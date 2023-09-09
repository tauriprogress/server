import environment from "../environment";
import { CombatMetric, Difficulty, RaidId, Realm, SpecId } from "../types";

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
        difficulty: number,
        combatMetric: string
    ): CharacterDocumentCollectionId {
        return `${ingameBossId} ${difficulty} ${combatMetric}`;
    }

    raidSummaryCacheId(raidId: RaidId) {
        return `${raidId}`;
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
}

export const id = new Id();

export default id;
