const {
    realms,
    specs,
    specToClass,
    shortRealms,
    raceToFaction,
    classToSpec
} = require("tauriprogress-constants");
const {
    raidName: currentRaidName,
    totalBosses: currentTotalBosses,
    raids,
    lastBoss: currentLastBoss
} = require("tauriprogress-constants/currentContent");
const tauriApi = require("./tauriApi");

const week = 1000 * 60 * 60 * 24 * 7;
let raidNames = {};
let difficulties = {};
for (let raid of raids) {
    raidNames[raid.raidName] = true;
    difficulties[raid.raidName] = raid.difficulties;
}

async function getLogs(lastLogIds = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs = [];
            let logs = [];
            let newLastLogIds = {};

            for (let key in realms) {
                let lastLogId = lastLogIds[realms[key]];
                do {
                    try {
                        data = await tauriApi.getRaidLast(
                            realms[key],
                            lastLogId
                        );
                    } catch (err) {
                        data = err.message;
                    }
                } while (!data.success && data === "request timed out");
                if (!data.success) throw new Error(data.errorstring);

                unfilteredLogs = unfilteredLogs.concat(
                    data.response.logs.map(log => ({
                        ...log,
                        realm: realms[key]
                    }))
                );
            }

            for (let log of unfilteredLogs.sort((a, b) =>
                a.killtime < b.killtime ? -1 : 1
            )) {
                if (
                    validRaidName(log.mapentry.name) &&
                    validDifficulty(log.mapentry.name, log.difficulty) &&
                    log.fight_time > 10000
                ) {
                    let logData;
                    do {
                        try {
                            logData = await tauriApi.getRaidLog(
                                log.realm,
                                log.log_id
                            );
                        } catch (err) {
                            logData = err.message;
                        }
                    } while (
                        !logData.success &&
                        logData === "request timed out"
                    );
                    if (!logData.success) throw new Error(logData.errorstring);

                    logs.push({ ...logData.response, realm: log.realm });

                    newLastLogIds = addNestedObjectValue(
                        newLastLogIds,
                        [log.realm],
                        log.log_id
                    );
                }
            }

            resolve({
                logs,
                lastLogIds: { ...lastLogIds, ...newLastLogIds }
            });
        } catch (err) {
            reject(err);
        }
    });
}

