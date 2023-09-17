import environment from "../environment";
import {
    ClassId,
    CombatMetric,
    Difficulty,
    Filters,
    RaidId,
    RaidName,
    Realm,
    SpecId,
} from "../types";

export type WeekId = string;
export type GuildId = string;
export type RaidBossId = string;
export type CharacterId = string;
export type CharacterDocumentCollectionId = string;

class Id {
    deconstruct: DeconstructId;

    constructor() {
        this.deconstruct = new DeconstructId();
    }

    weekId(date: Date): WeekId {
        return date.getTime().toString();
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

    raidSummaryCacheId(raidId: RaidId) {
        return `${raidId}`;
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

    characterLeaderboardCacheId(
        raidName: RaidName,
        combatMetric: CombatMetric,
        filters: Filters,
        page: number
    ) {
        return `${raidName}${combatMetric}${filters.difficulty}${filters.faction}${filters.class}${filters.realm}${page}`;
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

export const id = new Id();

export default id;
