import { validator } from "./../helpers/validators";
import { ClientSession, ReadConcern } from "mongodb";
import {
    CharacterDocument,
    CombatMetric,
    Difficulty,
    Faction,
    GuildDocument,
    LastLogIds,
    LeaderboardCharacterDocument,
    LooseObject,
    MaintenanceDocument,
    RaidBossDocument,
    Realm,
} from "../types";
import {
    areLogsSaved,
    createMaintenanceDocument,
    createRaidBossDocument,
    getCharacterDocumentCollectionId,
    getCharacterDocumentRankBulkwriteOperations,
    getDeconstructedCharacterDocumentCollectionId,
    getDeconstructedRaidBossId,
    getGuildId,
    getLogData,
    getRaidBossId,
    getRaidBossNameFromIngameBossId,
    getRaidNameFromIngamebossId,
    isError,
    logBugHandler,
    processLogs,
    requestGuildDocument,
    runGC,
    updateLastLogIdsOfFile,
    updateRaidBossDocument,
    writeLogsToFile,
    time,
    id,
    log,
} from "../helpers";
import {
    ERR_DB_ALREADY_UPDATING,
    ERR_DB_TANSACTION,
    ERR_GUILD_NOT_FOUND,
} from "../helpers/errors";
import cache from "./Cache";
import dbConnection from "./DBConnection";
import dbInterface from "./DBInterface";
import environment from "../environment";
import dbMaintenance from "./DBMaintenance";
import documentManager from "../helpers/documents";

class DBUpdate {
    public isUpdating: boolean;
    private updatedRaidbosses: ReturnType<typeof getRaidBossId>[];

    private updatedCharacterDocumentCollections: ReturnType<
        typeof id.characterDocumentCollectionId
    >[];

    constructor() {
        this.isUpdating = false;
        this.lastGuildsUpdate = 0;
        this.updatedRaidbosses = [];
        this.updatedCharacterDocumentCollections = [];
    }

    addToUpdatedCharacterDocumentCollections(
        characterDocumentCollectionId: ReturnType<
            typeof id.characterDocumentCollectionId
        >
    ) {
        this.updatedCharacterDocumentCollections.push(
            characterDocumentCollectionId
        );
    }

    getUpdatedCharacterDocumentCollectionIds() {
        let ids: { [key: string]: true } = {};

        for (const collectionName of this.updatedCharacterDocumentCollections) {
            ids[collectionName] = true;
        }
        return Object.keys(ids);
    }

    resetUpdatedCharacterDocumentCollections() {
        this.updatedCharacterDocumentCollections = [];
    }

    addToUpdatedRaidbosses(bossId: ReturnType<typeof id.raidBossId>) {
        this.updatedRaidbosses.push(bossId);
    }

    getUpdatedBossIds() {
        let bossIds: { [key: string]: true } = {};

        for (const bossId of this.updatedRaidbosses) {
            bossIds[bossId] = true;
        }
        return Object.keys(bossIds);
    }

    resetUpdatedBossIds() {
        this.updatedRaidbosses = [];
    }