function processLogs(logs) {
    let bossData = {};

    let guildData = {};

    let newRaidBoss = {
        bossName: undefined,
        latestKills: [],
        fastestKills: {},
        dps: {},
        hps: {},
        bestDps: {},
        bestHps: {},
        killCount: 0,
        difficulty: 0
    };

    let newGuild = {
        guildName: undefined,
        realm: undefined,
        faction: undefined,
        activity: {},
        progression: {
            latestKills: [],
            currentBossesDefeated: 0,
            completed: false
        },
        raidDays: defaultGuildRaidDays()
    };

    let newGuildBoss = {
        bossName: undefined,
        firstKill: undefined,
        killCount: 0,
        fastestKill: Number.MAX_SAFE_INTEGER,
        fastestKills: [],
        dps: {},
        hps: {}
    };

    for (let log of logs) {
        const raidName = log.mapentry.name;
        const difficulty = Number(log.difficulty);
        const bossName = log.encounter_data.encounter_name;
        const bossId = `${bossName} ${difficulty}`;
        const realm = log.realm;
        const faction = determineLogFaction(log);

        const guildName = log.guilddata.name;
        const guildId = `${guildName} ${realm}`;
        const guildBossCategorization = [
            "progression",
            raidName,
            difficulty,
            bossName
        ];
        /* create / update boss data */
        if (!bossData[raidName]) {
            bossData[raidName] = {};
        }
        if (!bossData[raidName][bossId]) {
            /* create boss data */
            bossData[raidName][bossId] = JSON.parse(
                JSON.stringify({
                    ...newRaidBoss,
                    bossName: bossName,
                    difficulty: difficulty
                })
            );
        }

        /* update boss data */
        bossData[raidName][bossId].killCount += 1;

        const logCategorization = [realm, faction];

        const trimmedLog = {
            log_id: log.log_id,
            guilddata: {
                name: log.guilddata.name,
                faction: log.guilddata.faction
            },
            fight_time: log.fight_time,
            realm: log.realm,
            killtime: log.killtime
        };

        const fastestKillsOfCategory = getNestedObjectValue(
            bossData[raidName][bossId].fastestKills,
            logCategorization
        );

        if (!fastestKillsOfCategory) {
            bossData[raidName][
                bossId
            ].fastestKills = addNestedObjectValue(
                bossData[raidName][bossId].fastestKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            bossData[raidName][bossId].fastestKills = addNestedObjectValue(
                bossData[raidName][bossId].fastestKills,
                logCategorization,
                fastestKillsOfCategory.concat(trimmedLog)
            );
        }

        bossData[raidName][bossId].latestKills.unshift(trimmedLog);

        /* create / update guild data */
        if (guildName) {
            const logDate = new Date(log.killtime * 1000);

            if (!guildData[guildId]) {
                guildData[guildId] = JSON.parse(
                    JSON.stringify({
                        ...newGuild,
                        guildName: guildName,
                        realm: realm,
                        faction: faction
                    })
                );
            }

            /* update guild data */
            guildData[guildId].activity[difficulty] = log.killtime;

            guildData[guildId].raidDays.total[unshiftDateDay(logDate.getDay())][
                logDate.getHours()
            ] += 1;

            guildData[guildId].progression.latestKills.unshift({
                log_id: log.log_id,
                mapentry: {
                    name: log.mapentry.name
                },
                encounter_data: {
                    encounter_name: log.encounter_data.encounter_name
                },
                difficulty: log.difficulty,
                fight_time: log.fight_time,
                killtime: log.killtime
            });

            let oldGuildBoss = getNestedObjectValue(
                guildData[guildId],
                guildBossCategorization
            );

            /* create guild boss */
            if (!oldGuildBoss) {
                guildData[guildId] = addNestedObjectValue(
                    guildData[guildId],
                    guildBossCategorization,
                    {
                        ...JSON.parse(JSON.stringify(newGuildBoss)),
                        bossName: bossName,
                        firstKill: log.killtime,
                        killCount: 0,
                        fastestKill: log.fight_time
                    }
                );

                oldGuildBoss = getNestedObjectValue(
                    guildData[guildId],
                    guildBossCategorization
                );
            }

            /* update guild boss */
            guildData[guildId] = addNestedObjectValue(
                guildData[guildId],
                guildBossCategorization,
                {
                    ...oldGuildBoss,
                    killCount: oldGuildBoss.killCount + 1,
                    fastestKill:
                        oldGuildBoss.fastestKill < log.fight_time
                            ? oldGuildBoss.fastestKill
                            : log.fight_time,
                    fastestKills: [
                        ...oldGuildBoss.fastestKills,
                        {
                            log_id: log.log_id,
                            fight_time: log.fight_time,
                            killtime: log.killtime,
                            realm: realm
                        }
                    ]
                }
            );
        }

        /* process data of characters and save it to boss and guild data */
        for (let character of log.members) {
            const characterId = createCharacterId(
                log.realm,
                character.name,
                character.spec
            );
            for (let variant of ["dps", "hps"]) {
                if (
                    specs[character.spec][
                        `is${capitalize(
                            variant === "dps" ? variant : "healer"
                        )}`
                    ]
                ) {
                    let characterData = {
                        name: character.name,
                        spec: character.spec,
                        class: specToClass[character.spec],
                        realm: realm,
                        ilvl: character.ilvl,
                        date: log.killtime,
                        logId: log.log_id,
                        faction: raceToFaction[character.race]
                    };

                    if (variant === "dps") {
                        characterData[variant] =
                            character.dmg_done / (log.fight_time / 1000);
                    } else {
                        characterData[variant] =
                            (character.heal_done + character.absorb_done) /
                            (log.fight_time / 1000);
                    }

                    if (
                        !bossData[raidName][bossId][variant][characterId] ||
                        characterData[variant] >
                            bossData[raidName][bossId][variant][characterId][
                                variant
                            ]
                    ) {
                        bossData[raidName][bossId][variant][
                            characterId
                        ] = characterData;
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
                            bossData[raidName][bossId][
                                `best${capitalize(variant)}`
                            ],
                            [...characterCategorization, variant]
                        )
                    ) {
                        bossData[raidName][bossId][
                            `best${capitalize(variant)}`
                        ] = addNestedObjectValue(
                            bossData[raidName][bossId][
                                `best${capitalize(variant)}`
                            ],
                            characterCategorization,
                            characterData
                        );
                    }

                    if (guildName) {
                        let oldCharacter = getNestedObjectValue(
                            guildData[guildId],
                            [...guildBossCategorization, variant, characterId]
                        );

                        if (
                            !oldCharacter ||
                            characterData[variant] > oldCharacter[variant]
                        ) {
                            guildData[guildId] = addNestedObjectValue(
                                guildData[guildId],
                                [
                                    ...guildBossCategorization,
                                    variant,
                                    characterId
                                ],
                                characterData
                            );
                        }
                    }
                }
            }
        }
    }

    /* bosses: cut latestKills to 50, cut fastestKills of each category to 50 */
    for (let raidName in bossData) {
        for (let bossId in bossData[raidName]) {
            bossData[raidName][bossId].latestKills = bossData[raidName][
                bossId
            ].latestKills.slice(0, 50);

            for (let realm in bossData[raidName][bossId].fastestKills) {
                for (let faction in bossData[raidName][bossId].fastestKills[
                    realm
                ]) {
                    let categorization = [realm, faction];
                    bossData[raidName][
                        bossId
                    ].fastestKills = addNestedObjectValue(
                        bossData[raidName][bossId].fastestKills,
                        categorization,
                        getNestedObjectValue(
                            bossData[raidName][bossId].fastestKills,
                            categorization
                        )
                            .sort((a, b) => a.fight_time - b.fight_time)
                            .slice(0, 50)
                    );
                }
            }
        }
    }

    /* guilds: cut latestKills, cut fastestKills to 10 */
    for (let guildId in guildData) {
        guildData[guildId].progression.latestKills = cutLatestKills(
            guildData[guildId].progression.latestKills
        );

        for (let raidName in guildData[guildId].progression) {
            if (validRaidName(raidName)) {
                for (let difficulty in guildData[guildId].progression[
                    raidName
                ]) {
                    for (let bossName in guildData[guildId].progression[
                        raidName
                    ][difficulty]) {
                        guildData[guildId].progression[raidName][difficulty][
                            bossName
                        ].fastestKills = guildData[guildId].progression[
                            raidName
                        ][difficulty][bossName].fastestKills
                            .sort((a, b) => a.fight_time - b.fight_time)
                            .slice(0, 10);
                    }
                }
            }
        }
    }

    return {
        bossData,
        guildData
    };
}

