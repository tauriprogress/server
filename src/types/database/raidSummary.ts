import { RaidBoss } from "../../types";

export interface RaidSummary {
    [propName: string]: RaidBossNoRecent;
}

export interface RaidBossNoRecent extends Omit<RaidBoss, "recentKills"> {}
