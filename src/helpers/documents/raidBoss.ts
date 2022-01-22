import { Difficulty, RaidBossDocument, RaidId } from "../../types";
import { raidBossId } from "../../helpers";

export function createRaidBossDocument(
    raidId: RaidId,
    bossId: number,
    bossName: string,
    difficulty: Difficulty
): RaidBossDocument {
    return {
        _id: raidBossId(bossId, difficulty),
        raidId: raidId,
        name: bossName,
        difficulty: difficulty,
        killCount: 0,
        recentKills: [],
        fastestKills: {},
        firstKills: {},
        bestDps: {},
        bestHps: {},
        bestDpsNoCat: undefined,
        bestHpsNoCat: undefined,
    };
}
