import environment from "../environment";
import { Difficulty, Realm, SpecId } from "../types";

export function characterId(name: string, realm: Realm, spec: SpecId) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function guildId(guildName: string, guildRealm: Realm) {
    return `${guildName} ${guildRealm}`;
}

export function raidBossId(bossId: number, difficulty: Difficulty) {
    return `${bossId} ${difficulty}`;
}
