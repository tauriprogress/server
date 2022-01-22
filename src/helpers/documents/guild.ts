import { guildId } from "..";
import { GuildDocument, GuildRaidDays, Realm, Faction } from "../../types";

export function createGuildDocument(
    guildName: string,
    realm: Realm,
    faction: Faction
): GuildDocument {
    return {
        _id: guildId(guildName, realm),
        f: faction,
        realm: realm,
        name: guildName,
        members: [],
        ranks: [],
        activity: {},
        progression: {
            recentKills: [],
            completion: {
                completed: false,
                bossesDefeated: 0,
                difficulties: {},
            },
            raids: {},
        },
        raidDays: createGuildRaidDays(),
        ranking: {},
    };
}

export function createGuildRaidDays(): GuildRaidDays {
    return {
        total: new Array(7).fill(new Array(24).fill(0)),
        recent: new Array(7).fill(new Array(24).fill(0)),
    };
}
