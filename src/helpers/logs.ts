import * as fs from "fs";

import { once } from "events";
import { createInterface } from "readline";
import environment from "../environment";
import {
    addNestedObjectValue,
    validRaidName,
    getDefaultBoss,
    getDefaultGuild,
    getDefaultGuildBoss,
    getLogFaction,
    getNestedObjectValue,
    getCharacterId,
    unshiftDateDay,
    guildRecentKills,
    getGuildId,
    sameMembers,
    getRaidBossId,
    ensureFile,
    validRaidLog,
    createCharacterDocument,
    getLatestWednesday,
} from "../helpers";
import tauriApi from "../tauriApi";
import {
    LastLogIds,
    LastRaidLogWithRealm,
    LooseObject,
    RaidLogWithRealm,
    Guild,
    Character,
    RaidBoss,
    GuildRankingFull,
    GuildDocument,
    Difficulty,
    Faction,
    Realm,
    TrimmedLog,
    RaidBossDocument,
    CharacterPerformanceOfBoss,
} from "../types";
import { ERR_FILE_DOES_NOT_EXIST } from "../helpers/errors";

import { pathToLastLogIds, pathToLogs } from "../constants";
import { raidBossId } from "./ids";
import { createRaidBossDocument } from "./documents";

export async function getLogs(lastLogIds: LastLogIds): Promise<{
    logs: RaidLogWithRealm[];
    lastLogIds: { [propName: string]: number };
}> {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs: Array<LastRaidLogWithRealm> = [];
            let logs: Array<RaidLogWithRealm> = [];
            let newLastLogIds: LastLogIds = {};

            for (const realmName of Object.values(environment.realms)) {
                const lastLogId = lastLogIds[realmName];
                const data = await tauriApi.getRaidLastLogs(
                    lastLogId || 0,
                    realmName
                );

                unfilteredLogs = unfilteredLogs.concat(
                    data.response.logs.map((log) => ({
                        ...log,
                        realm: realmName,
                        encounter_data: {
                            ...log.encounter_data,
                            encounter_name:
                                log.encounter_data.encounter_name.trim(),
                        },
                    }))
                );
            }

            for (let log of unfilteredLogs.sort((a, b) =>
                a.killtime < b.killtime ? -1 : 1
            )) {
                if (validRaidLog(log)) {
                    const logData = await tauriApi.getRaidLog(
                        log.log_id,
                        log.realm
                    );

                    logs.push({
                        ...logData.response,
                        realm: log.realm,
                        encounter_data: {
                            ...logData.response.encounter_data,
                            encounter_name:
                                logData.response.encounter_data.encounter_name.trim(),
                        },
                    });
                }

                newLastLogIds = addNestedObjectValue(
                    newLastLogIds,
                    [log.realm],
                    log.log_id
                );
            }

            resolve({
                logs,
                lastLogIds: { ...lastLogIds, ...newLastLogIds },
            });
        } catch (err) {
            reject(err);
        }
    });
}

