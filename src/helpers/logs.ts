import * as fs from "fs";

import { once } from "events";
import { createInterface } from "readline";
import environment from "../environment";
import {
    addNestedObjectValue,
    getLogFaction,
    getCharacterId,
    getGuildId,
    ensureFile,
    validRaidLog,
    createCharacterDocument,
} from "../helpers";
import tauriApi from "../tauriApi";
import {
    LastLogIds,
    LastRaidLogWithRealm,
    RaidLogWithRealm,
    GuildDocument,
    Faction,
    Realm,
    TrimmedLog,
    RaidBossDocument,
    CharacterPerformanceOfBoss,
} from "../types";
import { ERR_FILE_DOES_NOT_EXIST } from "../helpers/errors";

import { pathToLastLogIds, pathToLogs } from "../constants";
import { raidBossId } from "./ids";
import {
    addCharacterDocumentToRaidBossDocument,
    addLogToGuildDocument,
    addLogToRaidBossDocument,
    createGuildDocument,
    createRaidBossDocument,
} from "./documents";

export async function getLogs(lastLogIds: LastLogIds): Promise<{
    logs: RaidLogWithRealm[];
    lastLogIds: LastLogIds;
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

        const trimmedLog = trimLog(
            logId,
            isGuildKill,
            guildName,
            faction,
            fightLength,
            date,
            realm
        );

        if (!bosses[bossId]) {
            bosses[bossId] = createRaidBossDocument(
                raidId,
                bossId,
                bossName,
                difficulty
            );
        }

        bosses[bossId] = addLogToRaidBossDocument(
            bosses[bossId],
            trimmedLog,
            realm,
            faction
        );

        if (!characterPerformanceOfBoss[bossId]) {
            characterPerformanceOfBoss[bossId] = { dps: {}, hps: {} };
        }

        if (isGuildKill && guildId && guildName) {
            if (!guilds[guildId]) {
                guilds[guildId] = createGuildDocument(
                    guildName,
                    realm,
                    faction
                );
            }

            guilds[guildId] = addLogToGuildDocument(
                guilds[guildId],
                log,
                raidName,
                logId,
                bossName,
                difficulty,
                date,
                fightLength
            );
        }

        for (let character of log.members) {
            const characterId = getCharacterId(
                character.name,
                realm,
                character.spec
            );

            for (const combatMetric of ["dps", "hps"] as const) {
                if (
                    environment.specs[
                        character.spec as keyof typeof environment.specs
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

                    if (
                        !characterPerformanceOfBoss[bossId][combatMetric][
                            characterId
                        ] ||
                        characterDocument[combatMetric] >
                            characterPerformanceOfBoss[bossId][combatMetric][
                                characterId
                            ][combatMetric]
                    ) {
                        characterPerformanceOfBoss[bossId][combatMetric][
                            characterId
                        ] = characterDocument;
                    }

                    bosses[bossId] = addCharacterDocumentToRaidBossDocument(
                        characterDocument,
                        bosses[bossId],
                        combatMetric,
                        realm
                    );
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
