export interface TrimmedLog {
    id: number;
    guild?: GuildData;
    fightLength: number;
    realm: string;
    date: number;
}

interface GuildData {
    name: string;
    f: 0 | 1;
}
