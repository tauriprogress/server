import { Faction, Realm } from "..";

export interface TrimmedLog {
    id: number;
    guild: GuildData;
    fightLength: number;
    realm: Realm;
    date: number;
}

interface GuildData {
    name?: string;
    f: Faction;
}
