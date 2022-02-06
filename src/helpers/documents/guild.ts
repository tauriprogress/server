import { guildId, unshiftDateDay } from "..";
import {
    GuildDocument,
    GuildRaidDays,
    Realm,
    Faction,
    GuildBoss,
    TrimmedLog,
    Difficulty,
} from "../../types";

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
            latestKills: [],
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

export function addLogToGuildDocument(
    guild: GuildDocument,
    logId: number,
    bossName: string,
    difficulty: Difficulty,
    date: number
): GuildDocument {
    guild.activity[difficulty] = date;

    const logDate = new Date(date * 1000);
    guild.raidDays.total[unshiftDateDay(logDate.getUTCDay())][
        logDate.getUTCHours()
    ] += 1;

    guild.progression.latestKills.unshift({
        id: logId,
        date: date,
        boss: bossName,
        difficulty: difficulty,
    });

    return guild;
}

export function createGuildRaidDays(): GuildRaidDays {
    return {
        total: new Array(7).fill(new Array(24).fill(0)),
        recent: new Array(7).fill(new Array(24).fill(0)),
    };
}

export function createGuildBoss(): GuildBoss {
    return {
        killCount: 0,
        firstKills: [],
        fastestKills: [],
        latestKills: [],
    };
}
