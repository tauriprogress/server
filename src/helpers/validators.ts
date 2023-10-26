import environment from "../environment";
import { Difficulty, LastRaidLogWithRealm, Realm, ShortRealm } from "../types";

function validFilters(raidId: number, filters: any) {
    if (
        typeof filters === "object" &&
        filters !== null &&
        !Array.isArray(filters)
    ) {
        if (
            filters.difficulty === undefined ||
            !validDifficulty(raidId, filters.difficulty)
        ) {
            return false;
        }

        if (filters.realm !== undefined && !validRealm(filters.realm)) {
            return false;
        }

        if (filters.class !== undefined && !validClass(filters.class)) {
            return false;
        }

        if (filters.spec !== undefined && !validSpec(filters.spec)) {
            return false;
        }

        if (filters.role !== undefined && !validRole(filters.role)) {
            return false;
        }

        if (filters.faction !== undefined && !validFaction(filters.faction)) {
            return false;
        }

        return true;
    }

    return false;
}
function validRaidLog(log: LastRaidLogWithRealm) {
    if (
        validRaidLogDate(new Date(log.killtime * 1000)) &&
        validRaidName(log.mapentry.name) &&
        validDifficulty(log.mapentry.id, log.difficulty) &&
        validBossName(log.mapentry.id, log.encounter_data.encounter_name) &&
        log.fight_time > 10000
    ) {
        return true;
    }
    return false;
}

function validRaidLogDate(date: Date) {
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

function validRaidId(raidId: any) {
    if (typeof raidId === "number") {
        for (const raid of environment.currentContent.raids) {
            if (raid.id === raidId) {
                return true;
            }
        }
    }

    return false;
}

function validShortRealm(shortRealm: any) {
    return (
        typeof shortRealm === "string" &&
        Object.values(environment.shortRealms).includes(
            shortRealm as ShortRealm
        )
    );
}

function validRealm(realm: any) {
    return (
        typeof realm === "string" &&
        Object.values(environment.realms).includes(realm as Realm)
    );
}

function validClass(characterClass: any) {
    return (
        typeof characterClass === "number" &&
        environment.characterClassNames.hasOwnProperty(characterClass)
    );
}

function validSpec(characterSpec: any) {
    return (
        typeof characterSpec === "number" &&
        environment.specs.hasOwnProperty(characterSpec)
    );
}

function validRole(role: any) {
    return (
        typeof role === "string" &&
        (role === "damage" || role === "heal" || role === "tank")
    );
}

function validFaction(faction: any) {
    return typeof faction === "number" && (faction === 0 || faction === 1);
}

function validRaidName(raidName: any) {
    if (typeof raidName === "string") {
        for (const raid of environment.currentContent.raids) {
            if (raid.name === raidName) {
                return true;
            }
        }
    }
    return false;
}

function validBossName(raidId: any, bossName: any) {
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

function validIngameBossId(
    ingameBossId: number,
    difficulty: Difficulty
): boolean {
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

function validDifficulty(raidId: any, difficulty: any) {
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

function validCombatMetric(combatMetric: any) {
    return (
        typeof combatMetric === "string" &&
        (combatMetric === "dps" || combatMetric === "hps")
    );
}

function validPage(page: any) {
    return typeof page === "number" && page >= 0;
}

function validPageSize(pageSize: any) {
    return typeof pageSize === "number" && pageSize >= 1;
}

function validGuildName(guildName: any) {
    return typeof guildName === "string";
}

function validCharacterName(characterName: any) {
    return typeof characterName === "string";
}

function validRaidLogId(logId: any) {
    return typeof logId === "number";
}

function validLimit(limit: any) {
    return typeof limit === "number";
}

function validItems(items: any) {
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

function isError(variable: unknown): variable is Error {
    return variable instanceof Error;
}

export default {
    validFilters,
    validRaidLog,
    validRaidLogDate,
    validRaidId,
    validShortRealm,
    validRealm,
    validClass,
    validSpec,
    validRole,
    validFaction,
    validRaidName,
    validBossName,
    validIngameBossId,
    validDifficulty,
    validCombatMetric,
    validPage,
    validPageSize,
    validGuildName,
    validCharacterName,
    validRaidLogId,
    validLimit,
    validItems,
    isError,
};
