import { RaidBoss } from "../../types";
export * from "./updateRaidBoss";

export function getDefaultBoss(): RaidBoss {
    return {
        _id: "",
        raidId: 0,
        name: "",
        difficulty: 0,
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
