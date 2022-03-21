import environment from "../environment";
import {
    Difficulty,
    RaidName,
    Realm,
    SpecId,
    ClassId,
    LeaderboardType,
    RaidId,
} from "../types";

export function getCharacterId(name: string, realm: Realm, spec: SpecId) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function getLeaderboardCharacterId(
    name: string,
    realm: Realm,
    spec: SpecId | ClassId,
    raidName: RaidName,
    difficulty: Difficulty,
    leaderboardType: LeaderboardType
) {
    return `${name},${environment.shortRealms[realm]},${spec},${raidName},${difficulty},${leaderboardType}`;
}

export function getGuildId(guildName: string, guildRealm: Realm) {
    return `${guildName} ${guildRealm}`;
}

export function getRaidBossId(ingameBossId: number, difficulty: Difficulty) {
    return `${ingameBossId} ${difficulty}`;
}

export function getDeconstructRaidBossId(
    bossId: ReturnType<typeof getRaidBossId>
) {
    const [ingameBossId, difficulty] = bossId.split(" ");

    return [Number(ingameBossId), Number(difficulty) as Difficulty] as const;
}

export function getCharactersOfBossCollectionId(
    ingameBossId: number,
    difficulty: number,
    combatMetric: string
) {
    return `${ingameBossId} ${difficulty} ${combatMetric}`;
}

export function getRaidBossCacheId(raidId: number, bossName: string) {
    return `${raidId}${bossName}`;
}

export function getLeaderboardCacheId(
    raidId: number,
    combatMetric: string,
    spec?: string
) {
    if (spec) {
        return `${raidId}${spec}${combatMetric}`;
    }

    return `${raidId}${combatMetric}`;
}

export function getRaidSummaryCacheId(raidId: RaidId) {
    return `${raidId}`;
}

export function getCharacterPerformanceCacheId(
    characterName: string,
    realm: Realm,
    raidName: RaidName
) {
    return `${characterName}${realm}${raidName}`;
}
