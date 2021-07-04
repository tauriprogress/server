import { RaidBoss } from "../../types";
export * from "./updateRaidBoss";

export function getDefaultBoss(
    id = "",
    raidId = 0,
    name = "",
    difficulty = 0
): RaidBoss {
    return {
        _id: id,
        raidId: raidId,
        name: name,
        difficulty: difficulty,
        killCount: 0,
        recentKills: [],
        fastestKills: {},
        firstKills: {},
        bestDps: {},
        bestHps: {},
        bestDpsNoCat: undefined,
        bestHpsNoCat: undefined
    };
}
