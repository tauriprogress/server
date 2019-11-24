require("dotenv").config();

const { currentContent, tauriLogBugs } = require("tauriprogress-constants");
const {
    getNestedObjectValue,
    addNestedObjectValue,
    capitalize,
    applyPlayerPerformanceRanks,
    escapeRegex
} = require("./helpers");
const tauriApi = require("./tauriApi");

const fs = require("fs");

const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbAddress = process.env.MONGODB_ADDRESS;
const mongoUrl = `mongodb://${dbUser}:${dbPassword}@${dbAddress}`;
const MongoClient = require("mongodb").MongoClient;

(async function() {
    try {
        const client = await MongoClient.connect(mongoUrl, {
            useNewUrlParser: true,
            autoReconnect: true,
            reconnectTries: Number.MAX_SAFE_INTEGER,
            reconnectInterval: 2000
        });

        const db = client.db("tauriprogress");
        const guildCollection = await db.collection("guilds");
        const guilds = await guildCollection.find().toArray();

        let modifiedGuilds = {};

        let bossBugs = [];
        let specBugs = [];

        for (let bug of tauriLogBugs) {
            switch (bug.type) {
                case "boss":
                    bossBugs.push(bug);
                    break;
                case "spec":
                    specBugs.push(bug);
                    break;
                default:
            }
        }
        console.log("going over boss bugs");
        for (let bossBug of bossBugs) {
            console.log("fixing", bossBug.boss);
            let raidName = false;
            let bossName = false;
            for (let raid of currentContent.raids) {
                if (!raidName) {
                    const raidData = require(`tauriprogress-constants/${raid.raidName}`);

                    for (let boss of raidData.encounters) {
                        if (boss.encounter_id === bossBug.boss) {
                            raidName = raidData.name;
                            bossName = boss.encounter_name;
                            break;
                        }
                    }
                }
            }

            if (raidName || bossName) {
                let collection = await db.collection(raidName);

                for (let guild of guilds) {
                    for (let difficulty in guild.progression[raidName]) {
                        let buggedDifficulty = false;
                        for (let variant of ["dps", "hps"]) {
                            if (
                                guild.progression[raidName][difficulty][
                                    bossName
                                ]
                            ) {
                                for (let charId in guild.progression[raidName][
                                    difficulty
                                ][bossName][variant]) {
                                    let killDate =
                                        guild.progression[raidName][difficulty][
                                            bossName
                                        ][variant][charId].date;
                                    if (
                                        killDate > bossBug.date.from &&
                                        killDate < bossBug.date.to
                                    ) {
                                        delete guild.progression[raidName][
                                            difficulty
                                        ][bossName][variant][charId];
                                        buggedDifficulty = true;
                                    }
                                }
                            }
                        }

                        if (buggedDifficulty) {
                            let data;

                            do {
                                try {
                                    data = await tauriApi.getRaidGuildRank(
                                        guild.realm,
                                        guild.guildName,
                                        bossBug.boss,
                                        difficulty
                                    );
                                } catch (err) {
                                    data = err.message;
                                }
                            } while (
                                !data.success &&
                                data === "request timed out"
                            );
                            if (!data.success)
                                throw new Error(data.errorstring);

                            let bossLogs = data.response.logs.filter(log => {
                                return (
                                    log.killtime > bossBug.date.from &&
                                    log.killtime < bossBug.date.to
                                );
                            });

                            if (bossLogs.length) {
                                guild.progression[raidName][difficulty][
                                    bossName
                                ] = {
                                    ...guild.progression[raidName][difficulty][
                                        bossName
                                    ],
                                    killCount: bossLogs.length,
                                    fastestKill: bossLogs[0].fight_time,
                                    fastestKills: bossLogs.slice(0, 10),
                                    firstKill: bossLogs.reduce((acc, curr) => {
                                        if (curr < acc) {
                                            acc = curr;
                                        }
                                        return acc;
                                    }, Number.MAX_SAFE_INTEGER)
                                };
                            } else {
                                delete guild.progression[raidName][difficulty][
                                    bossName
                                ];
                            }

                            modifiedGuilds[
                                guildId(guild.guildName, guild.realm)
                            ] = JSON.parse(JSON.stringify(guild));
                        }
                    }
                }

                let bosses = await collection
                    .find({ bossName: bossName })
                    .toArray();

                for (boss of bosses) {
                    bestPerformance = {
                        bestDps: {},
                        bestHps: {}
                    };

                    delete boss.bestDps;
                    delete boss.bestHps;

                    for (let variant of ["dps", "hps"]) {
                        for (let charId in boss[variant]) {
                            characterData = boss[variant][charId];

                            if (
                                characterData.date > bossBug.date.from &&
                                characterData.date < bossBug.date.to
                            ) {
                                delete boss[variant][charId];
                            } else {
                                const characterCategorization = [
                                    characterData.realm,
                                    characterData.faction,
                                    characterData.class,
                                    characterData.spec
                                ];

                                if (
                                    characterData[variant] >
                                    getNestedObjectValue(
                                        bestPerformance[
                                            `best${capitalize(variant)}`
                                        ],
                                        [...characterCategorization, variant]
                                    )
                                ) {
                                    bestPerformance[
                                        `best${capitalize(variant)}`
                                    ] = addNestedObjectValue(
                                        bestPerformance[
                                            `best${capitalize(variant)}`
                                        ],
                                        characterCategorization,
                                        characterData
                                    );
                                }
                            }
                        }
                    }

                    for (let realm in boss.fastestKills) {
                        for (let faction in boss.fastestKills[realm]) {
                            boss.fastestKills[realm][
                                faction
                            ] = boss.fastestKills[realm][faction].filter(
                                log => {
                                    if (
                                        log.killtime > bossBug.from &&
                                        log.killtime < bossBug.to
                                    ) {
                                        return true;
                                    }
                                    return false;
                                }
                            );
                        }
                    }

                    await collection.updateOne(
                        {
                            bossName: new RegExp(
                                "^" + escapeRegex(boss.bossName) + "$",
                                "i"
                            ),
                            difficulty: boss.difficulty
                        },
                        {
                            $set: {
                                _id: boss["_id"],
                                ...boss,
                                ...bestPerformance
                            }
                        }
                    );
                }
            } else {
                throw new Error(`Boss id ${bossBug.boss} not found.`);
            }
        }
        console.log("going over spec bugs");
        for (let raid of currentContent.raids) {
            const raidName = raid.raidName;
            const raidCollection = await db.collection(raidName);
            const raidBosses = await raidCollection.find().toArray();
            for (let specBug of specBugs) {
                console.log("fixing", specBug.specId, "in", raidName);
                for (let boss of raidBosses) {
                    let modified = false;
                    let bestPerformance = {};
                    let variants = ["dps", "hps"];

                    if (specBug.changeKey.key === "dmg_done") {
                        variants = ["dps"];
                    }

                    if (specBug.changeKey.key === "heal_done") {
                        variants = ["hps"];
                    }

                    for (let variant of variants) {
                        bestPerformance[`best${capitalize(variant)}`] = {};
                        for (let charId in boss[variant]) {
                            let characterData = boss[variant][charId];

                            if (
                                characterData.spec === specBug.specId &&
                                characterData.date > specBug.date.from &&
                                characterData.date < specBug.date.to
                            ) {
                                modified = true;

                                if (
                                    specBug.changeKey.key === "dmg_done" ||
                                    specBug.changeKey.key === "heal_done"
                                ) {
                                    characterData[variant] = 0.1;
                                } else {
                                    characterData[specBug.changeKey.key] =
                                        specBug.changeKey.value;
                                }

                                boss[variant][charId] = characterData;
                            }

                            const characterCategorization = [
                                characterData.realm,
                                characterData.faction,
                                characterData.class,
                                characterData.spec
                            ];

                            if (
                                characterData[variant] >
                                getNestedObjectValue(
                                    bestPerformance[
                                        `best${capitalize(variant)}`
                                    ],
                                    [...characterCategorization, variant]
                                )
                            ) {
                                bestPerformance[
                                    `best${capitalize(variant)}`
                                ] = addNestedObjectValue(
                                    bestPerformance[
                                        `best${capitalize(variant)}`
                                    ],
                                    characterCategorization,
                                    characterData
                                );
                            }
                        }
                    }

                    if (modified) {
                        await raidCollection.updateOne(
                            {
                                bossName: new RegExp(
                                    "^" + escapeRegex(boss.bossName) + "$",
                                    "i"
                                ),
                                difficulty: boss.difficulty
                            },
                            {
                                $set: {
                                    ...applyPlayerPerformanceRanks({
                                        ...boss,
                                        ...bestPerformance
                                    }),
                                    _id: boss["_id"]
                                }
                            }
                        );
                    }
                }

                for (let guild of guilds) {
                    if (modifiedGuilds[guildId(guild.guildName, guild.realm)]) {
                        guild = JSON.parse(
                            JSON.stringify(
                                modifiedGuilds[
                                    guildId(guild.guildName, guild.realm)
                                ]
                            )
                        );
                    }

                    let modified = false;
                    let variants = ["dps", "hps"];

                    if (specBug.changeKey.key === "dmg_done") {
                        variants = ["dps"];
                    }

                    if (specBug.changeKey.key === "heal_done") {
                        variants = ["hps"];
                    }

                    for (let raid of currentContent.raids) {
                        const raidName = raid.raidName;
                        for (let difficulty in guild.progression[raidName]) {
                            for (let bossName in guild.progression[raidName][
                                difficulty
                            ]) {
                                for (let variant of variants) {
                                    for (let charId in guild.progression[
                                        raidName
                                    ][difficulty][bossName][variant]) {
                                        let characterData =
                                            guild.progression[raidName][
                                                difficulty
                                            ][bossName][variant][charId];

                                        if (
                                            characterData.spec ===
                                                specBug.specId &&
                                            characterData.date >
                                                specBug.date.from &&
                                            characterData.date < specBug.date.to
                                        ) {
                                            modified = true;

                                            if (
                                                specBug.changeKey.key ===
                                                    "dmg_done" ||
                                                specBug.changeKey.key ===
                                                    "heal_done"
                                            ) {
                                                characterData[variant] = 0.1;
                                            } else {
                                                characterData[
                                                    specBug.changeKey.key
                                                ] = specBug.changeKey.value;
                                            }

                                            guild.progression[raidName][
                                                difficulty
                                            ][bossName][variant][
                                                charId
                                            ] = characterData;
                                        }
                                    }
                                }
                            }
                        }
                    }

                    if (modified) {
                        if (
                            modifiedGuilds[
                                guildId(guild.guildName, guild.realm)
                            ]
                        ) {
                            modifiedGuilds[
                                guildId(guild.guildName, guild.realm)
                            ] = {
                                ...JSON.parse(
                                    JSON.stringify(
                                        modifiedGuilds[
                                            guildId(
                                                guild.guildName,
                                                guild.realm
                                            )
                                        ]
                                    )
                                ),
                                ...guild
                            };
                        } else {
                            modifiedGuilds[
                                guildId(guild.guildName, guild.realm)
                            ] = guild;
                        }
                    }
                }
            }
        }
        console.log("saving modified guilds");
        for (let guildId in modifiedGuilds) {
            delete modifiedGuilds[guildId]["_id"];
            await guildCollection.updateOne(
                {
                    guildName: new RegExp(
                        "^" +
                            escapeRegex(modifiedGuilds[guildId].guildName) +
                            "$",
                        "i"
                    ),
                    realm: modifiedGuilds[guildId].realm
                },
                {
                    $set: {
                        ...modifiedGuilds[guildId]
                    }
                }
            );
        }
    } catch (err) {
        console.error(err);
    }

    console.log("done");
})();

function guildId(guildName, realm) {
    return `${guildName} ${realm}`;
}
