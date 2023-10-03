import { addNestedObjectValue, getNestedObjectValue, id, time } from "..";
import environment from "../../environment";
import tauriApi from "../../tauriApi";
import {
    ClassId,
    Difficulty,
    Faction,
    MilliSecond,
    RaidLogWithRealm,
    RaidName,
    Realm,
    Second,
} from "../../types";

import { Document } from "mongodb";

import { Log } from "../log";

export interface GuildDocument extends Document {
    _id: ReturnType<typeof id.guildId>;
    f: Faction;
    realm: Realm;
    name: string;
    members: GuildMember[];
    ranks: string[];
    activity: GuildActivity;
    progression: GuildProgression;
    raidDays: GuildRaidDays;
    ranking: Ranking;
}

export interface GuildMember {
    name: string;
    class: ClassId;
    rankName: string;
    lvl: number;
    race: string;
}

export type GuildActivity = {
    [key in Difficulty]?: number;
};

export interface GuildProgression {
    latestKills: GuildLatestKill[];
    completion: GuildCompletion;
    raids: GuildRaids;
}

export interface GuildLatestKill {
    id: number;
    date: number;
    boss: string;
    difficulty: Difficulty;
}

export interface GuildRaidDays {
    total: number[][];
    latest: number[][];
}

export interface GuildCompletion {
    completed: false | number;
    bossesDefeated: number;
    difficulties: {
        [propName: number]: {
            completed: false | number;
            bossesDefeated: number;
        };
    };
}

export type GuildRaids = {
    [key in RaidName]?: {
        [key in Difficulty]?: {
            [propName: string]: GuildBoss;
        };
    };
};

export interface GuildBoss {
    killCount: number;
    firstKills: GuildKillLog[];
    fastestKills: GuildKillLog[];
    latestKills: GuildKillLog[];
}

export interface GuildKillLog {
    id: number;
    fightLength: MilliSecond;
    date: Second;
}

type Ranking = {
    [key in RaidName]?: {
        [key in Difficulty]?: {
            fullClear: GuildRankingFull;
            fastestKills: GuildRankingFastest;
        };
    };
};

export interface GuildRankingFull {
    time: number | false;
    logs: GuildRankingLog[];
    weeks: {
        [propName: string]: GuildRankingRaidGroup[];
    };
}

export interface GuildRankingFastest {
    time: number | false;
    logs: GuildRankingLog[];
}

export interface GuildRankingLog {
    id: number;
    date: number;
    fightLength: number;
    bossName: string;
}

export interface GuildRankingRaidGroup {
    members: string[];
    logs: GuildRankingLog[];
}

export type GuildLeaderboard = {
    name: string;
    f: Faction;
    realm: Realm;
    ranking: Ranking;
}[];

interface GuildOfGuildList {
    _id: string;
    f: Faction;
    realm: Realm;
    name: string;
    activity: GuildActivity;
    progression: Omit<GuildProgression, "recentKills" | "raids">;
}

export type GuildList = GuildOfGuildList[];

export class GuildDocumentController {
    _id: ReturnType<typeof id.guildId>;
    f: Faction;
    realm: Realm;
    name: string;
    members: GuildMember[];
    ranks: string[];
    activity: GuildActivity;
    progression: GuildProgression;
    raidDays: GuildRaidDays;
    ranking: Ranking;

    private log: Log;

    constructor(
        obj:
            | {
                  guildName: string;
                  realm: Realm;
                  faction: Faction;
              }
            | GuildDocument,
        logUtil: Log
    ) {
        this.log = logUtil;
        if (this.isGuildDocument(obj)) {
            obj = JSON.parse(JSON.stringify(obj)) as GuildDocument;

            this._id = obj._id;
            this.f = obj.f;
            this.realm = obj.realm;
            this.name = obj.name;
            this.members = obj.members;
            this.ranks = obj.ranks;
            this.activity = obj.activity;
            this.progression = obj.progression;
            this.raidDays = obj.raidDays;
            this.ranking = obj.ranking;
        } else {
            this._id = id.guildId(obj.guildName, obj.realm);
            this.f = obj.faction;
            this.realm = obj.realm;
            this.name = obj.guildName;
            this.members = [];
            this.ranks = [];
            this.activity = {};
            this.progression = {
                latestKills: [],
                completion: {
                    completed: false,
                    bossesDefeated: 0,
                    difficulties: {},
                },
                raids: {},
            };
            this.raidDays = this.createGuildRaidDays();
            this.ranking = {};
        }
    }

