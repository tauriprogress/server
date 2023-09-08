import environment from "../environment";
import {
    Difficulty,
    Faction,
    RaidLog,
    RaidLogWithRealm,
    Realm,
    TrimmedLog,
    ValidMember,
} from "../types";
import { CombatMetric } from "./../types/global/index";
import documentManager, {
    GuildDocumentController,
    RaidBossDocumentController,
} from "./documents";
import {
    CharacterDocument,
    characterOfRaidBoss,
} from "./documents/characterOfRaidBoss";
import WeeklyFullClearDocumentController from "./documents/weeklyFullClear";
import id, { CharacterId, GuildId, RaidBossId } from "./id";
import raid from "./raid";
import time from "./time";

interface RaidBosses {
    [raidBossId: RaidBossId]: RaidBossDocumentController;
}

interface Guilds {
    [guildId: GuildId]: GuildDocumentController;
}

interface CharacterDocumentsOfRaidBoss {
    [characterId: CharacterId]: CharacterDocument;
}

interface RaidBossesForCharacters {
    [raidBossId: RaidBossId]: CharactersOfRaidBoss;
}

class Weekly {
    isValidLog(log: RaidLogWithRealm) {
        const logWednesday = time.getLatestWednesday(
            new Date(log.killtime * 1000)
        );
        const currentWednesday = time.getLatestWednesday();

        if (
            logWednesday !== currentWednesday ||
            log.map_id !== raid.getCurrentRaidId()
        ) {
            return false;
        }

        return true;
    }
}

class Log {
    weekly = new Weekly();
    sameMembers(
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

    logFaction(log: RaidLogWithRealm): Faction {
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

    trimLog({
        logId,
        isGuildKill,
        guildName,
        faction,
        fightLength,
        date,
        realm,
    }: {
        logId: number;
        isGuildKill: boolean;
        guildName: string | undefined;
        faction: Faction;
        fightLength: number;
        date: number;
        realm: Realm;
    }): TrimmedLog {
        return {
            id: logId,
            guild: { name: isGuildKill ? guildName : "Random", f: faction },
            fightLength: fightLength,
            realm: realm,
            date: date,
        };
    }

    processLogs(logs: Array<RaidLogWithRealm>) {
        let bosses: RaidBosses = {};
        let guilds: Guilds = {};
        let raidBossesForCharacters: RaidBossesForCharacters = {};
        let weeklyFullClearDocuments: WeeklyFullClearDocumentController[] = [];

        for (const log of logs) {
            const logId = log.log_id;
            const raidId = log.mapentry.id;
            const bossName = log.encounter_data.encounter_name;
            const difficulty = log.difficulty;
            const bossId = id.raidBossId(
                log.encounter_data.encounter_id,
                difficulty
            );
            const realm = log.realm;
            const fightLength = log.fight_time;
            const date = log.killtime;

            const guildName = log.guilddata.name;
            const isGuildKill = log.guildid && guildName ? true : false;
            const guildId =
                isGuildKill && guildName
                    ? id.guildId(guildName, realm)
                    : undefined;
            const guildFaction = log.guilddata.faction;

            const faction = guildFaction || this.logFaction(log);

            const trimmedLog = this.trimLog({
                logId,
                isGuildKill,
                guildName,
                faction,
                fightLength,
                date,
                realm,
            });

            if (!bosses[bossId]) {
                bosses[bossId] = new documentManager.raidBoss({
                    raidId,
                    bossId,
                    bossName,
                    difficulty,
                });
            }

            bosses[bossId].addLog(trimmedLog, realm, faction);

            if (!raidBossesForCharacters[bossId]) {
                raidBossesForCharacters[bossId] = new CharactersOfRaidBoss();
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

            if (this.weekly.isValidLog(log)) {
                const newDocument = new documentManager.weeklyFullClear(log);

                let added = false;

                for (let document of weeklyFullClearDocuments) {
                    if (document.isSameRaidGroup(newDocument.getDocument())) {
                        document.mergeDocument(newDocument.getDocument());
                        added = true;
                        break;
                    }
                }

                if (!added) {
                    weeklyFullClearDocuments.push(newDocument);
                }
            }

            for (let character of log.members) {
                if (!this.validMember(character)) continue;

                for (const combatMetric of environment.combatMetrics) {
                    if (
                        environment.isSpecCombatMetric(
                            character.spec,
                            combatMetric
                        )
                    ) {
                        const characterDocument = characterOfRaidBoss(
                            character,
                            realm,
                            log.log_id,
                            date,
                            log.fight_time,
                            combatMetric
                        );
                        const currentPerformance =
                            characterDocument[combatMetric] || 0;

                        const oldPerformance =
                            raidBossesForCharacters[
                                bossId
                            ].getCharacterPerformance(
                                characterDocument._id,
                                combatMetric
                            ) || 0;

                        if (currentPerformance > oldPerformance) {
                            raidBossesForCharacters[
                                bossId
                            ].addCharacterDocument(
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
            characterPerformanceOfBoss: raidBossesForCharacters,
            weeklyFullClearDocuments,
        };
    }

    private validMember(
        member: RaidLog["members"][number]
    ): member is ValidMember {
        if (member.spec) {
            return true;
        }
        return false;
    }
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

export const log = new Log();

export default log;
