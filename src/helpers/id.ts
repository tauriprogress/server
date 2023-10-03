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

class Id {
    deconstruct: DeconstructId;
    cache: CacheId;

    constructor() {
        this.deconstruct = new DeconstructId();
        this.cache = new CacheId();
    }

    guildId(guildName: string, guildRealm: Realm): GuildId {
        return `${guildName} ${guildRealm}`;
    }

    raidBossId(ingameBossId: number, difficulty: Difficulty): RaidBossId {
        return `${ingameBossId} ${difficulty}`;
    }

    characterId(name: string, realm: Realm, spec: SpecId): CharacterId {
        return `${name},${environment.shortRealms[realm]},${spec}`;
    }

    characterDocumentCollectionId(
        ingameBossId: number,
        difficulty: Difficulty,
        combatMetric: CombatMetric
    ): CharacterDocumentCollectionId {
        return `${ingameBossId} ${difficulty} ${combatMetric}`;
    }

    leaderboardCharacterId(
        name: string,
        classId: ClassId,
        realm: Realm,
        raidName: RaidName,
        difficulty: Difficulty
    ) {
        return `${name},${classId},${environment.shortRealms[realm]},${raidName},${difficulty}`;
    }
}

class DeconstructId {
    characterDocumentCollectionId(
        characterDocumentCollectionId: ReturnType<
            typeof id.characterDocumentCollectionId
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

    raidBossId(bossId: ReturnType<typeof id.raidBossId>) {
        const [ingameBossId, difficulty] = bossId.split(" ");

        return [
            Number(ingameBossId),
            Number(difficulty) as Difficulty,
        ] as const;
    }
}

class CacheId {
    raidSummaryCacheId(raidId: RaidId) {
        return `${raidId}`;
    }
    raidBossCacheId(raidId: number, bossName: string) {
        return `${raidId}${bossName}`;
    }

    characterPerformanceCacheId(
        characterName: string,
        realm: Realm,
        raidName: RaidName
    ) {
        return `${characterName}${realm}${raidName}`;
    }

    characterLeaderboardCacheId(
        raidName: RaidName,
        combatMetric: CombatMetric,
        filters: Filters,
        page: number
    ) {
        return `${raidName}${combatMetric}${filters.difficulty}${filters.faction}${filters.class}${filters.realm}${page}`;
    }

    extendedLogId(logId: number, realm: Realm) {
        return `${logId}${realm}`;
    }

    characterApiId(characterName: string, realm: Realm) {
        return capitalize(`${characterName}${realm}`);
    }
}

export const id = new Id();

export default id;
