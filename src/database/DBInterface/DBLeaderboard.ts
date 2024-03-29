import { ClientSession } from "mongodb";
import { DatabaseInterface } from ".";
import environment from "../../environment";
import {
    CharacterDocument,
    GuildDocument,
    GuildLeaderboard,
    LeaderboardCharacterDocument,
    LeaderboardCharacterScoredDocument,
    capitalize,
    createLeaderboardCharacterDocument,
    id,
} from "../../helpers";
import { filter, Filters } from "../../helpers";
import { CombatMetric, Difficulty, RaidName } from "../../types";
import cache from "../cache";

export class DBLeaderboard {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }
    async getCharacterLeaderboard(
        raidName: RaidName,
        combatMetric: CombatMetric,
        filters: Filters,
        page: number,
        pageSize: number
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const leaderboardId = id.cache.characterLeaderboardCacheId(
                    raidName,
                    combatMetric,
                    filters,
                    page
                );

                const cachedData = cache.getCharacterLeaderboard(leaderboardId);
                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const bosses =
                        environment.getRaidInfoFromName(raidName).bosses;

                    let bestPerformances: { [key: string]: number } = {};

                    for (const boss of bosses) {
                        bestPerformances[boss.name] =
                            (
                                await this.dbInterface.raidboss.getRaidBoss(
                                    boss.bossIdOfDifficulty[
                                        filters.difficulty as keyof typeof boss.bossIdOfDifficulty
                                    ],
                                    filters.difficulty
                                )
                            )[
                                `best${capitalize(combatMetric)}NoCat` as const
                            ]?.[combatMetric] || 0;
                    }

                    const collection =
                        db.collection<LeaderboardCharacterDocument>(
                            combatMetric === "dps"
                                ? this.dbInterface.collections
                                      .characterLeaderboardDps.name
                                : this.dbInterface.collections
                                      .characterLeaderboardHps.name
                        );

                    const matchQuery = {
                        ...filter.filtersToAggregationMatchQuery(filters),
                        difficulty: filters.difficulty,
                        raidName: raidName,
                    };

                    const scoreField = {
                        score: {
                            $multiply: [
                                {
                                    $divide: [
                                        {
                                            $add: bosses.map((boss) => {
                                                const fieldName = `$bosses.${boss.name}`;
                                                const calculation = {
                                                    $multiply: [
                                                        {
                                                            $divide: [
                                                                {
                                                                    $cond: {
                                                                        if: {
                                                                            $isNumber:
                                                                                fieldName,
                                                                        },
                                                                        then: fieldName,
                                                                        else: 0,
                                                                    },
                                                                },
                                                                bestPerformances[
                                                                    boss.name
                                                                ],
                                                            ],
                                                        },
                                                        100,
                                                    ],
                                                };
                                                return bestPerformances[
                                                    boss.name
                                                ]
                                                    ? calculation
                                                    : 0;
                                            }),
                                        },
                                        bosses.length * 100,
                                    ],
                                },
                                environment.maxCharacterScore,
                            ],
                        },
                    };
                    const sort = { score: -1 };
                    const project = { bosses: 0 };
                    const skip = pageSize * page;
                    const limit = pageSize;
                    const result = (
                        await collection
                            .aggregate([
                                {
                                    $facet: {
                                        characters: [
                                            { $match: matchQuery },
                                            { $addFields: scoreField },
                                            { $sort: sort },
                                            { $skip: skip },
                                            { $limit: limit },
                                            { $project: project },
                                        ],
                                        itemCount: [
                                            { $match: matchQuery },
                                            {
                                                $group: {
                                                    _id: null,
                                                    n: { $sum: 1 },
                                                },
                                            },
                                        ],
                                    },
                                },
                                {
                                    $addFields: {
                                        itemCount: {
                                            $first: "$$CURRENT.itemCount.n",
                                        },
                                    },
                                },
                            ])
                            .toArray()
                    )[0] as {
                        characters: LeaderboardCharacterScoredDocument[];
                        itemCount: number;
                    };

                    if (page === 0) {
                        cache.characterLeaderboard.set(leaderboardId, result);
                    }

                    resolve(result);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    async getGuildLeaderboard(): Promise<GuildLeaderboard> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const cachedData = cache.getGuildLeaderboard();

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const guildLeaderboard = (await db
                        .collection<GuildDocument>(
                            this.dbInterface.collections.guilds.name
                        )
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            ranking: 1,
                        })
                        .toArray()) as GuildLeaderboard;

                    cache.guildLeaderboard.set(
                        cache.guildLeaderboardId,
                        guildLeaderboard
                    );

                    resolve(guildLeaderboard);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    saveCharactersToLeaderboard(
        characters: CharacterDocument[],
        raidName: RaidName,
        difficulty: Difficulty,
        bossName: string,
        combatMetric: CombatMetric,
        session?: ClientSession
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();
                const collection = db.collection<LeaderboardCharacterDocument>(
                    combatMetric === "dps"
                        ? this.dbInterface.collections.characterLeaderboardDps
                              .name
                        : this.dbInterface.collections.characterLeaderboardHps
                              .name
                );

                await collection.bulkWrite(
                    characters.map((character) => {
                        const doc = createLeaderboardCharacterDocument(
                            character,
                            raidName,
                            difficulty
                        );
                        return {
                            updateOne: {
                                filter: {
                                    _id: doc._id,
                                },
                                update: {
                                    $set: {
                                        ...(({
                                            ilvl,
                                            f,
                                            race,
                                            bosses,
                                            ...rest
                                        }) => {
                                            return rest;
                                        })(doc),
                                    },
                                    $max: {
                                        ilvl: doc.ilvl,
                                        [`bosses.${bossName}`]:
                                            character[combatMetric],
                                    },

                                    $setOnInsert: {
                                        f: doc.f,
                                        race: doc.race,
                                    },
                                },
                                upsert: true,
                            },
                        };
                    }),
                    { session }
                );
                resolve(true);
            } catch (e) {
                reject(e);
            }
        });
    }
}

export default DBLeaderboard;
