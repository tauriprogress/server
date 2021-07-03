import { environment } from "../environment";

export function validRaidId(raidId: number) {
    for (const raid of environment.raids) {
        if (raid.id === raidId) {
            return true;
        }
    }
    return false;
}

export function validRealm(realm: string) {
    return Object.values(environment.realms).includes(realm);
}

export function validClass(characterClass: number) {
    return environment.characterClassNames.hasOwnProperty(characterClass);
}

export function validRaidName(raidName: string) {
    for (const raid of environment.raids) {
        if (raid.name === raidName) {
            return true;
        }
    }
    return false;
}

export function validBossName(raidId: number, bossName: string) {
    for (const raid of environment.raids) {
        if (raid.id === raidId) {
            for (const boss of raid.bosses) {
                if (boss.name === bossName) {
                    return true;
                }
            }
        }
    }
    return false;
}

export function validDifficulty(raidId: number, difficulty: number) {
    for (const raid of environment.raids) {
        if (raid.id === raidId) {
            for (const raidDifficulty of raid.difficulties) {
                if (difficulty === raidDifficulty) {
                    return true;
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