function determineLogFaction(log) {
    /**
     * The reasons for this function:
     *  - There is no reference to the faction the kill took place in
     *  - The only way to determine faction is to look at guild or character data
     *  - The guild/character data is unreliable to determine faction
     *      because it is picked from a relational table at the time of the request based on a guild/char id,
     *      this means that the guild/char data may change over time
     *      (eg: guild/char gone through a faction change)
     *
     * To determine faction with higher probability,
     *  this function counts the faction each char belongs to and picks the highest
     *
     */

    let alliance = 0;
    let horde = 0;
    for (let member of log.members) {
        if (raceToFaction[member.race] === 0) {
            alliance++;
        } else {
            horde++;
        }
    }

    return horde > alliance ? 1 : 0;
}

async function requestGuildData(guildName, realm) {
    let guild;

    do {
        try {
            guild = await tauriApi.getGuild(realm, guildName);
        } catch (err) {
            guild = err.message;
        }
    } while (!guild.success && guild === "request timed out");
    if (!guild.success) throw new Error(guild.errorstring);

    guild = guild.response;

    let guildList = [];

    for (let memberId in guild.guildList) {
        guildList.push({
            name: guild.guildList[memberId].name,
            class: guild.guildList[memberId].class,
            realm: guild.guildList[memberId].realm,
            rank_name: guild.guildList[memberId].rank_name,
            level: guild.guildList[memberId].level,
            rank: guild.guildList[memberId].rank
        });
    }

    let newGuild = {
        ...guild,
        guildList: guildList
    };

    return newGuild;
}