export function processLogs(logs: Array<RaidLogWithRealm>) {
    let bosses: { [propName: string]: RaidBossDocument } = {};
    let guilds: {
        [propName: string]: GuildDocument;
    } = {};
    let defaultGuild = getDefaultGuild();

    let defaultGuildBoss = getDefaultGuildBoss();

    let characterPerformanceOfBoss: CharacterPerformanceOfBoss = {};

    for (const log of logs) {
        const logId = log.log_id;
        const raidName = log.mapentry.name;
        const raidId = log.mapentry.id;
        const bossName = log.encounter_data.encounter_name;
        const difficulty = log.difficulty;
        const bossId = raidBossId(log.encounter_data.encounter_id, difficulty);
        const realm = log.realm;
        const fightLength = log.fight_time;
        const date = log.killtime;

        const guildName = log.guilddata.name;
        const isGuildKill = log.guildid && guildName ? true : false;
        const guildId =
            isGuildKill && guildName ? getGuildId(guildName, realm) : undefined;
        const guildFaction = log.guilddata.faction;

        const faction = guildFaction || getLogFaction(log);

        const guildBossCategorization = [
            "progression",
            "raids",
            raidName,
            difficulty,
            bossName,
        ];

        const trimmedLog = trimLog(
            logId,
            isGuildKill,
            guildName,
            faction,
            fightLength,
            date,
            realm
        );

        // create boss
        if (!characterPerformanceOfBoss[bossId]) {
            characterPerformanceOfBoss[bossId] = { dps: {}, hps: {} };
        }

        if (!bosses[bossId]) {
            bosses[bossId] = createRaidBossDocument(
                raidId,
                bossId,
                bossName,
                difficulty
            );
        }

        // update boss
        bosses[bossId].killCount += 1;

        bosses[bossId].recentKills.unshift(trimmedLog);

        const logCategorization = [realm, faction];
        const categorizedFastestKills = getNestedObjectValue(
            bosses[bossId].fastestKills,
            logCategorization
        );
        if (!categorizedFastestKills) {
            bosses[bossId].fastestKills = addNestedObjectValue(
                bosses[bossId].fastestKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            bosses[bossId].fastestKills = addNestedObjectValue(
                bosses[bossId].fastestKills,
                logCategorization,
                categorizedFastestKills.concat(trimmedLog)
            );
        }

        const categorizedFirstKills = getNestedObjectValue(
            bosses[bossId].firstKills,
            logCategorization
        );
        if (!categorizedFirstKills) {
            bosses[bossId].firstKills = addNestedObjectValue(
                bosses[bossId].firstKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            bosses[bossId].firstKills = addNestedObjectValue(
                bosses[bossId].firstKills,
                logCategorization,
                categorizedFirstKills.concat(trimmedLog)
            );
        }

        if (isGuildKill && guildId) {
            // create guild
            if (!guilds[guildId]) {
                guilds[guildId] = {
                    ...JSON.parse(JSON.stringify(defaultGuild)),
                    _id: guildId,
                    name: guildName,
                    f: guildFaction,
                    realm: realm,
                };
            }

            // update guild
            guilds[guildId].activity[difficulty] = date;

            const logDate = new Date(date * 1000);
            guilds[guildId].raidDays.total[unshiftDateDay(logDate.getUTCDay())][
                logDate.getUTCHours()
            ] += 1;

            guilds[guildId].progression.latestKills.unshift({
                id: logId,
                date: date,
                boss: bossName,
                difficulty: difficulty,
            });

            // guild ranking
            const guildRankingFullClearCategory = [
                raidName,
                difficulty,
                "fullClear",
            ];

            const weekId = getLatestWednesday(logDate).getTime();

            let guildRankingFullClear = getNestedObjectValue(
                guilds[guildId].ranking,
                guildRankingFullClearCategory
            ) as GuildRankingFull | false;

            if (!guildRankingFullClear) {
                guildRankingFullClear = {
                    time: false,
                    logs: [],
                    weeks: {},
                };

                guildRankingFullClear.weeks[weekId] = [
                    {
                        members: log.members.map((member) => member.name),
                        logs: [
                            {
                                bossName: bossName,
                                date: date,
                                fightLength: fightLength,
                                id: logId,
                            },
                        ],
                    },
                ];
            } else if (!guildRankingFullClear.weeks[weekId]) {
                guildRankingFullClear.weeks[weekId] = [
                    {
                        members: log.members.map((member) => member.name),
                        logs: [
                            {
                                bossName: bossName,
                                date: date,
                                fightLength: fightLength,
                                id: logId,
                            },
                        ],
                    },
                ];
            } else {
                let logAddedToRanking = false;

                for (
                    let i = 0;
                    i < guildRankingFullClear.weeks[weekId].length;
                    i++
                ) {
                    let raidGroup = guildRankingFullClear.weeks[weekId][i];

                    const currentDifficulty = environment.difficultyNames[
                        String(
                            difficulty
                        ) as keyof typeof environment.difficultyNames
                    ].includes("10")
                        ? 10
                        : 25;

                    if (
                        sameMembers(
                            raidGroup.members,
                            log.members.map((member) => member.name),
                            currentDifficulty
                        )
                    ) {
                        logAddedToRanking = true;

                        raidGroup.logs.push({
                            bossName: bossName,
                            date: date,
                            fightLength: fightLength,
                            id: logId,
                        });

                        guildRankingFullClear.weeks[weekId][i] = raidGroup;

                        break;
                    }
                }

                if (!logAddedToRanking) {
                    guildRankingFullClear.weeks[weekId].push({
                        members: log.members.map((member) => member.name),
                        logs: [
                            {
                                bossName: bossName,
                                date: date,
                                fightLength: fightLength,
                                id: logId,
                            },
                        ],
                    });
                }
            }
            guilds[guildId].ranking = addNestedObjectValue(
                guilds[guildId].ranking,
                guildRankingFullClearCategory,
                guildRankingFullClear
            );

            let oldGuildBoss = getNestedObjectValue(
                guilds[guildId],
                guildBossCategorization
            );

            /* create guild boss */
            if (!oldGuildBoss) {
                guilds[guildId] = addNestedObjectValue(
                    guilds[guildId],
                    guildBossCategorization,
                    JSON.parse(JSON.stringify(defaultGuildBoss))
                ) as Guild;

                oldGuildBoss = getNestedObjectValue(
                    guilds[guildId],
                    guildBossCategorization
                );
            }

            /* update guild boss */
            guilds[guildId] = addNestedObjectValue(
                guilds[guildId],
                guildBossCategorization,
                {
                    ...oldGuildBoss,
                    killCount: oldGuildBoss.killCount + 1,
                    firstKill:
                        oldGuildBoss.firstKill === undefined
                            ? date
                            : date < oldGuildBoss.firstKill
                            ? date
                            : oldGuildBoss.firstKill,
                    fastestKills: [
                        ...oldGuildBoss.fastestKills,
                        {
                            id: logId,
                            fightLength: fightLength,
                            date: date,
                        },
                    ],
                }
            ) as Guild;
        }

        // process data of characters and save it to boss and guild data
        for (let character of log.members) {
            const characterId = getCharacterId(
                character.name,
                realm,
                character.spec
            );

            for (const combatMetric of ["dps", "hps"] as const) {
                if (
                    environment.specs[
                        String(character.spec) as keyof typeof environment.specs
                    ][
                        `is${
                            combatMetric === "dps" ? "Dps" : "Healer"
                        }` as keyof typeof environment.specs[keyof typeof environment.specs]
                    ]
                ) {
                    const characterDocument = createCharacterDocument(
                        character,
                        realm,
                        log.log_id,
                        date,
                        log.fight_time,
                        combatMetric
                    );

                    let combatMetricPerformance;

                    if (combatMetric === "dps") {
                        combatMetricPerformance =
                            character.dmg_done / (log.fight_time / 1000);
                    } else {
                        combatMetricPerformance =
                            (character.heal_done + character.absorb_done) /
                            (log.fight_time / 1000);
                    }

                    if (
                        !characterPerformanceOfBoss[bossId][combatMetric][
                            characterId
                        ] ||
                        combatMetricPerformance >
                            characterPerformanceOfBoss[bossId][combatMetric][
                                characterId
                            ][combatMetric]
                    ) {
                        characterPerformanceOfBoss[bossId][combatMetric][
                            characterId
                        ] = characterDocument;
                    }

                    const characterCategorization = [
                        realm,
                        characterDocument.f,
                        characterDocument.class,
                        characterDocument.spec,
                    ];

                    const bestOfNoCatKey =
                        combatMetric === "dps"
                            ? "bestDpsNoCat"
                            : "bestHpsNoCat";

                    const bestOf = bosses[bossId][bestOfNoCatKey];
                    const bestOfCombatMetric = bestOf && bestOf[combatMetric];

                    if (!bestOf || !bestOf[combatMetric]) {
                        bosses[bossId][bestOfNoCatKey] = characterDocument;
                    } else if (
                        bestOfCombatMetric &&
                        bestOfCombatMetric < combatMetricPerformance
                    ) {
                        bosses[bossId][bestOfNoCatKey] = characterDocument;
                    }

                    const bestOfKey =
                        combatMetric === "dps" ? "bestDps" : "bestHps";
                    let categorizedBestOf = getNestedObjectValue(
                        bosses[bossId][bestOfKey],
                        characterCategorization
                    ) as Character[];
                    let categorizedBestOfUpdated = false;

                    if (!categorizedBestOf) {
                        categorizedBestOfUpdated = true;
                        categorizedBestOf = [characterDocument];
                    } else {
                        const lastBestPerformance =
                            categorizedBestOf[categorizedBestOf.length - 1][
                                combatMetric
                            ];
                        const indexOfSameChar = categorizedBestOf.findIndex(
                            (data) => data._id === characterDocument._id
                        );

                        if (indexOfSameChar >= 0) {
                            const sameCharPerformance =
                                categorizedBestOf[indexOfSameChar][
                                    combatMetric
                                ];
                            if (
                                sameCharPerformance &&
                                combatMetricPerformance > sameCharPerformance
                            ) {
                                categorizedBestOf[indexOfSameChar] =
                                    characterDocument;
                                categorizedBestOfUpdated = true;
                            }
                        } else if (categorizedBestOf.length < 10) {
                            categorizedBestOf.push(characterDocument);
                            categorizedBestOfUpdated = true;
                        } else if (
                            lastBestPerformance &&
                            combatMetricPerformance > lastBestPerformance
                        ) {
                            categorizedBestOf.push(characterDocument);
                            categorizedBestOfUpdated = true;
                        }
                    }

                    if (categorizedBestOfUpdated) {
                        bosses[bossId][bestOfKey] = addNestedObjectValue(
                            bosses[bossId][bestOfKey],
                            characterCategorization,
                            categorizedBestOf
                                .sort(
                                    (a, b) =>
                                        (b[combatMetric] || 0) -
                                        (a[combatMetric] || 0)
                                )
                                .slice(0, 10)
                        );
                    }

                    if (isGuildKill && guildId) {
                        let oldCharacter = getNestedObjectValue(
                            guilds[guildId],
                            [
                                ...guildBossCategorization,
                                combatMetric,
                                characterId,
                            ]
                        );

                        if (
                            !oldCharacter ||
                            combatMetricPerformance > oldCharacter[combatMetric]
                        ) {
                            guilds[guildId] = addNestedObjectValue(
                                guilds[guildId],
                                [
                                    ...guildBossCategorization,
                                    combatMetric,
                                    characterId,
                                ],
                                characterDocument
                            ) as Guild;
                        }
                    }
                }
            }
        }
    }

    /* guilds: cut latestKills, cut fastestKills to 10 */
    for (const guildId in guilds) {
        guilds[guildId].progression.recentKills = guildRecentKills(
            guilds[guildId].progression.recentKills
        );

        for (const raidName in guilds[guildId].progression.raids) {
            if (validRaidName(raidName)) {
                for (const difficulty in guilds[guildId].progression.raids[
                    raidName
                ]) {
                    for (const bossName in guilds[guildId].progression.raids[
                        raidName
                    ][difficulty]) {
                        guilds[guildId].progression.raids[raidName][difficulty][
                            bossName
                        ].fastestKills = guilds[guildId].progression.raids[
                            raidName
                        ][difficulty][bossName].fastestKills
                            .sort((a, b) => a.fightLength - b.fightLength)
                            .slice(0, 10);
                    }
                }
            }
        }
    }

    return {
        guilds,
        bosses,
        combatMetrics: characterPerformanceOfBoss,
    };
}

export async function loadLogsFromFile(): Promise<RaidLogWithRealm[]> {
    return new Promise(async (resolve, reject) => {
        try {
            if (!fs.existsSync(pathToLogs)) {
                throw ERR_FILE_DOES_NOT_EXIST;
            }

            let logs: RaidLogWithRealm[] = [];

            const rl = createInterface({
                input: fs.createReadStream(pathToLogs),
                crlfDelay: Infinity,
            });

            rl.on("line", (line) => {
                logs.push(JSON.parse(line));
            });

            await once(rl, "close");

            resolve(logs);
        } catch (err) {
            reject(err);
        }
    });
}

export function getLastLogsIdsFromFile(): LastLogIds {
    ensureFile(pathToLastLogIds);

    try {
        return JSON.parse(fs.readFileSync(pathToLastLogIds, "utf-8"));
    } catch (err) {
        console.log(err);
        return {};
    }
}

export function updateLastLogIdsOfFile(newIds: LastLogIds) {
    const oldIds = getLastLogsIdsFromFile();

    fs.writeFileSync(
        pathToLastLogIds,
        JSON.stringify({ ...oldIds, ...newIds })
    );
}

export function writeLogsToFile(logs: RaidLogWithRealm[], filePath?: string) {
    let path = filePath || pathToLogs;
    ensureFile(path);
    const writer = fs.createWriteStream(path, {
        flags: "a",
    });
    for (let i = 0; i < logs.length; i++) {
        writeLogToFile(writer, logs[i]);
    }
}

export function writeLogToFile(
    writer: fs.WriteStream,
    log: RaidLogWithRealm
): void {
    writer.write(JSON.stringify(log) + "\r\n");
}

export function trimLog(
    logId: number,
    isGuildKill: boolean,
    guildName: string | undefined,
    faction: Faction,
    fightLength: number,
    date: number,
    realm: Realm
): TrimmedLog {
    return {
        id: logId,
        guild: isGuildKill ? { name: guildName, f: faction } : undefined,
        fightLength: fightLength,
        realm: realm,
        date: date,
    };
}
