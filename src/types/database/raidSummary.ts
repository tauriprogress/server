import { RaidBoss } from "../../types";

export interface RaidSummary {
    [propName: string]: RaidBossForSummary;
}

export interface RaidBossForSummary
    extends Omit<
        RaidBoss,
        "killCount" | "recentKills" | "bestDpsNoCat" | "bestHpsNoCat"
    > {}
