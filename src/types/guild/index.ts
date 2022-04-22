import { Realm, Faction, GuildProgression, GuildActivity } from "..";

interface GuildOfGuildList {
    _id: string;
    f: Faction;
    realm: Realm;
    name: string;
    activity: GuildActivity;
    progression: Omit<GuildProgression, "recentKills" | "raids">;
}

export type GuildList = GuildOfGuildList[];
