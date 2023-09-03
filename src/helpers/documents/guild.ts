import environment from "../../environment";
import {
    getGuildId,
    getNestedObjectValue,
    addNestedObjectValue,
    uniqueLogs,
    getRaidInfoFromName,
    timeTransformer,
    logs,
} from "..";
import {
    GuildDocument,
    GuildRaidDays,
    Realm,
    Faction,
    GuildBoss,
    Difficulty,
    RaidName,
    GuildRankingFull,
    RaidLogWithRealm,
    GuildKillLog,
    GuildLatestKill,
    GuildCompletion,
    GuildRaids,
    GuildRankingFastest,
    GuildMember,
} from "../../types";
import { week } from "../../constants";
import tauriApi from "../../tauriApi";

export async function requestGuildDocument(guildName: string, realm: Realm) {
    const response = await tauriApi.getGuildData(guildName, realm);

    const guildData = response.response;

    let members: GuildMember[] = [];

    for (const memberId in guildData.guildList) {
        members.push({
            name: guildData.guildList[memberId].name,
            class: guildData.guildList[memberId].class,
            rankName: guildData.guildList[memberId].rank_name,
            lvl: guildData.guildList[memberId].level,
            race: `${guildData.guildList[memberId].race},${guildData.guildList[memberId].gender}`,
        });
    }

    let ranks = [];
    for (const rankId in guildData.gRanks) {
        ranks.push(guildData.gRanks[rankId].rname);
    }

    let newGuild: GuildDocument = {
        ...createGuildDocument(guildName, realm, guildData.gFaction),
        ranks: ranks,
        members: members,
    };

    for (const guild of environment.guildFactionBugs) {
        if (
            guild.guildName === newGuild.name &&
            guild.realm === newGuild.realm
        ) {
            newGuild.f = guild.faction;
        }
    }

    return newGuild;
}

