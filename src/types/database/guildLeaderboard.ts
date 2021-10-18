export type GuildLeaderboard = GuildOfLeaderboard[];

export interface GuildOfLeaderboard {
    _id: string;
    class: number;
    spec: number;
    name: string;
    realm: string;
    f: 0 | 1;
    ilvl: number;
    topPercent: number;
    date: number;
    race: string;
}
