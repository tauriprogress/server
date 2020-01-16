const { raids } = require("tauriprogress-constants/currentContent");
const { realms, characterClasses } = require("tauriprogress-constants");
const { capitalize, validRaidName, minutesAgo } = require("./helpers");

function verifyGetGuild(req, res, next) {
    try {
        if (!req.body.guildName) throw new Error("Invalid guild name.");
        req.body.guildName = req.body.guildName.trim().replace(/\s+/g, " ");
        if (!req.body.realm) {
            req.body.realm = realms["tauri"];
        }
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: err.message
        });
    }
}

function verifyGetPlayer(req, res, next) {
    try {
        if (!req.body.playerName) throw new Error("Invalid player name.");
        req.body.playerName = capitalize(
            req.body.playerName.trim().replace(/\s+/g, " ")
        );

        if (!req.body.realm) {
            req.body.realm = realms["tauri"];
        }
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function verifyGetPlayerPerformance(req, res, next) {
    try {
        if (!req.body.playerName) throw new Error("Invalid player name.");
        req.body.playerName = capitalize(
            req.body.playerName.trim().replace(/\s+/g, " ")
        );

        if (req.body.raidName)
            req.body.raidName = req.body.raidName.trim().replace(/\s+/g, " ");

        if (!req.body.characterClass || !validClass(req.body.characterClass))
            throw new Error("Invalid player class");

        if (!validRaidName(req.body.raidName))
            throw new Error("Invalid raid name.");

        if (req.body.bossName)
            req.body.bossName = req.body.bossName.trim().replace(/\s+/g, " ");

        if (
            req.body.bossName &&
            !validBossName(req.body.raidName, req.body.bossName)
        )
            throw new Error("Invalid boss name.");

        if (
            req.body.difficulty &&
            validDifficulty(req.body.raidName, req.body.difficulty)
        )
            throw new Error("Invalid difficulty option.");

        if (!req.body.realm) {
            req.body.realm = realms["tauri"];
        }
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function verifyGetRaid(req, res, next) {
    try {
        if (req.body.raidName)
            req.body.raidName = req.body.raidName.trim().replace(/\s+/g, " ");

        if (!validRaidName(req.body.raidName))
            throw new Error("Invalid raid name.");

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: err.message
        });
    }
}

function verifyGetboss(req, res, next) {
    try {
        if (req.body.raidName)
            req.body.raidName = req.body.raidName.trim().replace(/\s+/g, " ");

        if (!validRaidName(req.body.raidName))
            throw new Error("Invalid raid name.");

        if (!req.body.bossName) throw new Error("Invalid boss name.");
        req.body.bossName = req.body.bossName.trim().replace(/\s+/g, " ");

        if (!validBossName(req.body.raidName, req.body.bossName))
            throw new Error("Invalid boss name.");

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function verifyGetLog(req, res, next) {
    try {
        if (!req.body.logId) throw new Error("Invalid log id name.");
        req.body.logId = req.body.logId.trim().replace(/\s+/g, " ");

        if (!req.body.realm) req.body.realm = realms["tauri"];
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function verifyPlayerBossKills(req, res, next) {
    try {
        if (req.body.realm)
            req.body.realm = req.body.realm.trim().replace(/\s+/g, " ");

        if (!validRealm(req.body.realm)) throw new Error("Invalid raid name.");

        if (!req.body.playerName) throw new Error("Invalid player name.");
        req.body.playerName = req.body.playerName.trim().replace(/\s+/g, " ");

        if (req.body.logId) {
            if (typeof req.body.logId !== "number")
                throw new Error("The log ID must be a number.");
        }

        if (req.body.limit) {
            if (typeof req.body.limit !== "number")
                throw new Error("The limit must be a number.");
        }

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function verifyGetItem(req, res, next) {
    try {
        if (req.body.realm)
            req.body.realm = req.body.realm.trim().replace(/\s+/g, " ");

        if (!validRealm(req.body.realm)) throw new Error("Invalid raid name.");

        if (!req.body.logId || typeof req.body.logId !== "number")
            throw new Error("Invalid item id");

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function validBossName(raidName, bossName) {
    let { encounters } = require(`tauriprogress-constants/${raidName}`);
    for (let encounter of encounters) {
        if (encounter.encounter_name === bossName) {
            return true;
        }
    }
    return false;
}

function validRealm(realm) {
    for (let key in realms) {
        if (realms[key] === realm) {
            return true;
        }
    }

    return false;
}

function validDifficulty(raidName, difficulty) {
    let raidDiffs = {};
    for (let raid of raids) {
        if (raid.raidName === raidName) {
            raidDiffs = raid.difficulties;
            break;
        }
    }
    if (!raidDiffs[difficulty]) return false;

    return true;
}

function validClass(characterClass) {
    for (let validClass in characterClasses) {
        if (validClass == characterClass) return true;
    }
    return false;
}

function collectStats(db) {
    return (req, res, next) => {
        let ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;

        db.saveReqStats(req.url, ip.split(",")[0], new Date());
        next();
    };
}

function updateDatabase(db) {
    return (req, res, next) => {
        if (minutesAgo(db.lastUpdated) > 5) {
            try {
                db.update();
            } catch (err) {
                console.error(err);
            }
        }
        next();
    };
}

module.exports = {
    verifyGetGuild,
    verifyGetPlayer,
    verifyGetRaid,
    verifyGetboss,
    verifyGetLog,
    verifyPlayerBossKills,
    verifyGetPlayerPerformance,
    collectStats,
    updateDatabase,
    verifyGetItem
};
