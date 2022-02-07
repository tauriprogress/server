import environment from "../../environment";
import {
    guildId,
    unshiftDateDay,
    getLatestWednesday,
    getNestedObjectValue,
    addNestedObjectValue,
    sameMembers,
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
    guild.raidDays.total[unshiftDateDay(logDate.getUTCDay())][
        logDate.getUTCHours()
    ] += 1;

    guild.progression.latestKills.unshift({
        id: logId,
        date: date,
        boss: bossName,
        difficulty: difficulty,
    });

    const guildRankingFullClearCategory = [raidName, difficulty, "fullClear"];

    const weekId = getLatestWednesday(logDate).getTime();

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

            const currentDifficulty = environment.difficultyNames[
                difficulty as keyof typeof environment.difficultyNames
            ].includes("10")
                ? 10
                : 25;

            if (
                sameMembers(
                    raidGroup.members,
                    log.members.map((member) => member.name),
                    currentDifficulty
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
    currentGuildBoss.latestKills.slice(0, 50);

    guild = addNestedObjectValue(
        guild,
        guildBossCategorization,
        currentGuildBoss
    ) as GuildDocument;

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
