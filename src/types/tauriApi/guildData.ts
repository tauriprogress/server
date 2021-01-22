export interface GuildData {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: Response;
}

export interface Response {
    dataUrlPrefix: string;
    isCata: boolean;
    expansion: number;
    guildName: string;
    titleName: string;
    realm: string;
    guildEmblemStyle: string;
    gFaction: number;
    guildEmblemObject: string;
    GrantAccess: boolean;
    faction: number;
    guildList: { [key: string]: GuildList };
    guildMembersCount: number;
    gRanks: { [key: string]: GRank };
    name: string;
}

export interface GRank {
    rights: number;
    rname: string;
}

export interface GuildList {
    realm: string;
    class: number;
    race: number;
    gender: number;
    level: number;
    faction: number;
    name: string;
    ach_points: number;
    rank: number;
    rank_name: string;
}
