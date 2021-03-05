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
            fullClear: {
                time: number | false;
                details: SmallLog[];
                weeks: {
                    [propName: string]: [
                        {
                            members: [];
                            logs: SmallLog[];
                        }
                    ];
                };
            };
            fastestKills: {
                time: number | false;
                details: SmallLog[];
            };
        };
    };
}

interface SmallLog {
    logId: number;
    date: number;
    fightLength: number;
}
