import { environment } from "../environment";
import {
    addNestedObjectValue,
    validBossName,
    validDifficulty,
    validRaidName,
    getDefaultBoss,
    getDefaultGuild,
    getDefaultGuildBoss,
    getLogFaction,
    getNestedObjectValue,
    getCharacterId,
    unshiftDateDay,
    guildRecentKills,
    getGuildId
} from "../helpers";
import tauriApi from "../tauriApi";
import {
    LastLogIds,
    LastRaidLogWithRealm,
    LooseObject,
    RaidLogWithRealm,
    Guild,
    Character,
    RaidBoss
} from "../types";

export async function getLogs(
    lastLogIds: LastLogIds
): Promise<{
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
                    lastLogId | 0,
                    realmName
                );

                unfilteredLogs = unfilteredLogs.concat(
                    data.response.logs.map(log => ({
                        ...log,
                        realm: realmName,
                        encounter_data: {
                            ...log.encounter_data,
                            encounter_name: log.encounter_data.encounter_name.trim()
                        }
                    }))
                );
            }

            for (let log of unfilteredLogs.sort((a, b) =>
                a.killtime < b.killtime ? -1 : 1
            )) {
                if (
                    validRaidName(log.mapentry.name) &&
                    validDifficulty(log.mapentry.id, log.difficulty) &&
                    validBossName(
                        log.mapentry.id,
                        log.encounter_data.encounter_name
                    ) &&
                    log.fight_time > 10000
                ) {
                    const logData = await tauriApi.getRaidLog(
                        log.log_id,
                        log.realm
                    );

                    logs.push({
                        ...logData.response,
                        realm: log.realm,
                        encounter_data: {
                            ...logData.response.encounter_data,
                            encounter_name: logData.response.encounter_data.encounter_name.trim()
                        }
                    });

                    newLastLogIds = addNestedObjectValue(
                        newLastLogIds,
                        [log.realm],
                        log.log_id
                    );
                }
            }

            resolve({
                logs,
                lastLogIds: { ...lastLogIds, ...newLastLogIds }
            });
        } catch (err) {
            reject(err);
        }
    });
}

