const fs = require("fs");
const { currentContent, logBugs, realms, specs } = require("./expansionData");
const { characterClassToSpec } = require("tauriprogress-constants");
const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbAddress = process.env.MONGODB_ADDRESS;
const mongoUri = `mongodb+srv://${dbUser}:${dbPassword}@${dbAddress}`;
const MongoClient = require("mongodb").MongoClient;
const cache = require("./cache");

const {
    getLogs,
    updateGuildData,
    requestGuildData,
    updateRaidBoss,
    minutesAgo,
    calcGuildContentCompletion,
    createCharacterId,
    addNestedObjectValue,
    getNestedObjectValue,
    calcTopPercentOfPerformance,
    capitalize,
    recentGuildRaidDays,
    logBugHandler,
    processLogs,
    getBossCollectionName,
    getLastLogIds,
    getBossInfo,
    getRaidInfoFromId,
    getRaidInfoFromName,
    addToTotalPerformance,
    applyCharacterPerformanceRanks
} = require("./helpers");

class Database {
    constructor() {
        this.db = {};
        this.client = undefined;
        this.lastUpdated = null;
        this.isUpdating = false;
        this.updateStatus = "";
        this.lastGuildsUpdate = 0;
        this.lastRaidBossCacheUpdate = 0;
    }

