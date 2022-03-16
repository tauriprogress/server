import { getGuildId } from "../../helpers";
import { Faction, Realm, ClassId, Difficulty } from "..";
import { RaidName } from "../global";
import { Document } from "mongodb";

export interface GuildDocument extends Document {
    _id: ReturnType<typeof getGuildId>;
    f: Faction;
    realm: Realm;
    name: string;
    members: GuildMember[];
    ranks: string[];
    activity: GuildActivity;
    progression: GuildProgression;
    raidDays: GuildRaidDays;
    ranking: Ranking;
}

export interface GuildMember {
    name: string;
    class: ClassId;
    rankName: string;
    lvl: number;
    race: string;
}

export type GuildActivity = {
    [key in Difficulty]?: number;
};

export interface GuildProgression {
    latestKills: GuildLatestKill[];
    completion: GuildCompletion;
    raids: GuildRaids;
}

export interface GuildLatestKill {
    id: number;
    date: number;
    boss: string;
    difficulty: Difficulty;
}

export interface GuildRaidDays {
    total: number[][];
    latest: number[][];
}

export interface GuildCompletion {
    completed: false | number;
    bossesDefeated: number;
    difficulties: {
        [propName: number]: {
            completed: false | number;
            bossesDefeated: number;
        };
    };
}

export type GuildRaids = {
    [key in RaidName]?: {
        [key in Difficulty]?: {
            [propName: string]: GuildBoss;
        };
    };
};

export interface GuildBoss {
    killCount: number;
    firstKills: GuildKillLog[];
    fastestKills: GuildKillLog[];
    latestKills: GuildKillLog[];
}

export interface GuildKillLog {
    id: number;
    fightLength: number;
    date: number;
}

type Ranking = {
    [key in RaidName]?: {
        [key in Difficulty]?: {
            fullClear: GuildRankingFull;
            fastestKills: GuildRankingFastest;
        };
    };
};

export interface GuildRankingFull {
    time: number | false;
    logs: GuildRankingLog[];
    weeks: {
        [propName: string]: GuildRankingRaidGroup[];
    };
}

export interface GuildRankingFastest {
    time: number | false;
    logs: GuildRankingLog[];
}

export interface GuildRankingLog {
    id: number;
    date: number;
    fightLength: number;
    bossName: string;
}

export interface GuildRankingRaidGroup {
    members: string[];
    logs: GuildRankingLog[];
}
