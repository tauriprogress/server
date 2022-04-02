import {
    MaintenanceDocument,
    GuildDocument,
    RaidBossDocument,
    Realm,
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
} from "../helpers";

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
            await db.updateLeaderboard();

            cache.clearRaidSummary();
            cache.clearCharacterPerformance();

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

            if (minutesAgo(db.lastGuildsUpdate) > 2800) {
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
                    .collection<GuildDocument>(db.collections.maintenance)
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
            }

            console.log("Guild update is not due yet.");
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

    const getBossIdsToUpdate = () => {
        let bossIds: { [key: string]: true } = {};

        for (const bossId of db.updatedRaidBosses) {
            bossIds[bossId] = true;
        }
        return Object.keys(bossIds);
    };

    return new Promise(async (resolve, reject) => {
        try {
            if (!db.connection) throw ERR_DB_CONNECTION;

            if (!db.firstCacheLoad) {
                db.firstCacheLoad = fullLoad();
            } else {
                const bossesToUpdate = getBossIdsToUpdate();

                for (const bossId of bossesToUpdate) {
                    const boss = await db.connection
                        .collection<RaidBossDocument>(db.collections.raidBosses)
                        .findOne({ _id: bossId });
                    if (boss) {
                        cache.raidBoss.set(bossId, boss);
                    }
                }

                db.updatedRaidBosses = [];
            }

            resolve(true);
        } catch (err) {
            reject(err);
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
