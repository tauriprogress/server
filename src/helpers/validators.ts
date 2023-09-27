import environment from "../environment";
import { Difficulty, LastRaidLogWithRealm, Realm, ShortRealm } from "../types";

class Validator {
    validFilters(raidId: number, filters: any) {
        if (
            typeof filters === "object" &&
            filters !== null &&
            !Array.isArray(filters)
        ) {
            if (
                filters.difficulty === undefined ||
                !this.validDifficulty(raidId, filters.difficulty)
            ) {
                return false;
            }

            if (
                filters.realm !== undefined &&
                !this.validRealm(filters.realm)
            ) {
                return false;
            }

            if (
                filters.class !== undefined &&
                !this.validClass(filters.class)
            ) {
                return false;
            }

            if (filters.spec !== undefined && !this.validSpec(filters.spec)) {
                return false;
            }

            if (
                filters.role !== undefined &&
                !validator.validRole(filters.role)
            ) {
                return false;
            }

            if (
                filters.faction !== undefined &&
                !this.validFaction(filters.faction)
            ) {
                return false;
            }

            return true;
        }

        return false;
    }
    validRaidLog(log: LastRaidLogWithRealm) {
        if (
            this.validRaidLogDate(new Date(log.killtime * 1000)) &&
            this.validRaidName(log.mapentry.name) &&
            this.validDifficulty(log.mapentry.id, log.difficulty) &&
            this.validBossName(
                log.mapentry.id,
                log.encounter_data.encounter_name
            ) &&
            log.fight_time > 10000
        ) {
            return true;
        }
        return false;
    }

    validRaidLogDate(date: Date) {
        if (!environment.seasonal) {
            return true;
        }

        const currentSeason = environment.getCurrentSeason();

        if (currentSeason) {
            const time = date.getTime();

            const start = new Date(currentSeason.start).getTime();
            const finish = new Date(currentSeason.finish).getTime();

            if (time > start && time < finish) {
                return true;
            }
        }

        return false;
    }

    validRaidId(raidId: any) {
        if (typeof raidId === "number") {
            for (const raid of environment.currentContent.raids) {
                if (raid.id === raidId) {
                    return true;
                }
            }
        }

        return false;
    }

    validShortRealm(shortRealm: any) {
        return (
            typeof shortRealm === "string" &&
            Object.values(environment.shortRealms).includes(
                shortRealm as ShortRealm
            )
        );
    }

    validRealm(realm: any) {
        return (
            typeof realm === "string" &&
            Object.values(environment.realms).includes(realm as Realm)
        );
    }

    validClass(characterClass: any) {
        return (
            typeof characterClass === "number" &&
            environment.characterClassNames.hasOwnProperty(characterClass)
        );
    }

    validSpec(characterSpec: any) {
        return (
            typeof characterSpec === "number" &&
            environment.specs.hasOwnProperty(characterSpec)
        );
    }

    validRole(role: any) {
        return (
            typeof role === "string" &&
            (role === "damage" || role === "heal" || role === "tank")
        );
    }

    validFaction(faction: any) {
        return typeof faction === "number" && (faction === 0 || faction === 1);
    }

    validRaidName(raidName: any) {
        if (typeof raidName === "string") {
            for (const raid of environment.currentContent.raids) {
                if (raid.name === raidName) {
                    return true;
                }
            }
        }
        return false;
    }

    validBossName(raidId: any, bossName: any) {
        if (typeof raidId === "number" && typeof bossName === "string") {
            for (const raid of environment.currentContent.raids) {
                if (raid.id === raidId) {
                    for (const boss of raid.bosses) {
                        if (boss.name === bossName) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    validIngameBossId(ingameBossId: number, difficulty: Difficulty): boolean {
        if (typeof ingameBossId !== "number" || typeof difficulty !== "number")
            return false;

        for (const raid of environment.currentContent.raids) {
            for (const boss of raid.bosses) {
                const diff = difficulty as keyof typeof boss.bossIdOfDifficulty;
                if (!boss.bossIdOfDifficulty[diff]) continue;
                if (boss.bossIdOfDifficulty[diff] === ingameBossId) {
                    return true;
                }
            }
        }

        return false;
    }

    validDifficulty(raidId: any, difficulty: any) {
        if (typeof raidId === "number" && typeof difficulty === "number") {
            for (const raid of environment.currentContent.raids) {
                if (raid.id === raidId) {
                    for (const raidDifficulty of raid.difficulties) {
                        if (difficulty === raidDifficulty) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    validCombatMetric(combatMetric: any) {
        return (
            typeof combatMetric === "string" &&
            (combatMetric === "dps" || combatMetric === "hps")
        );
    }

    validPage(page: any) {
        return typeof page === "number" && page >= 0;
    }

    validPageSize(pageSize: any) {
        return typeof pageSize === "number" && pageSize >= 1;
    }

    validGuildName(guildName: any) {
        return typeof guildName === "string";
    }

    validCharacterName(characterName: any) {
        return typeof characterName === "string";
    }

    validRaidLogId(logId: any) {
        return typeof logId === "number";
    }

    validLimit(limit: any) {
        return typeof limit === "number";
    }

    validItems(items: any) {
        return (
            Array.isArray(items) &&
            items.reduce((acc: boolean, curr: any) => {
                if (typeof curr.id !== "number") {
                    return false;
                }

                return acc;
            }, true)
        );
    }

    isError(variable: unknown): variable is Error {
        return variable instanceof Error;
    }
}

export const validator = new Validator();

export default validator;
