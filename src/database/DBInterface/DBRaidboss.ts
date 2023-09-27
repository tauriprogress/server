import { ClientSession } from "mongodb";
import { Faction } from "tauriprogress-constants/build/globalTypes";
import { DatabaseInterface } from ".";
import { CharacterDocument, RaidBossDocument, id } from "../../helpers";
import documentManager from "../../helpers/documents";
import { ERR_BOSS_NOT_FOUND } from "../../helpers/errors";
import filter, { Filters } from "../../helpers/filter";
import { CombatMetric, Difficulty, Realm, TrimmedLog } from "../../types";
import cache from "../Cache";

export class DBRaidboss {
    public firstRaidbossCacheLoad: boolean | Promise<true>;

    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
        this.firstRaidbossCacheLoad = false;
    }

    async getRaidBoss(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<RaidBossDocument> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const bossId = id.raidBossId(ingameBossId, difficulty);

                const cachedData = cache.getRaidBoss(bossId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const bossData = await db
                        .collection<RaidBossDocument>(
                            this.dbInterface.collections.raidBosses
                        )
                        .findOne({ _id: bossId });

                    if (!bossData) {
                        throw ERR_BOSS_NOT_FOUND;
                    }

                    cache.raidBoss.set(bossId, bossData);

                    resolve(bossData);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossKillCount(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(
                    (await this.getRaidBoss(ingameBossId, difficulty)).killCount
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossFastestKills(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<TrimmedLog[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const categorizedFastestKills = (
                    await this.getRaidBoss(ingameBossId, difficulty)
                ).fastestKills;
                let fastestKills: TrimmedLog[] = [];

                for (const key in categorizedFastestKills) {
                    const realm = key as unknown as Realm;
                    for (const key in categorizedFastestKills[realm]) {
                        const faction = key as unknown as Faction;
                        const logs =
                            categorizedFastestKills?.[realm]?.[faction];
                        if (logs) {
                            fastestKills = fastestKills.concat(logs);
                        }
                    }
                }

                resolve(
                    fastestKills
                        .sort((a, b) => a.fightLength - b.fightLength)
                        .slice(0, 50)
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossLatestKills(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<TrimmedLog[]> {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(
                    (await this.getRaidBoss(ingameBossId, difficulty))
                        .latestKills
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossCharacters(
        ingameBossId: number,
        combatMetric: CombatMetric,
        filters: Filters,
        page: number,
        pageSize: number
    ): Promise<{ characters: CharacterDocument[]; itemCount: number }> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<CharacterDocument>(
                    id.characterDocumentCollectionId(
                        ingameBossId,
                        filters.difficulty,
                        combatMetric
                    )
                );

                const matchQuery =
                    filter.filtersToAggregationMatchQuery(filters);
                const sort = { [combatMetric]: -1 };
                const skip = pageSize * page;
                const limit = pageSize;

                const result = (
                    await collection
                        .aggregate([
                            {
                                $facet: {
                                    characters: [
                                        { $match: matchQuery },
                                        { $sort: sort },
                                        { $skip: skip },
                                        { $limit: limit },
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
                )[0] as { characters: CharacterDocument[]; itemCount: number };

                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveRaidBoss(boss: RaidBossDocument, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const raidCollection = db.collection<RaidBossDocument>(
                    this.dbInterface.collections.raidBosses
                );

                const oldBoss = await raidCollection.findOne(
                    {
                        _id: boss._id,
                    },
                    { session: session }
                );

                if (!oldBoss) {
                    await raidCollection.insertOne(boss, {
                        session,
                    });
                } else {
                    const bossDocumentManager = new documentManager.raidBoss(
                        oldBoss
                    );
                    bossDocumentManager.mergeRaidBossDocument(boss);

                    const newDocument = bossDocumentManager.getDocument();

                    await raidCollection.updateOne(
                        {
                            _id: boss._id,
                        },
                        {
                            $set: newDocument,
                        },
                        {
                            session,
                        }
                    );
                }

                this.dbInterface.update.addToUpdatedRaidbosses(boss._id);

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateRaidBossCache(): Promise<void> {
        const fullLoad = async (): Promise<true> => {
            return new Promise(async (resolve, reject) => {
                try {
                    const db = this.dbInterface.maintenance.getConnection();

                    for (const boss of await db
                        .collection<RaidBossDocument>(
                            this.dbInterface.collections.raidBosses
                        )
                        .find()
                        .toArray()) {
                        cache.raidBoss.set(boss._id, boss);
                    }

                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            });
        };

        return new Promise(async (resolve, reject) => {
            try {
                console.log("Updating raidboss cache.");

                const db = this.dbInterface.maintenance.getConnection();

                if (!this.firstRaidbossCacheLoad) {
                    this.firstRaidbossCacheLoad = fullLoad();
                } else {
                    const bossesToUpdate =
                        this.dbInterface.update.getUpdatedBossIds();

                    for (const bossId of bossesToUpdate) {
                        const boss = await db
                            .collection<RaidBossDocument>(
                                this.dbInterface.collections.raidBosses
                            )
                            .findOne({ _id: bossId });
                        if (boss) {
                            cache.raidBoss.set(bossId, boss);
                        }
                    }

                    this.dbInterface.update.resetUpdatedBossIds();
                }
                console.log("Raidboss cache updated.");
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
}

export default DBRaidboss;
