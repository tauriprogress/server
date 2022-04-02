import environment from "../environment";
import cache from "./cache";

import {
    getLogData,
    processLogs,
    logBugHandler,
    minutesAgo,
    getRaidInfoFromId,
    getRelativePerformance,
    getRaidInfoFromName,
    capitalize,
    addNestedObjectValue,
    runGC,
    isError,
    Lock,
    getRaidBossSummary,
    writeLogsToFile,
    updateLastLogIdsOfFile,
    createMaintenanceDocument,
    getRaidBossId,
    createRaidBossDocument,
    getCharactersOfBossCollectionId,
    areLogsSaved,
    updateRaidBossDocument,
    updateGuildDocument,
    requestGuildDocument,
    createGuildDocument,
    getDeconstructRaidBossId,
    getGuildId,
    filtersToAggregationMatchQuery,
    getRaidSummaryCacheId,
    getCharacterPerformanceCacheId,
    getCharacterId,
    getRaidBossBestOfClass,
    getRaidBossBestOfSpec,
} from "../helpers";

import { MongoClient, Db, ClientSession, ReadConcern } from "mongodb";
import {
    LastLogIds,
    LooseObject,
    CharacterPerformance,
    TrimmedLog,
    CombatMetric,
    GuildList,
    Difficulty,
    MaintenanceDocument,
    CharacterDocument,
    RaidBossDocument,
    GuildDocument,
    Realm,
    Faction,
    Filters,
    RaidSummary,
    RaidId,
    ClassId,
    RaidName,
    GuildLeaderboard,
} from "../types";
import {
    ERR_BOSS_NOT_FOUND,
    ERR_DB_CONNECTION,
    ERR_DB_UPDATING,
    ERR_GUILD_NOT_FOUND,
} from "../helpers/errors";
import { combatMetrics } from "../constants";

const raidSummaryLock = new Lock();

const collectionNames = {
    guilds: "Guilds",
    maintenance: "Maintenance",
    raidBosses: "RaidBosses",
} as const;

class DBInterface {
    public connection: Db | undefined;
    public client: MongoClient | undefined;

    public lastUpdated: number;
    public isUpdating: boolean;
    public updateStatus: string;
    public lastGuildsUpdate: number;
    public collections: typeof collectionNames;

    public firstCacheLoad: false | true | Promise<true>;

    private updatedRaidBosses: ReturnType<typeof getRaidBossId>[];

    constructor() {
        this.connection = undefined;
        this.client = undefined;

        this.lastUpdated = 0;
        this.lastGuildsUpdate = 0;
        this.isUpdating = false;
        this.updateStatus = "";
        this.firstCacheLoad = false;
        this.updatedRaidBosses = [];

        this.collections = collectionNames;
    }

    async connect() {
        try {
            console.log("Connecting to database");
            const client = new MongoClient(
                `mongodb+srv://${environment.MONGODB_USER}:${environment.MONGODB_PASSWORD}@${environment.MONGODB_ADDRESS}`
            );
            await client.connect();

            this.client = client;
            this.connection = this.client.db("tauriprogress");

            this.lastUpdated = 0;
            this.lastGuildsUpdate = await this.getLastGuildsUpdate();
        } catch (err) {
            throw err;
        }
    }

    async initalizeDatabase(): Promise<true> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;
                if (this.isUpdating) throw ERR_DB_UPDATING;

                console.log("Initalizing database.");
                await this.connection.dropDatabase();

                const maintenanceCollection = this.connection.collection(
                    this.collections.maintenance
                );

                maintenanceCollection.insertOne(createMaintenanceDocument());

