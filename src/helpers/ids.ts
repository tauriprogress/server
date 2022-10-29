import environment from "../environment";
import {
    Difficulty,
    RaidName,
    Realm,
    SpecId,
    RaidId,
    CombatMetric,
    Filters,
    ClassId,
} from "../types";
import { capitalize } from "./transformers";

export function getCharacterId(name: string, realm: Realm, spec: SpecId) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function getLeaderboardCharacterId(
    name: string,
    classId: ClassId,
    realm: Realm,
    raidName: RaidName,
    difficulty: Difficulty
) {
    return `${name},${classId},${environment.shortRealms[realm]},${raidName},${difficulty}`;
}

export function getGuildId(guildName: string, guildRealm: Realm) {
    return `${guildName} ${guildRealm}`;
}

export function getRaidBossId(ingameBossId: number, difficulty: Difficulty) {
    return `${ingameBossId} ${difficulty}`;
}

export function getDeconstructedRaidBossId(
    bossId: ReturnType<typeof getRaidBossId>
) {
    const [ingameBossId, difficulty] = bossId.split(" ");

    return [Number(ingameBossId), Number(difficulty) as Difficulty] as const;
}

export function getDeconstructedCharacterDocumentCollectionId(
    characterDocumentCollectionId: ReturnType<
        typeof getCharacterDocumentCollectionId
    >
) {
    const [ingameBossId, difficulty, combatMetric] =
        characterDocumentCollectionId.split(" ");

    return [
        Number(ingameBossId),
        Number(difficulty) as Difficulty,
        combatMetric as CombatMetric,
    ] as const;
}

export function getCharacterDocumentCollectionId(
    ingameBossId: number,
    difficulty: number,
    combatMetric: string
) {
    return `${ingameBossId} ${difficulty} ${combatMetric}`;
}

export function getRaidBossCacheId(raidId: number, bossName: string) {
    return `${raidId}${bossName}`;
}

export function getCharacterLeaderboardCacheId(
    raidName: RaidName,
    combatMetric: CombatMetric,
    filters: Filters,
    page: number
) {
    return `${raidName}${combatMetric}${filters.difficulty}${filters.faction}${filters.class}${filters.realm}${page}`;
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

export function getExtendedLogId(logId: number, realm: Realm) {
    return `${logId}${realm}`;
}

export function getCharacterApiId(characterName: string, realm: Realm) {
    return capitalize(`${characterName}${realm}`);
}
