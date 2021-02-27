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
    getNestedObjectValue,
    applyCharacterPerformanceRanks,
    getRaidBossCacheId,
    getRelativePerformance,
    getLeaderboardCacheId,
    updateCharacterOfLeaderboard
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
    CharacterOfLeaderboard
} from "../types";

const connectionErrorMessage = "Not connected to database.";

class Database {
    public db: Db | undefined;

    private client: MongoClient | undefined;

    private lastUpdated: number;
    private lastGuildsUpdate: number;
    private isUpdating: boolean;
    private updateStatus: string;

    public firstCacheLoad: false | true | Promise<any>;

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

            this.lastUpdated = await this.getLastUpdated();
            this.lastGuildsUpdate = await this.getLastGuildsUpdate();
        } catch (err) {
            throw err;
        }
    }

    async initalizeDatabase() {
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

    async updateDatabase(isInitalization: boolean) {
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
                    : ((await maintenanceCollection.findOne(
                          {}
                      )) as DbMaintenance).lastLogIds;

                console.log("db: Requesting logs");
                let { logs, lastLogIds: newLastLogIds } = await getLogs(
                    lastLogIds
                );

                if (isInitalization) {
                    console.log(
                        "db: Saving logs in case something goes wrong in the initalization process to",
                        __dirname
                    );
                    fs.writeFileSync(
                        "logData.json",
                        JSON.stringify({ logs, lastLogIds: newLastLogIds })
                    );
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
                    newLastLogIds = { ...lastLogIds };
                    const loopSteps = 10;
                    for (
                        let i = 0;
                        i < Math.ceil(logs.length / loopSteps);
                        i++
                    ) {
                        const start = i * loopSteps;
                        const chunkOfLogs = logs.slice(
                            start,
                            start + loopSteps
                        );
                        const processedLogs = processLogs(chunkOfLogs);
                        newLastLogIds = {
                            ...newLastLogIds,
                            ...getLastLogIds(chunkOfLogs)
                        };
                        const session = this.client.startSession();

                        try {
                            console.log("db: Opening new transaction session");
                            await session.withTransaction(async () => {
                                await this.saveLogs(
                                    processedLogs,
                                    {
                                        lastLogIds: newLastLogIds,
                                        updateStarted
                                    },
                                    session
                                );
                            });
                        } catch (err) {
                            console.log("transaction error");
                            console.error(err);
                            break;
                        } finally {
                            session.endSession();
                            console.log("db: Transaction session closed");
                        }
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

    async isInitalized() {
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
                            return {};
                        });

                        await this.db.collection("guilds").insertOne(
                            {
                                ...newGuild,
                                ...guildData,
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
                                Number(bossId),
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
        bossId: number,
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
                        // THIS NEEDS TO BE THOUGHT OUT
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

                    let fastestKills: DbRaidBossDataResponse[number]["fastestKills"][string][number] = [];
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
        const fullLoad = async () => {
            return new Promise(async (resolve, reject) => {
                try {
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
                } = {
                    overall: {},
                    specs: {}
                };
                for (const difficulty of raid.difficulties) {
                    let characters: {
                        [propName: string]: {
                            best: CharacterOfLeaderboard;
                            specs: {
                                [propName: string]: CharacterOfLeaderboard;
                            };
                        };
                    } = {};

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

                            for (const characterData of characterContainer) {
                                const currentPerformance =
                                    characterData[combatMetric];
                                const currentPercent = currentPerformance
                                    ? getRelativePerformance(
                                          currentPerformance,
                                          bestPerformanceOfBoss
                                      )
                                    : 0;

                                const modifiedCharacter: CharacterOfLeaderboard = {
                                    _id: characterData._id,
                                    class: characterData.class,
                                    f: characterData.f,
                                    ilvl: characterData.ilvl,
                                    name: characterData.name,
                                    realm: characterData.realm,
                                    spec: characterData.spec,
                                    topPercent: currentPercent,
                                    date: characterData.date
                                };

                                if (!bestOfCharacter) {
                                    bestOfCharacter = modifiedCharacter;
                                } else {
                                    bestOfCharacter = updateCharacterOfLeaderboard(
                                        bestOfCharacter,
                                        modifiedCharacter
                                    );
                                }

                                if (!characters[charId]) {
                                    characters[charId] = {
                                        best: modifiedCharacter,
                                        specs: {}
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
                                    const updatedChar = updateCharacterOfLeaderboard(
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
                                const updatedChar = updateCharacterOfLeaderboard(
                                    characters[charId].best,
                                    bestOfCharacter
                                );

                                const performance =
                                    characters[charId].best.topPercent +
                                    bestOfCharacter.topPercent;

                                characters[charId].best = updatedChar;

                                characters[
                                    charId
                                ].best.topPercent = performance;
                            }
                        }
                    }

                    for (const charId in characters) {
                        if (!leaderboards.overall[difficulty]) {
                            leaderboards.overall[difficulty] = [];
                        }
                        characters[charId].best.topPercent =
                            characters[charId].best.topPercent /
                            raid.bosses.length;

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
                                characters[charId].specs[specId].topPercent /
                                raid.bosses.length;

                            leaderboards.specs[specId][difficulty].push(
                                characters[charId].specs[specId]
                            );
                        }
                    }

                    leaderboards.overall[difficulty].sort(
                        (a, b) => b.topPercent - a.topPercent
                    );

                    for (const specId in leaderboards.specs) {
                        leaderboards.specs[specId][difficulty].sort(
                            (a, b) => b.topPercent - a.topPercent
                        );
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
            }
        }
    }
}

const db = new Database();
export type DatabaseType = typeof db;

export default db;
