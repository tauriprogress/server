import { Difficulty, LeaderboardType, RaidName, SpecId, ClassId } from "..";
import { getLeaderboardCharacterId } from "../../helpers";

export default interface LeaderboardCharacterDocument extends Document {
    _id: ReturnType<typeof getLeaderboardCharacterId>;
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
