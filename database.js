const {
    raidName,
    lastBoss,
    raids
} = require("tauriprogress-constants/currentContent.json");
const { realms, specs } = require("tauriprogress-constants");
const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbAddress = process.env.MONGODB_ADDRESS;
const mongoUrl = `mongodb://${dbUser}:${dbPassword}@${dbAddress}`;
const MongoClient = require("mongodb").MongoClient;
const {
    getRaidBossLogs,
    processRaidBossLogs,
    mergeBossKillsOfGuildIntoGuildData,
    createGuildData,
    updateRaidBoss,
    applyPlayerPerformanceRanks,
    whenWas,
    calcGuildContentCompletition,
    createMemberId,
    escapeRegex,
    getBossId,
    addNestedObjectValue,
    getNestedObjectValue,
    getBestPerformance,
    calcTopPercentOfPerformance
} = require("./helpers");

class Database {
    constructor() {
        this.db = {};
        this.isUpdating = false;
        this.updateStatus = "";
    }

    async connect() {
        try {
            console.log("Connecting to database");
            let client = await MongoClient.connect(mongoUrl, {
                useNewUrlParser: true
            });
            this.db = client.db("tauriprogress");
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
                this.isUpdating = true;
                console.log("Initalizing database");
                const updateStarted = new Date().getTime() / 1000;

                console.log("db: Creating maintence collection");
                let maintence = await this.db.collection("maintence");
                if (await maintence.findOne()) await maintence.deleteMany({});

                console.log("db: Creating stats collection");
                let stats = await this.db.collection("stats");
                if (await stats.findOne()) await stats.deleteMany({});
                stats.insertOne({});

                console.log("db: Creating raids");
                let raidCollection;
                let guilds = {};
                for (let raid of raids) {
                    console.log(`db: Creating ${raid.raidName} collection`);
                    raidCollection = await this.db.collection(raid.raidName);
                    if (await raidCollection.findOne())
                        await raidCollection.deleteMany({});

                    let raidData = require(`tauriprogress-constants/${
                        raid.raidName
                    }`);

                    for (let boss of raidData.encounters) {
                        for (let diff in raid.difficulties) {
                            console.log(
                                "db: Processing " +
                                    boss.encounter_name +
                                    " diff: " +
                                    diff
                            );
                            let logs = await getRaidBossLogs(
                                boss.encounter_id,
                                diff,
                                0
                            );

                            let processedLogs = processRaidBossLogs(
                                logs,
                                boss.encounter_name
                            );

                            await this.saveRaidBoss({
                                raidName: raid.raidName,
                                raidBoss: processedLogs.raidBoss
                            });

                            for (let key in processedLogs.guildBossKills) {
                                if (!guilds[key]) {
                                    let guild = await createGuildData(
                                        processedLogs.guildBossKills[key].realm,
                                        processedLogs.guildBossKills[key]
                                            .guildName
                                    );

                                    guilds[
                                        key
                                    ] = mergeBossKillsOfGuildIntoGuildData(
                                        guild,
                                        processedLogs.guildBossKills[key],
                                        diff
                                    );
                                } else {
                                    guilds[
                                        key
                                    ] = mergeBossKillsOfGuildIntoGuildData(
                                        guilds[key],
                                        processedLogs.guildBossKills[key],
                                        diff
                                    );
                                }
                            }
                        }
                    }
                }
                console.log("db: pushing guilds in");
                let guildsCollection = await this.db.collection("guilds");
                if (await guildsCollection.findOne())
                    await guildsCollection.deleteMany({});

                for (let key in guilds) {
                    await this.saveGuild(
                        calcGuildContentCompletition(guilds[key])
                    );
                }

                maintence.insertOne({
                    lastUpdated: updateStarted,
                    initalized: true
                });
                this.isUpdating = false;
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
                resolve(maintence.initalized);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getLastLogDateOfBoss(raidName, bossName, diff) {
        return new Promise(async (resolve, reject) => {
            try {
                let lastLogDate = 0;
                let raidCollection = this.db.collection(raidName);

                let raidBoss = await raidCollection.findOne({
                    bossName: new RegExp(
                        "^" + escapeRegex(bossName) + "$",
                        "i"
                    ),
                    difficulty: new RegExp("^" + escapeRegex(diff) + "$", "i")
                });

                if (raidBoss) lastLogDate = raidBoss.lastLogDate;

                resolve(lastLogDate);
            } catch (err) {
                reject(err);
            }
        });
    }

    async updateDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.isUpdating)
                    throw new Error("Database is already updating");
                this.isUpdating = true;
                this.updateStatus = "Database is already updating";

                let updateStarted = new Date().getTime() / 1000;
                let maintence = await this.db.collection("maintence");

                for (let raid of raids) {
                    let raidData = require(`tauriprogress-constants/${
                        raid.raidName
                    }`);

                    for (let boss of raidData.encounters) {
                        console.log("db: Updating " + boss.encounter_name);
                        this.updateStatus = `Updating ${boss.encounter_name}`;

                        let result = await this.updateRaidBoss(
                            raid.raidName,
                            boss.encounter_name
                        );

                        if (!result.done) {
                            throw new Error(result);
                        }
                    }
                }

                if (whenWas(await this.lastUpdated()) > 180)
                    await this.updateGuilds();

                await maintence.updateOne(
                    {},
                    {
                        $set: {
                            lastUpdated: updateStarted
                        }
                    }
                );

                this.isUpdating = false;
                this.updateStatus = "";

                resolve(whenWas(updateStarted));
            } catch (err) {
                if (err.message !== "Database is already updating") {
                    this.isUpdating = false;
                    this.updateStatus = "";
                }
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
                            ["progression.currentBossesDefeated"]: 1,
                            ["progression.completed"]: 1,
                            ["progression." +
                            raidName +
                            "." +
                            lastBoss +
                            ".firstKill"]: 1
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

                if (!guild) throw new Error("Guild not found");

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
                    for (let realm in boss.firstKills) {
                        for (let faction in boss.firstKills[realm]) {
                            let objectKeys = [realm, faction];
                            boss.firstKills = addNestedObjectValue(
                                boss.firstKills,
                                objectKeys,
                                getNestedObjectValue(
                                    boss.firstKills,
                                    objectKeys
                                ).slice(0, 1)
                            );
                        }
                    }

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
        playerClass,
        playerSpecs,
        realm,
        raidName
    }) {
        return new Promise(async (resolve, reject) => {
            try {
                const raid = require(`tauriprogress-constants/${raidName}`);
                let playerPerformance = {};

                let raidCollection = await this.db.collection(raidName);

                for (let boss of raid.encounters) {
                    for (let diff of raid.difficulties) {
                        let time1 = new Date().getTime();
                        let bestPerformances = (await raidCollection
                            .find({
                                bossName: new RegExp(
                                    "^" +
                                        escapeRegex(boss.encounter_name) +
                                        "$",
                                    "i"
                                ),
                                difficulty: new RegExp(
                                    "^" + escapeRegex(diff) + "$",
                                    "i"
                                )
                            })
                            .project({
                                bestDps: 1,
                                bestHps: 1
                            })
                            .toArray())[0];

                        for (let specId of playerSpecs) {
                            const playerId = createMemberId(
                                realm,
                                playerName,
                                specId
                            );
                            let projection = {};
                            let bestDpsOfSpec = null;
                            let bestHpsOfSpec = null;

                            if (specs[specId].isDps) {
                                bestDpsOfSpec = getBestPerformance(
                                    bestPerformances.bestDps,
                                    "dps",
                                    specId
                                );
                                projection[`dps.${playerId}`] = 1;
                            }

                            if (specs[specId].isHealer) {
                                bestHpsOfSpec = getBestPerformance(
                                    bestPerformances.bestHps,
                                    "hps",
                                    specId
                                );

                                projection[`hps.${playerId}`] = 1;
                            }

                            let playerData = (await raidCollection
                                .find({
                                    bossName: new RegExp(
                                        "^" +
                                            escapeRegex(boss.encounter_name) +
                                            "$",
                                        "i"
                                    ),
                                    difficulty: new RegExp(
                                        "^" + escapeRegex(diff) + "$",
                                        "i"
                                    )
                                })
                                .project(projection)
                                .toArray())[0];
                            let objectKeys = [
                                raidName,
                                diff,
                                boss.encounter_name,
                                specId
                            ];

                            if (playerData.dps[playerId]) {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, "dps"],
                                    {
                                        ...playerData.dps[playerId],
                                        specTopPercentage: calcTopPercentOfPerformance(
                                            playerData.dps[playerId].dps,
                                            bestDpsOfSpec
                                        )
                                    }
                                );
                            } else {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, "dps"],
                                    { dps: false }
                                );
                            }

                            if (playerData.hps[playerId]) {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, "hps"],
                                    {
                                        ...playerData.hps[playerId],
                                        specTopPercentage: calcTopPercentOfPerformance(
                                            playerData.hps[playerId].hps,
                                            bestHpsOfSpec
                                        )
                                    }
                                );
                            } else {
                                playerPerformance = addNestedObjectValue(
                                    playerPerformance,
                                    [...objectKeys, "hps"],
                                    { hps: false }
                                );
                            }
                        }
                        let time2 = new Date().getTime();

                        console.log(time2 - time1);
                    }
                }

                resolve(playerPerformance);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(guild) {
        return new Promise(async (resolve, reject) => {
            try {
                let oldGuild = await this.db.collection("guilds").findOne({
                    guildName: new RegExp(
                        "^" + escapeRegex(guild.guildName) + "$",
                        "i"
                    ),
                    realm: guild.realm
                });

                if (!oldGuild) {
                    await this.db.collection("guilds").insertOne(guild);
                } else {
                    await this.db.collection("guilds").updateOne(
                        {
                            guildName: new RegExp(
                                "^" + escapeRegex(guild.guildName) + "$",
                                "i"
                            ),
                            realm: guild.realm
                        },
                        { $set: { ...guild, _id: oldGuild["_id"] } }
                    );
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
                    difficulty: new RegExp(
                        "^" + escapeRegex(raidBoss.difficulty) + "$",
                        "i"
                    )
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

    async lastUpdated() {
        return new Promise(async (resolve, reject) => {
            try {
                let maintence = await this.db.collection("maintence");
                let lastUpdated = (await maintence.findOne()).lastUpdated;
                resolve(lastUpdated);
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

                for (let guild of guilds) {
                    try {
                        let newGuild = await createGuildData(
                            guild.realm,
                            guild.guildName
                        );

                        if (newGuild) {
                            newGuild = {
                                ...newGuild,
                                progression: {
                                    ...guild.progression,
                                    latestKills:
                                        newGuild.progression.latestKills
                                }
                            };
                            await this.saveGuild(newGuild);
                        }
                    } catch (err) {
                        console.log(`Error with updating ${guild.guildName}:`);
                        console.error(err);
                    }
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

    async updateOneRaidBoss(raidName, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.isUpdating)
                    throw new Error("Database is already updating");
                this.isUpdating = true;
                this.updateStatus = `Updating ${bossName}`;

                const result = await this.updateRaidBoss(raidName, bossName);

                if (result.done) {
                    this.isUpdating = false;
                    this.updateStatus = "";
                    resolve(result);
                } else {
                    throw new Error(result);
                }
            } catch (err) {
                if (err.message !== "Database is already updating") {
                    this.isUpdating = false;
                    this.updateStatus = "";
                }

                reject(err);
            }
        });
    }

    async updateRaidBoss(raidName, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                let raidData = require(`tauriprogress-constants/${raidName}`);

                for (let diff of raidData.difficulties) {
                    diff = String(diff);
                    let lastLogDate = await this.getLastLogDateOfBoss(
                        raidName,
                        bossName,
                        diff
                    );

                    let logs = await getRaidBossLogs(
                        getBossId(raidData, bossName, diff),
                        diff,
                        lastLogDate
                    );

                    let processedLogs = processRaidBossLogs(logs, bossName);

                    await this.saveRaidBoss({
                        raidName: raidName,
                        raidBoss: processedLogs.raidBoss
                    });

                    for (let key in processedLogs.guildBossKills) {
                        let guild;
                        try {
                            guild = await this.getGuild(
                                processedLogs.guildBossKills[key].realm,
                                processedLogs.guildBossKills[key].guildName
                            );
                        } catch (err) {
                            if (err.message === "Guild not found") {
                                guild = await createGuildData(
                                    processedLogs.guildBossKills[key].realm,
                                    processedLogs.guildBossKills[key].guildName
                                );
                            }
                        }
                        if (guild)
                            await this.saveGuild(
                                calcGuildContentCompletition(
                                    mergeBossKillsOfGuildIntoGuildData(
                                        guild,
                                        processedLogs.guildBossKills[key],
                                        diff
                                    )
                                )
                            );
                    }
                }

                resolve({
                    done: true
                });
            } catch (err) {
                if (err.message !== "Database is already updating") {
                    this.isUpdating = false;
                    this.updateStatus = "";
                }

                reject(err);
            }
        });
    }

    async lastUpdateOfBoss(raidName, bossName) {
        return new Promise(async (resolve, reject) => {
            try {
                let raid = await this.db.collection(raidName);
                let bosses = await raid
                    .find({
                        bossName: new RegExp(
                            "^" + escapeRegex(bossName) + "$",
                            "i"
                        )
                    })
                    .toArray();

                let lastUpdated = bosses.reduce((acc, boss) => {
                    if (boss.lastUpdated > acc) acc = boss.lastUpdated;
                    return acc;
                }, 0);

                resolve(lastUpdated);
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = new Database();
