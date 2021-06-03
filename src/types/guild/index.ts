import { Character } from "../../types";

export interface Guild {
    _id: string;
    f: 0 | 1;
    realm: string;
    name: string;
    members: GuildMember[];
    ranks: string[];
    activity: GuildActivity;
    progression: GuildProgression;
    raidDays: GuildRaidDays;
    ranking: Ranking;
}

interface GuildMember {
    name: string;
    class: number;
    rankName: string;
    lvl: number;
    race: string;
}

interface GuildActivity {
    [propName: number]: number;
}

export interface GuildProgression {
    recentKills: GuildRecentKill[];
    completion: GuildCompletion;
    raids: GuildRaids;
}

export interface GuildRecentKill {
    id: number;
    date: number;
    boss: string;
    difficulty: number;
}

export interface GuildRaidDays {
    total: number[][];
    recent: number[][];
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

export interface GuildRaids {
    [propName: string]: {
        [propName: number]: {
            [propName: string]: GuildBoss;
        };
    };
}

export interface GuildBoss {
    killCount: number;
    fastestKills: GuildFastKill[];
    firstKill?: number;
    dps: {
        [propName: string]: Character;
    };
    hps: {
        [propName: string]: Character;
    };
}

interface GuildFastKill {
    id: number;
    fightLength: number;
    date: number;
}

interface Ranking {
    [propName: string]: {
        [propName: number]: {
            fullClear: GuildRankingFull;
            fastestKills: GuildRankingFastest;
        };
    };
}

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
