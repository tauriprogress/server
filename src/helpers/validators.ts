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