    async saveLogs(
        {
            bosses,
            guilds,
            characterPerformanceOfBoss,
        }: ReturnType<typeof processLogs>,
        {
            lastLogIds,
            updateStarted,
        }: { lastLogIds: LastLogIds; updateStarted: number },
        session?: ClientSession
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                await this.bulkWriteRaidBosses(bosses, session);
                runGC();

                console.log("db: Saving guilds");
                for (const guildId in guilds) {
                    await dbInterface.guild.saveGuild(guilds[guildId], session);
                }

                console.log("Saving chars");
                const operationsOfCharacterDocumentCollections: LooseObject =
                    {};

                for (const bossId in characterPerformanceOfBoss) {
                    for (const combatMetricKey in characterPerformanceOfBoss[
                        bossId
                    ]) {
                        const combatMetric = combatMetricKey as CombatMetric;
                        for (const charId in characterPerformanceOfBoss[bossId][
                            combatMetric
                        ]) {
                            const [ingameBossId, difficulty] =
                                getDeconstructedRaidBossId(bossId);
                            const characterDocumentCollectionId =
                                getCharacterDocumentCollectionId(
                                    ingameBossId,
                                    difficulty,
                                    combatMetric
                                );

                            const char =
                                characterPerformanceOfBoss[bossId][
                                    combatMetric
                                ][charId];

                            if (
                                !operationsOfCharacterDocumentCollections[
                                    characterDocumentCollectionId
                                ]
                            ) {
                                operationsOfCharacterDocumentCollections[
                                    characterDocumentCollectionId
                                ] = [];
                            }

                            operationsOfCharacterDocumentCollections[
                                characterDocumentCollectionId
                            ].push(
                                {
                                    updateOne: {
                                        filter: {
                                            _id: char._id,
                                        },
                                        update: {
                                            $setOnInsert: char,
                                        },
                                        upsert: true,
                                    },
                                },
                                {
                                    updateOne: {
                                        filter: {
                                            _id: char._id,
                                            [combatMetric]: {
                                                $lt: char[combatMetric],
                                            },
                                        },
                                        update: { $set: char },
                                    },
                                }
                            );
                        }
                    }
                }

                for (const characterDocumentCollectionId in operationsOfCharacterDocumentCollections) {
                    console.log(`${characterDocumentCollectionId}`);

                    const bossCollection = db.collection<CharacterDocument>(
                        characterDocumentCollectionId
                    );
                    await bossCollection.bulkWrite(
                        operationsOfCharacterDocumentCollections[
                            characterDocumentCollectionId
                        ],
                        { session }
                    );

                    this.addToUpdatedCharacterDocumentCollections(
                        characterDocumentCollectionId
                    );
                }

                console.log("Saving chars done");

                console.log("Saving characters to leaderboard.");
                for (const bossId in characterPerformanceOfBoss) {
                    for (const combatMetricKey in characterPerformanceOfBoss[
                        bossId
                    ]) {
                        const combatMetric = combatMetricKey as CombatMetric;

                        const [ingameBossId, difficulty] =
                            getDeconstructedRaidBossId(bossId);
                        const raidName =
                            getRaidNameFromIngamebossId(ingameBossId);

                        const bossName =
                            getRaidBossNameFromIngameBossId(ingameBossId);

                        if (raidName && bossName)
                            await dbInterface.leaderboard.saveCharactersToLeaderboard(
                                Object.values(
                                    characterPerformanceOfBoss[bossId][
                                        combatMetric
                                    ]
                                ),
                                raidName,
                                difficulty,
                                bossName,
                                combatMetric,
                                session
                            );
                    }
                }

                console.log("Characters saved to leaderboards.");

                await db
                    .collection<MaintenanceDocument>(
                        dbInterface.collections.maintenance
                    )
                    .updateOne(
                        {},
                        {
                            $set: {
                                lastUpdated: updateStarted,
                                lastLogIds: lastLogIds,
                                isInitalized: true,
                            },
                        },
                        {
                            session,
                        }
                    );
            } catch (err) {
                this.resetUpdatedBossIds();
                this.resetUpdatedCharacterDocumentCollections();
                reject(err);
            }
            resolve(true);
        });
    }

    async bulkWriteRaidBosses(
        bosses: {
            [key: string]: RaidBossDocument;
        },
        session?: ClientSession
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                console.log("db: Saving raid bosses");
                const raidBossCollection = db.collection<RaidBossDocument>(
                    dbInterface.collections.raidBosses
                );

                const oldBosses = (await raidBossCollection
                    .aggregate(
                        [
                            {
                                $match: {
                                    _id: {
                                        $in: Object.keys(bosses),
                                    },
                                },
                            },
                        ],
                        { session }
                    )
                    .toArray()) as RaidBossDocument[];

                let operations = [];
                for (const oldBoss of oldBosses) {
                    operations.push({
                        updateOne: {
                            filter: {
                                _id: oldBoss._id,
                            },
                            update: {
                                $set: updateRaidBossDocument(
                                    oldBoss,
                                    bosses[oldBoss._id]
                                ),
                            },
                        },
                    });
                }

                if (operations.length) {
                    await raidBossCollection.bulkWrite(operations, {
                        session,
                    });
                }

                for (const bossId in bosses) {
                    this.addToUpdatedRaidbosses(bossId);
                }

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    public updateDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();
                const client = dbConnection.getClient();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                console.log("Updating database.");
                const updateStarted = new Date().getTime() / 1000;
                this.isUpdating = true;

                const maintenanceCollection =
                    db.collection<MaintenanceDocument>(
                        dbInterface.collections.maintenance
                    );

                const maintenanceDocument =
                    await maintenanceCollection.findOne();

                const lastLogIds = !maintenanceDocument
                    ? {}
                    : maintenanceDocument.lastLogIds;

                let { logs, lastLogIds: newLastLogIds } =
                    await log.requestRaidLogs(lastLogIds);

                logs = logBugHandler(logs);
                const session = client.startSession();

                try {
                    console.log("Opening new transaction session");
                    const processedData = processLogs(logs);
                    await session.withTransaction(
                        async () => {
                            await this.saveLogs(
                                processedData,
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

                await dbInterface.raidboss.updateRaidBossCache();
                await this.updateCharacterDocumentRanks();

                cache.clearRaidSummary();
                cache.clearCharacterPerformance();
                cache.clearCharacterLeaderboard();

                this.isUpdating = false;

                console.log("Database update finished");
                resolve(true);
            } catch (err) {
                if (
                    !validator.isError(err) ||
                    err.message !== ERR_DB_ALREADY_UPDATING.message
                ) {
                    console.log(`Database update error`);
                    this.isUpdating = false;
                }

                reject(err);
            }
        });
    }

    updateGuilds(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbMaintenance.getConnection();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                const maintenanceDocument = dbMaintenance.getDocument();

                if (
                    time.minutesAgo(maintenanceDocument.lastGuildsUpdate) >
                    60 * 36
                ) {
                    const updateStarted = new Date().getTime() / 1000;

                    console.log("Updating guilds");
                    this.isUpdating = true;

                    await dbMaintenance.updateDocument({
                        lastGuildsUpdate: updateStarted,
                    });

                    const guilds = (await db
                        .collection<GuildDocument>(
                            dbInterface.collections.guilds
                        )
                        .find()
                        .project({
                            _id: 1,
                            name: 1,
                            realm: 1,
                            f: 1,
                        })
                        .toArray()) as {
                        _id: ReturnType<typeof id.guildId>;
                        name: string;
                        realm: Realm;
                        f: Faction;
                    }[];

                    let total = guilds.length;
                    let current = 0;

                    for (let guild of guilds) {
                        try {
                            current++;
                            console.log(
                                `Updating ${guild.name} ${current}/${total}`
                            );

                            const newGuildDoc = new documentManager.guild({
                                guildName: guild.name,
                                realm: guild.realm,
                                faction: guild.f,
                            });

                            await newGuildDoc.extendData();

                            await dbInterface.guild.saveGuild(newGuildDoc);
                        } catch (err) {
                            if (
                                validator.isError(err) &&
                                err.message &&
                                err.message.includes(
                                    ERR_GUILD_NOT_FOUND.message
                                )
                            ) {
                                dbInterface.guild.removeGuild(guild._id);
                            } else {
                                console.log(
                                    `Error while updating ${guild.name}:`
                                );
                                console.error(err);
                            }
                        }
                    }

                    this.isUpdating = false;

                    console.log("Guilds updated.");
                } else {
                    console.log("Guild update is not due yet.");
                }

                resolve();
            } catch (err) {
                if (
                    !validator.isError(err) ||
                    !err.message.includes(ERR_DB_ALREADY_UPDATING.message)
                ) {
                    this.isUpdating = false;
                }

                reject(err);
            }
        });
    }

    public async updateCharacterDocumentRanks() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log("Updating character ranks.");
                const db = dbConnection.getConnection();

                const collectionsToUpdate =
                    this.getUpdatedCharacterDocumentCollectionIds();
                for (const collectionId of collectionsToUpdate) {
                    const collection =
                        db.collection<CharacterDocument>(collectionId);
                    const [_1, _2, combatMetric] =
                        getDeconstructedCharacterDocumentCollectionId(
                            collectionId
                        );

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

                this.resetUpdatedCharacterDocumentCollections();

                console.log("Character ranks updated.");

                resolve(true);
            } catch (e) {
                reject(e);
            }
        });
    }
}

const dbUpdate = new DBUpdate();

export default dbUpdate;
