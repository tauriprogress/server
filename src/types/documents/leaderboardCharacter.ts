import { Difficulty, RaidName } from "..";
import { getLeaderboardCharacterId } from "../../helpers";
import { ClassId, Faction, Realm } from "../global";
import { Document } from "mongodb";

export interface LeaderboardCharacterDocument extends Document {
    _id: ReturnType<typeof getLeaderboardCharacterId>;
    raidName: RaidName;
    difficulty: Difficulty;
    score: number;
    ilvl: number;
    class: ClassId;
    f: Faction;
    name: string;
    realm: Realm;
    race: string;
}
