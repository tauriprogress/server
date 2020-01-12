const {
    raidName,
    lastBoss,
    raids
} = require("tauriprogress-constants/currentContent.json");
const classToSpec = require("tauriprogress-constants/classToSpec.json");
const fs = require("fs");
const { specs, tauriLogBugs } = require("tauriprogress-constants");
const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbAddress = process.env.MONGODB_ADDRESS;
const mongoUrl = `mongodb://${dbUser}:${dbPassword}@${dbAddress}`;
const MongoClient = require("mongodb").MongoClient;
const {
    getLogs,
    processLogs,
    updateGuildData,
    requestGuildData,
    updateRaidBoss,
    applyPlayerPerformanceRanks,
    minutesAgo,
    calcGuildContentCompletion,
    createCharacterId,
    escapeRegex,
    addNestedObjectValue,
    getNestedObjectValue,
    getBestPerformance,
    calcTopPercentOfPerformance,
    capitalize,
    logBugHandler
} = require("./helpers");

class Database {
    constructor() {
        this.db = {};
        this.lastUpdated = null;
        this.isUpdating = false;
        this.updateStatus = "";
    }

    async connect() {
        try {
            console.log("Connecting to database");
            let client = await MongoClient.connect(mongoUrl, {
                useNewUrlParser: true,
                autoReconnect: true,
                reconnectTries: Number.MAX_SAFE_INTEGER,
                reconnectInterval: 2000
            });

            this.db = client.db("tauriprogress");
            this.lastUpdated = await this.getLastUpdated();
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
                console.log("db: Creating maintence collection");
                let maintence = await this.db.collection("maintence");
                if (await maintence.findOne()) await maintence.deleteMany({});
                maintence.insertOne({});

                console.log("db: Creating stats collection");
                let stats = await this.db.collection("stats");
                if (await stats.findOne()) await stats.deleteMany({});
                stats.insertOne({});

                for (let raid of raids) {
                    let raidName = raid.raidName;
                    console.log(`db: Creating ${raidName} collection`);
                    let raidCollection = await this.db.collection(raidName);
                    if (await raidCollection.findOne())
                        await raidCollection.deleteMany({});
                }

                console.log("db: Creating guilds collection");
                let guildsCollection = await this.db.collection("guilds");
                if (await guildsCollection.findOne())
                    await guildsCollection.deleteMany({});

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
                let maintence = await this.db.collection("maintence").findOne();
                if (!maintence) resolve(false);
                resolve(maintence.isInitalized);
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
                const maintence = await this.db.collection("maintence");

                const lastLogIds = isInitalization
                    ? {}
                    : (await maintence.findOne()).lastLogIds;

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
                        "db: Saving logs in case something goes wrong in the initalization process as logData.json in this directory."
                    );
                    fs.writeFileSync(
                        "logData.json",
                        JSON.stringify({ logs, lastLogIds: newLastLogIds })
                    );

                    logs = logs.reduce((acc, log) => {
                        for (let bug of tauriLogBugs) {
                            log = logBugHandler(log, bug);
                        }

                        if (log) {
                            acc.push(log);
                        }

                        return acc;
                    }, []);
                }
                console.log("db: Processing logs");
                let { bossData, guildData } = processLogs(logs);

                console.log("db: Saving raid bosses");
                for (let raidName in bossData) {
                    for (let bossId in bossData[raidName]) {
                        const { bossName, difficulty } = bossData[raidName][
                            bossId
                        ];
                        console.log(
                            `db: Saving ${bossName} difficulty: ${difficulty}`
                        );

                        await this.saveRaidBoss({
                            raidName,
                            raidBoss: bossData[raidName][bossId]
                        });
                    }
                }

                console.log("db: Saving guilds");
                for (let guildId in guildData) {
                    console.log(`db: Saving: ${guildId}`);
                    await this.saveGuild(guildData[guildId]);
                }

                await maintence.updateOne(
                    {},
                    {
                        $set: {
                            lastUpdated: updateStarted,
                            lastLogIds: newLastLogIds,
                            isInitalized: true
                        }
                    }
                );

                if (!isInitalization && minutesAgo(this.lastUpdated) > 720)
                    await this.updateGuilds();

                this.isUpdating = false;
                this.updateStatus = "";
                this.lastUpdated = updateStarted;