function updateGuildData(oldGuild, newGuild) {
    let updatedGuild = {
        ...JSON.parse(JSON.stringify(oldGuild)),
        ...(({ progression, raidDays, activity, ...others }) => ({
            ...JSON.parse(JSON.stringify(others))
        }))(newGuild)
    };

    for (let raidName in newGuild.progression) {
        if (validRaidName(raidName)) {
            for (let difficulty in newGuild.progression[raidName]) {
                for (let bossName in newGuild.progression[raidName][
                    difficulty
                ]) {
                    const bossCategorization = [raidName, difficulty, bossName];
                    let oldBoss = getNestedObjectValue(
                        oldGuild.progression,
                        bossCategorization
                    );
                    let newBoss = getNestedObjectValue(
                        newGuild.progression,
                        bossCategorization
                    );
                    let updatedBoss;
                    if (oldBoss) {
                        updatedBoss = {
                            ...oldBoss,
                            killCount: oldBoss.killCount + newBoss.killCount,
                            fastestKill:
                                oldBoss.fastestKill < newBoss.fastestKill
                                    ? oldBoss.fastestKill
                                    : newBoss.fastestKill,
                            fastestKills: [
                                ...oldBoss.fastestKills,
                                ...newBoss.fastestKills
                            ]
                                .sort((a, b) => a.fight_time - b.fight_time)
                                .slice(0, 10),
                            firstKill:
                                oldBoss.firstKill < newBoss.firstKill
                                    ? oldBoss.firstKill
                                    : newBoss.firstKill
                        };

                        for (let variant of ["dps", "hps"]) {
                            for (let characterId in newBoss[variant]) {
                                let oldCharacter =
                                    oldBoss[variant][characterId];
                                let newCharacter =
                                    newBoss[variant][characterId];
                                if (
                                    !oldCharacter ||
                                    oldCharacter[variant] <
                                        newCharacter[variant]
                                ) {
                                    updatedBoss[variant][
                                        characterId
                                    ] = newCharacter;
                                }
                            }
                        }
                    } else {
                        updatedBoss = newBoss;
                    }

                    updatedGuild.progression = addNestedObjectValue(
                        updatedGuild.progression,
                        bossCategorization,
                        updatedBoss
                    );
                }
            }
        }
    }

    if (newGuild.progression) {
        updatedGuild.progression.latestKills = cutLatestKills([
            ...newGuild.progression.latestKills,
            ...oldGuild.progression.latestKills
        ]);
    }

    for (let [day, hours] of newGuild.raidDays.total.entries()) {
        for (let [hour, killCount] of hours.entries()) {
            updatedGuild.raidDays.total[day][hour] += killCount;
        }
    }

    updatedGuild.activity = { ...updatedGuild.activity, ...newGuild.activity };

    return updatedGuild;
}

function calcGuildContentCompletion(guild) {
    let completion = {
        completed: false,
        bossesDefeated: 0
    };

    for (let difficulty in guild.progression[currentRaidName]) {
        difficulty = Number(difficulty);
        if (!completion[difficulty])
            completion[difficulty] = { progress: 0, completed: false };

        for (let boss in guild.progression[currentRaidName][difficulty]) {
            completion[difficulty].progress++;
        }

        if (completion[difficulty].progress === currentTotalBosses) {
            const firstKill =
                guild.progression[currentRaidName][difficulty][currentLastBoss]
                    .firstKill;
            completion[difficulty].completed = firstKill;

            if (completion.completed) {
                completion.completed =
                    completion.completed < firstKill
                        ? completion.completed
                        : firstKill;
            } else {
                completion.completed = firstKill;
            }
        }

        if (completion.bossesDefeated < completion[difficulty].progress)
            completion.bossesDefeated = completion[difficulty].progress;
    }

    guild.progression.completion = { ...completion };
    return guild;
}

function updateRaidBoss(oldRaidBoss, newRaidBoss) {
    if (
        oldRaidBoss.bossName !== newRaidBoss.bossName ||
        oldRaidBoss.difficulty !== newRaidBoss.difficulty
    ) {
        throw new Error(
            `Updating boss data where bossName and difficulty is not the same is not allowed.`
        );
    }

    let updatedRaidBoss = {
        ...JSON.parse(JSON.stringify(oldRaidBoss)),
        latestKills: newRaidBoss.latestKills
            .concat(oldRaidBoss.latestKills)
            .slice(0, 50),
        killCount: oldRaidBoss.killCount + newRaidBoss.killCount
    };

    for (let realm in newRaidBoss.fastestKills) {
        for (let faction in newRaidBoss.fastestKills[realm]) {
            let objectKeys = [realm, faction];

            let oldLogs =
                getNestedObjectValue(oldRaidBoss.fastestKills, objectKeys) ||
                [];
            let newLogs = getNestedObjectValue(
                newRaidBoss.fastestKills,
                objectKeys
            );

            let updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.fight_time - b.fight_time)
                .slice(0, 50);

            updatedRaidBoss.fastestKills = addNestedObjectValue(
                updatedRaidBoss.fastestKills,
                objectKeys,
                updatedLogs
            );
        }
    }

    for (let variant of ["dps", "hps"]) {
        for (let key in newRaidBoss[variant]) {
            let member = newRaidBoss[variant][key];

            const memberCategorization = [
                member.realm,
                member.faction,
                member.class,
                member.spec
            ];

            if (
                member[variant] >
                getNestedObjectValue(
                    updatedRaidBoss[`best${capitalize(variant)}`],
                    [...memberCategorization, variant]
                )
            ) {
                updatedRaidBoss[
                    `best${capitalize(variant)}`
                ] = addNestedObjectValue(
                    updatedRaidBoss[`best${capitalize(variant)}`],
                    memberCategorization,
                    member
                );
            }

            if (
                !updatedRaidBoss[variant][key] ||
                updatedRaidBoss[variant][key][variant] < member[variant]
            ) {
                updatedRaidBoss[variant][key] = member;
            }
        }
    }

    return updatedRaidBoss;
}

