import {
    MaintenanceDocument,
    GuildDocument,
    RaidBossDocument,
    Realm,
    CharacterDocument,
    LeaderboardCharacterDocument,
    LeaderboardCharacterAggregated,
} from "../types";
import { Database } from "../database";
import { ReadConcern } from "mongodb";

import cache from "../database/cache";
import {
    ERR_DB_CONNECTION,
    ERR_DB_ALREADY_UPDATING,
    ERR_GUILD_NOT_FOUND,
    ERR_DB_TANSACTION,
} from "../helpers/errors";
import {
    getLogData,
    logBugHandler,
    processLogs,
    minutesAgo,
    isError,
    getGuildId,
    requestGuildDocument,
    getCharacterDocumentRankBulkwriteOperations,
    getDeconstructedCharacterDocumentCollectionId,
    getRaidInfoFromName,
    getLeaderboardCharacterId,
} from "../helpers";
import { combatMetrics } from "../constants";

function updateDatabase(db: Database) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db.connection) throw ERR_DB_CONNECTION;
            if (!db.client) throw ERR_DB_CONNECTION;
            if (db.isUpdating) throw ERR_DB_ALREADY_UPDATING;

            console.log("Updating database.");
            const updateStarted = new Date().getTime() / 1000;
            db.isUpdating = true;
            db.updateStatus = "Database is updating.";
            db.lastUpdated = updateStarted;

            const maintenanceCollection =
                db.connection.collection<MaintenanceDocument>(
                    db.collections.maintenance
                );

            const maintenanceDocument = await maintenanceCollection.findOne();

            const lastLogIds = !maintenanceDocument
                ? {}
                : maintenanceDocument.lastLogIds;

            let { logs, lastLogIds: newLastLogIds } = await getLogData(
                false,
                lastLogIds
            );

            logs = logBugHandler(logs);
            const session = db.client.startSession();

            try {
                console.log("Opening new transaction session");
                await session.withTransaction(
                    async () => {
                        await db.saveLogs(
                            processLogs(logs),
                            {
                                lastLogIds: newLastLogIds,
                                updateStarted,
                            },
                            session
                        );
                    },
                    {
                        readConcern: new ReadConcern("majority"),
                        writeConcern: {
                            w: "majority",
                            j: true,
                        },
                    }
                );
            } catch (err) {
                console.log("transaction error");
                console.error(err);
                throw ERR_DB_TANSACTION;
            } finally {
                session.endSession();
                console.log("Transaction session closed");
            }

            await updateRaidBossCache(db);
            await updateCharacterDocumentRanks(db);

            cache.clearRaidSummary();
            cache.clearCharacterPerformance();

            await updateLeaderboardScores(db);

            db.isUpdating = false;
            db.updateStatus = "";

            console.log("Database update finished");
            resolve(true);
        } catch (err) {
            if (
                !isError(err) ||
                err.message !== ERR_DB_ALREADY_UPDATING.message
            ) {
                console.log(`Database update error`);
                db.isUpdating = false;
                db.updateStatus = "";
            }

            reject(err);
        }
    });
}

function updateGuilds(db: Database) {
    return new Promise(async (resolve, reject) => {
        try {
            if (!db.connection) throw ERR_DB_CONNECTION;
            if (db.isUpdating) throw ERR_DB_ALREADY_UPDATING;

            if (minutesAgo(db.lastGuildsUpdate) > 720) {
                const updateStarted = new Date().getTime() / 1000;
                const maintenanceCollection =
                    db.connection.collection<MaintenanceDocument>(
                        db.collections.maintenance
                    );

                console.log("Updating guilds");
                db.updateStatus = "Updating guilds.";
                db.isUpdating = true;
                db.lastGuildsUpdate = updateStarted;

                const guilds = (await db.connection
                    .collection<GuildDocument>(db.collections.guilds)
                    .find()
                    .project({
                        _id: 1,
                        name: 1,
                        realm: 1,
                    })
                    .toArray()) as {
                    _id: ReturnType<typeof getGuildId>;
                    name: string;
                    realm: Realm;
                }[];

                let total = guilds.length;
                let current = 0;

                for (let guild of guilds) {
                    try {
                        current++;
                        console.log(
                            `Updating ${guild.name} ${current}/${total}`
                        );

                        const newGuild = await requestGuildDocument(
                            guild.name,
                            guild.realm
                        );

                        await db.saveGuild({
                            ...newGuild,
                            _id: guild._id,
                        });
                    } catch (err) {
                        if (
                            isError(err) &&
                            err.message &&
                            err.message.includes(ERR_GUILD_NOT_FOUND.message)
                        ) {
                            db.removeGuild(guild._id);
                        } else {
                            console.log(`Error while updating ${guild.name}:`);
                            console.error(err);
                        }
                    }
                }

                await maintenanceCollection.updateOne(
                    {},
                    {
                        $set: {
                            lastGuildsUpdate: db.lastGuildsUpdate,
                        },
                    }
                );

                db.isUpdating = false;
                db.updateStatus = "";

                console.log("Guilds updated.");
            } else {
                console.log("Guild update is not due yet.");
            }

            resolve(true);
        } catch (e) {
            db.isUpdating = false;
            db.updateStatus = "";

            reject(e);
        }
    });
}

