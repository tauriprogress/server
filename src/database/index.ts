import * as fs from "fs";
import { environment } from "../environment";
import cache from "./cache";

import {
    getBossCollectionName,
    getLogs,
    processLogs,
    logBugHandler,
    updateRaidBoss,
    requestGuildData,
    getRecentGuildRaidDays,
    getGuildContentCompletion,
    updateGuildData,
    getLastLogIds,
    minutesAgo,
    getRaidInfoFromId,
    getBossInfo,
    applyCharacterPerformanceRanks,
    getRaidBossCacheId,
    getRelativePerformance,
    getLeaderboardCacheId,
    updateCharacterOfLeaderboard,
    getRaidInfoFromName,
    capitalize,
    getCharacterId,
    addNestedObjectValue,
    getNestedObjectValue,
    addToCharTotalPerformance,
    updateGuildRanking,
    runGC,
    getDefaultBoss,
    getRaidBossId
} from "../helpers";

import { MongoClient, Db, ClientSession, ObjectID } from "mongodb";
import {
    DbMaintenance,
    RaidLogWithRealm,
    RaidBoss,
    DbRaidBoss,
    Guild,
    LastLogIds,
    Character,
    RaidBossDataToServe,
    DbRaidBossDataResponse,
    LooseObject,
    Leaderboard,
    RankedCharacter,
    CharacterOfLeaderboard,
    RaidSummary,
    RaidBossNoRecent,
    CharacterPerformance,
    CharPerfBossData,
    TrimmedLog
} from "../types";

const connectionErrorMessage = "Not connected to database.";

class Database {
    public db: Db | undefined;

    private client: MongoClient | undefined;

    public lastUpdated: number;
    public isUpdating: boolean;
    public updateStatus: string;
    private lastGuildsUpdate: number;

    public firstCacheLoad: false | true | Promise<true>;

    private updatedRaidBosses: { raidId: number; name: string }[];

    constructor() {
        this.db = undefined;
        this.client = undefined;

        this.lastUpdated = 0;
        this.lastGuildsUpdate = 0;
        this.isUpdating = false;
        this.updateStatus = "";
        this.firstCacheLoad = false;
        this.updatedRaidBosses = [];
    }

    async connect() {
        try {
            console.log("Connecting to database");
            this.client = await MongoClient.connect(
                `mongodb+srv://${environment.MONGODB_USER}:${environment.MONGODB_PASSWORD}@${environment.MONGODB_ADDRESS}`,
                {
                    useUnifiedTopology: true,
                    useNewUrlParser: true
                }
            );

            this.db = this.client.db("tauriprogress");

            this.lastUpdated = 0;
            this.lastGuildsUpdate = await this.getLastGuildsUpdate();
        } catch (err) {
            throw err;
        }
    }

    async initalizeDatabase(): Promise<true> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                console.log("db: Initalizing database");
                this.db.dropDatabase();

                console.log("db: Creating maintenance collection");
                const maintenanceCollection = await this.db.collection(
                    "maintenance"
                );

                if (await maintenanceCollection.findOne({}))
                    await maintenanceCollection.deleteMany({});

                const defaultMaintenance: DbMaintenance = {
                    _id: new ObjectID(),
                    lastUpdated: 0,
                    lastGuildsUpdate: 0,
                    lastLogIds: {},
                    isInitalized: true
                };

                maintenanceCollection.insertOne(defaultMaintenance);

                console.log("db: Creating guilds collection");
                const guildsCollection = await this.db.collection("guilds");
                if (await guildsCollection.findOne({}))
                    await guildsCollection.deleteMany({});