    async connect() {
        try {
            console.log("Connecting to database");
            this.client = await MongoClient.connect(mongoUri, {
                useUnifiedTopology: true,
                useNewUrlParser: true
            });

            this.db = this.client.db("tauriprogress");

            this.lastUpdated = await this.getLastUpdated();
            this.lastGuildsUpdate = await this.getLastGuildsUpdate();

            await this.updateRaidBossCache();
        } catch (err) {
            throw err;
        }
    }
    async disconnect() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db)
                    throw new Error(
                        "Tried to disconnect from db while not connected."
                    );

                this.db.close();
            } catch (err) {
                reject(err);
            }
        });
    }

    async initalizeDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log("db: Initalizing database");
                console.log("db: Creating maintenance collection");
                const maintenanceCollection = await this.db.collection(
                    "maintenance"
                );
                if (await maintenanceCollection.findOne())
                    await maintenanceCollection.deleteMany({});

                maintenanceCollection.insertOne({
                    lastUpdated: 0,
                    lastGuildsUpdate: 0,
                    lastLogIds: {},
                    isInitalized: true
                });

                console.log("db: Creating guilds collection");
                let guildsCollection = await this.db.collection("guilds");
                if (await guildsCollection.findOne())
                    await guildsCollection.deleteMany({});

                console.log(`db: Creating collections for raids and bosses`);
                for (const raid of currentContent.raids) {
                    const raidCollection = await this.db.collection(
                        String(raid.id)
                    );

                    if (await raidCollection.findOne())
                        await raidCollection.deleteMany({});

                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.difficultyIds) {
                            for (const combatMetric of ["dps", "hps"]) {
                                const collectionName = getBossCollectionName(
                                    boss.difficultyIds[difficulty],
                                    difficulty,
                                    combatMetric
                                );
                                const bossCollection = await this.db.collection(
                                    collectionName
                                );

                                if (await bossCollection.findOne())
                                    await bossCollection.deleteMany({});
                            }
                        }
                    }
                }

                await this.update(true);
                console.log("db: initalization done.");
                resolve("Done");
            } catch (err) {
                this.isUpdating = false;
                reject(err);
            }
        });
    }

    async isInitalized() {
        return new Promise(async (resolve, reject) => {
            try {
                const maintenanceCollection = await this.db
                    .collection("maintenance")
                    .findOne();
                if (!maintenanceCollection) resolve(false);
                resolve(maintenanceCollection.isInitalized);
            } catch (err) {
                reject(err);
            }
        });
    }

    async update(isInitalization) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.isUpdating)
                    throw new Error("Database is already updating");
                console.log("db: Updating database");

                this.isUpdating = true;
                this.updateStatus = "Database is already updating";

                const updateStarted = new Date().getTime() / 1000;
                const maintenanceCollection = await this.db.collection(
                    "maintenance"
                );

                const lastLogIds = isInitalization
                    ? {}
                    : (await maintenanceCollection.findOne()).lastLogIds;

                if (!lastLogIds)
                    throw new Error(
                        `Database update error, last log ids: ${lastLogIds}`
                    );

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
                        for (const bug of logBugs) {
                            log = logBugHandler(log, bug);
                        }

                        if (log) {
                            acc.push(log);
                        }

                        return acc;
                    }, []);

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
                    minutesAgo(this.lastGuildsUpdate) > 720
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

                if (minutesAgo(this.lastRaidBossCacheUpdate) > 20) {
                    this.updateRaidBossCache();
                }

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

    async saveLogs(
        { bosses, guilds, combatMetrics },
        { lastLogIds, updateStarted },
        session = null
    ) {
        return new Promise(async (resolve, reject) => {
            try {
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
                                combatMetric,
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
            resolve("Done");
        });
    }

    async saveRaidBoss(boss, session = null) {
        return new Promise(async (resolve, reject) => {
            try {
                const raidCollection = this.db.collection(String(boss.raidId));
                const oldData = await raidCollection.findOne(
                    {
                        name: boss.name
                    },
                    { session }
                );

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

                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateRaidBossCache() {
        return new Promise(async (resolve, reject) => {
            try {
                const updateStarted = new Date().getTime() / 1000;

                let promises = [];

                for (const raid of currentContent.raids) {
                    for (const boss of raid.bosses) {
                        promises.push(this.requestRaidBoss(raid.id, boss.name));
                    }

                    const bosses = await Promise.all(promises);

                    for (const boss of bosses) {
                        const cacheId = `${raid.id}${boss.name}`;

                        cache.raidBoss.set(cacheId, boss);
                    }
                }

                this.lastRaidBossCacheUpdate = updateStarted;

                resolve("done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async requestRaidBoss(raidId, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
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
                    const bossId = bossInfo.difficultyIds[difficulty];
                    for (const combatMetric of ["dps", "hps"]) {
                        const bossCollectionName = getBossCollectionName(
                            bossId,
                            difficulty,
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

                const bossData = (
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

                for (const difficulty of difficulties) {
                    const boss = bossData[difficulty];
                    for (let combatMetric of ["dps", "hps"]) {
                        boss[combatMetric] = applyCharacterPerformanceRanks(
                            boss[combatMetric],
                            combatMetric
                        );
                    }

                    let fastestKills = [];
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

                    boss.fastestKills = fastestKills
                        .sort((a, b) => {
                            return a.fightLength - b.fightLength;
                        })
                        .slice(0, 50);

                    bossData[difficulty] = boss;
                }

                resolve(bossData);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                this.updateStatus = "Updating guilds";

                let guilds = await this.db
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
                        let newGuild = await requestGuildData(
                            guild.name,
                            guild.realm
                        );

                        if (newGuild) {
                            await this.saveGuild({
                                ...newGuild,
                                _id: guild._id
                            });
                        }
                    } catch (err) {
                        if (
                            err.message &&
                            err.message.includes("guild not found")
                        ) {
                            this.removeGuild(guild);
                        } else {
                            console.log(`Error with updating ${guild.name}:`);
                            console.error(err);
                        }
                    }
                }

                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(newGuild, session = null) {
        return new Promise(async (resolve, reject) => {
            try {
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
                        );

                        if (guildData) {
                            await this.db.collection("guilds").insertOne(
                                recentGuildRaidDays(
                                    calcGuildContentCompletion({
                                        ...newGuild,
                                        ...guildData
                                    })
                                ),
                                { session }
                            );
                        }
                    } catch (err) {
                        console.error(err);
                    }
                } else {
                    await this.db.collection("guilds").updateOne(
                        {
                            _id: newGuild._id
                        },
                        {
                            $set: {
                                ...recentGuildRaidDays(
                                    calcGuildContentCompletion(
                                        updateGuildData(oldGuild, newGuild)
                                    )
                                )
                            }
                        },
                        { session }
                    );
                }
                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveChar(bossId, combatMetric, char, session = null) {
        return new Promise(async (resolve, reject) => {
            try {
                const bossCollection = await this.db.collection(
                    `${bossId} ${combatMetric}`
                );

                let oldChar = await bossCollection.findOne(
                    {
                        _id: char._id
                    },
                    { session }
                );

                if (!oldChar) {
                    await bossCollection.insertOne(char, { session });
                } else {
                    if (oldChar[combatMetric] < char[combatMetric]) {
                        await bossCollection.updateOne(
                            {
                                _id: char._id
                            },
                            {
                                $set: {
                                    ...char
                                }
                            },
                            { session }
                        );
                    }
                }
                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async removeGuild(guild) {
        return new Promise(async (resolve, reject) => {
            try {
                await this.db.collection("guilds").deleteOne({
                    _id: guild._id
                });
                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                resolve(this.db.collection("guilds").find().toArray());
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuildList() {
        return new Promise(async (resolve, reject) => {
            try {
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

    async getGuild(realm, guildName) {
        return new Promise(async (resolve, reject) => {
            try {
                let guild = await this.db.collection("guilds").findOne({
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

    async getRaidSummary(id) {
        return new Promise(async (resolve, reject) => {
            try {
                const cacheId = `raidsummary${id}`;

                const cachedData = cache.raidSummary.get(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const difficulties = getRaidInfoFromId(id).difficulties;

                    const projection = difficulties.reduce(
                        (acc, difficulty) => {
                            return { ...acc, [`${difficulty}.recentKills`]: 0 };
                        },
                        {}
                    );

                    let bosses = await this.db
                        .collection(String(id))
                        .find({})
                        .project(projection)
                        .toArray();

                    let raidSummary = {};
                    for (const difficulty of difficulties) {
                        for (const bossData of bosses) {
                            const boss = bossData[difficulty];
                            for (const realmName in boss.fastestKills) {
                                for (const faction in boss.fastestKills[
                                    realmName
                                ]) {
                                    boss.fastestKills[realmName][
                                        faction
                                    ] = boss.fastestKills[realmName][
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

    async getRaidBoss(raidId, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                const cacheId = `${raidId}${bossName}`;

                const cachedData = cache.raidBoss.get(cacheId);

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

    async getCharacterPerformance({
        characterName,
        characterClass,
        realm,
        raidName
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                const cacheId = `${characterName}${realm}${raidName}`;

                const cachedData = cache.character.get(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const {
                        bossCount,
                        bosses,
                        id: raidId,
                        difficulties
                    } = getRaidInfoFromName(raidName);
                    const characterSpecs = characterClassToSpec[characterClass];

                    let aggregations = {};

                    let characterPerformance = {};

                    for (const bossInfo of bosses) {
                        let projection = {};
                        for (const difficulty in bossInfo.difficultyIds) {
                            let currentProjection = {
                                [`${difficulty}.characterData`]: 1
                            };
                            for (const combatMetric of ["dps", "hps"]) {
                                currentProjection[
                                    `${difficulty}.best${capitalize(
                                        combatMetric
                                    )}NoCat`
                                ] = 1;

                                if (!aggregations[bossInfo.name]) {
                                    aggregations[bossInfo.name] = [];
                                }

                                const ids = [];
                                for (const specId of characterSpecs) {
                                    if (
                                        specs[specId] &&
                                        specs[specId][
                                            combatMetric === "dps"
                                                ? "isDps"
                                                : "isHealer"
                                        ]
                                    ) {
                                        const characterId = createCharacterId(
                                            characterName,
                                            realm,
                                            specId
                                        );

                                        ids.push(characterId);

                                        for (const realmName of Object.values(
                                            realms
                                        )) {
                                            for (const faction of [0, 1]) {
                                                currentProjection = {
                                                    ...currentProjection,
                                                    [`${difficulty}.best${capitalize(
                                                        combatMetric
                                                    )}.${realmName}.${faction}.${specId}`]: {
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
                        let characterTotal = {};
                        let bestTotal = {};

                        for (const boss of bosses) {
                            const currentBoss = data[boss.name][0];

                            for (const combatMetric of ["dps", "hps"]) {
                                const bestCombatMetricOfBoss =
                                    currentBoss[difficulty][
                                        `best${capitalize(combatMetric)}`
                                    ];
                                const bestOverall =
                                    currentBoss[difficulty][
                                        `best${capitalize(combatMetric)}NoCat`
                                    ];

                                let bestOfClass = {};
                                let bestOfCharacter = {
                                    [combatMetric]: false
                                };

                                for (const specId of characterSpecs) {
                                    let bestOfSpec = {};
                                    let characterSpecData = {
                                        [combatMetric]: false
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
                                                createCharacterId(
                                                    characterName,
                                                    realm,
                                                    specId
                                                )
                                        ) || {};
                                    if (
                                        bestOfCharacter[combatMetric] <
                                        charData[combatMetric]
                                    ) {
                                        bestOfCharacter = charData;
                                    }

                                    characterSpecData = {
                                        ...charData,
                                        topPercent: calcTopPercentOfPerformance(
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

                                    characterTotal = addToTotalPerformance(
                                        characterTotal,
                                        [specId, combatMetric],
                                        characterSpecData[combatMetric]
                                    );

                                    bestTotal = addToTotalPerformance(
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
                                        topPercent: calcTopPercentOfPerformance(
                                            bestOfCharacter[combatMetric],
                                            bestOfClass[combatMetric]
                                        )
                                    }
                                );

                                bestTotal = addToTotalPerformance(
                                    bestTotal,
                                    ["class", combatMetric],
                                    bestOfClass[combatMetric]
                                );

                                characterTotal = addToTotalPerformance(
                                    characterTotal,
                                    ["class", combatMetric],
                                    bestOfCharacter[combatMetric]
                                );

                                characterPerformance = addNestedObjectValue(
                                    characterPerformance,
                                    [...categorization, "noSpec", combatMetric],
                                    {
                                        ...bestOfCharacter,
                                        topPercent: calcTopPercentOfPerformance(
                                            bestOfCharacter[combatMetric],
                                            bestOverall[combatMetric]
                                        )
                                    }
                                );
                                bestTotal = addToTotalPerformance(
                                    bestTotal,
                                    ["noSpec", combatMetric],
                                    bestOverall[combatMetric]
                                );

                                characterTotal = addToTotalPerformance(
                                    characterTotal,
                                    ["noSpec", combatMetric],
                                    bestOfCharacter[combatMetric]
                                );
                            }
                        }

                        for (const specId in characterTotal) {
                            for (const combatMetric in characterTotal[specId]) {
                                const categorization = [specId, combatMetric];
                                const bestCombatMetricOfTotal = getNestedObjectValue(
                                    bestTotal,
                                    categorization
                                );
                                const characterCombatMetricOfTotal = getNestedObjectValue(
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
                                        topPercent: calcTopPercentOfPerformance(
                                            characterCombatMetricOfTotal,
                                            bestCombatMetricOfTotal
                                        )
                                    }
                                );
                            }
                        }
                    }
                    try {
                        cache.character.set(cacheId, characterPerformance);
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

    async getLastUpdated() {
        return new Promise(async (resolve, reject) => {
            try {
                let maintenanceCollection = await this.db
                    .collection("maintenance")
                    .findOne();

                let lastUpdated = maintenanceCollection
                    ? maintenanceCollection.lastUpdated
                    : null;
                resolve(lastUpdated);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getLastGuildsUpdate() {
        return new Promise(async (resolve, reject) => {
            try {
                let maintenanceCollection = await this.db
                    .collection("maintenance")
                    .findOne();

                let lastGuildsUpdate = maintenanceCollection
                    ? maintenanceCollection.lastGuildsUpdate || 0
                    : 0;

                resolve(lastGuildsUpdate);
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = new Database();