function applyPlayerPerformanceRanks(raidBoss) {
    let dpsArr = [];
    let hpsArr = [];
    let dpsSpecs = {};
    let hpsSpecs = {};
    let dpsClasses = {};
    let hpsClasses = {};

    for (let dpsKey in raidBoss.dps) {
        dpsArr.push({ ...raidBoss.dps[dpsKey], key: dpsKey });
    }

    for (let hpsKey in raidBoss.hps) {
        hpsArr.push({ ...raidBoss.hps[hpsKey], key: hpsKey });
    }

    dpsArr = dpsArr.sort((a, b) => b.dps - a.dps);
    hpsArr = hpsArr.sort((a, b) => b.hps - a.hps);

    for (let i = 0; i < dpsArr.length; i++) {
        dpsSpecs[dpsArr[i].spec] = dpsSpecs[dpsArr[i].spec]
            ? dpsSpecs[dpsArr[i].spec] + 1
            : 1;
        dpsClasses[dpsArr[i].class] = dpsClasses[dpsArr[i].class]
            ? dpsClasses[dpsArr[i].class] + 1
            : 1;

        raidBoss.dps[dpsArr[i].key].rank = i + 1;
        raidBoss.dps[dpsArr[i].key].specRank = dpsSpecs[dpsArr[i].spec];
        raidBoss.dps[dpsArr[i].key].classRank = dpsClasses[dpsArr[i].class];
    }

    for (let i = 0; i < hpsArr.length; i++) {
        hpsSpecs[hpsArr[i].spec] = hpsSpecs[hpsArr[i].spec]
            ? hpsSpecs[hpsArr[i].spec] + 1
            : 1;
        hpsClasses[hpsArr[i].class] = hpsClasses[hpsArr[i].class]
            ? hpsClasses[hpsArr[i].class] + 1
            : 1;
        raidBoss.hps[hpsArr[i].key].rank = i + 1;
        raidBoss.hps[hpsArr[i].key].specRank = hpsSpecs[hpsArr[i].spec];
        raidBoss.hps[hpsArr[i].key].classRank = hpsClasses[hpsArr[i].class];
    }

    return raidBoss;
}

function minutesAgo(time) {
    return Math.round((new Date().getTime() / 1000 - Number(time)) / 60);
}

function secsAgo(time) {
    return Math.round(new Date().getTime() / 1000 - time);
}

function createCharacterId(realm, name, spec) {
    return `${shortRealms[realm]} ${name} ${spec}`;
}

