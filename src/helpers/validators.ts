import environment from "../environment";
import { Difficulty, LastRaidLogWithRealm, Realm, ShortRealm } from "../types";

export function validRaidId(raidId: any) {
    if (typeof raidId === "number") {
        for (const raid of environment.currentContent.raids) {
            if (raid.id === raidId) {
                return true;
            }
        }
    }

    return false;
}

export function validShortRealm(shortRealm: any) {
    return (
        typeof shortRealm === "string" &&
        Object.values(environment.shortRealms).includes(
            shortRealm as ShortRealm
        )
    );
}

export function validRealm(realm: any) {
    return (
        typeof realm === "string" &&
        Object.values(environment.realms).includes(realm as Realm)
    );
}

export function validClass(characterClass: any) {
    return (
        typeof characterClass === "number" &&
        environment.characterClassNames.hasOwnProperty(characterClass)
    );
}

export function validSpec(characterSpec: any) {
    return (
        typeof characterSpec === "number" &&
        environment.specs.hasOwnProperty(characterSpec)
    );
}

export function validRole(role: any) {
    return (
        typeof role === "string" &&
        (role === "damage" || role === "heal" || role === "tank")
    );
}

export function validFaction(faction: any) {
    return typeof faction === "number" && (faction === 0 || faction === 1);
}

export function validRaidName(raidName: any) {
    if (typeof raidName === "string") {
        for (const raid of environment.currentContent.raids) {
            if (raid.name === raidName) {
                return true;
            }
        }
    }
    return false;
}

export function validBossName(raidId: any, bossName: any) {
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

export function validIngameBossId(
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

export function validDifficulty(raidId: any, difficulty: any) {
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

export function sameMembers(
    members1: string[],
    members2: string[],
    difficulty: 10 | 25
): boolean {
    let memberContainer: { [propName: string]: boolean } = {};
    let sameMemberCount = 1;

    for (let name of members1) {
        memberContainer[name] = true;
    }

    for (let name of members2) {
        if (memberContainer[name]) {
            sameMemberCount++;
        }
    }

    return difficulty * 0.8 <= sameMemberCount;
}

export function isSeasonRunning() {
    return !!getCurrentSeason();
}

export function getCurrentSeason() {
    const currentDate = new Date().getTime();

    if (environment.seasonal) {
        for (const season of environment.seasons) {
            const start = new Date(season.start).getTime();
            const finish = new Date(season.finish).getTime();
            if (currentDate > start && currentDate < finish) {
                return season;
            }
        }
    }

    return false;
}

export function validLogDate(date: Date) {
    if (!environment.seasonal) {
        return true;
    }

    const currentSeason = getCurrentSeason();

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

export function validCombatMetric(combatMetric: any) {
    return (
        typeof combatMetric === "string" &&
        (combatMetric === "dps" || combatMetric === "hps")
    );
}

export function validFilters(raidId: number, filters: any) {
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

export function validPage(page: any) {
    return typeof page === "number" && page >= 0;
}

export function validPageSize(pageSize: any) {
    return typeof pageSize === "number" && pageSize >= 1;
}

export function validGuildName(guildName: any) {
    return typeof guildName === "string";
}

export function validCharacterName(characterName: any) {
    return typeof characterName === "string";
}

export function validLogId(logId: any) {
    return typeof logId === "number";
}

export function validLimit(limit: any) {
    return typeof limit === "number";
}

export function validItemids(ids: any) {
    return (
        Array.isArray(ids) &&
        ids.reduce((acc: boolean, curr: any) => {
            if (typeof curr !== "number") {
                return false;
            }

            return acc;
        }, true)
    );
}

export const possibleLeaderboardIds = (() => {
    /*
    let leaderboardIds = [];

    const combatMetrics = ["dps", "hps"];
    const roles = ["damage", "heal", "tank"];
    const specs = Object.keys(environment.specs);

    let raidIds = [];

    for (const raid of environment.currentContent.raids) {
        raidIds.push(raid.id);
    }

    for (const raidId of raidIds) {
        for (const combatMetric of combatMetrics) {
            leaderboardIds.push(getLeaderboardCacheId(raidId, combatMetric));
            for (const role of roles) {
                leaderboardIds.push(
                    getLeaderboardCacheId(raidId, combatMetric, role)
                );
            }

            for (const spec of specs) {
                leaderboardIds.push(
                    getLeaderboardCacheId(raidId, combatMetric, spec)
                );
            }
        }
    }

    return leaderboardIds;
    */
})();

export function validLeaderboardId() {
    /*
    return (
        typeof leaderboardId === "string" &&
        possibleLeaderboardIds.includes(leaderboardId)
    );
    */
}

export function isError(variable: unknown): variable is Error {
    return variable instanceof Error;
}

export function validRaidLog(log: LastRaidLogWithRealm) {
    if (
        validLogDate(new Date(log.killtime * 1000)) &&
        validRaidName(log.mapentry.name) &&
        validDifficulty(log.mapentry.id, log.difficulty) &&
        validBossName(log.mapentry.id, log.encounter_data.encounter_name) &&
        log.fight_time > 10000
    ) {
        return true;
    }
    return false;
}
