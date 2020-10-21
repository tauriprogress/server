const {
    currentContent,
    realms,
    characterClassNames
} = require("./expansionData");
const {
    capitalize,
    validRaidName,
    minutesAgo,
    validBossName
} = require("./helpers");

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

function verifyGetCharacter(req, res, next) {
    try {
        if (!req.body.characterName) throw new Error("Invalid character name.");
        req.body.characterName = capitalize(
            req.body.characterName.trim().replace(/\s+/g, " ")
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

function verifyGetCharacterPerformance(req, res, next) {
    try {
        if (!req.body.characterName) throw new Error("Invalid character name.");
        req.body.characterName = capitalize(
            req.body.characterName.trim().replace(/\s+/g, " ")
        );

        if (req.body.raidName)
            req.body.raidName = req.body.raidName.trim().replace(/\s+/g, " ");

        if (!req.body.characterClass || !validClass(req.body.characterClass))
            throw new Error("Invalid character class");

        if (!validRaidName(req.body.raidName))
            throw new Error("Invalid raid name.");

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

function verifyGetRaidSummary(req, res, next) {
    try {
        if (!req.body.raidId || !validRaidId(req.body.raidId))
            throw new Error(`${req.body.raidId} is not a valid raid id.`);

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: err.message
        });
    }
}

function verifyGetBoss(req, res, next) {
    try {
        if (!req.body.raidId || !validRaidId(req.body.raidId))
            throw new Error(`${req.body.raidId} is not a valid raid id.`);

        if (
            !req.body.bossName ||
            !validBossName(req.body.raidId, req.body.bossName)
        )
            throw new Error(`${req.body.bossName} is not a valid boss name.`);

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

function verifyCharacterRecentKills(req, res, next) {
    try {
        if (req.body.realm)
            req.body.realm = req.body.realm.trim().replace(/\s+/g, " ");

        if (!validRealm(req.body.realm)) throw new Error("Invalid raid name.");

        if (!req.body.characterName) throw new Error("Invalid character name.");
        req.body.characterName = req.body.characterName
            .trim()
            .replace(/\s+/g, " ");

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

function verifyGetItems(req, res, next) {
    try {
        if (req.body.realm)
            req.body.realm = req.body.realm.trim().replace(/\s+/g, " ");

        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        if (!req.body.ids || !Array.isArray(req.body.ids))
            throw new Error("Invalid item ids");

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

function validRaidId(raidId) {
    for (const raid of currentContent.raids) {
        if (raid.id === raidId) {
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

function validClass(characterClass) {
    for (let classId in characterClassNames) {
        if (classId == characterClass) return true;
    }
    return false;
}

function updateDatabase(db) {
    return (req, res, next) => {
        if (minutesAgo(db.lastUpdated) > 5) {
            try {
                db.update();
            } catch (err) {
                console.log(err);
            }
        }
        next();
    };
}

module.exports = {
    verifyGetGuild,
    verifyGetCharacter,
    verifyGetRaidSummary,
    verifyGetBoss,
    verifyGetLog,
    verifyCharacterRecentKills,
    verifyGetCharacterPerformance,
    updateDatabase,
    verifyGetItems
};