function escapeRegex(s) {
    return String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getBossId(raidData, bossName, difficulty = 0) {
    return raidData.encounters.reduce((acc, boss) => {
        if (
            boss.encounter_name === bossName &&
            (boss.encounter_difficulty === 0 ||
                boss.encounter_difficulty === Number(difficulty))
        )
            acc = boss.encounter_id;
        return acc;
    }, null);
}

function addNestedObjectValue(obj, keys, value) {
    let currentKey = keys[0];
    if (currentKey !== undefined) {
        obj[currentKey] = addNestedObjectValue(
            obj.hasOwnProperty(currentKey) ? obj[currentKey] : {},
            keys.slice(1, keys.length),
            value
        );
        return obj;
    } else {
        return value !== undefined ? value : {};
    }
}

function getNestedObjectValue(obj, keys) {
    let currentKey = keys[0];

    if (keys.length === 1) {
        return obj.hasOwnProperty(currentKey) ? obj[currentKey] : false;
    } else {
        return obj.hasOwnProperty(currentKey)
            ? getNestedObjectValue(obj[currentKey], keys.slice(1, keys.length))
            : false;
    }
}

function getBestPerformance(
    bestPerformances,
    type,
    { characterClass, spec } = {}
) {
    let bestPerformance = 0;

    let perfSpecs = {};

    if (spec) {
        perfSpecs[specToClass[spec]] = [spec];
    } else if (characterClass) {
        perfSpecs[characterClass] = classToSpec[characterClass];
    } else {
        for (let characterClass in classToSpec) {
            perfSpecs[characterClass] = classToSpec[characterClass];
        }
    }

    for (const realmId in realms) {
        const realm = realms[realmId];
        for (let faction of [0, 1]) {
            for (let characterClass in perfSpecs) {
                for (let currentSpec of perfSpecs[characterClass]) {
                    const objectKeys = [
                        realm,
                        faction,
                        characterClass,
                        currentSpec,
                        type
                    ];

                    let currentBestPerformance = getNestedObjectValue(
                        bestPerformances,
                        objectKeys
                    );

                    if (
                        currentBestPerformance &&
                        currentBestPerformance > bestPerformance
                    ) {
                        bestPerformance = currentBestPerformance;
                    }
                }
            }
        }
    }
    return bestPerformance;
}

function calcTopPercentOfPerformance(currentPerformance, bestPerformance) {
    return Math.round((currentPerformance / bestPerformance) * 1000) / 10;
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function validRaidName(raidName) {
    return raidNames[raidName] ? true : false;
}

function validDifficulty(raidName, difficulty) {
    return difficulties[raidName][difficulty] ? true : false;
}

function logBugHandler(log, bug) {
    if (log) {
        switch (bug.type) {
            case "log":
                if (log.log_id === bug.logId && log.realm === bug.realm) {
                    log = false;
                }

                break;
            case "boss":
                if (
                    log.encounter_data.encounter_id === bug.boss &&
                    log.killtime > bug.date.from &&
                    log.killtime < bug.date.to
                ) {
                    log = false;
                }

                break;
            case "spec":
                log.members = log.members.map(member => {
                    if (
                        member.spec === bug.specId &&
                        log.killtime > bug.date.from &&
                        log.killtime < bug.date.to
                    ) {
                        return {
                            ...member,
                            [bug.changeKey.key]: bug.changeKey.value
                        };
                    }
                    return member;
                });

                break;
            default:
        }
    }

    return log;
}

function cutLatestKills(kills) {
    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    let latestKills = [];

    for (let log of kills) {
        if (log.killtime * 1000 > timeBoundary) {
            latestKills.push(log);
        } else if (latestKills.length < 50) {
            latestKills.push(log);
        } else {
            break;
        }
    }

    return latestKills;
}

function getLatestWednesday(date) {
    const currentDate = date ? date : new Date();
    const currentDay = currentDate.getDay();

    const wednesdayDaysAgo = (currentDay < 3 ? currentDay + 7 : currentDay) - 3;

    let lastWednesdayDate = currentDate.getDate() - wednesdayDaysAgo;
    if (currentDay === 3 && currentDate.getHours() < 9) {
        lastWednesdayDate -= 7;
    }

    return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        lastWednesdayDate,
        10
    );
}

function defaultGuildRaidDays() {
    return {
        total: new Array(7).fill(new Array(24).fill(0)),
        recent: new Array(7).fill(new Array(24).fill(0))
    };
}

function recentGuildRaidDays(guild) {
    let { recent } = JSON.parse(JSON.stringify(defaultGuildRaidDays()));

    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    for (let log of guild.progression.latestKills) {
        if (log.killtime * 1000 > timeBoundary) {
            let logDate = new Date(log.killtime * 1000);

            recent[unshiftDateDay(logDate.getDay())][logDate.getHours()] += 1;
        } else {
            break;
        }
    }
    guild.raidDays.recent = recent;

    return guild;
}

function unshiftDateDay(day) {
    return day - 1 >= 0 ? day - 1 : 6;
}

module.exports = {
    getLogs,
    processLogs,
    requestGuildData,
    updateGuildData,
    updateRaidBoss,
    minutesAgo,
    applyPlayerPerformanceRanks,
    calcGuildContentCompletion,
    createCharacterId,
    escapeRegex,
    getBossId,
    secsAgo,
    addNestedObjectValue,
    getNestedObjectValue,
    getBestPerformance,
    calcTopPercentOfPerformance,
    capitalize,
    validRaidName,
    validDifficulty,
    logBugHandler,
    recentGuildRaidDays
};
