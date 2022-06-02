import { Difficulty, RaidName } from "..";
import { getLeaderboardCharacterId } from "../../helpers";
import { ClassId, Faction, Realm } from "../global";
import { Document } from "mongodb";

export interface LeaderboardCharacterScoredDocument
    extends Omit<LeaderboardCharacterDocument, "bosses"> {
    score: number;
}

export interface LeaderboardCharacterDocument extends Document {
    _id: ReturnType<typeof getLeaderboardCharacterId>;
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
