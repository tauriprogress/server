import environment from "../environment";
import {
    Difficulty,
    RaidName,
    Realm,
    SpecId,
    ClassId,
    LeaderboardType,
} from "../types";

export function characterId(name: string, realm: Realm, spec: SpecId) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function leaderboardCharacterId(
    name: string,
    realm: Realm,
    spec: SpecId | ClassId,
    raidName: RaidName,
    difficulty: Difficulty,
    leaderboardType: LeaderboardType
) {
    return `${name},${environment.shortRealms[realm]},${spec},${raidName},${difficulty},${leaderboardType}`;
}

export function guildId(guildName: string, guildRealm: Realm) {
    return `${guildName} ${guildRealm}`;
}

export function raidBossId(ingameBossId: number, difficulty: Difficulty) {
    return `${ingameBossId} ${difficulty}`;
}

export function deconstructRaidBossId(bossId: ReturnType<typeof raidBossId>) {
    const [ingameBossId, difficulty] = bossId.split(" ");

    return [Number(ingameBossId), Number(difficulty) as Difficulty] as const;
}

export function raidBossCollectionId(
    id: number,
    difficulty: number,
    combatMetric: string
) {
    return `${id} ${difficulty} ${combatMetric}`;
}

export function raidBossCacheId(raidId: number, bossName: string) {
    return `${raidId}${bossName}`;
}

export function leaderboardCacheId(
    raidId: number,
    combatMetric: string,
    spec?: string
) {
    if (spec) {
        return `${raidId}${spec}${combatMetric}`;
    }

    return `${raidId}${combatMetric}`;
}
