import {
    getRecentGuildRaidDays,
    getGuildContentCompletion,
    getNestedObjectValue,
    addNestedObjectValue,
    uniqueLogs,
    guildRecentKills,
    getRaidInfoFromName
} from "../../helpers";

import { Guild, GuildBoss, GuildRankingFastest } from "../../types";

export function updateGuildData(oldGuild: Guild, newGuild: Guild) {
    let updatedGuild: Guild = {
        ...JSON.parse(JSON.stringify(oldGuild)),
        ...(({ progression, raidDays, activity, ...others }) => ({
            ...JSON.parse(JSON.stringify(others)),
            members: newGuild.members.length
                ? newGuild.members
                : oldGuild.members,
            ranks: newGuild.ranks.length ? newGuild.ranks : oldGuild.ranks
        }))(newGuild)
    };

    for (const raidName in newGuild.progression.raids) {
        for (const difficulty in newGuild.progression.raids[raidName]) {
            for (const bossName in newGuild.progression.raids[raidName][
                difficulty
            ]) {
                const bossCategorization = [raidName, difficulty, bossName];
                let oldBoss: GuildBoss = getNestedObjectValue(
                    oldGuild.progression.raids,
                    bossCategorization
                );
                let newBoss: GuildBoss = getNestedObjectValue(
                    newGuild.progression.raids,
                    bossCategorization
                );

                let updatedBoss: GuildBoss;
                if (oldBoss) {
                    updatedBoss = {
                        ...oldBoss,
                        killCount: oldBoss.killCount + newBoss.killCount,
                        fastestKills: uniqueLogs([
                            ...oldBoss.fastestKills,
                            ...newBoss.fastestKills
                        ])
                            .sort((a, b) => a.fightLength - b.fightLength)
                            .slice(0, 10)
                    };

                    for (const combatMetric of ["dps", "hps"] as const) {
                        for (const characterId in newBoss[combatMetric]) {
                            const oldCharacter =
                                oldBoss[combatMetric][characterId];

                            const oldPerformance =
                                (oldCharacter && oldCharacter[combatMetric]) ||
                                0;

                            const newCharacter =
                                newBoss[combatMetric][characterId];

                            const newPerformance =
                                newCharacter[combatMetric] || 0;
                            if (
                                !oldCharacter ||
                                oldPerformance < newPerformance
                            ) {
                                updatedBoss[combatMetric][
                                    characterId
                                ] = newCharacter;
                            }
                        }
                    }
                } else {
                    updatedBoss = newBoss;
                }

                updatedGuild.progression.raids = addNestedObjectValue(
                    updatedGuild.progression.raids,
                    bossCategorization,
                    updatedBoss
                );
            }
        }

        updatedGuild.progression.recentKills = guildRecentKills(
            uniqueLogs([
                ...newGuild.progression.recentKills,
                ...oldGuild.progression.recentKills
            ])
        );
    }

    if (newGuild.raidDays) {
        for (let [day, hours] of newGuild.raidDays.total.entries()) {
            for (let [hour, killCount] of hours.entries()) {
                updatedGuild.raidDays.total[day][hour] += killCount;
            }
        }
    }

    if (newGuild.activity) {
        updatedGuild.activity = {
            ...updatedGuild.activity,
            ...newGuild.activity
        };
    }

    updatedGuild.raidDays.recent = getRecentGuildRaidDays(
        updatedGuild.progression.recentKills
    );
    updatedGuild.progression.completion = getGuildContentCompletion(
        updatedGuild.progression.raids
    );

    return updatedGuild;
}

export function updateGuildRanking(guild: Guild) {
    for (const raidName in guild.ranking) {
        for (const difficulty in guild.ranking[raidName]) {
            guild.ranking[raidName][
                difficulty
            ].fastestKills = fastestGuildRanking(
                raidName,
                Number(difficulty),
                guild
            );
        }
    }

    return guild;
}

export function fastestGuildRanking(
    raidName: string,
    difficulty: number,
    guild: Guild
): GuildRankingFastest {
    const raidInfo = getRaidInfoFromName(raidName);
    let time = 0;
    let logs = [];

    for (const bossInfo of raidInfo.bosses) {
        if (
            !guild.progression.raids[raidName] ||
            !guild.progression.raids[raidName][difficulty] ||
            !guild.progression.raids[raidName][difficulty][bossInfo.name]
        ) {
            return {
                time: false,
                logs: []
            };
        }

        const fastestKill =
            guild.progression.raids[raidName][difficulty][bossInfo.name]
                .fastestKills[0];

        time += fastestKill.fightLength;
        logs.push(fastestKill);
    }

    return { time: time, logs: logs };
}
