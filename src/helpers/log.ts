import { once } from "events";
import * as fs from "fs";
import { createInterface } from "readline";
import environment from "../environment";
import tauriApi from "../tauriApi";
import {
    Difficulty,
    Faction,
    LastRaidLogWithRealm,
    RaidLog,
    RaidLogWithRealm,
    Realm,
    TrimmedLog,
    ValidMember,
} from "../types";
import { CombatMetric, LooseObject } from "./../types/global/index";
import documentManager, {
    GuildDocumentController,
    RaidBossDocumentController,
    WeeklyGuildFullClearDocumentController,
} from "./documents";
import { CharacterDocument } from "./documents/character";
import { ERR_FILE_DOES_NOT_EXIST } from "./errors";
import id, { CharacterId, GuildId, RaidBossId } from "./id";
import time from "./time";
import { ensureFile } from "./utils";
import validator from "./validators";
import WeeklyChallengeDocumentController from "./documents/weeklyChallenge";

export interface RaidBosses {
    [raidBossId: RaidBossId]: RaidBossDocumentController;
}

interface Guilds {
    [guildId: GuildId]: GuildDocumentController;
}

interface CharacterDocumentsOfRaidBoss {
    [characterId: CharacterId]: CharacterDocument;
}

interface CharacterCollection {
    [raidBossId: RaidBossId]: CharactersOfRaidBoss;
}

export type LastLogIds = {
    [K in Realm]?: number;
};

export type WeeklyChallengeControllers = {
    [key in Difficulty]?: WeeklyChallengeDocumentController;
};

function isValidWeeklyLog(log: RaidLogWithRealm) {
    const logWednesday = time
        .getLatestWednesday(new Date(log.killtime * 1000))
        .getTime();
    const currentWednesday = time.getLatestWednesday().getTime();

    if (
        logWednesday !== currentWednesday ||
        log.map_id !== environment.getCurrentRaidId()
    ) {
        return false;
    }

    return true;
}

function sameMembers(
    members1: string[],
    members2: string[],
    difficulty: Difficulty
): boolean {
    const diffNum = environment.difficultyNames[
        difficulty as keyof typeof environment.difficultyNames
    ].includes("10")
        ? 10
        : 25;

    let memberContainer: { [propName: string]: boolean } = {};
    let sameMemberCount = 0;

    for (let name of members1) {
        memberContainer[name] = true;
    }

    for (let name of members2) {
        if (memberContainer[name]) {
            sameMemberCount++;
        }
    }

    return diffNum * 0.8 <= sameMemberCount;
}

function uniqueLogs<T extends { id: number }>(logs: T[]): T[] {
    let logIds: LooseObject = {};
    const uniqueLogs: T[] = [];

    for (const log of logs) {
        if (!logIds[log.id]) {
            logIds[log.id] = true;
            uniqueLogs.push(log);
        }
    }
    return uniqueLogs;
}

function logFaction(log: RaidLogWithRealm): Faction {
    if (log.guilddata.faction) {
        return log.guilddata.faction;
    }

    let alliance = 0;
    let horde = 0;
    for (let member of log.members) {
        const race = member.race;

        if (environment.characterRaceFaction[race] === 0) {
            alliance++;
        } else {
            horde++;
        }
    }

    return horde > alliance ? 1 : 0;
}

function trimLog(raidLog: RaidLogWithRealm): TrimmedLog {
    return {
        id: raidLog.log_id,
        guild: {
            name: raidLog.guilddata.name || "Random",
            f: logFaction(raidLog),
        },
        fightLength: raidLog.fight_time,
        realm: raidLog.realm,
        date: raidLog.killtime,
    };
}