export function processLogs(logs: Array<RaidLogWithRealm>) {
    let bosses: { [propName: string]: RaidBoss } = {};
    let defaultBoss = getDefaultBoss();
    let guilds: {
        [propName: string]: Guild;
    } = {};
    let defaultGuild = getDefaultGuild();

    let defaultGuildBoss = getDefaultGuildBoss();

    let combatMetrics: LooseObject = {};
    let defaultCombatMetricBoss = { dps: {}, hps: {} };

    for (const log of logs) {
        const logId = log.log_id;
        const raidName = log.mapentry.name;
        const raidId = log.mapentry.id;
        const bossName = log.encounter_data.encounter_name;
        const difficulty = Number(log.difficulty);
        const bossId = `${log.encounter_data.encounter_id} ${difficulty}`;
        const realm = log.realm as keyof typeof environment.shortRealms;
        const faction = getLogFaction(log);
        const fightLength = log.fight_time;
        const date = log.killtime;

        const guildName = log.guilddata.name;
        const isGuildKill = log.guildid && guildName ? true : false;
        const guildId =
            isGuildKill && guildName ? getGuildId(guildName, realm) : undefined;
        const guildFaction = log.guilddata.faction;
        const guildBossCategorization = [
            "progression",
            raidName,
            difficulty,
            bossName
        ];

        const trimmedLog = {
            id: logId,
            guild: isGuildKill
                ? { name: guildName || undefined, f: faction as 0 | 1 }
                : undefined,
            fightLength: fightLength,
            realm: realm,
            date: date
        };

        // create boss
        // in combatMetrics first
        if (!combatMetrics[bossId]) {
            combatMetrics[bossId] = JSON.parse(
                JSON.stringify(defaultCombatMetricBoss)
            );
        }

        if (!bosses[bossId]) {
            bosses[bossId] = {
                ...JSON.parse(JSON.stringify(defaultBoss)),
                _id: bossId,
                raidId: raidId,
                name: bossName,
                difficulty: difficulty
            };
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
                    realm: realm
                };
            }

            // update guild
            guilds[guildId].activity[difficulty] = date;

            const logDate = new Date(date * 1000);
            guilds[guildId].raidDays.total[unshiftDateDay(logDate.getDay())][
                logDate.getHours()
            ] += 1;

            guilds[guildId].progression.recentKills.unshift({
                id: logId,
                date: date,
                boss: bossName,
                difficulty: difficulty
            });

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
                        oldGuildBoss.firstKill === false
                            ? date
                            : date < oldGuildBoss.firstKill
                            ? date
                            : oldGuildBoss.firstKill,
                    fastestKills: [
                        ...oldGuildBoss.fastestKills,
                        {
                            id: logId,
                            fightLength: fightLength,
                            date: date
                        }
                    ]
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
                    let characterData: Character = {
                        _id: characterId,
                        realm: environment.shortRealms[realm],
                        class: character.spec
                            ? environment.characterSpecToClass[
                                  String(
                                      character.spec
                                  ) as keyof typeof environment.characterSpecToClass
                              ]
                            : character.class,
                        name: character.name,
                        spec: character.spec,
                        ilvl: character.ilvl,
                        date: date,
                        logId: log.log_id,
                        f: environment.characterRaceToFaction[
                            String(
                                character.race
                            ) as keyof typeof environment.characterRaceToFaction
                        ] as 0 | 1
                    };

                    let combatMetricPerformance;

                    if (combatMetric === "dps") {
                        combatMetricPerformance =
                            character.dmg_done / (log.fight_time / 1000);
                        characterData["dps"] = combatMetricPerformance;
                    } else {
                        combatMetricPerformance =
                            (character.heal_done + character.absorb_done) /
                            (log.fight_time / 1000);
                        characterData["hps"] = combatMetricPerformance;
                    }

                    if (
                        !combatMetrics[bossId][combatMetric][characterId] ||
                        combatMetricPerformance >
                            combatMetrics[bossId][combatMetric][characterId][
                                combatMetric
                            ]
                    ) {
                        combatMetrics[bossId][combatMetric][
                            characterId
                        ] = characterData;
                    }

                    const characterCategorization = [
                        realm,
                        characterData.f,
                        characterData.class,
                        characterData.spec
                    ];

                    const bestOfNoCatKey =
                        combatMetric === "dps"
                            ? "bestDpsNoCat"
                            : "bestHpsNoCat";

                    const bestOf = bosses[bossId][bestOfNoCatKey];
                    const bestOfCombatMetric = bestOf && bestOf[combatMetric];

                    if (!bestOf || !bestOf[combatMetric]) {
                        bosses[bossId][bestOfNoCatKey] = characterData;
                    } else if (
                        bestOfCombatMetric &&
                        bestOfCombatMetric < combatMetricPerformance
                    ) {
                        bosses[bossId][bestOfNoCatKey] = characterData;
                    }

                    const bestOfKey =
                        combatMetric === "dps" ? "bestDps" : "bestHps";
                    const categorizedBestOf = getNestedObjectValue(
                        bosses[bossId][bestOfKey],
                        characterCategorization
                    ) as Character[];

                    if (!categorizedBestOf) {
                        bosses[bossId][bestOfKey] = addNestedObjectValue(
                            bosses[bossId][bestOfKey],
                            characterCategorization,
                            [characterData]
                        );
                    } else {
                        const lastBestPerformance =
                            categorizedBestOf[categorizedBestOf.length - 1][
                                combatMetric
                            ];

                        if (
                            lastBestPerformance &&
                            combatMetricPerformance > lastBestPerformance
                        ) {
                            const indexOfSameChar = categorizedBestOf.findIndex(
                                data => data._id === characterData._id
                            );

                            if (indexOfSameChar >= 0) {
                                const sameCharPerformance =
                                    categorizedBestOf[indexOfSameChar][
                                        combatMetric
                                    ];
                                if (
                                    sameCharPerformance &&
                                    combatMetricPerformance >
                                        sameCharPerformance
                                ) {
                                    categorizedBestOf[
                                        indexOfSameChar
                                    ] = characterData;

                                    categorizedBestOf
                                        .sort(
                                            (a, b) =>
                                                (b[combatMetric] || 0) -
                                                (a[combatMetric] || 0)
                                        )
                                        .slice(0, 10);
                                }
                            } else {
                                bosses[bossId][
                                    bestOfKey
                                ] = addNestedObjectValue(
                                    bosses[bossId][bestOfKey],
                                    characterCategorization,
                                    categorizedBestOf
                                        .concat(characterData)
                                        .sort(
                                            (a, b) =>
                                                (b[combatMetric] || 0) -
                                                (a[combatMetric] || 0)
                                        )
                                        .slice(0, 10)
                                );
                            }
                        }
                    }

                    if (isGuildKill && guildId) {
                        let oldCharacter = getNestedObjectValue(
                            guilds[guildId],
                            [
                                ...guildBossCategorization,
                                combatMetric,
                                characterId
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
                                    characterId
                                ],
                                characterData
                            ) as Guild;
                        }
                    }
                }
            }
        }
    }

    /* bosses: cut latestKills to 50, cut fastestKills of each category to 50, cut firstkills to 3 */
    for (const bossId in bosses) {
        bosses[bossId].recentKills = bosses[bossId].recentKills.slice(0, 50);

        for (const realm in bosses[bossId].fastestKills) {
            for (const faction in bosses[bossId].fastestKills[realm]) {
                const categorization = [realm, faction];
                bosses[bossId].fastestKills = addNestedObjectValue(
                    bosses[bossId].fastestKills,
                    categorization,
                    (getNestedObjectValue(
                        bosses[bossId].fastestKills,
                        categorization
                    ) as RaidBoss["fastestKills"][string][number])
                        .sort((a, b) => a.fightLength - b.fightLength)
                        .slice(0, 50)
                );
            }
        }

        for (const realm in bosses[bossId].firstKills) {
            for (const faction in bosses[bossId].firstKills[realm]) {
                const categorization = [realm, faction];
                bosses[bossId].firstKills = addNestedObjectValue(
                    bosses[bossId].firstKills,
                    categorization,
                    (getNestedObjectValue(
                        bosses[bossId].firstKills,
                        categorization
                    ) as RaidBoss["firstKills"][string][number])
                        .sort((a, b) => a.date - b.date)
                        .slice(0, 3)
                );
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
        combatMetrics
    };
}
