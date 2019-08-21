const {
    durumuId,
    realms,
    specs,
    specToClass,
    valuesCorrectSince,
    shortRealms,
    raceToFaction,
    classToSpec
} = require("tauriprogress-constants");
const {
    raidName,
    totalBosses,
    raids,
    lastBoss
} = require("tauriprogress-constants/currentContent");
const tauriApi = require("./tauriApi");

let raidNames = {};
let difficulties = {};
for (let raid of raids) {
    raidNames[raid.raidName] = true;
    difficulties[raid.raidName] = raid.difficulties;
}

async function getCategorizedLogs(lastLogIds = {}) {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs = [];
            let logs = {};
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
                    !invalidDurumu(
                        log.encounter_data.encounter_id,
                        log.killtime
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

                    let categorization = [
                        log.mapentry.name,
                        log.encounter_data.encounter_name,
                        log.difficulty
                    ];
                    let categorizedLogs = getNestedObjectValue(
                        logs,
                        categorization
                    );
                    let currentLog = { ...logData.response, realm: log.realm };

                    logs = addNestedObjectValue(
                        logs,
                        categorization,
                        categorizedLogs
                            ? [...categorizedLogs, currentLog]
                            : [currentLog]
                    );

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

function createGuildBossKill(kill) {
    return {
        raidName: kill.mapentry.name,
        bossName: kill.encounter_data.encounter_name,
        realm: kill.realm,
        guildName: kill.guilddata.name,
        firstKill: kill.killtime,
        killCount: 1,
        fastestKill: kill.fight_time,
        fastestKills: [
            {
                log_id: kill.log_id,
                fight_time: kill.fight_time,
                killtime: kill.killtime,
                realm: kill.realm
            }
        ],
        dps: {},
        hps: {}
    };
}

function updateGuildBossKill(guild, kill) {
    return {
        ...guild,
        killCount: guild.killCount + 1,
        firstKill:
            kill.killtime > guild.firstKill ? guild.firstKill : kill.killtime,
        fastestKill:
            kill.fight_time > guild.fastestKill
                ? guild.fastestKill
                : kill.fight_time,
        fastestKills: guild.fastestKills
            .concat({
                log_id: kill.log_id,
                fight_time: kill.fight_time,
                killtime: kill.killtime,
                realm: kill.realm
            })
            .sort((a, b) => a.fight_time - b.fight_time)
            .slice(0, 10)
    };
}

function getDps({ dmg_done }, { fight_time }) {
    return dmg_done / (fight_time / 1000);
}

function memberDps(realm, member, kill, dps) {
    return {
        name: member.name,
        spec: member.spec,
        class: specToClass[member.spec],
        realm: realm,
        ilvl: member.ilvl,
        date: kill.killtime,
        dps: dps,
        logId: kill.log_id,
        faction: raceToFaction[member.race]
    };
}

function getHps({ heal_done, absorb_done }, { fight_time }) {
    return (heal_done + absorb_done) / (fight_time / 1000);
}

function memberHps(realm, member, kill, hps) {
    return {
        name: member.name,
        spec: member.spec,
        class: specToClass[member.spec],
        realm: realm,
        ilvl: member.ilvl,
        date: kill.killtime,
        hps: hps,
        logId: kill.log_id,
        faction: raceToFaction[member.race]
    };
}

function processRaidBossLogs(logs, bossName, difficulty) {
    let raidBoss = {
        bossName: bossName,
        latestKills: [],
        firstKills: {},
        fastestKills: {},
        dps: {},
        hps: {},
        bestDps: {},
        bestHps: {},
        killCount: 0,
        difficulty
    };
    let guilds = {};
    let bossId;
    if (logs[0]) bossId = logs[0].encounter_data.encounter_id;

    for (let log of logs) {
        raidBoss.killCount += 1;
        let guildId;
        if (log.guildid) {
            guildId = `${log.realm} ${log.guilddata.name}`;

            if (!guilds[guildId]) {
                guilds[guildId] = createGuildBossKill(log);
            } else {
                guilds[guildId] = updateGuildBossKill(guilds[guildId], log);
            }
        }

        for (let member of log.members) {
            const memberId = createMemberId(
                log.realm,
                member.name,
                member.spec
            );

            if (specs[member.spec].isDps) {
                const playerDps = invalidDurumu(bossId, log.killtime)
                    ? true
                    : getDps(member, log);

                const processedMember = memberDps(
                    log.realm,
                    member,
                    log,
                    playerDps
                );

                const processedMemberCategorization = [
                    processedMember.realm,
                    processedMember.faction,
                    processedMember.class,
                    processedMember.spec
                ];

                if (
                    processedMember.dps >
                    getNestedObjectValue(raidBoss.bestDps, [
                        ...processedMemberCategorization,
                        "dps"
                    ])
                ) {
                    raidBoss.bestDps = addNestedObjectValue(
                        raidBoss.bestDps,
                        processedMemberCategorization,
                        processedMember
                    );
                }

                if (
                    log.guildid &&
                    (!guilds[guildId].dps[memberId] ||
                        guilds[guildId].dps[memberId].dps < playerDps)
                ) {
                    guilds[guildId].dps[memberId] = processedMember;
                }

                if (
                    !raidBoss.dps[memberId] ||
                    raidBoss.dps[memberId].dps < playerDps
                ) {
                    raidBoss.dps[memberId] = processedMember;
                }
            }

            if (specs[member.spec].isHealer) {
                const playerHps = getHps(
                    {
                        ...member,
                        absorb_done:
                            valuesCorrectSince < log.killtime
                                ? member.absorb_done
                                : 0
                    },
                    log
                );

                const processedMember = memberHps(
                    log.realm,
                    member,
                    log,
                    playerHps
                );

                const processedMemberCategorization = [
                    processedMember.realm,
                    processedMember.faction,
                    processedMember.class,
                    processedMember.spec
                ];

                if (
                    processedMember.hps >
                    getNestedObjectValue(raidBoss.bestHps, [
                        ...processedMemberCategorization,
                        "hps"
                    ])
                ) {
                    raidBoss.bestHps = addNestedObjectValue(
                        raidBoss.bestHps,
                        processedMemberCategorization,
                        processedMember
                    );
                }

                if (
                    log.guildid &&
                    (!guilds[guildId].hps[memberId] ||
                        guilds[guildId].hps[memberId].hps < playerHps)
                ) {
                    guilds[guildId].hps[memberId] = processedMember;
                }

                if (
                    !raidBoss.hps[memberId] ||
                    raidBoss.hps[memberId].hps < playerHps
                ) {
                    raidBoss.hps[memberId] = processedMember;
                }
            }
        }
    }

    for (let log of logs.sort((a, b) => a.killtime - b.killtime)) {
        let logCategorization = [log.realm, raceToFaction[log.members[0].race]];

        let firstKillsOfCategory = getNestedObjectValue(
            raidBoss.firstKills,
            logCategorization
        );

        if (!firstKillsOfCategory) {
            raidBoss.firstKills = addNestedObjectValue(
                raidBoss.firstKills,
                logCategorization,
                [log]
            );
        } else {
            raidBoss.firstKills = addNestedObjectValue(
                raidBoss.firstKills,
                logCategorization,
                firstKillsOfCategory.concat(log)
            );
        }
    }

    for (let realm in raidBoss.firstKills) {
        for (let faction in raidBoss.firstKills[realm]) {
            let objectKeys = [realm, faction];
            raidBoss.firstKills = addNestedObjectValue(
                raidBoss.firstKills,
                objectKeys,
                getNestedObjectValue(raidBoss.firstKills, objectKeys)
                    .sort((a, b) => a.killtime - b.killtime)
                    .slice(0, 3)
            );
        }
    }

    for (let log of logs.sort((a, b) => a.fight_time - b.fight_time)) {
        let logCategorization = [log.realm, raceToFaction[log.members[0].race]];

        let fastestKillsOfCategory = getNestedObjectValue(
            raidBoss.fastestKills,
            logCategorization
        );

        if (!fastestKillsOfCategory) {
            raidBoss.fastestKills = addNestedObjectValue(
                raidBoss.fastestKills,
                logCategorization,
                [
                    {
                        log_id: log.log_id,
                        guilddata: {
                            name: log.guilddata.name,
                            faction: log.guilddata.faction
                        },
                        fight_time: log.fight_time,
                        realm: log.realm,
                        killtime: log.killtime
                    }
                ]
            );
        } else {
            raidBoss.fastestKills = addNestedObjectValue(
                raidBoss.fastestKills,
                logCategorization,
                fastestKillsOfCategory.concat({
                    log_id: log.log_id,
                    guilddata: {
                        name: log.guilddata.name,
                        faction: log.guilddata.faction
                    },
                    fight_time: log.fight_time,
                    realm: log.realm,
                    killtime: log.killtime
                })
            );
        }
    }

    for (let realm in raidBoss.fastestKills) {
        for (let faction in raidBoss.fastestKills[realm]) {
            let objectKeys = [realm, faction];
            raidBoss.fastestKills = addNestedObjectValue(
                raidBoss.fastestKills,
                objectKeys,
                getNestedObjectValue(raidBoss.fastestKills, objectKeys)
                    .sort((a, b) => a.fight_time - b.fight_time)
                    .slice(0, 50)
            );
        }
    }

    raidBoss.latestKills = raidBoss.latestKills
        .concat(
            logs
                .sort((a, b) => b.killtime - a.killtime)
                .map(log => ({
                    log_id: log.log_id,
                    guilddata: {
                        name: log.guilddata.name,
                        faction: log.guilddata.faction
                    },
                    fight_time: log.fight_time,
                    realm: log.realm,
                    killtime: log.killtime
                }))
        )
        .slice(0, 50);

    return {
        raidBoss,
        guildBossKills: guilds
    };
}

async function createGuildData(realm, guildName) {
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

    let kills;

    do {
        try {
            kills = await tauriApi.getRaidGuild(realm, guildName);
        } catch (err) {
            kills = err.message;
        }
    } while (!kills.success && kills === "request timed out");
    if (!kills.success) throw new Error(kills.errorstring);

    kills = kills.response.logs.slice(0, 50).map(log => ({
        log_id: log.log_id,
        mapentry: log.mapentry,
        encounter_data: log.encounter_data,
        difficulty: log.difficulty,
        fight_time: log.fight_time,
        killtime: log.killtime
    }));

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
        guildList: guildList,
        progression: {
            latestKills: kills,
            currentBossesDefeated: 0,
            completed: false
        },
        exists: true
    };

    for (let raid of raids) {
        newGuild.progression[raid.raidName] = {};
        for (let diff in raid.difficulties) {
            newGuild.progression[raid.raidName][diff] = {};
        }
    }

    return newGuild;
}

function mergeBossKillsOfGuildIntoGuildData(guildData, bossKill, difficulty) {
    delete bossKill.bestDps;
    delete bossKill.bestHps;
    delete bossKill.latestKills;

    let bossOfGuild =
        guildData.progression[bossKill.raidName][difficulty][bossKill.bossName];

    let newGuildData = JSON.parse(JSON.stringify(guildData));

    if (!bossOfGuild) {
        newGuildData.progression[bossKill.raidName][difficulty][
            bossKill.bossName
        ] = bossKill;
    } else {
        newGuildData.progression[bossKill.raidName][difficulty][
            bossKill.bossName
        ].fastestKills = guildData.progression[bossKill.raidName][difficulty][
            bossKill.bossName
        ].fastestKills
            .concat(bossKill.fastestKills)
            .sort((a, b) => a.fight_time - b.fight_time)
            .slice(0, 10);

        let oldDpses =
            guildData.progression[bossKill.raidName][difficulty][
                bossKill.bossName
            ].dps;
        let oldHpses =
            guildData.progression[bossKill.raidName][difficulty][
                bossKill.bossName
            ].hps;

        for (let key in bossKill.dps) {
            let member = bossKill.dps[key];

            if (!oldDpses[key] || oldDpses[key].dps < member.dps) {
                newGuildData.progression[bossKill.raidName][difficulty][
                    bossKill.bossName
                ].dps[key] = member;
            }
        }

        for (let key in bossKill.hps) {
            let member = bossKill.hps[key];
            if (!oldHpses[key] || oldHpses[key].hps < member.hps) {
                newGuildData.progression[bossKill.raidName][difficulty][
                    bossKill.bossName
                ].hps[key] = member;
            }
        }

        newGuildData.progression[bossKill.raidName][difficulty][
            bossKill.bossName
        ] = {
            ...newGuildData.progression[bossKill.raidName][difficulty][
                bossKill.bossName
            ],
            killCount: bossOfGuild.killCount + bossKill.killCount,
            firstKill:
                bossOfGuild.firstKill < bossKill.firstKill
                    ? bossOfGuild.firstKill
                    : bossKill.firstKill,
            fastestKill:
                bossOfGuild.fastestKill < bossKill.fastestKill
                    ? bossOfGuild.fastestKill
                    : bossKill.fastestKill
        };
    }

    return newGuildData;
}

function calcGuildContentCompletion(guild) {
    let bossesDefeated = {};
    let currentBossesDefeated = 0;
    let completed = false;

    for (let diff in guild.progression[raidName]) {
        if (!bossesDefeated[diff]) bossesDefeated[diff] = 0;

        for (let boss in guild.progression[raidName][diff]) {
            bossesDefeated[diff]++;
        }

        if (bossesDefeated[diff] > currentBossesDefeated)
            currentBossesDefeated = bossesDefeated[diff];

        if (bossesDefeated[diff] === totalBosses) {
            completed = !completed
                ? guild.progression[raidName][diff][lastBoss].firstKill
                : completed <
                  guild.progression[raidName][diff][lastBoss].firstKill
                ? completed
                : guild.progression[raidName][diff][lastBoss].firstKill;
        }
    }

    guild.progression.completed = completed;

    guild.progression.currentBossesDefeated = currentBossesDefeated;

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

    for (let realm in newRaidBoss.firstKills) {
        for (let faction in newRaidBoss.firstKills[realm]) {
            let objectKeys = [realm, faction];

            let oldLogs =
                getNestedObjectValue(oldRaidBoss.firstKills, objectKeys) || [];

            let newLogs = getNestedObjectValue(
                newRaidBoss.firstKills,
                objectKeys
            );

            let updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.killtime - b.killtime)
                .slice(0, 3);

            updatedRaidBoss.firstKills = addNestedObjectValue(
                updatedRaidBoss.firstKills,
                objectKeys,
                updatedLogs
            );
        }
    }

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

    for (let key in newRaidBoss.dps) {
        let member = newRaidBoss.dps[key];

        const memberCategorization = [
            member.realm,
            member.faction,
            member.class,
            member.spec
        ];

        if (
            member.dps >
            getNestedObjectValue(updatedRaidBoss.bestDps, [
                ...memberCategorization,
                "dps"
            ])
        ) {
            updatedRaidBoss.bestDps = addNestedObjectValue(
                updatedRaidBoss.bestDps,
                memberCategorization,
                member
            );
        }

        if (
            !updatedRaidBoss.dps[key] ||
            updatedRaidBoss.dps[key].dps < member.dps
        ) {
            updatedRaidBoss.dps[key] = member;
        }
    }

    for (let key in newRaidBoss.hps) {
        let member = newRaidBoss.hps[key];

        const memberCategorization = [
            member.realm,
            member.faction,
            member.class,
            member.spec
        ];

        if (
            member.hps >
            getNestedObjectValue(updatedRaidBoss.bestHps, [
                ...memberCategorization,
                "hps"
            ])
        ) {
            updatedRaidBoss.bestHps = addNestedObjectValue(
                updatedRaidBoss.bestHps,
                memberCategorization,
                member
            );
        }

        if (
            !updatedRaidBoss.hps[key] ||
            updatedRaidBoss.hps[key].hps < member.hps
        ) {
            updatedRaidBoss.hps[key] = member;
        }
    }

    return updatedRaidBoss;
}

