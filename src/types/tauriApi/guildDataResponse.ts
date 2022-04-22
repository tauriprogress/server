import { ClassId, Faction } from "../global";

export interface GuildDataResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: GuildData;
}

export interface GuildData {
    dataUrlPrefix: string;
    isCata: boolean;
    expansion: number;
    guildName: string;
    titleName: string;
    realm: string;
    guildEmblemStyle: string;
    gFaction: Faction;
    guildEmblemObject: string;
    GrantAccess: boolean;
    faction: number;
    guildList: { [key: string]: GuildMember };
    guildMembersCount: number;
    gRanks: { [key: string]: GRank };
    name: string;
}

export interface GRank {
    rights: number;
    rname: string;
}

interface GuildMember {
    realm: string;
    class: ClassId;
    race: number;
    gender: number;
    level: number;
    faction: number;
    name: string;
    ach_points: number;
    rank: number;
    rank_name: string;
}
