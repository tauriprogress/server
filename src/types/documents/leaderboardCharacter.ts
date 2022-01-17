import { Difficulty, LeaderboardType, RaidName, SpecId, ClassId } from "..";
import { leaderboardCharacterId } from "../../helpers";

export default interface LeaderboardCharacterDocument extends Document {
    _id: ReturnType<typeof leaderboardCharacterId>;
    raidName: RaidName;
    difficulty: Difficulty;
    leaderboardType: LeaderboardType;
    specOrClass: SpecId | ClassId;
    performance: PerformanceElement[];
}

interface PerformanceElement {
    name: string;
    value: number;
}