function applyPlayerPerformanceRanks(raidBoss) {
    let dpsArr = [];
    let hpsArr = [];
    let dpsSpecs = {};
    let hpsSpecs = {};

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
        raidBoss.dps[dpsArr[i].key].rank = i + 1;
        raidBoss.dps[dpsArr[i].key].specRank = dpsSpecs[dpsArr[i].spec];
    }

    for (let i = 0; i < hpsArr.length; i++) {
        hpsSpecs[hpsArr[i].spec] = hpsSpecs[hpsArr[i].spec]
            ? hpsSpecs[hpsArr[i].spec] + 1
            : 1;
        raidBoss.hps[hpsArr[i].key].rank = i + 1;
        raidBoss.hps[hpsArr[i].key].specRank = hpsSpecs[hpsArr[i].spec];
    }

    return raidBoss;
}

function minutesAgo(time) {
    return Math.round((new Date().getTime() / 1000 - Number(time)) / 60);
}

function secsAgo(time) {
    return Math.round(new Date().getTime() / 1000 - time);
}

function invalidDurumu(bossId, killtime) {
    if (durumuId === bossId && valuesCorrectSince > killtime) {
        return true;
    }
    return false;
}

function createMemberId(realm, name, spec) {
    return `${shortRealms[realm]} ${name} ${spec}`;
}

function escapeRegex(s) {
    return String(s).replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

function getBossId(raidData, bossName, diff = 0) {
    return raidData.encounters.reduce((acc, boss) => {
        if (
            boss.encounter_name === bossName &&
            (boss.encounter_difficulty === 0 ||
                boss.encounter_difficulty === Number(diff))
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

function getBestPerformance(bestPerformances, type, spec) {
    let bestPerformance = 0;

    let perfSpecs = {};

    if (spec) {
        perfSpecs[specToClass[spec]] = [spec];
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

module.exports = {
    getCategorizedLogs,
    processRaidBossLogs,
    createGuildData,
    mergeBossKillsOfGuildIntoGuildData,
    updateRaidBoss,
    minutesAgo,
    applyPlayerPerformanceRanks,
    calcGuildContentCompletion,
    createMemberId,
    escapeRegex,
    getBossId,
    secsAgo,
    addNestedObjectValue,
    getNestedObjectValue,
    getBestPerformance,
    calcTopPercentOfPerformance,
    capitalize,
    validRaidName,
    validDifficulty
};
