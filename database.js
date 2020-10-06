const fs = require("fs");
const { currentContent, logBugs } = require("./expansionData");
const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbAddress = process.env.MONGODB_ADDRESS;
const mongoUri = `mongodb+srv://${dbUser}:${dbPassword}@${dbAddress}`;
const MongoClient = require("mongodb").MongoClient;

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
    getBestPerformance,
    calcTopPercentOfPerformance,
    capitalize,
    recentGuildRaidDays,
    logBugHandler,
    processLogs,
    getBossCollectionName,
    getLastLogIds,
    raidInfoFromBossId,
    getBossInfo,
    getRaidInfo
} = require("./helpers");

class Database {
    constructor() {
        this.db = {};
        this.client = undefined;
        this.lastUpdated = null;
        this.isUpdating = false;
        this.updateStatus = "";
        this.lastGuildsUpdate = 0;
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
                console.log("db: Updating database");
                if (this.isUpdating)
                    throw new Error("Database is already updating");
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
                let { logs, lastLogIds: newLastLogIds } = getLogs(lastLogIds);

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
                    console.log("db: Opening new transaction session");
                    newLastLogIds = {};
                    const loopSteps = 20;
                    for (let i = 0; i < Math.ceil(logs.length); i++) {
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
                            throw err;
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
                    session
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

    async updateGuilds() {
        return new Promise(async (resolve, reject) => {
            try {
                this.updateStatus = "Updating guilds";

                let guilds = await this.db
                    .collection("guilds")
                    .find({})
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
                                        ...guildData,
                                        ...newGuild
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
                    try {
                        await bossCollection.insertOne(char, { session });
                    } catch (err) {
                        console.error(
                            `Error while tring to save ${char._id} \n ${err.message}`
                        );
                    }
                } else {
                    if (oldChar[combatMetric < char[combatMetric]]) {
                        await bossCollection.updateOne(
                            {
                                _id: char._id
                            },
                            {
                                $set: {
                                    char
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
                resolve(
                    await this.db
                        .collection("guilds")
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            activity: 1,
                            ["progression.completion"]: 1
                        })
                        .toArray()
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuild(id) {
        return new Promise(async (resolve, reject) => {
            try {
                let guild = await this.db.collection("guilds").findOne({
                    _id: id
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
                const difficulties = getRaidInfo(id).difficulties;

                const projection = difficulties.reduce((acc, difficulty) => {
                    return { ...acc, [`${difficulty}.recentKills`]: 0 };
                }, {});

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
                                ] = boss.fastestKills[realmName][faction].slice(
                                    0,
                                    10
                                );
                            }
                        }

                        raidSummary[boss._id] = boss;
                    }
                }

                resolve(raidSummary);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBoss(raidId, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                const difficulties = getRaidInfo(raidId).difficulties;

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

    async getPlayerPerformance({
        playerName,
        characterClass,
        realm,
        raidName
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                const {
                    totalBosses
                } = require(`tauriprogress-constants/${raidName}`);
                let playerSpecs = classToSpec[characterClass];

                let playerPerformance = {};

                let totalBestPerformance = {};
                let totalPlayerPerformance = {};

                let raidCollection = await this.db.collection(raidName);

                let projection = {
                    bossName: 1,
                    difficulty: 1,
                    bestDps: 1,
                    bestHps: 1
                };

                for (let specId of playerSpecs) {
                    const characterId = createCharacterId(
                        realm,
                        playerName,
                        specId
                    );

                    if (specs[specId].isDps) {
                        projection[`dps.${characterId}`] = 1;
                    }

                    if (specs[specId].isHealer) {
                        projection[`hps.${characterId}`] = 1;
                    }
                }

                let bosses = await raidCollection
                    .find()
                    .project(projection)
                    .toArray();

                for (let boss of bosses) {
                    let objectKeys = [raidName, boss.difficulty, boss.bossName];

                    let noSpecData = {
                        dps: { dps: false },
                        hps: { hps: false }
                    };

                    for (let specId of playerSpecs) {
                        let characterId = createCharacterId(
                            realm,
                            playerName,
                            specId
                        );

                        for (let variant of ["dps", "hps"]) {
                            let playerData = boss[variant]
                                ? boss[variant][characterId]
                                : null;

                            if (playerData) {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, specId, variant],
                                    {
                                        ...playerData,
                                        topPercent: calcTopPercentOfPerformance(
                                            playerData[variant],
                                            getBestPerformance(
                                                boss[
                                                    `best${capitalize(variant)}`
                                                ],
                                                variant,
                                                { spec: specId }
                                            )
                                        ),
                                        rank: playerData.specRank
                                    }
                                );

                                totalPlayerPerformance = addNestedObjectValue(
                                    totalPlayerPerformance,
                                    [boss.difficulty, variant, specId],
                                    getNestedObjectValue(
                                        totalPlayerPerformance,
                                        [boss.difficulty, variant, specId]
                                    ) + playerData[variant]
                                );

                                if (
                                    noSpecData[variant][variant] <
                                    playerData[variant]
                                ) {
                                    noSpecData[variant] = playerData;
                                }
                            } else {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, specId, [variant]],
                                    { [variant]: false }
                                );
                            }

                            totalBestPerformance = addNestedObjectValue(
                                totalBestPerformance,
                                [boss.difficulty, variant, specId],
                                getNestedObjectValue(totalBestPerformance, [
                                    boss.difficulty,
                                    variant,
                                    specId
                                ]) +
                                    getBestPerformance(
                                        boss[`best${capitalize(variant)}`],
                                        variant,
                                        { spec: specId }
                                    )
                            );
                        }
                    }

                    for (let specVariant of ["noSpec", "class"]) {
                        for (let variant of ["dps", "hps"]) {
                            playerPerformance = addNestedObjectValue(
                                playerPerformance,
                                [...objectKeys, specVariant, variant],
                                {
                                    ...noSpecData[variant],
                                    rank:
                                        specVariant === "class"
                                            ? noSpecData[variant].classRank
                                            : noSpecData[variant].rank,
                                    topPercent:
                                        noSpecData[variant][variant] &&
                                        calcTopPercentOfPerformance(
                                            noSpecData[variant][variant],
                                            getBestPerformance(
                                                boss[
                                                    `best${capitalize(variant)}`
                                                ],
                                                variant,
                                                specVariant === "class"
                                                    ? {
                                                          characterClass: characterClass
                                                      }
                                                    : {}
                                            )
                                        )
                                }
                            );

                            totalPlayerPerformance = addNestedObjectValue(
                                totalPlayerPerformance,
                                [boss.difficulty, variant, specVariant],
                                getNestedObjectValue(totalPlayerPerformance, [
                                    boss.difficulty,
                                    variant,
                                    specVariant
                                ]) +
                                    (noSpecData[variant][variant]
                                        ? noSpecData[variant][variant]
                                        : 0)
                            );

                            totalBestPerformance = addNestedObjectValue(
                                totalBestPerformance,
                                [boss.difficulty, variant, specVariant],
                                getNestedObjectValue(totalBestPerformance, [
                                    boss.difficulty,
                                    variant,
                                    specVariant
                                ]) +
                                    getBestPerformance(
                                        boss[`best${capitalize(variant)}`],
                                        variant,
                                        specVariant === "class"
                                            ? { characterClass: characterClass }
                                            : {}
                                    )
                            );
                        }
                    }
                }

                for (let difficulty in playerPerformance[raidName]) {
                    difficulty = Number(difficulty);
                    for (let variant of ["dps", "hps"]) {
                        for (let specId in totalPlayerPerformance[difficulty][
                            variant
                        ]) {
                            let playerTotal = getNestedObjectValue(
                                totalPlayerPerformance,
                                [difficulty, variant, specId]
                            );
                            let bestTotal = getNestedObjectValue(
                                totalBestPerformance,
                                [difficulty, variant, specId]
                            );

                            playerPerformance = addNestedObjectValue(
                                playerPerformance,
                                [
                                    raidName,
                                    difficulty,
                                    "total",
                                    specId,
                                    variant
                                ],
                                {
                                    [variant]: playerTotal / totalBosses,
                                    topPercent: calcTopPercentOfPerformance(
                                        playerTotal,
                                        bestTotal
                                    )
                                }
                            );
                        }
                    }
                }

                resolve(playerPerformance);
            } catch (err) {
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