    getDocument(): GuildDocument {
        return {
            _id: this._id,
            f: this.f,
            realm: this.realm,
            name: this.name,
            members: this.members,
            ranks: this.ranks,
            activity: this.activity,
            progression: this.progression,
            raidDays: this.raidDays,
            ranking: this.ranking,
        };
    }

    addLog(raidLog: RaidLogWithRealm): void {
        const logId = raidLog.log_id;
        const bossName = raidLog.encounter_data.encounter_name;
        const raidName = raidLog.mapentry.name;
        const difficulty = raidLog.difficulty;
        const fightLength = raidLog.fight_time;
        const date = raidLog.killtime;

        const logDate = new Date(date * 1000);
        const weekId = time.dateToString(time.getLatestWednesday(logDate));

        const updateActivity = () => {
            this.activity[difficulty] = date;
        };

        const updateRaidDays = () => {
            this.raidDays.total[time.unshiftDateDay(logDate.getUTCDay())][
                logDate.getUTCHours()
            ] += 1;
        };

        const updateLatestKills = () => {
            this.progression.latestKills.unshift({
                id: logId,
                date: date,
                boss: bossName,
                difficulty: difficulty,
            });
            this.progression.latestKills = this.progression.latestKills.slice(
                0,
                50
            );
        };

        const updateRanking = () => {
            const guildRankingFullClearCategory = [
                raidName,
                difficulty,
                "fullClear",
            ];

            let guildRankingFullClear = (getNestedObjectValue(
                this.ranking,
                guildRankingFullClearCategory
            ) as GuildRankingFull | undefined) || {
                time: false,
                logs: [],
                weeks: {},
            };

            if (!guildRankingFullClear.weeks[weekId]) {
                guildRankingFullClear.weeks[weekId] = [
                    {
                        members: raidLog.members.map((member) => member.name),
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

                for (let raidGroup of guildRankingFullClear.weeks[weekId]) {
                    if (
                        this.log.sameMembers(
                            raidGroup.members,
                            raidLog.members.map((member) => member.name),
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

                        break;
                    }
                }

                if (!logAddedToRanking) {
                    guildRankingFullClear.weeks[weekId].push({
                        members: raidLog.members.map((member) => member.name),
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

            this.ranking = addNestedObjectValue(
                this.ranking,
                guildRankingFullClearCategory,
                guildRankingFullClear
            );
        };

        const updateProgression = () => {
            const guildBossCategorization = [
                "raids",
                raidName,
                difficulty,
                bossName,
            ];

            let currentGuildBoss =
                (getNestedObjectValue(
                    this.progression,
                    guildBossCategorization
                ) as GuildBoss | false) || this.createGuildBoss();

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
            currentGuildBoss.latestKills = currentGuildBoss.latestKills.slice(
                0,
                10
            );

            this.progression = addNestedObjectValue(
                this.progression,
                guildBossCategorization,
                currentGuildBoss
            ) as GuildProgression;
        };

        updateActivity();
        updateRaidDays();
        updateLatestKills();
        updateRanking();
        updateProgression();
    }

    private createGuildRaidDays(): GuildRaidDays {
        return {
            total: new Array(7).fill(0).map(() => new Array(24).fill(0)),
            latest: new Array(7).fill(0).map(() => new Array(24).fill(0)),
        };
    }

    private createGuildBoss(): GuildBoss {
        return {
            killCount: 0,
            firstKills: [],
            fastestKills: [],
            latestKills: [],
        };
    }

    isGuildDocument(obj: any): obj is GuildDocument {
        if (obj && obj._id) {
            return true;
        }
        return false;
    }

    extendData(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await tauriApi.getGuildData(
                    this.name,
                    this.realm
                );
                const guildData = response.response;

                for (const memberId in guildData.guildList) {
                    this.members.push({
                        name: guildData.guildList[memberId].name,
                        class: guildData.guildList[memberId].class,
                        rankName: guildData.guildList[memberId].rank_name,
                        lvl: guildData.guildList[memberId].level,
                        race: `${guildData.guildList[memberId].race},${guildData.guildList[memberId].gender}`,
                    });
                }

                for (const rankId in guildData.gRanks) {
                    this.ranks.push(guildData.gRanks[rankId].rname);
                }

                this.f = guildData.gFaction;

                for (const guild of environment.guildFactionBugs) {
                    if (
                        this.name === guild.guildName &&
                        this.realm === guild.realm
                    ) {
                        this.f = guild.faction;
                    }
                }
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    refreshValues() {
        this.resfreshRaidDaysLatest();
        this.refreshProgressionCompletion();
        this.refreshRanking();
    }

    mergeGuildDocument(guild: GuildDocument): void {
        const mergeFaction = () => {
            this.f = guild.f;
        };

        const mergeMembers = () => {
            this.members = JSON.parse(JSON.stringify(guild.members));
        };
        const mergeRanks = () => {
            this.ranks = JSON.parse(JSON.stringify(guild.ranks));
        };

        const mergeProgressionLatestKills = () => {
            this.progression.latestKills = guild.progression.latestKills
                .concat(this.progression.latestKills)
                .slice(0, 50);
        };

        const mergeProgressionRaidBoss = () => {
            let raidName: keyof typeof guild.progression.raids;
            for (raidName in guild.progression.raids) {
                for (const key in guild.progression.raids[raidName]) {
                    const difficulty = Number(key) as unknown as Difficulty;

                    for (const bossName in guild.progression.raids[raidName]?.[
                        difficulty
                    ]) {
                        let newBoss =
                            guild.progression.raids[raidName]?.[difficulty]?.[
                                bossName
                            ];
                        let oldBoss =
                            this.progression.raids[raidName]?.[difficulty]?.[
                                bossName
                            ];

                        let updatedBoss: GuildBoss | undefined = undefined;

                        if (oldBoss && newBoss) {
                            updatedBoss = {
                                ...oldBoss,
                                killCount:
                                    oldBoss.killCount + newBoss.killCount,
                                fastestKills: this.log
                                    .uniqueLogs([
                                        ...oldBoss.fastestKills,
                                        ...newBoss.fastestKills,
                                    ])
                                    .sort(
                                        (a, b) => a.fightLength - b.fightLength
                                    )
                                    .slice(0, 10),
                                firstKills: this.log
                                    .uniqueLogs([
                                        ...oldBoss.firstKills,
                                        ...newBoss.firstKills,
                                    ])
                                    .sort((a, b) => a.date - b.date)
                                    .slice(0, 10),
                                latestKills: this.log
                                    .uniqueLogs([
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
                            this.progression.raids = addNestedObjectValue(
                                this.progression.raids,
                                [raidName, difficulty, bossName],
                                updatedBoss
                            );
                        }
                    }
                }
            }
        };

        const mergeRaidDaysTotal = () => {
            for (let [day, hours] of guild.raidDays.total.entries()) {
                for (let [hour, killCount] of hours.entries()) {
                    this.raidDays.total[day][hour] += killCount;
                }
            }
        };

        const mergeActivity = () => {
            this.activity = {
                ...this.activity,
                ...guild.activity,
            };
        };

        const mergeRanking = () => {
            let raidName: keyof typeof guild.progression.raids;
            for (raidName in guild.ranking) {
                for (const key in guild.ranking[raidName]) {
                    const difficulty = Number(key) as unknown as Difficulty;

                    if (!this.ranking[raidName]) {
                        this.ranking[raidName] = {};
                    }

                    if (!this.ranking?.[raidName]?.[difficulty]) {
                        this.ranking = addNestedObjectValue(
                            this.ranking,
                            [raidName, difficulty],
                            guild.ranking?.[raidName]?.[difficulty]
                        );

                        continue;
                    }

                    for (const weekId in guild.ranking?.[raidName]?.[difficulty]
                        ?.fullClear.weeks) {
                        let oldRaidGroups =
                            this.ranking?.[raidName]?.[difficulty]?.fullClear
                                .weeks[weekId];

                        let newRaidGroups =
                            guild.ranking?.[raidName]?.[difficulty]?.fullClear
                                .weeks[weekId];

                        if (!newRaidGroups) {
                            continue;
                        }

                        if (!oldRaidGroups) {
                            this.ranking = addNestedObjectValue(
                                this.ranking,
                                [
                                    raidName,
                                    difficulty,
                                    "fullClear",
                                    "weeks",
                                    weekId,
                                ],
                                newRaidGroups
                            );

                            continue;
                        } else {
                            for (let newGroup of newRaidGroups) {
                                let added = false;
                                for (let i = 0; i < oldRaidGroups.length; i++) {
                                    let oldGroup = oldRaidGroups[i];
                                    if (
                                        this.log.sameMembers(
                                            oldGroup.members,
                                            newGroup.members,
                                            difficulty
                                        )
                                    ) {
                                        oldRaidGroups[i] = {
                                            ...oldGroup,
                                            logs: [
                                                ...oldGroup.logs,
                                                ...newGroup.logs,
                                            ],
                                        };

                                        this.ranking = addNestedObjectValue(
                                            this.ranking,
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
                                    this.ranking?.[raidName]?.[
                                        difficulty
                                    ]?.fullClear.weeks[weekId].push(newGroup);
                                }
                            }
                        }
                    }
                }
            }
        };

        mergeFaction();
        mergeMembers();
        mergeRanks();
        mergeProgressionLatestKills();
        mergeProgressionRaidBoss();
        mergeRaidDaysTotal();
        mergeActivity();
        mergeRanking();

        this.refreshValues();
    }

    private resfreshRaidDaysLatest() {
        let { latest: raidDays } = JSON.parse(
            JSON.stringify(this.createGuildRaidDays())
        );

        const timeBoundary = time
            .getLatestWednesday(
                new Date(new Date().getTime() - environment.week * 2)
            )
            .getTime();

        for (const log of this.progression.latestKills) {
            if (log.date * 1000 > timeBoundary) {
                let logDate = new Date(log.date * 1000);

                raidDays[time.unshiftDateDay(logDate.getUTCDay())][
                    logDate.getUTCHours()
                ] += 1;
            } else {
                break;
            }
        }

        this.raidDays.latest = raidDays;
    }

    private refreshProgressionCompletion() {
        this.progression.completion = getGuildContentCompletion(
            this.progression.raids
        );
    }

    private refreshRanking() {
        let raidName: RaidName;
        for (raidName in this.ranking) {
            for (const key in this.ranking[raidName]) {
                const difficulty = Number(key) as unknown as Difficulty;
                this.ranking = addNestedObjectValue(
                    this.ranking,
                    [raidName, difficulty, "fastestKills"],
                    fastestGuildRanking(raidName, difficulty, this)
                );

                const fullClear =
                    this.ranking?.[raidName]?.[difficulty]?.fullClear;

                if (!fullClear) continue;

                this.ranking = addNestedObjectValue(
                    this.ranking,
                    [raidName, difficulty, "fullClear"],
                    fullClearGuildRanking(fullClear, raidName)
                );
            }
        }
    }
}

function getGuildContentCompletion(guildRaids: GuildRaids): GuildCompletion {
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

export function fullClearGuildRanking(
    fullClearGuildRanking: GuildRankingFull,
    raidName: RaidName
): GuildRankingFull {
    const raidInfo = environment.getRaidInfoFromName(raidName);
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
    const raidInfo = environment.getRaidInfoFromName(raidName);
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
