import { RaidBoss, ExtendedRaidBoss, RaidBossForSummary } from "../../types";
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
        bestHpsNoCat: undefined,
    };
}

export function getRaidBossSummary(boss: ExtendedRaidBoss): RaidBossForSummary {
    let raidBossForSummary = JSON.parse(JSON.stringify(boss));

    for (const realmName in boss.fastestKills) {
        for (const faction in boss.fastestKills[realmName]) {
            raidBossForSummary.fastestKills[realmName][faction] =
                boss.fastestKills[realmName][faction].slice(0, 3);
        }
    }

    delete raidBossForSummary.killCount;
    delete raidBossForSummary.recentKills;
    delete raidBossForSummary.bestDpsNoCat;
    delete raidBossForSummary.bestHpsNoCat;
    delete raidBossForSummary.dps;
    delete raidBossForSummary.hps;
    delete raidBossForSummary.fiftyFastestKills;

    return raidBossForSummary;
}