                console.log("db: Database update finished");
                resolve(minutesAgo(updateStarted));
            } catch (err) {
                console.error(`Database update error: ${err.message}`);
                if (err.message !== "Database is already updating") {
                    this.isUpdating = false;
                    this.updateStatus = "";
                }
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
                            `db: Updating ${guild.guildName} ${current}/${total}`
                        );
                        let newGuild = await requestGuildData(
                            guild.guildName,
                            guild.realm
                        );

                        if (newGuild) {
                            await this.saveGuild(newGuild);
                        }
                    } catch (err) {
                        if (err.message === "guild not found") {
                            this.removeGuild(guild);
                        } else {
                            console.log(
                                `Error with updating ${guild.guildName}:`
                            );
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

    async saveRaidBoss({ raidName, raidBoss }) {
        return new Promise(async (resolve, reject) => {
            try {
                if (!raidName)
                    throw new Error(
                        "Need to specify which raid the boss belongs to."
                    );
                let raidCollection = this.db.collection(raidName);
                let oldRaidBoss = await raidCollection.findOne({
                    bossName: new RegExp(
                        "^" + escapeRegex(raidBoss.bossName) + "$",
                        "i"
                    ),
                    difficulty: Number(raidBoss.difficulty)
                });

                if (!oldRaidBoss) {
                    raidCollection.insertOne(
                        applyPlayerPerformanceRanks(raidBoss)
                    );
                } else {
                    await raidCollection.updateOne(
                        {
                            bossName: new RegExp(
                                "^" + escapeRegex(raidBoss.bossName) + "$",
                                "i"
                            ),
                            difficulty: raidBoss.difficulty
                        },
                        {
                            $set: {
                                ...applyPlayerPerformanceRanks(
                                    updateRaidBoss(oldRaidBoss, raidBoss)
                                ),
                                _id: oldRaidBoss["_id"]
                            }
                        }
                    );
                }

                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(newGuild) {
        return new Promise(async (resolve, reject) => {
            try {
                let oldGuild = await this.db.collection("guilds").findOne({
                    guildName: new RegExp(
                        "^" + escapeRegex(newGuild.guildName) + "$",
                        "i"
                    ),
                    realm: newGuild.realm
                });

                if (!oldGuild) {
                    try {
                        let guildData = await requestGuildData(
                            newGuild.guildName,
                            newGuild.realm
                        );
                        await this.db.collection("guilds").insertOne(
                            calcGuildContentCompletion({
                                ...guildData,
                                ...newGuild
                            })
                        );
                    } catch (err) {
                        console.error(
                            `Error while tring to save guild ${newGuild.guildName} ${newGuild.realm},
                            this error may safely be ignored.
                            \n ${err.message}`
                        );
                    }
                } else {
                    await this.db.collection("guilds").updateOne(
                        {
                            guildName: new RegExp(
                                "^" + escapeRegex(newGuild.guildName) + "$",
                                "i"
                            ),
                            realm: newGuild.realm
                        },
                        {
                            $set: {
                                ...calcGuildContentCompletion(
                                    updateGuildData(oldGuild, newGuild)
                                ),
                                _id: oldGuild["_id"]
                            }
                        }
                    );
                }
                resolve("Done");
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveReqStats(url, ip, date) {
        return new Promise(async (resolve, reject) => {
            try {
                let stats = await this.db.collection("stats");
                const today = `${date.getFullYear()}:${date.getMonth() +
                    1}:${date.getDate()}`;
                const time = date.toLocaleString();
                const replaceReg = /\./gi;

                await stats.updateOne(
                    {},
                    {
                        $set: {
                            [`${today}.${ip.replace(
                                replaceReg,
                                "-"
                            )}.${time}`]: url
                        }
                    }
                );
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
                    guildName: new RegExp(
                        "^" + escapeRegex(guild.guildName) + "$",
                        "i"
                    ),
                    realm: guild.realm
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
                resolve(
                    this.db
                        .collection("guilds")
                        .find()
                        .toArray()
                );
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
                            guildName: 1,
                            gFaction: 1,
                            realm: 1,
                            ["progression.completion"]: 1
                        })
                        .toArray()
                );
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuild(realm, guildName) {
        return new Promise(async (resolve, reject) => {
            try {
                let guild = await this.db.collection("guilds").findOne({
                    guildName: new RegExp(
                        "^" + escapeRegex(guildName) + "$",
                        "i"
                    ),
                    realm: realm
                });

                if (!guild) throw new Error("guild not found");

                resolve(guild);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaid(raidName) {
        return new Promise(async (resolve, reject) => {
            try {
                let raidData = {};
                let bosses = await this.db
                    .collection(raidName)
                    .find()
                    .project({
                        ["dps"]: 0,
                        ["hps"]: 0,
                        ["latestKills"]: 0
                    })
                    .toArray();

                for (let boss of bosses) {
                    for (let realm in boss.fastestKills) {
                        for (let faction in boss.fastestKills[realm]) {
                            let objectKeys = [realm, faction];
                            boss.fastestKills = addNestedObjectValue(
                                boss.fastestKills,
                                objectKeys,
                                getNestedObjectValue(
                                    boss.fastestKills,
                                    objectKeys
                                ).slice(0, 1)
                            );
                        }
                    }

                    if (!raidData[boss.difficulty])
                        raidData[boss.difficulty] = {};

                    raidData[boss.difficulty][boss.bossName] = boss;
                }

                resolve(raidData);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidBoss(raidName, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                let raidCollection = this.db.collection(raidName);
                let raidBoss = await raidCollection
                    .find({
                        bossName: new RegExp(
                            "^" + escapeRegex(bossName) + "$",
                            "i"
                        )
                    })
                    .project({
                        ["bestDps"]: 0,
                        ["bestHps"]: 0
                    })
                    .toArray();
                if (!raidBoss) throw new Error("Boss not found");

                let raidBosses = {};

                for (let boss of raidBoss) {
                    raidBosses[boss.difficulty] = boss;
                    let fastestKills = [];
                    for (let realm in boss.fastestKills) {
                        for (let faction in boss.fastestKills[realm]) {
                            let objectKeys = [realm, faction];
                            fastestKills = fastestKills.concat(
                                getNestedObjectValue(
                                    boss.fastestKills,
                                    objectKeys
                                )
                            );
                        }
                    }

                    boss.fastestKills = fastestKills
                        .sort((a, b) => a.fight_time - b.fight_time)
                        .slice(0, 50);
                }

                resolve(raidBosses);
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
                let maintence = await this.db.collection("maintence").findOne();

                let lastUpdated = maintence ? maintence.lastUpdated : null;
                resolve(lastUpdated);
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = new Database();