                console.log(`db: Creating collections for raids and bosses`);
                for (const raid of environment.currentContent.raids) {
                    const raidCollection = await this.db.collection(
                        String(raid.id)
                    );

                    if (await raidCollection.findOne({}))
                        await raidCollection.deleteMany({});

                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.difficultyIds) {
                            await this.saveRaidBoss(
                                getDefaultBoss(
                                    getRaidBossId(
                                        boss.difficultyIds[
                                            difficulty as keyof typeof boss.difficultyIds
                                        ],
                                        Number(difficulty)
                                    ),
                                    raid.id,
                                    boss.name,
                                    Number(difficulty)
                                )
                            );

                            for (const combatMetric of ["dps", "hps"]) {
                                const collectionName = getBossCollectionName(
                                    boss.difficultyIds[
                                        difficulty as keyof typeof boss.difficultyIds
                                    ],
                                    Number(difficulty),
                                    combatMetric
                                );
                                const bossCollection = await this.db.collection(
                                    collectionName
                                );

                                if (await bossCollection.findOne({}))
                                    await bossCollection.deleteMany({});
                            }
                        }
                    }
                }

                await this.updateDatabase(true);
                console.log("db: Initalization done.");
                resolve(true);
            } catch (err) {
                this.isUpdating = false;
                reject(err);
            }
        });
    }

    async updateDatabase(isInitalization: boolean): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);
                if (!this.client) throw new Error(connectionErrorMessage);

                if (this.isUpdating)
                    throw new Error("db: Database is already updating.");

                console.log("db: Updating database");
                this.isUpdating = true;
                this.updateStatus = "Database is updating.";

                const updateStarted = new Date().getTime() / 1000;
                const maintenanceCollection = await this.db.collection(
                    "maintenance"
                );

                const lastLogIds = isInitalization
                    ? {}
                    : (
                          (await maintenanceCollection.findOne(
                              {}
                          )) as DbMaintenance
                      ).lastLogIds;

                let oldLogData:
                    | {
                          logs: RaidLogWithRealm[];
                          lastLogIds: { [propName: string]: number };
                      }
                    | false = false;
                if (isInitalization) {
                    try {
                        oldLogData = require("../../newLogData.json") as {
                            logs: RaidLogWithRealm[];
                            lastLogIds: { [propName: string]: number };
                        };
                        console.log("db: Using old log data for initalization");
                    } catch (err) {
                        console.log("db: Requesting logs");
                    }
                } else {
                    console.log("db: Requesting logs");
                }
                let { logs, lastLogIds: newLastLogIds } = oldLogData
                    ? oldLogData
                    : await getLogs(lastLogIds);

                logs = logs.reduce((acc, log) => {
                    let fixedLog: RaidLogWithRealm | false = log;
                    for (const bug of environment.logBugs) {
                        if (fixedLog) {
                            fixedLog = logBugHandler(fixedLog, bug);
                        }
                    }

                    if (fixedLog) {
                        acc.push(fixedLog);
                    }

                    return acc;
                }, [] as RaidLogWithRealm[]);

                if (isInitalization) {
                    console.log(
                        "db: Saving logs in case something goes wrong in the initalization process to",
                        __dirname
                    );

                    fs.writeFileSync(
                        "logData.json",
                        JSON.stringify({ logs, lastLogIds: newLastLogIds })
                    );

                    console.log("db: Processing logs");
                    const { bosses, guilds, combatMetrics } = processLogs(logs);

                    console.log("db: Saving raid bosses");
                    for (const bossId in bosses) {
                        await this.saveRaidBoss(bosses[bossId]);
                    }

                    console.log("db: Saving guilds");
                    for (const guildId in guilds) {
                        await this.saveGuild(guilds[guildId]);
                    }

                    console.log("db: Saving chars");
                    for (const bossId in combatMetrics) {
                        console.log(`db: to ${bossId}`);

                        for (const combatMetric in combatMetrics[bossId]) {
                            let characters = [];
                            for (const charId in combatMetrics[bossId][
                                combatMetric
                            ]) {
                                characters.push(
                                    combatMetrics[bossId][combatMetric][charId]
                                );
                            }

                            const bossCollection = await this.db.collection(
                                `${bossId} ${combatMetric}`
                            );

                            try {
                                await bossCollection.insertMany(characters);
                            } catch (err) {
                                console.error(
                                    `Error while tring to save to ${bossId} ${combatMetric}`
                                );
                            }
                        }
                    }
                    console.log("db: Saving chars done");

                    await maintenanceCollection.updateOne(
                        {},
                        {
                            $set: {
                                lastUpdated: updateStarted,
                                lastLogIds: newLastLogIds,
                                lastGuildsUpdate: updateStarted,
                                isInitalized: true
                            }
                        }
                    );
                } else {
                    let completed = false;
                    let chunkLastLogIds = { ...lastLogIds };
                    const loopSteps = 10;
                    const loopCount = Math.ceil(logs.length / loopSteps);

                    if (loopCount === 0) {
                        completed = true;
                    }

                    for (let i = 1; i <= loopCount; i++) {
                        const start = (i - 1) * loopSteps;
                        const chunkOfLogs = logs.slice(
                            start,
                            start + loopSteps
                        );
                        const processedLogs = processLogs(chunkOfLogs);
                        chunkLastLogIds = {
                            ...chunkLastLogIds,
                            ...getLastLogIds(chunkOfLogs)
                        };
                        const session = this.client.startSession();

                        try {
                            console.log("db: Opening new transaction session");
                            await session.withTransaction(
                                async () => {
                                    await this.saveLogs(
                                        processedLogs,
                                        {
                                            lastLogIds: chunkLastLogIds,
                                            updateStarted
                                        },
                                        session
                                    );
                                },
                                {
                                    readConcern: {
                                        level: "majority"
                                    },
                                    writeConcern: {
                                        w: "majority",
                                        j: true
                                    }
                                }
                            );

                            if (i === loopCount) {
                                completed = true;
                            }
                        } catch (err) {
                            console.log("transaction error");
                            console.error(err);
                            break;
                        } finally {
                            session.endSession();
                            console.log("db: Transaction session closed");
                        }
                    }

                    if (completed) {
                        await maintenanceCollection.updateOne(
                            {},
                            {
                                $set: {
                                    lastLogIds: newLastLogIds
                                }
                            }
                        );
                    }
                }

                if (
                    !isInitalization &&
                    minutesAgo(this.lastGuildsUpdate) > 2800
                ) {
                    console.log("db: Updating guilds");
                    this.lastGuildsUpdate = updateStarted;
                    await maintenanceCollection.updateOne(
                        {},
                        {
                            $set: {
                                lastGuildsUpdate: this.lastGuildsUpdate
                            }
                        }
                    );

                    await this.updateGuilds();
                }

                this.updateRaidBossCache();

                this.updateLeaderboard();

                cache.clearRaidSummary();
                cache.clearCharacterPerformance();

                this.isUpdating = false;
                this.updateStatus = "";
                this.lastUpdated = updateStarted;

                console.log("db: Database update finished");
                resolve(minutesAgo(updateStarted));
            } catch (err) {
                if (err.message !== "Database is already updating") {
                    console.error(`Database update error: ${err.message}`);
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
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as DbMaintenance | null;

                resolve(maintenance ? maintenance.lastUpdated : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getLastGuildsUpdate(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as DbMaintenance | null;

                resolve(maintenance ? maintenance.lastGuildsUpdate : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async isInitalized(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as DbMaintenance | null;

                resolve(maintenance ? maintenance.isInitalized : false);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveRaidBoss(boss: RaidBoss, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const raidCollection = this.db.collection(String(boss.raidId));
                const oldData = (await raidCollection.findOne(
                    {
                        name: boss.name
                    },
                    { session: session }
                )) as DbRaidBoss | null;

                if (!oldData) {
                    await raidCollection.insertOne(
                        {
                            name: boss.name,
                            [boss.difficulty]: boss
                        },
                        {
                            session
                        }
                    );
                } else {
                    let updatedBoss = oldData[boss.difficulty]
                        ? updateRaidBoss(oldData[boss.difficulty], boss)
                        : boss;

                    await raidCollection.updateOne(
                        {
                            name: boss.name
                        },
                        {
                            $set: {
                                ...oldData,
                                _id: oldData._id,
                                [boss.difficulty]: updatedBoss
                            }
                        },
                        {
                            session
                        }
                    );
                }

                this.updatedRaidBosses.push({
                    raidId: boss.raidId,
                    name: boss.name
                });

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(newGuild: Guild, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                let oldGuild = await this.db.collection("guilds").findOne(
                    {
                        _id: newGuild._id
                    },
                    { session }
                );

                if (!oldGuild) {
                    try {
                        let guildData = await requestGuildData(
                            newGuild.name,
                            newGuild.realm
                        ).catch(err => {
                            if (err.message === "guild not found")
                                throw new Error(err.message);
                            return false as const;
                        });

                        await this.db.collection("guilds").insertOne(
                            guildData
                                ? updateGuildData(newGuild, guildData)
                                : {
                                      ...updateGuildRanking(newGuild),
                                      raidDays: {
                                          ...newGuild.raidDays,
                                          recent: getRecentGuildRaidDays(
                                              newGuild.progression.recentKills
                                          )
                                      },
                                      progression: {
                                          ...newGuild.progression,
                                          completion: getGuildContentCompletion(
                                              newGuild.progression.raids
                                          )
                                      }
                                  },
                            { session }
                        );
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    await this.db.collection("guilds").updateOne(
                        {
                            _id: newGuild._id
                        },
                        {
                            $set: updateGuildData(oldGuild, newGuild)
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

    async saveLogs(
        { bosses, guilds, combatMetrics }: ReturnType<typeof processLogs>,
        {
            lastLogIds,
            updateStarted
        }: { lastLogIds: LastLogIds; updateStarted: number },
        session?: ClientSession
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenanceCollection = this.db.collection("maintenance");
                console.log("db: Saving raid bosses");
                for (const bossId in bosses) {
                    await this.saveRaidBoss(bosses[bossId], session);
                }

                console.log("db: Saving guilds");
                for (const guildId in guilds) {
                    await this.saveGuild(guilds[guildId], session);
                }

                console.log("db: Saving chars");
                for (const bossId in combatMetrics) {
                    console.log(`db: to ${bossId}`);
                    for (const combatMetric in combatMetrics[bossId]) {
                        for (const charId in combatMetrics[bossId][
                            combatMetric
                        ]) {
                            await this.saveChar(
                                bossId,
                                combatMetric as "dps" | "hps",
                                combatMetrics[bossId][combatMetric][charId],
                                session
                            );
                        }
                    }
                }
                console.log("db: Saving chars done");

                await maintenanceCollection.updateOne(
                    {},
                    {
                        $set: {
                            lastUpdated: updateStarted,
                            lastLogIds: lastLogIds,
                            isInitalized: true
                        }
                    },
                    {
                        session
                    }
                );
            } catch (err) {
                reject(err);
            }
            resolve(true);
        });
    }

    async saveChar(
        bossId: string,
        combatMetric: "dps" | "hps",
        char: Character,
        session?: ClientSession
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const bossCollection = await this.db.collection(
                    `${bossId} ${combatMetric}`
                );

                const oldChar: Character = await bossCollection.findOne(
                    {
                        _id: char._id
                    },
                    { session }
                );

                if (!oldChar) {
                    await bossCollection.insertOne(char, { session });
                } else {
                    const oldPerformance = oldChar[combatMetric];
                    const newPerformance = char[combatMetric];

                    if (
                        oldPerformance &&
                        newPerformance &&
                        oldPerformance < newPerformance
                    ) {
                        await bossCollection.updateOne(
                            {
                                _id: char._id
                            },
                            {
                                $set: char
                            },
                            { session }
                        );
                    }
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                this.updateStatus = "Updating guilds";

                const guilds: {
                    _id: string;
                    name: string;
                    realm: string;
                }[] = await this.db
                    .collection("guilds")
                    .find({})
                    .project({
                        _id: 1,
                        name: 1,
                        realm: 1
                    })
                    .toArray();

                let total = guilds.length;
                let current = 0;

                for (let guild of guilds) {
                    try {
                        current++;
                        console.log(
                            `db: Updating ${guild.name} ${current}/${total}`
                        );

                        const newGuild = await requestGuildData(
                            guild.name,
                            guild.realm
                        );

                        await this.saveGuild({
                            ...newGuild,
                            _id: guild._id
                        });
                    } catch (err) {
                        if (
                            err.message &&
                            err.message.includes("guild not found")
                        ) {
                            this.removeGuild(guild._id);
                        } else {
                            console.log(`Error with updating ${guild.name}:`);
                            console.error(err);
                        }
                    }
                }

                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async removeGuild(guildId: string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                await this.db.collection("guilds").deleteOne({
                    _id: guildId
                });
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async requestRaidBoss(
        raidId: number,
        bossName: string
    ): Promise<RaidBossDataToServe> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const difficulties = getRaidInfoFromId(raidId).difficulties;

                const projection = difficulties.reduce((acc, difficulty) => {
                    return {
                        ...acc,
                        [`${difficulty}.bestDps`]: 0,
                        [`${difficulty}.bestHps`]: 0,
                        [`${difficulty}.firstKills`]: 0
                    };
                }, {});

                const bossInfo = getBossInfo(raidId, bossName);

                let lookUps = [];
                for (const difficulty in bossInfo.difficultyIds) {
                    const bossId =
                        bossInfo.difficultyIds[
                            difficulty as keyof typeof bossInfo.difficultyIds
                        ];

                    for (const combatMetric of ["dps", "hps"]) {
                        const bossCollectionName = getBossCollectionName(
                            bossId,
                            Number(difficulty),
                            combatMetric
                        );

                        lookUps.push({
                            $lookup: {
                                from: bossCollectionName,
                                pipeline: [
                                    {
                                        $sort: {
                                            [combatMetric]: -1
                                        }
                                    }
                                ],
                                as: `${difficulty}.${combatMetric}`
                            }
                        });
                    }
                }

                const dbResponse: DbRaidBossDataResponse = (
                    await this.db
                        .collection(String(raidId))
                        .aggregate([
                            {
                                $match: {
                                    name: bossName
                                }
                            },
                            ...lookUps
                        ])
                        .project(projection)
                        .toArray()
                )[0];

                let bossData: RaidBossDataToServe = {
                    _id: dbResponse._id,
                    name: dbResponse.name
                };

                for (const difficulty of difficulties) {
                    const boss = dbResponse[difficulty];
                    let newBoss: RaidBossDataToServe[number] = {
                        ...boss,
                        fastestKills: [],
                        dps: [],
                        hps: []
                    };
                    for (let combatMetric of ["dps", "hps"] as const) {
                        newBoss[combatMetric] = applyCharacterPerformanceRanks(
                            boss[combatMetric],
                            combatMetric
                        );
                    }

                    let fastestKills: DbRaidBossDataResponse[number]["fastestKills"][string][number] =
                        [];
                    for (const realm in boss.fastestKills) {
                        for (const faction in boss.fastestKills[realm]) {
                            const objectKeys = [realm, faction];

                            fastestKills = fastestKills.concat(
                                getNestedObjectValue(
                                    boss.fastestKills,
                                    objectKeys
                                )
                            );
                        }
                    }

                    newBoss.fastestKills = fastestKills
                        .sort((a, b) => {
                            return a.fightLength - b.fightLength;
                        })
                        .slice(0, 50);

                    bossData[difficulty] = newBoss;
                }
                resolve(bossData);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateRaidBossCache() {
        const fullLoad = async (): Promise<true> => {
            return new Promise(async (resolve, reject) => {
                try {
                    runGC();
                    for (const raid of environment.currentContent.raids) {
                        let promises = [];
                        for (const boss of raid.bosses) {
                            promises.push(
                                this.requestRaidBoss(raid.id, boss.name)
                            );
                        }

                        const bosses = await Promise.all(promises);

                        for (const boss of bosses) {
                            const cacheId = getRaidBossCacheId(
                                raid.id,
                                boss.name
                            );

                            cache.raidBoss.set(cacheId, boss);
                        }
                        runGC();
                    }
                    resolve(true);
                } catch (err) {
                    reject(err);
                }
            });
        };

        const getBossesToUpdate = () => {
            let encounteredBosses: LooseObject = {};
            let uniqueBosses = [];

            for (let bossData of this.updatedRaidBosses) {
                if (!encounteredBosses[bossData.name]) {
                    uniqueBosses.push(bossData);
                    encounteredBosses[bossData.name] = true;
                }
            }
            return uniqueBosses;
        };

        return new Promise(async (resolve, reject) => {
            try {
                if (!this.firstCacheLoad) {
                    this.firstCacheLoad = fullLoad();
                } else {
                    const bossesToUpdate = getBossesToUpdate();

                    for (let bossData of bossesToUpdate) {
                        let boss = await this.requestRaidBoss(
                            bossData.raidId,
                            bossData.name
                        );

                        const cacheId = getRaidBossCacheId(
                            bossData.raidId,
                            boss.name
                        );

                        cache.raidBoss.set(cacheId, boss);
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
        await this.firstCacheLoad;

        for (const combatMetric of ["dps", "hps"] as const) {
            for (const raid of environment.currentContent.raids) {
                let leaderboards: {
                    overall: Leaderboard;
                    specs: { [propName: string]: Leaderboard };
                    roles: { [propName: string]: Leaderboard };
                } = {
                    overall: {},
                    roles: {},
                    specs: {}
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
                        let boss = cache.raidBoss.get(
                            getRaidBossCacheId(raid.id, bossInfo.name)
                        ) as RaidBossDataToServe;

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
                                currentPerformance &&
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
                                        race: characterData.race
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
                                            topPercent: 0
                                        },
                                        specs: {},
                                        roles: {}
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

                cache.leaderboard.set(
                    overallLeaderboardId,
                    leaderboards.overall
                );

                for (let specId in leaderboards.specs) {
                    const currentLeaderboardId = getLeaderboardCacheId(
                        raid.id,
                        combatMetric,
                        specId
                    );

                    cache.leaderboard.set(
                        currentLeaderboardId,
                        leaderboards.specs[specId]
                    );
                }

                for (let role in leaderboards.roles) {
                    const currentLeaderboardId = getLeaderboardCacheId(
                        raid.id,
                        combatMetric,
                        role
                    );

                    cache.leaderboard.set(
                        currentLeaderboardId,
                        leaderboards.roles[role]
                    );
                }

                runGC();
            }
        }
    }

    async getGuildList() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `list`;

                const cachedData = cache.guildList.get(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const guildList = await this.db
                        .collection("guilds")
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            activity: 1,
                            ["progression.completion"]: 1
                        })
                        .toArray();

                    cache.guildList.set(cacheId, guildList);

                    resolve(guildList);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuild(realm: string, guildName: string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const guild = await this.db.collection("guilds").findOne({
                    name: guildName,
                    realm: realm
                });

                if (!guild) throw new Error("guild not found");

                resolve(guild);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBoss(
        raidId: number,
        bossName: string
    ): Promise<RaidBossDataToServe> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `${raidId}${bossName}`;

                const cachedData = cache.raidBoss.get(cacheId) as
                    | RaidBossDataToServe
                    | false;

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    let bossData = await this.requestRaidBoss(raidId, bossName);
                    cache.raidBoss.set(cacheId, bossData);

                    resolve(bossData);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossKillCount(
        raidId: number,
        bossName: string,
        difficulty: number
    ): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `${raidId}${bossName}`;

                const cachedData = cache.raidBoss.get(cacheId) as
                    | RaidBossDataToServe
                    | false;

                if (cachedData) {
                    resolve(cachedData[difficulty].killCount);
                } else {
                    let bossData = await this.requestRaidBoss(raidId, bossName);
                    cache.raidBoss.set(cacheId, bossData);

                    resolve(bossData[difficulty].killCount);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBossRecentKills(
        raidId: number,
        bossName: string,
        difficulty: number
    ): Promise<TrimmedLog[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `${raidId}${bossName}`;

                const cachedData = cache.raidBoss.get(cacheId) as
                    | RaidBossDataToServe
                    | false;

                if (cachedData) {
                    resolve(cachedData[difficulty].recentKills);
                } else {
                    let bossData = await this.requestRaidBoss(raidId, bossName);
                    cache.raidBoss.set(cacheId, bossData);

                    resolve(bossData[difficulty].recentKills);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getCharacterLeaderboard(id: string) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.firstCacheLoad) throw new Error("Loading...");

                const data = cache.leaderboard.get(id);

                if (!data) {
                    throw new Error("No data");
                } else {
                    resolve(data);
                }
            } catch (err) {
                reject(err);
            }
        });
    }
    async getGuildLeaderboard() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `guildleaderboard`;

                const cachedData = cache.guildLeaderboard.get(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const guildLeaderboard = await this.db
                        .collection("guilds")
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            ranking: 1
                        })
                        .toArray();

                    cache.guildLeaderboard.set(cacheId, guildLeaderboard);

                    resolve(guildLeaderboard);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidSummary(raidId: number) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `raidsummary${raidId}`;

                const cachedData = cache.raidSummary.get(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const difficulties = getRaidInfoFromId(raidId).difficulties;

                    const projection = difficulties.reduce(
                        (acc, difficulty) => {
                            return { ...acc, [`${difficulty}.recentKills`]: 0 };
                        },
                        {}
                    );

                    let bosses = (await this.db
                        .collection(String(raidId))
                        .find({})
                        .project(projection)
                        .toArray()) as {
                        [propName: number]: RaidBossNoRecent;
                    }[];

                    let raidSummary: RaidSummary = {};
                    for (const difficulty of difficulties) {
                        for (const bossData of bosses) {
                            const boss = bossData[difficulty];

                            if (!boss) continue;
                            for (const realmName in boss.fastestKills) {
                                for (const faction in boss.fastestKills[
                                    realmName
                                ]) {
                                    boss.fastestKills[realmName][faction] =
                                        boss.fastestKills[realmName][
                                            faction
                                        ].slice(0, 10);
                                }
                            }

                            raidSummary[boss._id] = boss;
                        }
                    }

                    cache.raidSummary.set(cacheId, raidSummary);

                    resolve(raidSummary);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getCharacterPerformance(
        characterName: string,
        characterClass: keyof typeof environment.characterClassToSpec,
        realm: keyof typeof environment.shortRealms,
        raidName: string
    ): Promise<CharacterPerformance> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const cacheId = `${characterName}${realm}${raidName}`;

                const cachedData = cache.characterPerformance.get(cacheId) as
                    | CharacterPerformance
                    | false;

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const {
                        bossCount,
                        bosses,
                        id: raidId,
                        difficulties
                    } = getRaidInfoFromName(raidName);
                    const characterSpecs =
                        environment.characterClassToSpec[characterClass];

                    let aggregations: LooseObject = {};

                    let characterPerformance: CharacterPerformance = {};

                    for (const bossInfo of bosses) {
                        let projection = {};
                        for (const difficulty in bossInfo.difficultyIds) {
                            let currentProjection: LooseObject = {
                                [`${difficulty}.characterData`]: 1
                            };
                            for (const combatMetric of [
                                "dps",
                                "hps"
                            ] as const) {
                                currentProjection[
                                    `${difficulty}.best${capitalize(
                                        combatMetric
                                    )}NoCat`
                                ] = 1;

                                if (!aggregations[bossInfo.name]) {
                                    aggregations[bossInfo.name] = [];
                                }

                                for (const specId of characterSpecs) {
                                    const spec =
                                        environment.specs[
                                            specId as unknown as keyof typeof environment.specs
                                        ];
                                    const key = (
                                        combatMetric === "dps"
                                            ? "isDps"
                                            : "isHealer"
                                    ) as keyof typeof spec;

                                    if (spec && spec[key]) {
                                        for (const realmName of Object.values(
                                            environment.realms
                                        )) {
                                            for (const faction of [0, 1]) {
                                                currentProjection = {
                                                    ...currentProjection,
                                                    [`${difficulty}.best${capitalize(
                                                        combatMetric
                                                    )}.${realmName}.${faction}.${specId}`]:
                                                        {
                                                            $arrayElemAt: [
                                                                `$${difficulty}.best${capitalize(
                                                                    combatMetric
                                                                )}.${realmName}.${faction}.${characterClass}.${specId}`,
                                                                0
                                                            ]
                                                        }
                                                };
                                            }
                                        }
                                    }
                                }
                                projection = {
                                    ...projection,
                                    ...currentProjection
                                };
                            }
                        }
                        aggregations[bossInfo.name].unshift(
                            {
                                $match: {
                                    name: bossInfo.name
                                }
                            },
                            {
                                $project: projection
                            }
                        );
                    }

                    let data = (
                        await this.db
                            .collection(String(raidId))
                            .aggregate([
                                {
                                    $facet: aggregations
                                }
                            ])
                            .toArray()
                    )[0];

                    for (const difficulty of difficulties) {
                        let characterTotal: LooseObject = {};
                        let bestTotal: LooseObject = {};

                        for (const boss of bosses) {
                            const currentBoss = data[boss.name][0];

                            for (const combatMetric of [
                                "dps",
                                "hps"
                            ] as const) {
                                const bestCombatMetricOfBoss =
                                    currentBoss[difficulty][
                                        `best${capitalize(combatMetric)}`
                                    ];
                                const bestOverall = currentBoss[difficulty][
                                    `best${capitalize(combatMetric)}NoCat`
                                ] || { dps: 0, hps: 0 };

                                let bestOfClass: LooseObject = {};
                                let bestOfCharacter: LooseObject = {
                                    [combatMetric]: 0
                                };

                                for (const specId of characterSpecs) {
                                    let bestOfSpec: LooseObject = {};
                                    let characterSpecData: LooseObject = {
                                        [combatMetric]: 0
                                    };

                                    for (const realmName in bestCombatMetricOfBoss) {
                                        for (const faction in bestCombatMetricOfBoss[
                                            realmName
                                        ]) {
                                            const currentBest =
                                                bestCombatMetricOfBoss[
                                                    realmName
                                                ][faction][specId];

                                            if (currentBest) {
                                                if (
                                                    !bestOfSpec[combatMetric] ||
                                                    bestOfSpec[combatMetric] <
                                                        currentBest[
                                                            combatMetric
                                                        ]
                                                ) {
                                                    bestOfSpec = currentBest;
                                                }
                                                if (
                                                    !bestOfClass[
                                                        combatMetric
                                                    ] ||
                                                    bestOfClass[combatMetric] <
                                                        currentBest[
                                                            combatMetric
                                                        ]
                                                ) {
                                                    bestOfClass = currentBest;
                                                }
                                            }
                                        }
                                    }

                                    const bossData = (
                                        await this.getRaidBoss(
                                            raidId,
                                            boss.name
                                        )
                                    )[difficulty][combatMetric];

                                    const charData =
                                        bossData.find(
                                            character =>
                                                character._id ===
                                                getCharacterId(
                                                    characterName,
                                                    realm,
                                                    specId
                                                )
                                        ) || ({} as LooseObject);
                                    if (
                                        bestOfCharacter[combatMetric] <
                                        charData[combatMetric]
                                    ) {
                                        bestOfCharacter = charData;
                                    }

                                    characterSpecData = {
                                        ...charData,
                                        topPercent: getRelativePerformance(
                                            charData[combatMetric],
                                            bestOfSpec[combatMetric]
                                        )
                                    };

                                    const categorization = [
                                        raidName,
                                        difficulty,
                                        boss.name,
                                        specId,
                                        combatMetric
                                    ];

                                    characterPerformance = addNestedObjectValue(
                                        characterPerformance,
                                        categorization,
                                        characterSpecData
                                    );

                                    characterTotal = addToCharTotalPerformance(
                                        characterTotal,
                                        [specId, combatMetric],
                                        characterSpecData[combatMetric]
                                    );

                                    bestTotal = addToCharTotalPerformance(
                                        bestTotal,
                                        [specId, combatMetric],
                                        bestOfSpec[combatMetric]
                                    );
                                }

                                const categorization = [
                                    raidName,
                                    difficulty,
                                    boss.name
                                ];

                                characterPerformance = addNestedObjectValue(
                                    characterPerformance,
                                    [...categorization, "class", combatMetric],
                                    {
                                        ...bestOfCharacter,
                                        topPercent: getRelativePerformance(
                                            bestOfCharacter[combatMetric],
                                            bestOfClass[combatMetric]
                                        )
                                    }
                                );

                                bestTotal = addToCharTotalPerformance(
                                    bestTotal,
                                    ["class", combatMetric],
                                    bestOfClass[combatMetric]
                                );

                                characterTotal = addToCharTotalPerformance(
                                    characterTotal,
                                    ["class", combatMetric],
                                    bestOfCharacter[combatMetric]
                                );

                                characterPerformance = addNestedObjectValue(
                                    characterPerformance,
                                    [...categorization, "noSpec", combatMetric],
                                    {
                                        ...bestOfCharacter,
                                        topPercent: getRelativePerformance(
                                            bestOfCharacter[combatMetric],
                                            bestOverall[combatMetric]
                                        )
                                    }
                                );
                                bestTotal = addToCharTotalPerformance(
                                    bestTotal,
                                    ["noSpec", combatMetric],
                                    bestOverall[combatMetric]
                                );

                                characterTotal = addToCharTotalPerformance(
                                    characterTotal,
                                    ["noSpec", combatMetric],
                                    bestOfCharacter[combatMetric]
                                );
                            }
                        }

                        for (const specId in characterTotal) {
                            for (const combatMetric in characterTotal[specId]) {
                                const categorization = [specId, combatMetric];
                                const bestCombatMetricOfTotal =
                                    getNestedObjectValue(
                                        bestTotal,
                                        categorization
                                    );
                                const characterCombatMetricOfTotal =
                                    getNestedObjectValue(
                                        characterTotal,
                                        categorization
                                    );
                                const characterPerformanceTotal =
                                    characterPerformance[raidName][difficulty]
                                        .total;

                                characterPerformance[raidName][
                                    difficulty
                                ].total = addNestedObjectValue(
                                    characterPerformanceTotal || {},
                                    categorization,
                                    {
                                        [combatMetric]:
                                            characterCombatMetricOfTotal /
                                            bossCount,
                                        topPercent: getRelativePerformance(
                                            characterCombatMetricOfTotal,
                                            bestCombatMetricOfTotal
                                        )
                                    }
                                ) as CharPerfBossData;
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

const db = new Database();

export type DatabaseType = typeof db;

export default db;
