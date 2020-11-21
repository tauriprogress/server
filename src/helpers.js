const {
    characterSpecToClass,
    shortRealms,
    characterRaceToFaction
} = require("tauriprogress-constants");

const expansionData = require("./expansionData");
const { currentContent } = expansionData;

const tauriApi = require("./tauriApi");
const week = 1000 * 60 * 60 * 24 * 7;

async function getLogs(lastLogIds = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs = [];
            let logs = [];
            let newLastLogIds = {};
            const realms = expansionData.realms;

            for (let realmKey in realms) {
                const lastLogId = lastLogIds[realms[realmKey]];
                do {
                    try {
                        data = await tauriApi.getRaidLast(
                            realms[realmKey],
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
                        realm: realms[realmKey],
                        encounter_data: {
                            ...log.encounter_data,
                            encounter_name: log.encounter_data.encounter_name.trim()
                        }
                    }))
                );
            }

            for (let log of unfilteredLogs.sort((a, b) =>
                a.killtime < b.killtime ? -1 : 1
            )) {
                if (
                    validRaidName(log.mapentry.name) &&
                    validDifficulty(log.mapentry.name, log.difficulty) &&
                    validBossName(
                        log.mapentry.id,
                        log.encounter_data.encounter_name
                    ) &&
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

                    logs.push({
                        ...logData.response,
                        realm: log.realm,
                        encounter_data: {
                            ...logData.response.encounter_data,
                            encounter_name: logData.response.encounter_data.encounter_name.trim()
                        }
                    });

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
    let bosses = {};
    let defaultBoss = {
        _id: undefined,
        raidId: undefined,
        name: undefined,
        difficulty: undefined,
        killCount: 0,
        recentKills: [],
        fastestKills: {},
        firstKills: {},
        bestDps: {},
        bestHps: {},
        bestDpsNoCat: {},
        bestHpsNoCat: {}
    };

    let guilds = {};
    let defaultGuild = {
        _id: undefined,
        f: undefined,
        realm: undefined,
        name: undefined,
        members: [],
        ranks: [],
        activity: {},
        progression: {
            recentKills: [],
            completion: {}
        },
        raidDays: defaultGuildRaidDays()
    };
    let defaultGuildBoss = {
        killCount: 0,
        fastestKills: [],
        firstKill: false,
        dps: {},
        hps: {}
    };

    let combatMetrics = {};
    let defaultCombatMetricBoss = { dps: {}, hps: {} };

    for (const log of logs) {
        const logId = log.log_id;
        const raidName = log.mapentry.name;
        const raidId = log.mapentry.id;
        const bossName = log.encounter_data.encounter_name;
        const difficulty = Number(log.difficulty);
        const bossId = `${log.encounter_data.encounter_id} ${difficulty}`;
        const realm = log.realm;
        const faction = determineLogFaction(log);
        const fightLength = log.fight_time;
        const date = log.killtime;

        const guildId = log.guildid;
        const guildName = log.guilddata.name;
        const isGuildKill = guildId && guildName ? true : false;
        const guildFaction = log.guilddata.faction;
        const guildBossCategorization = [
            "progression",
            raidName,
            difficulty,
            bossName
        ];

        const trimmedLog = {
            id: logId,
            guild: isGuildKill ? { name: guildName, f: faction } : null,
            fightLength: fightLength,
            realm: realm,
            date: date
        };

        // create boss
        // in combatMetrics first
        if (!combatMetrics[bossId]) {
            combatMetrics[bossId] = JSON.parse(
                JSON.stringify(defaultCombatMetricBoss)
            );
        }

        if (!bosses[bossId]) {
            bosses[bossId] = {
                ...JSON.parse(JSON.stringify(defaultBoss)),
                _id: bossId,
                raidId: raidId,
                name: bossName,
                difficulty: difficulty
            };
        }

        // update boss
        bosses[bossId].killCount += 1;

        bosses[bossId].recentKills.unshift(trimmedLog);

        const logCategorization = [realm, faction];
        const categorizedFastestKills = getNestedObjectValue(
            bosses[bossId].fastestKills,
            logCategorization
        );
        if (!categorizedFastestKills) {
            bosses[bossId].fastestKills = addNestedObjectValue(
                bosses[bossId].fastestKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            bosses[bossId].fastestKills = addNestedObjectValue(
                bosses[bossId].fastestKills,
                logCategorization,
                categorizedFastestKills.concat(trimmedLog)
            );
        }

        const categorizedFirstKills = getNestedObjectValue(
            bosses[bossId].firstKills,
            logCategorization
        );
        if (!categorizedFirstKills) {
            bosses[bossId].firstKills = addNestedObjectValue(
                bosses[bossId].firstKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            bosses[bossId].firstKills = addNestedObjectValue(
                bosses[bossId].firstKills,
                logCategorization,
                categorizedFirstKills.concat(trimmedLog)
            );
        }

        if (isGuildKill) {
            // create guild
            if (!guilds[guildId]) {
                guilds[guildId] = {
                    ...JSON.parse(JSON.stringify(defaultGuild)),
                    _id: guildId,
                    name: guildName,
                    f: guildFaction,
                    realm: realm
                };
            }

            // update guild
            guilds[guildId].activity[difficulty] = date;

            const logDate = new Date(date * 1000);
            guilds[guildId].raidDays.total[unshiftDateDay(logDate.getDay())][
                logDate.getHours()
            ] += 1;

            guilds[guildId].progression.recentKills.unshift({
                id: logId,
                date: date,
                boss: bossName,
                difficulty: difficulty
            });

            let oldGuildBoss = getNestedObjectValue(
                guilds[guildId],
                guildBossCategorization
            );

            /* create guild boss */
            if (!oldGuildBoss) {
                guilds[guildId] = addNestedObjectValue(
                    guilds[guildId],
                    guildBossCategorization,
                    JSON.parse(JSON.stringify(defaultGuildBoss))
                );

                oldGuildBoss = getNestedObjectValue(
                    guilds[guildId],
                    guildBossCategorization
                );
            }

            /* update guild boss */
            guilds[guildId] = addNestedObjectValue(
                guilds[guildId],
                guildBossCategorization,
                {
                    ...oldGuildBoss,
                    killCount: oldGuildBoss.killCount + 1,
                    firstKill:
                        oldGuildBoss.firstKill === false
                            ? date
                            : date < oldGuildBoss.firstKill
                            ? date
                            : oldGuildBoss.firstKill,
                    fastestKills: [
                        ...oldGuildBoss.fastestKills,
                        {
                            id: logId,
                            fightLength: fightLength,
                            date: date
                        }
                    ]
                }
            );
        }

        // process data of characters and save it to boss and guild data
        for (let character of log.members) {
            const characterId = createCharacterId(
                character.name,
                realm,
                character.spec
            );

            for (let combatMetric of ["dps", "hps"]) {
                if (
                    expansionData.specs[character.spec][
                        `is${capitalize(
                            combatMetric === "dps" ? combatMetric : "healer"
                        )}`
                    ]
                ) {
                    let characterData = {
                        _id: characterId,
                        realm: shortRealms[realm],
                        class: character.spec
                            ? characterSpecToClass[character.spec]
                            : character.class,
                        name: character.name,
                        spec: character.spec,
                        ilvl: character.ilvl,
                        date: date,
                        logId: log.log_id,
                        f: characterRaceToFaction[character.race]
                    };

                    if (combatMetric === "dps") {
                        characterData[combatMetric] =
                            character.dmg_done / (log.fight_time / 1000);
                    } else {
                        characterData[combatMetric] =
                            (character.heal_done + character.absorb_done) /
                            (log.fight_time / 1000);
                    }

                    if (
                        !combatMetrics[bossId][combatMetric][characterId] ||
                        characterData[combatMetric] >
                            combatMetrics[bossId][combatMetric][characterId][
                                combatMetric
                            ]
                    ) {
                        combatMetrics[bossId][combatMetric][
                            characterId
                        ] = characterData;
                    }

                    const characterCategorization = [
                        realm,
                        characterData.f,
                        characterData.class,
                        characterData.spec
                    ];

                    const bestOf =
                        bosses[bossId][`best${capitalize(combatMetric)}NoCat`];

                    if (!bestOf[combatMetric]) {
                        bosses[bossId][
                            `best${capitalize(combatMetric)}NoCat`
                        ] = characterData;
                    }

                    if (characterData[combatMetric] > bestOf[combatMetric]) {
                        bosses[bossId][
                            `best${capitalize(combatMetric)}NoCat`
                        ] = characterData;
                    }

                    const categorizedBestOf = getNestedObjectValue(
                        bosses[bossId][`best${capitalize(combatMetric)}`],
                        characterCategorization
                    );

                    if (!categorizedBestOf) {
                        bosses[bossId][
                            `best${capitalize(combatMetric)}`
                        ] = addNestedObjectValue(
                            bosses[bossId][`best${capitalize(combatMetric)}`],
                            characterCategorization,
                            [characterData]
                        );
                    } else if (
                        characterData[combatMetric] >
                        categorizedBestOf[categorizedBestOf.length - 1][
                            combatMetric
                        ]
                    ) {
                        const indexOfSameChar = categorizedBestOf.findIndex(
                            data => data._id === characterData._id
                        );

                        if (indexOfSameChar >= 0) {
                            if (
                                characterData[combatMetric] >
                                categorizedBestOf[indexOfSameChar][combatMetric]
                            ) {
                                categorizedBestOf[
                                    indexOfSameChar
                                ] = characterData;
                                categorizedBestOf
                                    .sort(
                                        (a, b) =>
                                            b[combatMetric] - a[combatMetric]
                                    )
                                    .slice(0, 10);
                            }
                        } else {
                            bosses[bossId][
                                `best${capitalize(combatMetric)}`
                            ] = addNestedObjectValue(
                                bosses[bossId][
                                    `best${capitalize(combatMetric)}`
                                ],
                                characterCategorization,
                                categorizedBestOf
                                    .concat(characterData)
                                    .sort(
                                        (a, b) =>
                                            b[combatMetric] - a[combatMetric]
                                    )
                                    .slice(0, 10)
                            );
                        }
                    }

                    if (isGuildKill) {
                        let oldCharacter = getNestedObjectValue(
                            guilds[guildId],
                            [
                                ...guildBossCategorization,
                                combatMetric,
                                characterId
                            ]
                        );

                        if (
                            !oldCharacter ||
                            characterData[combatMetric] >
                                oldCharacter[combatMetric]
                        ) {
                            guilds[guildId] = addNestedObjectValue(
                                guilds[guildId],
                                [
                                    ...guildBossCategorization,
                                    combatMetric,
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

    /* bosses: cut latestKills to 50, cut fastestKills of each category to 50, cut firstkills to 3 */
    for (const bossId in bosses) {
        bosses[bossId].recentKills = bosses[bossId].recentKills.slice(0, 50);

        for (const realm in bosses[bossId].fastestKills) {
            for (const faction in bosses[bossId].fastestKills[realm]) {
                const categorization = [realm, faction];
                bosses[bossId].fastestKills = addNestedObjectValue(
                    bosses[bossId].fastestKills,
                    categorization,
                    getNestedObjectValue(
                        bosses[bossId].fastestKills,
                        categorization
                    )
                        .sort((a, b) => a.fightLength - b.fightLength)
                        .slice(0, 50)
                );
            }
        }

        for (const realm in bosses[bossId].firstKills) {
            for (const faction in bosses[bossId].firstKills[realm]) {
                const categorization = [realm, faction];
                bosses[bossId].firstKills = addNestedObjectValue(
                    bosses[bossId].firstKills,
                    categorization,
                    getNestedObjectValue(
                        bosses[bossId].firstKills,
                        categorization
                    )
                        .sort((a, b) => a.date - b.date)
                        .slice(0, 3)
                );
            }
        }
    }

    /* guilds: cut latestKills, cut fastestKills to 10 */
    for (const guildId in guilds) {
        guilds[guildId].progression.recentKills = cutRecentKills(
            guilds[guildId].progression.recentKills
        );

        for (const raidName in guilds[guildId].progression) {
            if (validRaidName(raidName)) {
                for (const difficulty in guilds[guildId].progression[
                    raidName
                ]) {
                    for (const bossName in guilds[guildId].progression[
                        raidName
                    ][difficulty]) {
                        guilds[guildId].progression[raidName][difficulty][
                            bossName
                        ].fastestKills = guilds[guildId].progression[raidName][
                            difficulty
                        ][bossName].fastestKills
                            .sort((a, b) => a.fightLength - b.fightLength)
                            .slice(0, 10);
                    }
                }
            }
        }
    }

    return {
        guilds,
        bosses,
        combatMetrics
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
        if (characterRaceToFaction[member.race] === 0) {
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
            guild = await tauriApi.getGuild(guildName, realm);
        } catch (err) {
            guild = err.message;
        }
    } while (!guild.success && guild === "request timed out");
    if (!guild.success) throw new Error(guild.errorstring);

    guild = guild.response;

    let members = [];

    for (const memberId in guild.guildList) {
        members.push({
            name: guild.guildList[memberId].name,
            class: guild.guildList[memberId].class,
            rankName: guild.guildList[memberId].rank_name,
            lvl: guild.guildList[memberId].level
        });
    }

    let ranks = [];
    for (const rankId in guild.gRanks) {
        ranks.push(guild.gRanks[rankId].rname);
    }

    let newGuild = {
        name: guild.guildName,
        f: guild.faction,
        realm: guild.realm,
        ranks: ranks,
        members: members
    };

    for (let guild of expansionData.guildFactionBugs) {
        if (
            guild.guildName === newGuild.name &&
            guild.realm === newGuild.realm
        ) {
            newGuild.f = guild.faction;
        }
    }

    return newGuild;
}

function updateGuildData(oldGuild, newGuild) {
    let updatedGuild = {
        ...JSON.parse(JSON.stringify(oldGuild)),
        ...(({ progression, raidDays, activity, ...others }) => ({
            ...JSON.parse(JSON.stringify(others)),
            members: newGuild.members.length
                ? newGuild.members
                : oldGuild.members,
            ranks: newGuild.ranks.length ? newGuild.ranks : oldGuild.ranks
        }))(newGuild)
    };

    if (newGuild.progression) {
        for (const raidName in newGuild.progression) {
            if (validRaidName(raidName)) {
                for (const difficulty in newGuild.progression[raidName]) {
                    for (const bossName in newGuild.progression[raidName][
                        difficulty
                    ]) {
                        const bossCategorization = [
                            raidName,
                            difficulty,
                            bossName
                        ];
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
                                killCount:
                                    oldBoss.killCount + newBoss.killCount,
                                fastestKills: uniqueLogs([
                                    ...oldBoss.fastestKills,
                                    ...newBoss.fastestKills
                                ])
                                    .sort(
                                        (a, b) => a.fightLength - b.fightLength
                                    )
                                    .slice(0, 10)
                            };

                            for (let combatMetric of ["dps", "hps"]) {
                                for (let characterId in newBoss[combatMetric]) {
                                    let oldCharacter =
                                        oldBoss[combatMetric][characterId];
                                    let newCharacter =
                                        newBoss[combatMetric][characterId];
                                    if (
                                        !oldCharacter ||
                                        oldCharacter[combatMetric] <
                                            newCharacter[combatMetric]
                                    ) {
                                        updatedBoss[combatMetric][
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

        updatedGuild.progression.recentKills = cutRecentKills(
            uniqueLogs([
                ...newGuild.progression.recentKills,
                ...oldGuild.progression.recentKills
            ])
        );
    }

    if (newGuild.raidDays) {
        for (let [day, hours] of newGuild.raidDays.total.entries()) {
            for (let [hour, killCount] of hours.entries()) {
                updatedGuild.raidDays.total[day][hour] += killCount;
            }
        }
    }

    if (newGuild.activity) {
        updatedGuild.activity = {
            ...updatedGuild.activity,
            ...newGuild.activity
        };
    }

    return updatedGuild;
}

function calcGuildContentCompletion(guild) {
    let completion = {
        completed: false,
        bossesDefeated: 0
    };
    for (let difficulty in guild.progression[currentContent.name]) {
        difficulty = Number(difficulty);
        if (!completion[difficulty])
            completion[difficulty] = { progress: 0, completed: false };

        for (let boss in guild.progression[currentContent.name][difficulty]) {
            completion[difficulty].progress++;
        }

        if (
            currentContent.completionDifficulties.includes(difficulty) &&
            completion[difficulty].progress === currentContent.totalBosses
        ) {
            const firstKill =
                guild.progression[currentContent.name][difficulty][
                    currentContent.lastBoss
                ].firstKill;
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

        if (
            currentContent.completionDifficulties.includes(difficulty) &&
            completion.bossesDefeated < completion[difficulty].progress
        )
            completion.bossesDefeated = completion[difficulty].progress;
    }

    guild.progression.completion = { ...completion };
    return guild;
}

function updateRaidBoss(oldBoss, boss) {
    let updatedRaidBoss = {
        ...JSON.parse(JSON.stringify(oldBoss)),
        recentKills: boss.recentKills.concat(oldBoss.recentKills).slice(0, 50),
        killCount: oldBoss.killCount + boss.killCount
    };

    for (const realm in boss.fastestKills) {
        for (const faction in boss.fastestKills[realm]) {
            const categorization = [realm, faction];

            const oldLogs =
                getNestedObjectValue(oldBoss.fastestKills, categorization) ||
                [];

            const newLogs = getNestedObjectValue(
                boss.fastestKills,
                categorization
            );

            const updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.fightLength - b.fightLength)
                .slice(0, 50);

            updatedRaidBoss.fastestKills = addNestedObjectValue(
                updatedRaidBoss.fastestKills,
                categorization,
                updatedLogs
            );
        }
    }

    for (const realm in boss.firstKills) {
        for (const faction in boss.firstKills[realm]) {
            const categorization = [realm, faction];

            const oldLogs =
                getNestedObjectValue(oldBoss.firstKills, categorization) || [];

            const newLogs = getNestedObjectValue(
                boss.firstKills,
                categorization
            );

            const updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.date - b.date)
                .slice(0, 3);

            updatedRaidBoss.firstKills = addNestedObjectValue(
                updatedRaidBoss.firstKills,
                categorization,
                updatedLogs
            );
        }
    }

    for (const combatMetric of ["dps", "hps"]) {
        if (
            boss[`best${capitalize(combatMetric)}NoCat`] >
            updatedRaidBoss[`best${capitalize(combatMetric)}NoCat`]
        ) {
            updatedRaidBoss[`best${capitalize(combatMetric)}NoCat`] =
                boss[`best${capitalize(combatMetric)}NoCat`];
        }

        for (const realm in boss[`best${capitalize(combatMetric)}`]) {
            for (const faction in boss[`best${capitalize(combatMetric)}`][
                realm
            ]) {
                for (const characterClass in boss[
                    `best${capitalize(combatMetric)}`
                ][realm][faction]) {
                    for (const characterSpec in boss[
                        `best${capitalize(combatMetric)}`
                    ][realm][faction][characterClass]) {
                        const categorization = [
                            `best${capitalize(combatMetric)}`,
                            realm,
                            faction,
                            characterClass,
                            characterSpec
                        ];
                        const oldBestsOfCombatMetric =
                            getNestedObjectValue(oldBoss, categorization) || [];

                        const newBestsOfCombatMetric =
                            getNestedObjectValue(boss, categorization) || [];

                        const bestCharacters = {};

                        for (const bestCharacter of [
                            ...oldBestsOfCombatMetric,
                            ...newBestsOfCombatMetric
                        ]) {
                            if (
                                !bestCharacters[bestCharacter._id] ||
                                (bestCharacters[bestCharacter._id] &&
                                    bestCharacter[combatMetric] >
                                        bestCharacters[bestCharacter._id][
                                            combatMetric
                                        ])
                            ) {
                                bestCharacters[
                                    bestCharacter._id
                                ] = bestCharacter;
                            }
                        }

                        const updatedBestsOfCombatMetric = [];

                        for (const charId in bestCharacters) {
                            updatedBestsOfCombatMetric.push(
                                bestCharacters[charId]
                            );
                        }

                        updatedRaidBoss = addNestedObjectValue(
                            updatedRaidBoss,
                            categorization,
                            updatedBestsOfCombatMetric
                                .sort(
                                    (a, b) => b[combatMetric] - a[combatMetric]
                                )
                                .slice(0, 10)
                        );
                    }
                }
            }
        }
    }

    return updatedRaidBoss;
}

function applyCharacterPerformanceRanks(characters, combatMetric) {
    let classes = {};
    let specs = {};
    let sortedCharacters = characters.sort(
        (a, b) => b[combatMetric] - a[combatMetric]
    );

    for (let i = 0; i < sortedCharacters.length; i++) {
        let character = sortedCharacters[i];

        if (!classes[character.class]) {
            classes[character.class] = 1;
        } else {
            classes[character.class] += 1;
        }

        if (!specs[character.spec]) {
            specs[character.spec] = 1;
        } else {
            specs[character.spec] += 1;
        }

        character.rank = i + 1;
        character.cRank = classes[character.class];
        character.sRank = specs[character.spec];

        sortedCharacters[i] = character;
    }

    return sortedCharacters;
}

function minutesAgo(time) {
    return Math.round((new Date().getTime() / 1000 - Number(time)) / 60);
}

function secsAgo(time) {
    return Math.round(new Date().getTime() / 1000 - time);
}

function createCharacterId(name, realm, spec) {
    return `${name},${shortRealms[realm]},${spec}`;
}

function escapeRegex(s) {
    return String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
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

function calcTopPercentOfPerformance(currentPerformance, bestPerformance) {
    return Math.round((currentPerformance / bestPerformance) * 1000) / 10;
}

function addToTotalPerformance(total, categorization, combatMetricValue) {
    let prevTotalValue = getNestedObjectValue(total, categorization);
    if (!combatMetricValue) {
        return addNestedObjectValue(
            total,
            categorization,
            prevTotalValue || false
        );
    }
    if (!prevTotalValue) {
        return addNestedObjectValue(total, categorization, combatMetricValue);
    }
    return addNestedObjectValue(
        total,
        categorization,
        prevTotalValue + combatMetricValue
    );
}

function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function validRaidName(raidName) {
    for (const raid of currentContent.raids) {
        if (raid.name === raidName) {
            return true;
        }
    }
    return false;
}

function validDifficulty(raidName, difficulty) {
    for (const raid of currentContent.raids) {
        if (raid.name === raidName) {
            for (const raidDifficulty of raid.difficulties) {
                if (difficulty === raidDifficulty) {
                    return true;
                }
            }

            return false;
        }
    }
    return false;
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

            case "guildData":
                if (bug.guildIds[log.guildid]) {
                    log[bug.changeKey.key] = bug.changeKey.value;
                    log.guildid = bug.id;
                }
                break;
            case "date":
                if (log.log_id === bug.id) {
                    log[bug.changeKey.key] = bug.changeKey.value;
                }
                break;
            default:
        }
    }

    return log;
}

function cutRecentKills(kills) {
    const timeBoundary = getLatestWednesday(
        new Date(new Date().getTime() - week * 2)
    ).getTime();

    let recentKills = [];

    for (const log of kills) {
        if (log.date * 1000 > timeBoundary) {
            recentKills.push(log);
        } else if (recentKills.length < 50) {
            recentKills.push(log);
        } else {
            break;
        }
    }

    return recentKills;
}

function uniqueLogs(logs) {
    let logIds = {};
    const uniqueLogs = [];
    for (const log of logs) {
        if (!logIds[log.id]) {
            logIds[log.id] = true;
            uniqueLogs.push(log);
        }
    }
    return uniqueLogs;
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

    for (let log of guild.progression.recentKills) {
        if (log.date * 1000 > timeBoundary) {
            let logDate = new Date(log.date * 1000);

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

function getBossCollectionName(id, difficulty, combatMetric) {
    return `${id} ${difficulty} ${combatMetric}`;
}

function getLastLogIds(logs) {
    let lastLogIds = {};

    for (let log of logs) {
        lastLogIds[log.realm] = log.log_id;
    }

    return lastLogIds;
}

function getBossInfo(raidId, bossName) {
    for (const raid of currentContent.raids) {
        if (raid.id === raidId) {
            for (const boss of raid.bosses) {
                if (boss.name === bossName) {
                    return boss;
                }
            }
        }
    }
    return false;
}

function getRaidInfoFromId(raidId) {
    for (const raid of currentContent.raids) {
        if (raid.id === raidId) {
            return raid;
        }
    }
    return false;
}

function getRaidInfoFromName(raidName) {
    for (const raid of currentContent.raids) {
        if (raid.name === raidName) {
            return raid;
        }
    }
    return false;
}

function validBossName(raidId, bossName) {
    for (const raid of currentContent.raids) {
        if (raid.id === raidId) {
            for (const boss of raid.bosses) {
                if (boss.name === bossName) {
                    return true;
                }
            }
        }
    }
    return false;
}

module.exports = {
    getLogs,
    processLogs,
    requestGuildData,
    updateGuildData,
    updateRaidBoss,
    minutesAgo,
    applyCharacterPerformanceRanks,
    calcGuildContentCompletion,
    createCharacterId,
    escapeRegex,
    secsAgo,
    addNestedObjectValue,
    getNestedObjectValue,
    calcTopPercentOfPerformance,
    capitalize,
    validRaidName,
    validBossName,
    validDifficulty,
    logBugHandler,
    recentGuildRaidDays,
    getBossCollectionName,
    getLastLogIds,
    getBossInfo,
    getRaidInfoFromId,
    getRaidInfoFromName,
    addToTotalPerformance
};
