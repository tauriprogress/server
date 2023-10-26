import environment from "../environment";
import {
    ClassId,
    CombatMetric,
    Difficulty,
    RaidId,
    RaidName,
    Realm,
    SpecId,
} from "../types";
import { Filters } from "./filter";
import { capitalize } from "./utils";

export type GuildId = string;
export type RaidBossId = string;
export type CharacterId = string;
export type CharacterDocumentCollectionId = string;

function guildId(guildName: string, guildRealm: Realm): GuildId {
    return `${guildName} ${guildRealm}`;
}

function raidBossId(ingameBossId: number, difficulty: Difficulty): RaidBossId {
    return `${ingameBossId} ${difficulty}`;
}

function characterId(name: string, realm: Realm, spec: SpecId): CharacterId {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

function characterDocumentCollectionId(
    ingameBossId: number,
    difficulty: Difficulty,
    combatMetric: CombatMetric
): CharacterDocumentCollectionId {
    return `${ingameBossId} ${difficulty} ${combatMetric}`;
}

function leaderboardCharacterId(
    name: string,
    classId: ClassId,
    realm: Realm,
    raidName: RaidName,
    difficulty: Difficulty
) {
    return `${name},${classId},${environment.shortRealms[realm]},${raidName},${difficulty}`;
}
function deconstructCharacterDocumentCollectionId(
    collectionId: ReturnType<typeof characterDocumentCollectionId>
) {
    const [ingameBossId, difficulty, combatMetric] = collectionId.split(" ");

    return [
        Number(ingameBossId),
        Number(difficulty) as Difficulty,
        combatMetric as CombatMetric,
    ] as const;
}
function deconstructRaidBossId(bossId: ReturnType<typeof raidBossId>) {
    const [ingameBossId, difficulty] = bossId.split(" ");

    return [Number(ingameBossId), Number(difficulty) as Difficulty] as const;
}

function raidSummaryCacheId(raidId: RaidId) {
    return `${raidId}`;
}
function raidBossCacheId(raidId: number, bossName: string) {
    return `${raidId}${bossName}`;
}

function characterPerformanceCacheId(
    characterName: string,
    realm: Realm,
    raidName: RaidName
) {
    return `${characterName}${realm}${raidName}`;
}

function characterLeaderboardCacheId(
    raidName: RaidName,
    combatMetric: CombatMetric,
    filters: Filters,
    page: number
) {
    return `${raidName}${combatMetric}${filters.difficulty}${filters.faction}${filters.class}${filters.realm}${page}`;
}

function extendedLogId(logId: number, realm: Realm) {
    return `${logId}${realm}`;
}

function characterApiId(characterName: string, realm: Realm) {
    return capitalize(`${characterName}${realm}`);
}

export default {
    guildId,
    raidBossId,
    characterId,
    characterDocumentCollectionId,
    leaderboardCharacterId,
    deconstruct: {
        characterDocumentCollectionId: deconstructCharacterDocumentCollectionId,
        raidBossId: deconstructRaidBossId,
    },
    cache: {
        raidSummaryCacheId,
        raidBossCacheId,
        characterPerformanceCacheId,
        characterLeaderboardCacheId,
        extendedLogId,
        characterApiId,
    },
};