                for (const raid of environment.currentContent.raids) {
                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.bossIdOfDifficulty) {
                            const ingameBossId =
                                boss.bossIdOfDifficulty[
                                    difficulty as keyof typeof boss.bossIdOfDifficulty
                                ];
                            await this.saveRaidBoss(
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
                                    getCharactersOfBossCollectionId(
                                        ingameBossId,
                                        Number(difficulty),
                                        combatMetric
                                    );
                                const bossCollection =
                                    this.connection.collection(collectionName);

                                if (await bossCollection.findOne({}))
                                    await bossCollection.deleteMany({});
                            }
                        }
                    }
                }

                const updateStarted = new Date().getTime() / 1000;
                this.isUpdating = true;
                this.updateStatus = "Database is updating.";
                this.lastUpdated = updateStarted;
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
                    await this.saveRaidBoss(bosses[bossId]);
                }

                // initalization should keep this empty since there is no update
                this.updatedRaidBosses = [];

                console.log("Saving guilds.");
                for (const guildId in guilds) {
                    await this.saveGuild(guilds[guildId]);
                }

                console.log("Saving characters.");
                for (const bossId in characterPerformanceOfBoss) {
                    console.log(`Filling collection ${bossId}`);

                    let combatMetric: keyof typeof characterPerformanceOfBoss[number];
                    for (combatMetric in characterPerformanceOfBoss[bossId]) {
                        let characters = [];
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
                            getDeconstructRaidBossId(bossId);

                        const bossCollection =
                            this.connection.collection<CharacterDocument>(
                                getCharactersOfBossCollectionId(
                                    ingameBossId,
                                    Number(difficulty),
                                    combatMetric
                                )
                            );

                        try {
                            await bossCollection.insertMany(characters);
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
                console.log("Characters saved.");

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

                await this.updateRaidBossCache();
                await this.updateLeaderboard();

                this.isUpdating = false;
                this.updateStatus = "";

                console.log("Initalization done.");
                resolve(true);
            } catch (err) {
                this.isUpdating = false;
                reject(err);
            }
        });
    }
    async updateDatabase(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;
                if (!this.client) throw ERR_DB_CONNECTION;
                if (this.isUpdating) throw ERR_DB_UPDATING;

                console.log("Updating database.");
                const updateStarted = new Date().getTime() / 1000;
                this.isUpdating = true;
                this.updateStatus = "Database is updating.";
                this.lastUpdated = updateStarted;

                const maintenanceCollection =
                    this.connection.collection<MaintenanceDocument>(
                        this.collections.maintenance
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
                const session = this.client.startSession();

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
                } finally {
                    session.endSession();
                    console.log("Transaction session closed");
                }

                if (minutesAgo(this.lastGuildsUpdate) > 2800) {
                    console.log("Updating guilds");
                    this.lastGuildsUpdate = updateStarted;
                    await maintenanceCollection.updateOne(
                        {},
                        {
                            $set: {
                                lastGuildsUpdate: this.lastGuildsUpdate,
                            },
                        }
                    );

                    await this.updateGuilds();
                }

                await this.updateRaidBossCache();
                await this.updateLeaderboard();

                cache.clearRaidSummary();
                cache.clearCharacterPerformance();

                this.isUpdating = false;
                this.updateStatus = "";

                console.log("Database update finished");
                resolve(minutesAgo(updateStarted));
            } catch (err) {
                if (!isError(err) || err.message !== ERR_DB_UPDATING.message) {
                    console.log(`Database update error`);
                    console.error(err);
                    this.isUpdating = false;
                    this.updateStatus = "";
                }
                reject(err);
            }
        });
    }
    async getLastUpdated(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const maintenance = await this.connection
                    .collection<MaintenanceDocument>(
                        this.collections.maintenance
                    )
                    .findOne();

                resolve(maintenance ? maintenance.lastUpdated : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getLastGuildsUpdate(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const maintenance = await this.connection
                    .collection<MaintenanceDocument>(
                        this.collections.maintenance
                    )
                    .findOne();

                resolve(maintenance ? maintenance.lastGuildsUpdate : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async isInitalized(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const maintenance = await this.connection
                    .collection<MaintenanceDocument>(
                        this.collections.maintenance
                    )
                    .findOne({});

                resolve(maintenance ? maintenance.isInitalized : false);
            } catch (err) {
                reject(err);
            }
        });
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
                if (!this.connection) throw ERR_DB_CONNECTION;

                await this.bulkWriteRaidBosses(bosses, session);
                runGC();

                console.log("db: Saving guilds");
                for (const guildId in guilds) {
                    await this.saveGuild(guilds[guildId], session);
                }

                const operationsOfBossCollection: LooseObject = {};

                for (const bossId in characterPerformanceOfBoss) {
                    for (const combatMetricKey in characterPerformanceOfBoss[
                        bossId
                    ]) {
                        const combatMetric = combatMetricKey as CombatMetric;
                        for (const charId in characterPerformanceOfBoss[bossId][
                            combatMetric
                        ]) {
                            const [ingameBossId, difficulty] =
                                getDeconstructRaidBossId(bossId);
                            const bossCollectionName =
                                getCharactersOfBossCollectionId(
                                    ingameBossId,
                                    difficulty,
                                    combatMetric
                                );

                            const char =
                                characterPerformanceOfBoss[bossId][
                                    combatMetric
                                ][charId];

                            if (
                                !operationsOfBossCollection[bossCollectionName]
                            ) {
                                operationsOfBossCollection[bossCollectionName] =
                                    [];
                            }

                            operationsOfBossCollection[bossCollectionName].push(
                                {
                                    updateOne: {
                                        filter: { _id: char._id },
                                        update: {
                                            $max: {
                                                [combatMetric]:
                                                    char[combatMetric],
                                            },
                                            $setOnInsert: char,
                                        },
                                        upsert: true,
                                    },
                                }
                            );
                        }
                    }
                }

                console.log("db: Saving chars");
                for (const bossCollectionName in operationsOfBossCollection) {
                    console.log(`db: to ${bossCollectionName}`);

                    const bossCollection =
                        this.connection.collection<CharacterDocument>(
                            bossCollectionName
                        );

                    await bossCollection.bulkWrite(
                        operationsOfBossCollection[bossCollectionName],
                        { session }
                    );
                }

                console.log("db: Saving chars done");

                await this.connection
                    .collection<MaintenanceDocument>(
                        this.collections.maintenance
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
                reject(err);
            }
            resolve(true);
        });
    }

    async saveRaidBoss(boss: RaidBossDocument, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const raidCollection =
                    this.connection.collection<RaidBossDocument>(
                        this.collections.raidBosses
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
                    await raidCollection.updateOne(
                        {
                            _id: boss._id,
                        },
                        {
                            $set: updateRaidBossDocument(oldBoss, boss),
                        },
                        {
                            session,
                        }
                    );
                }

                this.updatedRaidBosses.push(boss._id);

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(guild: GuildDocument, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const guildsCollection =
                    this.connection.collection<GuildDocument>(
                        this.collections.guilds
                    );

                let oldGuild = await guildsCollection.findOne(
                    {
                        _id: guild._id,
                    },
                    { session }
                );

                if (!oldGuild) {
                    try {
                        let guildData = await requestGuildDocument(
                            guild.name,
                            guild.realm
                        ).catch((err) => {
                            if (err.message === ERR_GUILD_NOT_FOUND.message)
                                throw ERR_GUILD_NOT_FOUND;
                            return false as const;
                        });

                        await guildsCollection.insertOne(
                            guildData
                                ? updateGuildDocument(guild, guildData)
                                : updateGuildDocument(
                                      createGuildDocument(
                                          guild.name,
                                          guild.realm,
                                          guild.f
                                      ),
                                      guild
                                  ),
                            { session }
                        );
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    await guildsCollection.updateOne(
                        {
                            _id: guild._id,
                        },
                        {
                            $set: updateGuildDocument(oldGuild, guild),
                        },
                        { session }
                    );
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
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
                if (!this.connection) throw ERR_DB_CONNECTION;

                console.log("db: Saving raid bosses");
                const raidBossCollection =
                    this.connection.collection<RaidBossDocument>(
                        this.collections.raidBosses
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

                await raidBossCollection.bulkWrite(operations, {
                    session,
                });

                for (const bossId in bosses) {
                    this.updatedRaidBosses.push(bossId);
                }

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                this.updateStatus = "Updating guilds";

                const guilds = (await this.connection
                    .collection<GuildDocument>(this.collections.maintenance)
                    .find({})
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
                            `db: Updating ${guild.name} ${current}/${total}`
                        );

                        const newGuild = await requestGuildDocument(
                            guild.name,
                            guild.realm
                        );

                        await this.saveGuild({
                            ...newGuild,
                            _id: guild._id,
                        });
                    } catch (err) {
                        if (
                            isError(err) &&
                            err.message &&
                            err.message.includes(ERR_GUILD_NOT_FOUND.message)
                        ) {
                            this.removeGuild(guild._id);
                        } else {
                            console.log(`Error with updating ${guild.name}:`);
                            console.error(err);
                        }
                    }

                    runGC();
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async removeGuild(_id: ReturnType<typeof getGuildId>) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                await this.connection
                    .collection<GuildDocument>(this.collections.guilds)
                    .deleteOne({
                        _id: _id,
                    });
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateRaidBossCache() {
        const fullLoad = async (): Promise<true> => {
            return new Promise(async (resolve, reject) => {
                try {
                    if (!this.connection) throw ERR_DB_CONNECTION;

                    for (const boss of await this.connection
                        .collection<RaidBossDocument>(
                            this.collections.raidBosses
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

        const getBossIdsToUpdate = () => {
            let bossIds: { [key: string]: true } = {};

            for (const bossId of this.updatedRaidBosses) {
                bossIds[bossId] = true;
            }
            return Object.keys(bossIds);
        };

        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                if (!this.firstCacheLoad) {
                    this.firstCacheLoad = fullLoad();
                } else {
                    const bossesToUpdate = getBossIdsToUpdate();

                    for (const bossId of bossesToUpdate) {
                        const boss = await this.connection
                            .collection<RaidBossDocument>(
                                this.collections.raidBosses
                            )
                            .findOne({ _id: bossId });
                        if (boss) {
                            cache.raidBoss.set(bossId, boss);
                        }
                    }

                    this.updatedRaidBosses = [];
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateLeaderboard() {
        /*
        await this.firstCacheLoad;

        for (const combatMetric of ["dps", "hps"] as const) {
            for (const raid of environment.currentContent.raids) {
                let leaderboards: {
                    overall?: CharacterLeaderboard;
                    specs: { [propName: string]: CharacterLeaderboard };
                    roles: { [propName: string]: CharacterLeaderboard };
                } = {
                    overall: {},
                    roles: {},
                    specs: {},
                };
                for (const difficulty of raid.difficulties) {
                    let characters: {
                        [propName: string]: {
                            best: CharacterOfLeaderboard;
                            specs: {
                                [propName: string]: CharacterOfLeaderboard;
                            };
                            roles: {
                                [propName: string]: CharacterOfLeaderboard;
                            };
                        };
                    } = {};

                    let bestRelativePerformance = 0;

                    for (const bossInfo of raid.bosses) {
                        let boss = cache.getRaidBoss(
                            getRaidBossCacheId(raid.id, bossInfo.name)
                        );

                        if (!boss) continue;

                        let charactersOfBoss: {
                            [propName: string]: RankedCharacter[];
                        } = {};
                        let bestPerformanceOfBoss = 0;

                        for (const character of boss[difficulty][
                            combatMetric
                        ]) {
                            let currentPerformance = character[combatMetric];
                            const charId = `${character.name},${character.realm},${character.class}`;

                            if (!charactersOfBoss[charId]) {
                                charactersOfBoss[charId] = [];
                            }

                            charactersOfBoss[charId].push(character);

                            if (
                                typeof currentPerformance === "number" &&
                                currentPerformance > bestPerformanceOfBoss
                            ) {
                                bestPerformanceOfBoss = currentPerformance;
                            }
                        }

                        for (const charId in charactersOfBoss) {
                            let characterContainer = charactersOfBoss[charId];
                            let bestOfCharacter:
                                | CharacterOfLeaderboard
                                | undefined;

                            let bestOfRoles: {
                                [propName: string]:
                                    | CharacterOfLeaderboard
                                    | undefined;
                            } = {};

                            for (const characterData of characterContainer) {
                                const currentPerformance =
                                    characterData[combatMetric];
                                const currentPercent = currentPerformance
                                    ? getRelativePerformance(
                                          currentPerformance,
                                          bestPerformanceOfBoss
                                      )
                                    : 0;

                                const modifiedCharacter: CharacterOfLeaderboard =
                                    {
                                        _id: characterData._id,
                                        class: characterData.class,
                                        f: characterData.f,
                                        ilvl: characterData.ilvl,
                                        name: characterData.name,
                                        realm: characterData.realm,
                                        spec: characterData.spec,
                                        topPercent: currentPercent,
                                        date: characterData.date,
                                        race: characterData.race,
                                    };

                                if (!bestOfCharacter) {
                                    bestOfCharacter = modifiedCharacter;
                                } else {
                                    bestOfCharacter =
                                        updateCharacterOfLeaderboard(
                                            bestOfCharacter,
                                            modifiedCharacter
                                        );
                                }

                                let currentRoleChar =
                                    bestOfRoles[
                                        environment.specs[
                                            String(
                                                characterData.spec
                                            ) as keyof typeof environment.specs
                                        ].role
                                    ];

                                if (!currentRoleChar) {
                                    bestOfRoles[
                                        environment.specs[
                                            String(
                                                characterData.spec
                                            ) as keyof typeof environment.specs
                                        ].role
                                    ] = modifiedCharacter;
                                } else {
                                    bestOfRoles[
                                        environment.specs[
                                            String(
                                                characterData.spec
                                            ) as keyof typeof environment.specs
                                        ].role
                                    ] = updateCharacterOfLeaderboard(
                                        currentRoleChar,
                                        modifiedCharacter
                                    );
                                }

                                if (!characters[charId]) {
                                    characters[charId] = {
                                        best: {
                                            ...bestOfCharacter,
                                            topPercent: 0,
                                        },
                                        specs: {},
                                        roles: {},
                                    };
                                }

                                if (
                                    !characters[charId].specs[
                                        characterData.spec
                                    ]
                                ) {
                                    characters[charId].specs[
                                        characterData.spec
                                    ] = modifiedCharacter;
                                } else {
                                    const updatedChar =
                                        updateCharacterOfLeaderboard(
                                            characters[charId].specs[
                                                characterData.spec
                                            ],
                                            modifiedCharacter
                                        );

                                    const performance =
                                        characters[charId].specs[
                                            characterData.spec
                                        ].topPercent +
                                        modifiedCharacter.topPercent;

                                    characters[charId].specs[
                                        characterData.spec
                                    ] = updatedChar;

                                    characters[charId].specs[
                                        characterData.spec
                                    ].topPercent = performance;
                                }
                            }

                            if (bestOfCharacter) {
                                const updatedChar =
                                    updateCharacterOfLeaderboard(
                                        characters[charId].best,
                                        bestOfCharacter
                                    );

                                const performance =
                                    characters[charId].best.topPercent +
                                    bestOfCharacter.topPercent;

                                characters[charId].best = updatedChar;

                                characters[charId].best.topPercent =
                                    performance;

                                if (performance > bestRelativePerformance) {
                                    bestRelativePerformance = performance;
                                }
                            }

                            for (const role in bestOfRoles) {
                                let currentChar = bestOfRoles[role];
                                if (currentChar) {
                                    let prevOfRole = characters[charId].roles[
                                        role
                                    ] || { ...currentChar, topPercent: 0 };

                                    const updatedChar =
                                        updateCharacterOfLeaderboard(
                                            prevOfRole,
                                            currentChar
                                        );

                                    const performance =
                                        prevOfRole.topPercent +
                                        currentChar.topPercent;

                                    characters[charId].roles[role] =
                                        updatedChar;

                                    characters[charId].roles[role].topPercent =
                                        performance;
                                }
                            }
                        }
                        runGC();
                        await sleep(150);
                    }
                    if (!leaderboards.overall) {
                        leaderboards.overall = {};
                    }
                    if (!leaderboards.overall[difficulty]) {
                        leaderboards.overall[difficulty] = [];
                    }

                    for (const charId in characters) {
                        characters[charId].best.topPercent =
                            getRelativePerformance(
                                characters[charId].best.topPercent,
                                bestRelativePerformance
                            );

                        leaderboards.overall[difficulty].push(
                            characters[charId].best
                        );

                        for (const specId in characters[charId].specs) {
                            if (!leaderboards.specs[specId]) {
                                leaderboards.specs[specId] = {};
                            }

                            if (!leaderboards.specs[specId][difficulty]) {
                                leaderboards.specs[specId][difficulty] = [];
                            }

                            characters[charId].specs[specId].topPercent =
                                getRelativePerformance(
                                    characters[charId].specs[specId].topPercent,
                                    bestRelativePerformance
                                );

                            leaderboards.specs[specId][difficulty].push(
                                characters[charId].specs[specId]
                            );
                        }

                        for (const role in characters[charId].roles) {
                            if (!leaderboards.roles[role]) {
                                leaderboards.roles[role] = {};
                            }

                            if (!leaderboards.roles[role][difficulty]) {
                                leaderboards.roles[role][difficulty] = [];
                            }

                            characters[charId].roles[role].topPercent =
                                getRelativePerformance(
                                    characters[charId].roles[role].topPercent,
                                    bestRelativePerformance
                                );

                            leaderboards.roles[role][difficulty].push(
                                characters[charId].roles[role]
                            );
                        }
                    }

                    leaderboards.overall[difficulty].sort(
                        (a, b) => b.topPercent - a.topPercent
                    );

                    for (const specId in leaderboards.specs) {
                        if (!!leaderboards.specs[specId][difficulty]) {
                            leaderboards.specs[specId][difficulty].sort(
                                (a, b) => b.topPercent - a.topPercent
                            );
                        }
                    }

                    for (const role in leaderboards.roles) {
                        if (!!leaderboards.roles[role][difficulty]) {
                            leaderboards.roles[role][difficulty].sort(
                                (a, b) => b.topPercent - a.topPercent
                            );
                        }
                    }
                }

                const overallLeaderboardId = getLeaderboardCacheId(
                    raid.id,
                    combatMetric
                );

                cache.characterLeaderboard.set(
                    overallLeaderboardId,
                    leaderboards.overall
                );

                delete leaderboards.overall;

                for (let specId in leaderboards.specs) {
                    const currentLeaderboardId = getLeaderboardCacheId(
                        raid.id,
                        combatMetric,
                        specId
                    );

                    cache.characterLeaderboard.set(
                        currentLeaderboardId,
                        leaderboards.specs[specId]
                    );

                    delete leaderboards.specs[specId];
                    runGC();
                }

                for (let role in leaderboards.roles) {
                    const currentLeaderboardId = getLeaderboardCacheId(
                        raid.id,
                        combatMetric,
                        role
                    );

                    cache.characterLeaderboard.set(
                        currentLeaderboardId,
                        leaderboards.roles[role]
                    );

                    delete leaderboards.specs[role];
                    runGC();
                }
            }
        }
        */
    }

    async getGuildList(): Promise<GuildList> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const guildList = cache.getGuildList();

                if (guildList) {
                    resolve(guildList);
                } else {
                    const guildList = (await this.connection
                        .collection<GuildDocument>(this.collections.guilds)
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            activity: 1,
                            ["progression.completion"]: 1,
                        })
                        .toArray()) as GuildList;

                    cache.guildList.set(cache.guildListId, guildList);

                    resolve(guildList);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuild(realm: Realm, guildName: string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const guild = await this.connection
                    .collection<GuildDocument>(this.collections.guilds)
                    .findOne({
                        name: guildName,
                        realm: realm,
                    });

                if (!guild) throw ERR_GUILD_NOT_FOUND;

                resolve(guild);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBoss(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<RaidBossDocument> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const bossId = getRaidBossId(ingameBossId, difficulty);

                const cachedData = cache.getRaidBoss(bossId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const bossData = await this.connection
                        .collection<RaidBossDocument>(
                            this.collections.raidBosses
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
                if (!this.connection) throw ERR_DB_CONNECTION;

                resolve(
                    (await this.getRaidBoss(ingameBossId, difficulty)).killCount
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossRecentKills(
        ingameBossId: number,
        difficulty: Difficulty
    ): Promise<TrimmedLog[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                resolve(
                    (await this.getRaidBoss(ingameBossId, difficulty))
                        .recentKills
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
                if (!this.connection) throw ERR_DB_CONNECTION;
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
    async getRaidBossCharacters(
        ingameBossId: number,
        combatMetric: CombatMetric,
        filters: Filters,
        page: number,
        pageSize: number
    ): Promise<{ characters: CharacterDocument[]; itemCount: number }> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const collection =
                    this.connection.collection<CharacterDocument>(
                        getCharactersOfBossCollectionId(
                            ingameBossId,
                            filters.difficulty,
                            combatMetric
                        )
                    );

                const matchQuery = filtersToAggregationMatchQuery(filters);
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
                                    itemCount: "$$CURRENT.itemCount.n",
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

    async getCharacterLeaderboard(): Promise<void> {
        return new Promise(async (resolve) => {
            resolve();
        });
    }
    async getGuildLeaderboard(): Promise<GuildLeaderboard> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const cachedData = cache.getGuildLeaderboard();

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const guildLeaderboard = (await this.connection
                        .collection<GuildDocument>(this.collections.guilds)
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

    async getRaidSummary(raidId: RaidId): Promise<RaidSummary> {
        return new Promise(async (resolve, reject) => {
            try {
                await raidSummaryLock.acquire();
                if (!this.connection) throw ERR_DB_CONNECTION;

                const cacheId = getRaidSummaryCacheId(raidId);
                const cachedData = cache.getRaidSummary(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    let raidSummary: RaidSummary = {};

                    const bosses = getRaidInfoFromId(raidId).bosses;
                    for (const bossInfo of bosses) {
                        for (const key in bossInfo.bossIdOfDifficulty) {
                            const difficulty = Number(
                                key
                            ) as unknown as Difficulty;
                            const ref =
                                key as keyof typeof bossInfo.bossIdOfDifficulty;
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[ref];
                            const bossId = getRaidBossId(
                                ingameBossId,
                                difficulty
                            );

                            raidSummary[bossId] = getRaidBossSummary(
                                await this.getRaidBoss(ingameBossId, difficulty)
                            );
                        }
                    }

                    cache.raidSummary.set(cacheId, raidSummary);

                    resolve(raidSummary);
                }
            } catch (err) {
                reject(err);
            } finally {
                raidSummaryLock.release();
            }
        });
    }

    async getCharacterPerformance(
        characterName: string,
        characterClass: ClassId,
        realm: Realm,
        raidName: RaidName
    ): Promise<CharacterPerformance> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.connection) throw ERR_DB_CONNECTION;

                const cacheId = getCharacterPerformanceCacheId(
                    characterName,
                    realm,
                    raidName
                );

                const cachedData = cache.getCharacterPerformance(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const specs =
                        environment.characterClassSpecs[characterClass];

                    const characterIds = specs.map((specId) =>
                        getCharacterId(characterName, realm, specId)
                    );

                    let lookups: object[] = [];

                    const bosses = getRaidInfoFromName(raidName).bosses;

                    for (let bossInfo of bosses) {
                        const difficulties = Object.keys(
                            bossInfo.bossIdOfDifficulty
                        ).map((key) =>
                            Number(key)
                        ) as (keyof typeof bossInfo.bossIdOfDifficulty)[];

                        for (let difficulty of difficulties) {
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[difficulty];

                            for (let combatMetric of combatMetrics) {
                                const collectionName =
                                    getCharactersOfBossCollectionId(
                                        ingameBossId,
                                        difficulty,
                                        combatMetric
                                    );

                                lookups.push({
                                    $lookup: {
                                        from: collectionName,
                                        pipeline: [
                                            {
                                                match: {
                                                    _id: {
                                                        $in: characterIds,
                                                    },
                                                },
                                            },
                                        ],
                                        as: collectionName,
                                    },
                                });
                            }
                        }
                    }

                    const characterData = (
                        await this.connection
                            .collection(this.collections.maintenance)
                            .aggregate([
                                { $limit: 1 },
                                { $project: { _id: 1 } },
                                ...lookups,
                            ])
                            .toArray()
                    )[0] as { [key: string]: CharacterDocument[] };

                    let characterPerformance: CharacterPerformance =
                        {} as CharacterPerformance;

                    for (let bossInfo of bosses) {
                        const difficulties = Object.keys(
                            bossInfo.bossIdOfDifficulty
                        ).map((key) =>
                            Number(key)
                        ) as (keyof typeof bossInfo.bossIdOfDifficulty)[];

                        for (let difficulty of difficulties) {
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[difficulty];

                            for (let combatMetric of combatMetrics) {
                                function addDocToPerformance(
                                    keyName: string | number,
                                    doc: CharacterDocument,
                                    bestDoc: CharacterDocument | undefined
                                ): void {
                                    characterPerformance = addNestedObjectValue(
                                        characterPerformance,
                                        [
                                            ...categorization,
                                            keyName,
                                            combatMetric,
                                        ],
                                        {
                                            ...doc,
                                            performance: getRelativePerformance(
                                                doc[combatMetric],
                                                bestDoc?.[combatMetric] ||
                                                    doc[combatMetric]
                                            ),
                                        }
                                    ) as CharacterPerformance;
                                }
                                const categorization = [
                                    raidName,
                                    difficulty,
                                    bossInfo.name,
                                ];
                                const bestOfNoCatKey = `best${capitalize(
                                    combatMetric
                                )}NoCat` as const;

                                const bossId = getCharactersOfBossCollectionId(
                                    ingameBossId,
                                    difficulty,
                                    combatMetric
                                );

                                const characterDocuments =
                                    characterData[bossId];

                                const currentBoss = await this.getRaidBoss(
                                    ingameBossId,
                                    difficulty
                                );

                                let bestOfCharacter: CharacterDocument = {
                                    [combatMetric]: 0,
                                } as CharacterDocument;

                                for (const specId of environment
                                    .characterClassSpecs[characterClass]) {
                                    const bestOfSpec = getRaidBossBestOfSpec(
                                        currentBoss,
                                        specId,
                                        combatMetric
                                    );

                                    const characterDoc =
                                        characterDocuments.find(
                                            (document) =>
                                                document.spec === specId
                                        );
                                    if (!characterDoc) {
                                        addDocToPerformance(
                                            specId,
                                            {
                                                [combatMetric]: 0,
                                            } as CharacterDocument,
                                            bestOfSpec
                                        );
                                        continue;
                                    } else {
                                        addDocToPerformance(
                                            specId,
                                            characterDoc,
                                            bestOfSpec
                                        );
                                    }

                                    if (
                                        characterDoc[combatMetric] >
                                        bestOfCharacter[combatMetric]
                                    ) {
                                        bestOfCharacter = characterDoc;
                                    }
                                }

                                const currentBest =
                                    currentBoss[bestOfNoCatKey] ||
                                    ({
                                        dps: 0,
                                        hps: 0,
                                    } as unknown as CharacterDocument);
                                addDocToPerformance(
                                    "all",
                                    bestOfCharacter,
                                    currentBest
                                );

                                const bestOfClass = getRaidBossBestOfClass(
                                    currentBoss,
                                    characterClass,
                                    combatMetric
                                );
                                addDocToPerformance(
                                    "class",
                                    bestOfCharacter,
                                    bestOfClass
                                );
                            }
                        }
                    }

                    try {
                        cache.characterPerformance.set(
                            cacheId,
                            characterPerformance
                        );
                    } catch (err) {
                        console.log("db: Character cache is full");
                    }

                    resolve(characterPerformance);
                }
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }
}

const db = new DBInterface();

export type Database = typeof db;

export default db;
