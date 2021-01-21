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
    return environment.realms.hasOwnProperty(realm);
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
