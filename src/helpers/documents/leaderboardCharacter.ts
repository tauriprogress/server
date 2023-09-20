import { CharacterDocument, id } from "..";
import { Document } from "mongodb";
import { RaidName, Difficulty, ClassId, Realm, Faction } from "../../types";

export interface LeaderboardCharacterScoredDocument
    extends Omit<LeaderboardCharacterDocument, "bosses"> {
    score: number;
}

export interface LeaderboardCharacterDocument extends Document {
    _id: ReturnType<typeof id.leaderboardCharacterId>;
    raidName: RaidName;
    difficulty: Difficulty;
    ilvl: number;
    class: ClassId;
    f: Faction;
    name: string;
    realm: Realm;
    race: string;
    bosses: {
        [key: string]: Boss;
    };
}

interface Boss {
    bossName: string;
    performance: number;
}

export interface LeaderboardCharacterAggregated extends Document {
    _id: string;
    name: string;
    realm: Realm;
    class: ClassId;
    raidName: RaidName;
}

export function createLeaderboardCharacterDocument(
    character: CharacterDocument,
    raidName: RaidName,
    difficulty: Difficulty
): LeaderboardCharacterDocument {
    return {
        _id: id.leaderboardCharacterId(
            character.name,
            character.class,
            character.realm,
            raidName,
            difficulty
        ),
        raidName: raidName,
        difficulty: difficulty,

        name: character.name,
        realm: character.realm,
        class: character.class,
        f: character.f,
        ilvl: character.ilvl,
        race: character.race,
        bosses: {},
    };
}
