import { week } from "../../constants";
import { environment } from "../../environment";
import { getLatestWednesday, unshiftDateDay } from "../../helpers";
import {
    Guild,
    GuildRaids,
    GuildRaidDays,
    GuildRecentKill,
    GuildCompletion
} from "../../types";

import tauriApi from "../../tauriApi";

export function getDefaultGuild(): Guild {
    return {
        _id: "",
        f: 0,
        realm: "",
        name: "",
        members: [],
        ranks: [],
        activity: {},
        progression: {
            recentKills: [],
            completion: {
                completed: false,
                bossesDefeated: 0,
                difficulties: {}
            },
            raids: {}
        },
        raidDays: defaultGuildRaidDays(),
        ranking: {}
    };
}

export function defaultGuildRaidDays(): GuildRaidDays {
    return {
        total: new Array(7).fill(new Array(24).fill(0)),
        recent: new Array(7).fill(new Array(24).fill(0))
    };
}

export function getRecentGuildRaidDays(logs: GuildRecentKill[]) {
    let { recent: raidDays } = JSON.parse(
        JSON.stringify(defaultGuildRaidDays())
    );

    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    for (const log of logs) {
        if (log.date * 1000 > timeBoundary) {
            let logDate = new Date(log.date * 1000);

            raidDays[unshiftDateDay(logDate.getUTCDay())][
                logDate.getUTCHours()
            ] += 1;
        } else {
            break;
        }
    }

    return raidDays;
}

export function getGuildContentCompletion(
    guildRaids: GuildRaids
): GuildCompletion {
    let completion: GuildCompletion = {
        completed: false,
        bossesDefeated: 0,
        difficulties: {}
    };
    for (const diff in guildRaids[environment.currentContent.name]) {
        const difficulty = Number(diff);

        if (!completion.difficulties[difficulty]) {
            completion.difficulties[difficulty] = {
                completed: false,
                bossesDefeated: 0
            };
        }

        for (let _1 in guildRaids[environment.currentContent.name][
            difficulty
        ]) {
            completion.difficulties[difficulty].bossesDefeated++;
        }

        if (
            environment.currentContent.completionDifficulties.includes(
                difficulty
            ) &&
            completion.difficulties[difficulty].bossesDefeated ===
                environment.currentContent.totalBosses
        ) {
            const firstKill =
                guildRaids[environment.currentContent.name][difficulty][
                    environment.currentContent.lastBoss
                ].firstKill || false;

            completion.difficulties[difficulty].completed = firstKill;

            if (completion.completed && firstKill) {
                completion.completed =
                    completion.completed < firstKill
                        ? completion.completed
                        : firstKill;
            } else {
                completion.completed = firstKill;
            }
        }

        if (
            environment.currentContent.completionDifficulties.includes(
                difficulty
            ) &&
            completion.bossesDefeated <
                completion.difficulties[difficulty].bossesDefeated
        )
            completion.bossesDefeated =
                completion.difficulties[difficulty].bossesDefeated;
    }

    return completion;
}

export function guildRecentKills(logs: GuildRecentKill[]) {
    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    let recentKills = [];

    for (const log of logs) {
        if (log.date * 1000 > timeBoundary) {
            recentKills.push(log);
        } else if (recentKills.length < 50) {
            recentKills.push(log);
        } else {
            break;
        }
    }

    return recentKills;
}

export function getGuildId(guildName: string, realm: string) {
    return `${guildName} ${realm}`;
}

export async function requestGuildData(guildName: string, realm: string) {
    const response = await tauriApi.getGuildData(guildName, realm);

    const guild = response.response;

    let members = [];

    for (const memberId in guild.guildList) {
        members.push({
            name: guild.guildList[memberId].name,
            class: guild.guildList[memberId].class,
            rankName: guild.guildList[memberId].rank_name,
            lvl: guild.guildList[memberId].level,
            race: `${guild.guildList[memberId].race},${guild.guildList[memberId].gender}`
        });
    }

    let ranks = [];
    for (const rankId in guild.gRanks) {
        ranks.push(guild.gRanks[rankId].rname);
    }

    let newGuild: Guild = {
        ...getDefaultGuild(),
        _id: getGuildId(guildName, realm),
        name: guild.guildName,
        f: guild.faction as 0 | 1,
        realm: guild.realm,
        ranks: ranks,
        members: members
    };

    for (const guild of environment.guildFactionBugs) {
        if (
            guild.guildName === newGuild.name &&
            guild.realm === newGuild.realm
        ) {
            newGuild.f = Number(guild.faction) as 0 | 1;
        }
    }

    return newGuild;
}

export * from "./guildBoss";
export * from "./updateGuildData";
