const {
    durumuId,
    realms,
    specs,
    specToClass,
    valuesCorrectSince,
    shortRealms,
    raceToFaction
} = require("tauriprogress-constants");
const {
    raidName,
    totalBosses,
    raids,
    lastBoss
} = require("tauriprogress-constants/currentContent");
const tauriApi = require("./tauriApi");

async function getRaidBossLogs(bossId, difficulty, lastLogDate = 0) {
    return new Promise(async (resolve, reject) => {
        try {
            let bossLogs = [];
            let logs = [];
            let data;

            for (let key in realms) {
                do {
                    try {
                        data = await tauriApi.getRaidRank(
                            realms[key],
                            bossId,
                            difficulty
                        );
                    } catch (err) {
                        data = err.message;
                    }
                } while (!data.success && data === "request timed out");
                if (!data.success) throw new Error(data.errorstring);

                bossLogs = bossLogs.concat(
                    data.response.logs.map(log => ({
                        ...log,
                        realm: realms[key]
                    }))
                );
            }

            for (let log of bossLogs) {
                if (lastLogDate < log.killtime) {
                    let bossData;
                    do {
                        try {
                            bossData = await tauriApi.getRaidLog(
                                log.realm,
                                log.log_id
                            );
                        } catch (err) {
                            bossData = err.message;
                        }
                    } while (
                        !bossData.success &&
                        bossData === "request timed out"
                    );
                    if (!bossData.success)
                        throw new Error(bossData.errorstring);

                    logs.push({ ...bossData.response, realm: log.realm });
                }
            }

            resolve({
                logs,
                difficulty
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

function processRaidBossLogs({ logs, difficulty }) {
    let raidBoss = {
        bossName: "",
        latestKills: [],
        firstKills: [],
        fastestKills: [],
        dps: {},
        hps: {},
        bestDps: {
            dps: 0
        },
        bestHps: {
            hps: 0
        },
        killCount: 0,
        lastLogDate: 0,
        difficulty
    };
    let guilds = {};
    let bossId;
    if (logs[0]) raidBoss.bossName = logs[0].encounter_data.encounter_name;
    if (logs[0]) bossId = logs[0].encounter_data.encounter_id;

    for (let log of logs) {
        // get thru all the kill logs
        raidBoss.killCount += 1;
        let guildId;
        if (log.guildid) {
            // if the kill is done by a guild
            guildId = `${log.realm} ${log.guilddata.name}`;

            if (!guilds[guildId]) {
                // if there is no guild data yet create it
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

                if (raidBoss.bestDps.dps < playerDps) {
                    raidBoss.bestDps = processedMember;
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

                if (raidBoss.bestHps.hps < playerHps) {
                    raidBoss.bestHps = processedMember;
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

    raidBoss.latestKills = raidBoss.latestKills
        .concat(logs.sort((a, b) => b.killtime - a.killtime))
        .slice(0, 50)
        .map(log => ({
            log_id: log.log_id,
            guilddata: {
                name: log.guilddata.name,
                faction: log.guilddata.faction
            },
            fight_time: log.fight_time,
            realm: log.realm,
            killtime: log.killtime
        }));

    raidBoss.firstKills = raidBoss.firstKills
        .concat(logs.sort((a, b) => a.killtime - b.killtime))
        .slice(0, 3);

    raidBoss.fastestKills = raidBoss.fastestKills
        .concat(logs.sort((a, b) => a.fight_time - b.fight_time))
        .slice(0, 50)
        .map(log => ({
            log_id: log.log_id,
            guilddata: {
                name: log.guilddata.name,
                faction: log.guilddata.faction
            },
            fight_time: log.fight_time,
            realm: log.realm,
            killtime: log.killtime
        }));

    raidBoss.lastLogDate = raidBoss.latestKills[0].killtime;
    raidBoss.lastUpdated = new Date().getTime() / 1000;

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
        }
    };

    for (let raid of raids) {
        newGuild.progression[raid.raidName] = {};
        for (let diff in raid.difficulties) {
            newGuild.progression[raid.raidName][diff] = {};
        }
    }

    return newGuild;
}

function mergeBossKillIntoGuildData(guildData, bossKill, difficulty) {
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

function calcGuildContentCompletition(guild) {
    let bossesDefeated = {};
    let currentBossesDefeated = 0;

    for (let diff in guild.progression[raidName]) {
        if (!bossesDefeated[diff]) bossesDefeated[diff] = 0;

        for (let boss in guild.progression[raidName][diff]) {
            bossesDefeated[diff]++;
        }

        if (bossesDefeated[diff] > currentBossesDefeated)
            currentBossesDefeated = bossesDefeated[diff];

        if (bossesDefeated[diff] === totalBosses) {
            guild.progression.completed = !guild.progression.completed
                ? guild.progression[raidName][diff][lastBoss].firstKill
                : guild.progression.completed <
                  guild.progression[raidName][diff][lastBoss].firstKill
                ? guild.progression.completed
                : guild.progression[raidName][diff][lastBoss].firstKill;
        }
    }

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
        firstKills: oldRaidBoss.firstKills
            .concat(newRaidBoss.firstKill)
            .sort((a, b) => a.killtime - b.killtime)
            .slice(0, 3),
        fastestKills: oldRaidBoss.fastestKills
            .concat(newRaidBoss.fastestKills)
            .sort((a, b) => a.fight_time - b.fight_time)
            .slice(0, 50),
        killCount: oldRaidBoss.killCount + newRaidBoss.killCount,
        lastLogDate: newRaidBoss.lastLogDate,
        lastUpdated: newRaidBoss.lastUpdated
    };

    for (let key in newRaidBoss.dps) {
        let member = newRaidBoss.dps[key];

        if (updatedRaidBoss.bestDps.dps < member.dps) {
            updatedRaidBoss.bestDps = member;
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

        if (updatedRaidBoss.bestHps.hps < member.hps) {
            updatedRaidBoss.bestHps = member;
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

    for (let dpsKey in raidBoss.dps) {
        dpsArr.push({ ...raidBoss.dps[dpsKey], key: dpsKey });
    }

    for (let hpsKey in raidBoss.hps) {
        hpsArr.push({ ...raidBoss.hps[hpsKey], key: hpsKey });
    }

    dpsArr = dpsArr.sort((a, b) => b.dps - a.dps);
    hpsArr = hpsArr.sort((a, b) => b.hps - a.hps);

    for (let i = 0; i < dpsArr.length; i++) {
        raidBoss.dps[dpsArr[i].key].rank = i + 1;
    }

    for (let i = 0; i < hpsArr.length; i++) {
        raidBoss.hps[hpsArr[i].key].rank = i + 1;
    }

    return raidBoss;
}

function whenWas(date) {
    return Math.round((new Date().getTime() / 1000 - Number(date)) / 60);
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

function getBossId(raidData, bossName) {
    return raidData.encounters.reduce((acc, boss) => {
        if (boss.encounter_name === bossName) acc = boss.encounter_id;
        return acc;
    }, null);
}

module.exports = {
    getRaidBossLogs,
    processRaidBossLogs,
    createGuildData,
    mergeBossKillIntoGuildData,
    updateRaidBoss,
    whenWas,
    applyPlayerPerformanceRanks,
    calcGuildContentCompletition,
    createMemberId,
    escapeRegex,
    getBossId
};
