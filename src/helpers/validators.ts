import { environment } from "../environment";

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

export function validRealm(realm: any) {
    return (
        typeof realm === "string" &&
        Object.values(environment.realms).includes(realm)
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
            !filters.difficulty &&
            !validDifficulty(raidId, filters.difficulty)
        ) {
            return false;
        }

        if (!filters.realm && !validRealm(filters.realm)) {
            return false;
        }

        if (!filters.class && !validClass(filters.class)) {
            return false;
        }

        if (!filters.spec && !validSpec(filters.spec)) {
            return false;
        }

        if (!filters.role && !validRole(filters.role)) {
            return false;
        }

        if (!filters.faction && !validFaction(filters.faction)) {
            return false;
        }

        return true;
    }

    return false;
}