async function requestRaidLogs(lastLogIds: LastLogIds): Promise<{
    logs: RaidLogWithRealm[];
    lastLogIds: LastLogIds;
}> {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs: Array<LastRaidLogWithRealm> = [];
            let logs: Array<RaidLogWithRealm> = [];
            let newLastLogIds: LastLogIds = {};

            for (const realmName of environment.realms) {
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
                if (validator.validRaidLog(log)) {
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

                newLastLogIds[log.realm] = log.log_id;
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

function processLogs(
    logs: Array<RaidLogWithRealm>,
    weeklyChallengeRaidBossName?: string
) {
    let bosses: RaidBosses = {};
    let guilds: Guilds = {};
    let characterCollection: CharacterCollection = {};
    let weeklyFullClearCollection: WeeklyGuildFullClearDocumentController[] =
        [];

    let weeklyChallenge: WeeklyChallengeControllers = {};

    for (const log of logs) {
        const raidId = log.mapentry.id;
        const bossName = log.encounter_data.encounter_name;
        const difficulty = log.difficulty;
        const bossId = id.raidBossId(
            log.encounter_data.encounter_id,
            difficulty
        );
        const realm = log.realm;
        const date = log.killtime;

        const guildName = log.guilddata.name;
        const isGuildKill = log.guildid && guildName ? true : false;
        const guildId =
            isGuildKill && guildName ? id.guildId(guildName, realm) : undefined;

        const faction = logFaction(log);
        const trimmedLog = trimLog(log);

        if (!bosses[bossId]) {
            bosses[bossId] = new documentManager.raidBoss({
                raidId,
                bossId,
                bossName,
                difficulty,
            });
        }

        bosses[bossId].addLog(trimmedLog, realm, faction);

        if (!characterCollection[bossId]) {
            characterCollection[bossId] = new CharactersOfRaidBoss();
        }

        if (isGuildKill && guildId && guildName) {
            if (!guilds[guildId]) {
                guilds[guildId] = new documentManager.guild({
                    guildName,
                    realm,
                    faction,
                });
            }

            guilds[guildId].addLog(log);
        }

        if (isValidWeeklyLog(log)) {
            const newDocument = new documentManager.weeklyGuildFullClear(log);

            let added = false;

            for (let document of weeklyFullClearCollection) {
                if (document.isSameRaidGroup(newDocument.getDocument())) {
                    document.mergeDocument(newDocument.getDocument());
                    added = true;
                    break;
                }
            }

            if (!added) {
                weeklyFullClearCollection.push(newDocument);
            }

            if (weeklyChallengeRaidBossName === bossName) {
                if (!weeklyChallenge[difficulty]) {
                    weeklyChallenge[difficulty] =
                        new documentManager.weeklyChallenge({
                            bossName: weeklyChallengeRaidBossName,
                            difficulty,
                        });
                }

                if (weeklyChallenge[difficulty]?.isChallengeLog(log)) {
                    weeklyChallenge[difficulty]?.addLog(log);
                }
            }
        }

        for (let character of log.members) {
            if (!validMember(character)) continue;

            for (const combatMetric of environment.combatMetrics) {
                if (
                    environment.isSpecCombatMetric(character.spec, combatMetric)
                ) {
                    const characterDocument = documentManager.character({
                        character,
                        realm,
                        logId: log.log_id,
                        date,
                        fightTime: log.fight_time,
                        combatMetric,
                    });
                    const currentPerformance =
                        characterDocument[combatMetric] || 0;

                    const oldPerformance =
                        characterCollection[bossId].getCharacterPerformance(
                            characterDocument._id,
                            combatMetric
                        ) || 0;

                    if (currentPerformance > oldPerformance) {
                        characterCollection[bossId].addCharacterDocument(
                            characterDocument,
                            combatMetric
                        );
                    }

                    bosses[bossId].addCharacterDocument(
                        characterDocument,
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
        characterCollection,
        weeklyFullClearCollection,
        weeklyChallenge,
    };
}

function filterRaidLogBugs(logs: RaidLogWithRealm[]): RaidLogWithRealm[] {
    return logs.reduce((acc, log) => {
        let fixedLog: RaidLogWithRealm = JSON.parse(JSON.stringify(log));

        for (const bug of environment.logBugs) {
            switch (bug.type) {
                case "ignoreLogOfId":
                    if (
                        bug.id === fixedLog.log_id &&
                        bug.realm === fixedLog.realm
                    ) {
                        return acc;
                    }
                    break;
                case "ignoreBossOfDate":
                    if (
                        bug.bossId === fixedLog.encounter_data.encounter_id &&
                        bug.date.from < fixedLog.killtime &&
                        bug.date.to > fixedLog.killtime
                    ) {
                        return acc;
                    }
                    break;
                case "changeSpecDmgDoneOfDate":
                    fixedLog.members = fixedLog.members.map((member: any) => {
                        if (
                            member.spec === bug.specId &&
                            bug.date.from < fixedLog.killtime &&
                            bug.date.to > fixedLog.killtime
                        ) {
                            return {
                                ...member,
                                dmg_done: bug.changeTo,
                            };
                        }
                        return member;
                    });

                    break;
                case "ignoreLogOfCharacter":
                    for (const member of fixedLog.members) {
                        if (
                            bug.name === member.name &&
                            bug.realm === fixedLog.realm
                        ) {
                            return acc;
                        }
                    }

                    break;
                case "overwriteSpecOfCharacter":
                    if (
                        bug.logId === fixedLog.log_id &&
                        bug.realm === fixedLog.realm
                    ) {
                        fixedLog.members = fixedLog.members.map(
                            (member: any) => {
                                if (bug.characterName === member.name) {
                                    return {
                                        ...member,
                                        spec: bug.specId,
                                    };
                                }
                                return member;
                            }
                        );
                    }
                    break;

                case "ignoreCharacter":
                    fixedLog.members = fixedLog.members.filter((member) => {
                        if (
                            bug.name === member.name &&
                            bug.realm === fixedLog.realm
                        ) {
                            return false;
                        }
                        return true;
                    });
                    break;
                case "changeKilltimeOfLog":
                    if (bug.id === fixedLog.log_id) {
                        fixedLog.killtime = bug.changeTo;
                    }
                    break;

                case "changeGuildData":
                    if (bug.guildIds[fixedLog.guildid]) {
                        fixedLog.guilddata = bug.changeTo;
                        fixedLog.guildid = bug.id;
                    }
                    break;
                case "removeCharacterFromLogs":
                    fixedLog.members = fixedLog.members.map((member) => {
                        if (
                            bug.characterName === member.name &&
                            bug.realm === fixedLog.realm &&
                            bug.date.from < fixedLog.killtime &&
                            bug.date.to > fixedLog.killtime
                        ) {
                            member.dmg_done = 1;
                            member.absorb_done = 1;
                            member.dmg_absorb = 1;
                            member.heal_done = 1;
                        }
                        return member;
                    });
                    break;
            }
        }

        acc.push(fixedLog);

        return acc;
    }, [] as RaidLogWithRealm[]);
}

function validMember(
    member: RaidLog["members"][number]
): member is ValidMember {
    if (member.spec) {
        return true;
    }
    return false;
}

function generateLastLogIds<T extends { log_id: number; realm: Realm }>(
    logs: T[]
) {
    let lastLogIds: LastLogIds = {};

    for (let log of logs) {
        lastLogIds[log.realm] = log.log_id;
    }

    return lastLogIds;
}

class CharactersOfRaidBoss {
    private dps: CharacterDocumentsOfRaidBoss;
    private hps: CharacterDocumentsOfRaidBoss;
    constructor() {
        this.dps = {};
        this.hps = {};
    }

    addCharacterDocument(
        document: CharacterDocument,
        combatMetric: CombatMetric
    ) {
        this[combatMetric][document._id] = document;
    }

    getCharacterPerformance(
        characterId: CharacterId,
        combatMetric: CombatMetric
    ) {
        if (!this[combatMetric][characterId]) {
            return undefined;
        }

        return this[combatMetric][characterId][combatMetric];
    }

    getData() {
        return {
            dps: this.dps,
            hps: this.hps,
        };
    }
}

class LogFileManager {
    private pathToLogs: string;
    private pathToLastLogIds: string;

    constructor(
        pathToLogs: string = environment.pathToLogs,
        pathToLastLogIds: string = environment.pathToLastLogIds
    ) {
        this.pathToLogs = pathToLogs;
        this.pathToLastLogIds = pathToLastLogIds;
    }

    areLogsPreserved(): boolean {
        return fs.existsSync(this.pathToLogs);
    }

    async getLogs(): Promise<RaidLogWithRealm[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.areLogsPreserved()) {
                    throw ERR_FILE_DOES_NOT_EXIST;
                }

                let logs: RaidLogWithRealm[] = [];

                const rl = createInterface({
                    input: fs.createReadStream(this.pathToLogs),
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

    getLastLogIds(): LastLogIds {
        ensureFile(this.pathToLastLogIds);

        try {
            return JSON.parse(fs.readFileSync(this.pathToLastLogIds, "utf-8"));
        } catch (err) {
            console.log(err);
            return {};
        }
    }

    async writeLogs(logs: RaidLogWithRealm[], optionalWriter?: fs.WriteStream) {
        ensureFile(this.pathToLogs);

        const writer =
            optionalWriter ||
            fs.createWriteStream(this.pathToLogs, {
                flags: "a",
            });

        for (let raidLog of logs) {
            await new Promise((resolve, reject) => {
                writer.write(JSON.stringify(raidLog) + "\r\n", (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(true);
                    }
                });
            });
            this.updateLastLogIdsOfFile(generateLastLogIds([raidLog]));
        }
    }

    private updateLastLogIdsOfFile(newIds: LastLogIds) {
        const oldIds = this.getLastLogIds();

        fs.writeFileSync(
            this.pathToLastLogIds,
            JSON.stringify({ ...oldIds, ...newIds })
        );
    }
}

export default {
    sameMembers,
    generateLastLogIds,
    uniqueLogs,
    logFaction,
    trimLog,
    requestRaidLogs,
    processLogs,
    validMember,
    fileManager: LogFileManager,
    filterRaidLogBugs,
};