export function createGuildDocument(
    guildName: string,
    realm: Realm,
    faction: Faction
): GuildDocument {
    return {
        _id: getGuildId(guildName, realm),
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
    log: RaidLogWithRealm,
    raidName: RaidName,
    logId: number,
    bossName: string,
    difficulty: Difficulty,
    date: number,
    fightLength: number
): GuildDocument {
    guild.activity[difficulty] = date;

    const logDate = new Date(date * 1000);
    guild.raidDays.total[timeTransformer.unshiftDateDay(logDate.getUTCDay())][
        logDate.getUTCHours()
    ] += 1;

    guild.progression.latestKills.unshift({
        id: logId,
        date: date,
        boss: bossName,
        difficulty: difficulty,
    });
    guild.progression.latestKills = guild.progression.latestKills.slice(0, 50);

    const guildRankingFullClearCategory = [raidName, difficulty, "fullClear"];

    const weekId = timeTransformer.getLatestWednesday(logDate).getTime();

    let guildRankingFullClear = getNestedObjectValue(
        guild.ranking,
        guildRankingFullClearCategory
    ) as GuildRankingFull | false;

    if (!guildRankingFullClear) {
        guildRankingFullClear = {
            time: false,
            logs: [],
            weeks: {},
        };

        guildRankingFullClear.weeks[weekId] = [
            {
                members: log.members.map((member) => member.name),
                logs: [
                    {
                        bossName: bossName,
                        date: date,
                        fightLength: fightLength,
                        id: logId,
                    },
                ],
            },
        ];
    } else if (!guildRankingFullClear.weeks[weekId]) {
        guildRankingFullClear.weeks[weekId] = [
            {
                members: log.members.map((member) => member.name),
                logs: [
                    {
                        bossName: bossName,
                        date: date,
                        fightLength: fightLength,
                        id: logId,
                    },
                ],
            },
        ];
    } else {
        let logAddedToRanking = false;

        for (let i = 0; i < guildRankingFullClear.weeks[weekId].length; i++) {
            let raidGroup = guildRankingFullClear.weeks[weekId][i];

            if (
                logs.sameMembers(
                    raidGroup.members,
                    log.members.map((member) => member.name),
                    difficulty
                )
            ) {
                logAddedToRanking = true;

                raidGroup.logs.push({
                    bossName: bossName,
                    date: date,
                    fightLength: fightLength,
                    id: logId,
                });

                guildRankingFullClear.weeks[weekId][i] = raidGroup;

                break;
            }
        }

        if (!logAddedToRanking) {
            guildRankingFullClear.weeks[weekId].push({
                members: log.members.map((member) => member.name),
                logs: [
                    {
                        bossName: bossName,
                        date: date,
                        fightLength: fightLength,
                        id: logId,
                    },
                ],
            });
        }
    }

    guild.ranking = addNestedObjectValue(
        guild.ranking,
        guildRankingFullClearCategory,
        guildRankingFullClear
    );

    const guildBossCategorization = [
        "progression",
        "raids",
        raidName,
        difficulty,
        bossName,
    ];

    let currentGuildBoss = getNestedObjectValue(
        guild,
        guildBossCategorization
    ) as GuildBoss | false;

    if (!currentGuildBoss) {
        currentGuildBoss = createGuildBoss();
    }

    let guildKillLog: GuildKillLog = {
        id: logId,
        fightLength: fightLength,
        date: date,
    };

    currentGuildBoss.killCount += 1;
    currentGuildBoss.firstKills = currentGuildBoss.firstKills
        .concat(guildKillLog)
        .slice(0, 10);
    currentGuildBoss.fastestKills = currentGuildBoss.fastestKills
        .concat(guildKillLog)
        .sort((a, b) => a.fightLength - b.fightLength)
        .slice(0, 10);
    currentGuildBoss.latestKills.unshift(guildKillLog);
    currentGuildBoss.latestKills = currentGuildBoss.latestKills.slice(0, 10);

    guild = addNestedObjectValue(
        guild,
        guildBossCategorization,
        currentGuildBoss
    ) as GuildDocument;

    return guild;
}

export function createGuildRaidDays(): GuildRaidDays {
    return {
        total: new Array(7).fill(0).map(() => new Array(24).fill(0)),
        latest: new Array(7).fill(0).map(() => new Array(24).fill(0)),
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

export function updateGuildDocument(
    oldGuild: GuildDocument,
    guild: GuildDocument
): GuildDocument {
    let updatedGuild: GuildDocument = {
        ...JSON.parse(JSON.stringify(oldGuild)),
        ...(({ progression, raidDays, activity, ranking, ...others }) => ({
            ...JSON.parse(JSON.stringify(others)),
            members: guild.members.length ? guild.members : oldGuild.members,
            ranks: guild.ranks.length ? guild.ranks : oldGuild.ranks,
        }))(guild),
    };

    updatedGuild.progression.latestKills = guild.progression.latestKills
        .concat(oldGuild.progression.latestKills)
        .slice(0, 50);

    let raidName: keyof typeof guild.progression.raids;
    for (raidName in guild.progression.raids) {
        for (const key in guild.progression.raids[raidName]) {
            const difficulty = Number(key) as unknown as Difficulty;

            for (const bossName in guild.progression.raids[raidName]?.[
                difficulty
            ]) {
                let newBoss =
                    guild.progression.raids[raidName]?.[difficulty]?.[bossName];
                let oldBoss =
                    oldGuild.progression.raids[raidName]?.[difficulty]?.[
                        bossName
                    ];

                let updatedBoss: GuildBoss | undefined = undefined;

                if (oldBoss && newBoss) {
                    updatedBoss = {
                        ...oldBoss,
                        killCount: oldBoss.killCount + newBoss.killCount,
                        fastestKills: uniqueLogs([
                            ...oldBoss.fastestKills,
                            ...newBoss.fastestKills,
                        ])
                            .sort((a, b) => a.fightLength - b.fightLength)
                            .slice(0, 10),
                        firstKills: uniqueLogs([
                            ...oldBoss.firstKills,
                            ...newBoss.firstKills,
                        ])
                            .sort((a, b) => a.date - b.date)
                            .slice(0, 10),
                        latestKills: uniqueLogs([
                            ...oldBoss.latestKills,
                            ...newBoss.latestKills,
                        ])
                            .sort((a, b) => b.date - a.date)
                            .slice(0, 10),
                    };
                } else if (oldBoss) {
                    updatedBoss = oldBoss;
                } else if (newBoss) {
                    updatedBoss = newBoss;
                }

                if (updatedBoss) {
                    updatedGuild.progression.raids = addNestedObjectValue(
                        updatedGuild.progression.raids,
                        [raidName, difficulty, bossName],
                        updatedBoss
                    );
                }
            }
        }
    }

    for (let [day, hours] of guild.raidDays.total.entries()) {
        for (let [hour, killCount] of hours.entries()) {
            updatedGuild.raidDays.total[day][hour] += killCount;
        }
    }

    updatedGuild.activity = {
        ...updatedGuild.activity,
        ...guild.activity,
    };

    updatedGuild.raidDays.latest = getLatestGuildRaidDays(
        updatedGuild.progression.latestKills
    );

    updatedGuild.progression.completion = getGuildContentCompletion(
        updatedGuild.progression.raids
    );

    for (raidName in guild.ranking) {
        for (const key in guild.ranking[raidName]) {
            const difficulty = Number(key) as unknown as Difficulty;

            if (!updatedGuild.ranking[raidName]) {
                updatedGuild.ranking[raidName] = {};
            }

            if (!updatedGuild.ranking?.[raidName]?.[difficulty]) {
                updatedGuild.ranking = addNestedObjectValue(
                    updatedGuild.ranking,
                    [raidName, difficulty],
                    guild.ranking?.[raidName]?.[difficulty]
                );

                continue;
            }

            for (const weekId in guild.ranking?.[raidName]?.[difficulty]
                ?.fullClear.weeks) {
                let oldRaidGroups =
                    updatedGuild.ranking?.[raidName]?.[difficulty]?.fullClear
                        .weeks[weekId];

                let newRaidGroups =
                    guild.ranking?.[raidName]?.[difficulty]?.fullClear.weeks[
                        weekId
                    ];

                if (!newRaidGroups) {
                    continue;
                }

                if (!oldRaidGroups) {
                    updatedGuild.ranking = addNestedObjectValue(
                        updatedGuild.ranking,
                        [raidName, difficulty, "fullClear", "weeks", weekId],
                        newRaidGroups
                    );

                    continue;
                } else {
                    for (let newGroup of newRaidGroups) {
                        let added = false;
                        for (let i = 0; i < oldRaidGroups.length; i++) {
                            let oldGroup = oldRaidGroups[i];
                            if (
                                logs.sameMembers(
                                    oldGroup.members,
                                    newGroup.members,
                                    difficulty
                                )
                            ) {
                                oldRaidGroups[i] = {
                                    ...oldGroup,
                                    logs: [...oldGroup.logs, ...newGroup.logs],
                                };

                                updatedGuild.ranking = addNestedObjectValue(
                                    updatedGuild.ranking,
                                    [
                                        raidName,
                                        difficulty,
                                        "fullClear",
                                        "weeks",
                                        weekId,
                                    ],
                                    oldRaidGroups
                                );

                                added = true;
                                break;
                            }
                        }

                        if (!added) {
                            updatedGuild.ranking?.[raidName]?.[
                                difficulty
                            ]?.fullClear.weeks[weekId].push(newGroup);
                        }
                    }
                }
            }
        }
    }
    return updateGuildRanking(updatedGuild);
}

export function getLatestGuildRaidDays(logs: GuildLatestKill[]) {
    let { latest: raidDays } = JSON.parse(
        JSON.stringify(createGuildRaidDays())
    );

    const timeBoundary = timeTransformer
        .getLatestWednesday(new Date(new Date().getTime() - week * 2))
        .getTime();

    for (const log of logs) {
        if (log.date * 1000 > timeBoundary) {
            let logDate = new Date(log.date * 1000);

            raidDays[timeTransformer.unshiftDateDay(logDate.getUTCDay())][
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
        difficulties: {},
    };

    for (const key in guildRaids[environment.currentContent.name]) {
        const difficulty = Number(key) as unknown as Difficulty;

        if (!completion.difficulties[difficulty]) {
            completion.difficulties[difficulty] = {
                completed: false,
                bossesDefeated: 0,
            };
        }

        for (let _ in guildRaids?.[environment.currentContent.name]?.[
            difficulty
        ]) {
            completion.difficulties[difficulty].bossesDefeated++;
        }
        if (
            environment.currentContent.completionDifficulties.includes(
                difficulty as never
            ) &&
            completion.difficulties[difficulty].bossesDefeated ===
                environment.currentContent.bossCount
        ) {
            const firstKill =
                guildRaids?.[environment.currentContent.name]?.[difficulty]?.[
                    environment.currentContent.lastBoss
                ].firstKills[0].date || false;

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
                difficulty as never
            ) &&
            completion.bossesDefeated <
                completion.difficulties[difficulty].bossesDefeated
        )
            completion.bossesDefeated =
                completion.difficulties[difficulty].bossesDefeated;
    }

    return completion;
}

export function updateGuildRanking(guild: GuildDocument) {
    let raidName: RaidName;
    for (raidName in guild.ranking) {
        for (const key in guild.ranking[raidName]) {
            const difficulty = Number(key) as unknown as Difficulty;
            guild.ranking = addNestedObjectValue(
                guild.ranking,
                [raidName, difficulty, "fastestKills"],
                fastestGuildRanking(raidName, difficulty, guild)
            );

            const fullClear =
                guild.ranking?.[raidName]?.[difficulty]?.fullClear;

            if (!fullClear) continue;

            guild.ranking = addNestedObjectValue(
                guild.ranking,
                [raidName, difficulty, "fullClear"],
                fullClearGuildRanking(fullClear, raidName)
            );
        }
    }

    return guild;
}

export function fullClearGuildRanking(
    fullClearGuildRanking: GuildRankingFull,
    raidName: string
): GuildRankingFull {
    const raidInfo = getRaidInfoFromName(raidName);
    let bestTime = fullClearGuildRanking.time;
    let logs = fullClearGuildRanking.logs;

    const latestWeekId = Object.keys(fullClearGuildRanking.weeks).reduce(
        (acc, curr) => {
            if (Number(curr) > Number(acc)) {
                return Number(curr);
            }

            return acc;
        },
        0
    );

    for (const weekId in fullClearGuildRanking.weeks) {
        for (const raidGroup of fullClearGuildRanking.weeks[weekId]) {
            let completion: { [propName: string]: boolean } = {};
            for (const bossInfo of raidInfo.bosses) {
                completion[bossInfo.name] = false;
            }

            for (const log of raidGroup.logs) {
                completion[log.bossName] = true;
            }

            let completed = true;
            for (const bossName in completion) {
                if (!completion[bossName]) {
                    completed = false;
                }
            }

            if (completed) {
                raidGroup.logs = raidGroup.logs.sort((a, b) => a.date - b.date);

                let time =
                    (raidGroup.logs[raidGroup.logs.length - 1].date -
                        (raidGroup.logs[0].date -
                            raidGroup.logs[0].fightLength / 1000)) *
                    1000;

                if (!bestTime || time < bestTime) {
                    bestTime = time;
                    logs = raidGroup.logs;
                }
            }
        }
    }

    return {
        time: bestTime,
        logs: logs,
        weeks: { [latestWeekId]: fullClearGuildRanking.weeks[latestWeekId] },
    };
}

export function fastestGuildRanking(
    raidName: RaidName,
    difficulty: Difficulty,
    guild: GuildDocument
): GuildRankingFastest {
    const raidInfo = getRaidInfoFromName(raidName);
    let time = 0;
    let logs = [];

    for (const bossInfo of raidInfo.bosses) {
        if (
            !guild.progression.raids?.[raidName]?.[difficulty]?.[bossInfo.name]
        ) {
            return {
                time: false,
                logs: [],
            };
        }

        const fastestKill = guild.progression.raids?.[raidName]?.[difficulty]?.[
            bossInfo.name
        ].fastestKills[0] as unknown as GuildKillLog;

        time += fastestKill.fightLength;
        logs.push({ ...fastestKill, bossName: bossInfo.name });
    }

    return { time: time, logs: logs };
}