export async function updateRaidBossCache(db: Database) {
    const fullLoad = async (): Promise<true> => {
        return new Promise(async (resolve, reject) => {
            try {
                if (!db.connection) throw ERR_DB_CONNECTION;

                for (const boss of await db.connection
                    .collection<RaidBossDocument>(db.collections.raidBosses)
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
            if (!db.connection) throw ERR_DB_CONNECTION;

            if (!db.firstCacheLoad) {
                db.firstCacheLoad = fullLoad();
            } else {
                const bossesToUpdate = db.getUpdatedBossIds();

                for (const bossId of bossesToUpdate) {
                    const boss = await db.connection
                        .collection<RaidBossDocument>(db.collections.raidBosses)
                        .findOne({ _id: bossId });
                    if (boss) {
                        cache.raidBoss.set(bossId, boss);
                    }
                }

                db.resetUpdatedBossIds();
            }
            console.log("Raidboss cache updated.");
            resolve(true);
        } catch (err) {
            reject(err);
        }
    });
}

export function updateCharacterDocumentRanks(db: Database) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Updating character ranks.");
            if (!db.connection) throw ERR_DB_CONNECTION;

            const collectionsToUpdate =
                db.getUpdatedCharacterDocumentCollectionIds();
            for (const collectionId of collectionsToUpdate) {
                const collection =
                    db.connection.collection<CharacterDocument>(collectionId);
                const [_1, _2, combatMetric] =
                    getDeconstructedCharacterDocumentCollectionId(collectionId);

                await collection.bulkWrite(
                    getCharacterDocumentRankBulkwriteOperations(
                        await collection
                            .find()
                            .sort({
                                [combatMetric]: -1,
                            })
                            .toArray()
                    )
                );
            }

            db.resetUpdatedCharacterDocumentCollections();

            console.log("Character ranks updated.");

            resolve(true);
        } catch (e) {
            reject(e);
        }
    });
}

export function updateLeaderboardScores(db: Database) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log("Updating character leaderboard scores.");
            if (!db.connection) throw ERR_DB_CONNECTION;

            const lastLeaderboardUpdate = await db.getLastLeaderboardUpdate();
            let operations: Promise<any[]>[] = [];

            for (const combatMetric of combatMetrics) {
                const collection =
                    db.connection.collection<LeaderboardCharacterDocument>(
                        combatMetric === "dps"
                            ? db.collections.characterLeaderboardDps
                            : db.collections.characterLeaderboardHps
                    );

                await collection
                    .aggregate<LeaderboardCharacterAggregated>([
                        {
                            $match: {
                                lastUpdated: {
                                    $gt: lastLeaderboardUpdate,
                                },
                            },
                        },
                        {
                            $group: {
                                _id: { $concat: ["$name", " ", "$realm"] },
                                name: { $last: "$name" },
                                realm: { $last: "$realm" },
                                class: { $last: "$class" },
                                raidName: { $last: "$raidName" },
                            },
                        },
                    ])
                    .batchSize(1000)
                    .forEach((document) => {
                        operations.push(
                            db
                                .getCharacterPerformance(
                                    document.name,
                                    document.class,
                                    document.realm,
                                    document.raidName
                                )
                                .then((characterPerformance) => {
                                    const difficulties = getRaidInfoFromName(
                                        document.raidName
                                    ).difficulties;
                                    let result = [];

                                    for (const difficulty of difficulties) {
                                        result.push({
                                            updateOne: {
                                                filter: {
                                                    _id: getLeaderboardCharacterId(
                                                        document.name,
                                                        document.realm,
                                                        document.raidName,
                                                        difficulty
                                                    ),
                                                },
                                                update: {
                                                    $set: {
                                                        score: characterPerformance[
                                                            document.raidName
                                                        ][difficulty].total
                                                            .class[
                                                            combatMetric
                                                        ],
                                                    },
                                                },
                                            },
                                        });
                                    }

                                    return result;
                                })
                        );
                    });

                if (operations.length) {
                    await collection.bulkWrite(
                        (await Promise.all(operations)).flat()
                    );
                }
            }

            db.saveLastLeaderboardUpdateDate(new Date());

            console.log("Character scores updated");

            resolve(true);
        } catch (e) {
            console.log(e);
            reject(e);
        }
    });
}

export default [
    {
        name: "Update database",
        interval: 1000 * 60 * 30,
        minDelay: 1000 * 60 * 15,
        perform: updateDatabase,
    },
    {
        name: "Update guilds",
        interval: 1000 * 60 * 60 * 12,
        minDelay: 1000 * 60 * 60 * 10,
        perform: updateGuilds,
    },
];
