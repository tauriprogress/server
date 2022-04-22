import {
    Difficulty,
    RaidName,
    LeaderboardCharacterDocument,
    CharacterDocument,
} from "../../types";
import { getLeaderboardCharacterId } from "..";

export function createLeaderboardCharacterDocument(
    character: CharacterDocument,
    raidName: RaidName,
    difficulty: Difficulty
): LeaderboardCharacterDocument {
    return {
        _id: getLeaderboardCharacterId(
            character.name,
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
        score: 0,

        lastUpdated: 0,
    };
}
