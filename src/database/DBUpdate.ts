import { ClientSession, ReadConcern } from "mongodb";
import {
    CharacterDocument,
    CombatMetric,
    Difficulty,
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
    minutesAgo,
    processLogs,
    requestGuildDocument,
    runGC,
    updateLastLogIdsOfFile,
    updateRaidBossDocument,
    writeLogsToFile,
} from "../helpers";
import {
    ERR_DB_ALREADY_UPDATING,
    ERR_DB_TANSACTION,
    ERR_GUILD_NOT_FOUND,
} from "../helpers/errors";
import cache from "./Cache";
import dbConnection from "./DBConnection";
import dbInterface from "./index";
import environment from "../environment";

class DBUpdate {
    private isUpdating: boolean;
    private lastGuildsUpdate: number;
    private updatedRaidbosses: ReturnType<typeof getRaidBossId>[];

    private updatedCharacterDocumentCollections: ReturnType<
        typeof getCharacterDocumentCollectionId
    >[];

    constructor() {
        this.isUpdating = false;
        this.lastGuildsUpdate = 0;
        this.updatedRaidbosses = [];
        this.updatedCharacterDocumentCollections = [];
    }

    addToUpdatedCharacterDocumentCollections(
        characterDocumentCollection: ReturnType<
            typeof getCharacterDocumentCollectionId
        >
    ) {
        this.updatedCharacterDocumentCollections.push(
            characterDocumentCollection
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

    addToUpdatedRaidbosses(bossId: ReturnType<typeof getRaidBossId>) {
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

                let { logs, lastLogIds: newLastLogIds } = await getLogData(
                    false,
                    lastLogIds
                );

                logs = logBugHandler(logs);
                const session = client.startSession();

                try {
                    console.log("Opening new transaction session");
                    await session.withTransaction(
                        async () => {
                            await this.saveLogs(
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
                    !isError(err) ||
                    err.message !== ERR_DB_ALREADY_UPDATING.message
                ) {
                    console.log(`Database update error`);
                    this.isUpdating = false;
                }

                reject(err);
            }
        });
    }

    public async updateGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                if (this.lastGuildsUpdate === 0) {
                    this.lastGuildsUpdate =
                        await dbInterface.guild.getLastGuildsUpdate();
                }

                if (minutesAgo(this.lastGuildsUpdate) > 60 * 36) {
                    const updateStarted = new Date().getTime() / 1000;
                    const maintenanceCollection =
                        db.collection<MaintenanceDocument>(
                            dbInterface.collections.maintenance
                        );

                    console.log("Updating guilds");
                    this.isUpdating = true;
                    this.lastGuildsUpdate = updateStarted;

                    const guilds = (await db
                        .collection<GuildDocument>(
                            dbInterface.collections.guilds
                        )
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

                            await dbInterface.guild.saveGuild({
                                ...newGuild,
                                _id: guild._id,
                            });
                        } catch (err) {
                            if (
                                isError(err) &&
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

                    await maintenanceCollection.updateOne(
                        {},
                        {
                            $set: {
                                lastGuildsUpdate: this.lastGuildsUpdate,
                            },
                        }
                    );

                    this.isUpdating = false;

                    console.log("Guilds updated.");
                } else {
                    console.log("Guild update is not due yet.");
                }

                resolve(true);
            } catch (e) {
                this.isUpdating = false;

                reject(e);
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

    async initalizeDatabase(): Promise<true> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                console.log("Initalizing database.");
                await db.dropDatabase();

                const maintenanceCollection = db.collection(
                    dbInterface.collections.maintenance
                );

                maintenanceCollection.insertOne(createMaintenanceDocument());

                for (const raid of environment.currentContent.raids) {
                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.bossIdOfDifficulty) {
                            const ingameBossId =
                                boss.bossIdOfDifficulty[
                                    difficulty as keyof typeof boss.bossIdOfDifficulty
                                ];
                            await dbInterface.raidboss.saveRaidBoss(
                                createRaidBossDocument(
                                    raid.id,
                                    getRaidBossId(
                                        ingameBossId,
                                        Number(difficulty) as Difficulty
                                    ),
                                    boss.name,
                                    Number(difficulty) as Difficulty
                                )
                            );

                            for (const combatMetric of ["dps", "hps"]) {
                                const collectionName =
                                    getCharacterDocumentCollectionId(
                                        ingameBossId,
                                        Number(difficulty),
                                        combatMetric
                                    );
                                const bossCollection =
                                    db.collection(collectionName);

                                if (await bossCollection.findOne({}))
                                    await bossCollection.deleteMany({});

                                await bossCollection.createIndex({
                                    [combatMetric]: -1,
                                });
                            }
                        }
                    }
                }

                for (const combatMetric of ["dps", "hps"]) {
                    const leaderboardCollection =
                        db.collection<LeaderboardCharacterDocument>(
                            combatMetric === "dps"
                                ? dbInterface.collections
                                      .characterLeaderboardDps
                                : dbInterface.collections
                                      .characterLeaderboardHps
                        );
                    if (await leaderboardCollection.findOne({}))
                        await leaderboardCollection.deleteMany({});

                    await leaderboardCollection.createIndex({
                        [combatMetric]: -1,
                    });
                }

                const updateStarted = new Date().getTime() / 1000;
                this.isUpdating = true;
                const lastLogIds = {};

                let { logs, lastLogIds: newLastLogIds } = await getLogData(
                    true,
                    lastLogIds
                );

                logs = logBugHandler(logs);

                if (!areLogsSaved()) {
                    console.log(
                        "Saving logs in case something goes wrong in the initalization process."
                    );
                    writeLogsToFile(logs);
                    updateLastLogIdsOfFile(newLastLogIds);
                }

                console.log("Processing logs.");
                const { bosses, guilds, characterPerformanceOfBoss } =
                    processLogs(logs);

                console.log("Saving raid bosses.");
                for (const bossId in bosses) {
                    await dbInterface.raidboss.saveRaidBoss(bosses[bossId]);
                }

                // initalization should keep this empty since there is no update
                this.resetUpdatedBossIds();

                console.log("Saving guilds.");
                for (const guildId in guilds) {
                    await dbInterface.guild.saveGuild(guilds[guildId]);
                }

                console.log("Saving characters.");
                for (const bossId in characterPerformanceOfBoss) {
                    console.log(`Filling collection ${bossId}`);

                    let combatMetric: keyof (typeof characterPerformanceOfBoss)[number];
                    for (combatMetric in characterPerformanceOfBoss[bossId]) {
                        let characters: CharacterDocument[] = [];
                        for (const charId in characterPerformanceOfBoss[bossId][
                            combatMetric
                        ]) {
                            characters.push(
                                characterPerformanceOfBoss[bossId][
                                    combatMetric
                                ][charId]
                            );
                        }

                        const [ingameBossId, difficulty] =
                            getDeconstructedRaidBossId(bossId);

                        const collectionName = getCharacterDocumentCollectionId(
                            ingameBossId,
                            Number(difficulty),
                            combatMetric
                        );
                        const bossCollection =
                            db.collection<CharacterDocument>(collectionName);

                        try {
                            await bossCollection.insertMany(characters);

                            const raidName =
                                getRaidNameFromIngamebossId(ingameBossId);

                            const bossName =
                                getRaidBossNameFromIngameBossId(ingameBossId);
                            if (raidName && bossName)
                                await dbInterface.leaderboard.saveCharactersToLeaderboard(
                                    characters,
                                    raidName,
                                    difficulty,
                                    bossName,
                                    combatMetric
                                );
                            this.addToUpdatedCharacterDocumentCollections(
                                collectionName
                            );
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
                console.log("Characters saved.");

                console.log("Update character ranks");
                await this.updateCharacterDocumentRanks();
                console.log("Character ranks updated");

                await maintenanceCollection.updateOne(
                    {},
                    {
                        $set: {
                            lastUpdated: updateStarted,
                            lastLogIds: newLastLogIds,
                            lastGuildsUpdate: updateStarted,
                            isInitalized: true,
                        },
                    }
                );

                await dbInterface.raidboss.updateRaidBossCache();

                this.isUpdating = false;

                console.log("Initalization done.");
                resolve(true);
            } catch (err) {
                this.isUpdating = false;
                reject(err);
            }
        });
    }

    async isInitalized(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                const maintenance = await db
                    .collection<MaintenanceDocument>(
                        dbInterface.collections.maintenance
                    )
                    .findOne({});

                resolve(maintenance ? maintenance.isInitalized : false);
            } catch (err) {
                reject(err);
            }
        });
    }
}

const dbUpdate = new DBUpdate();

export default dbUpdate;
