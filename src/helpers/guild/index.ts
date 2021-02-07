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
        raidDays: defaultGuildRaidDays()
    };
}

export function defaultGuildRaidDays(): GuildRaidDays {
    return {
        total: new Array(7).fill(new Array(24).fill(0)),
        recent: new Array(7).fill(new Array(24).fill(0))
    };
}

export function getRecentGuildRaidDays(logs: GuildRecentKill[]) {
    let { recent: raidDays } = defaultGuildRaidDays();

    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    for (const log of logs) {
        if (log.date * 1000 > timeBoundary) {
            let logDate = new Date(log.date * 1000);

            raidDays[unshiftDateDay(logDate.getDay())][logDate.getHours()] += 1;
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

        for (let boss in guildRaids[environment.currentContent.name][
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

export * from "./guildBoss";
