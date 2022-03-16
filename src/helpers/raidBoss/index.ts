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
