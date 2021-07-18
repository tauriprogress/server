import { environment } from "../environment";
import { Request, Response, NextFunction } from "express";

import {
    validRaidId,
    validClass,
    validRealm,
    validRaidName,
    validBossName,
    validDifficulty
} from "../helpers";

const { capitalize, minutesAgo } = require("../helpers");

export async function waitDbCache(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        await req.db.firstCacheLoad;
        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyGetGuild(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.body.guildName) throw new Error("Invalid guild name.");
        req.body.guildName = req.body.guildName.trim().replace(/\s+/g, " ");
        if (!req.body.realm) {
            req.body.realm = environment.defaultRealm;
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

export function verifyGetCharacter(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.body.characterName) throw new Error("Invalid character name.");
        req.body.characterName = capitalize(
            req.body.characterName.trim().replace(/\s+/g, " ")
        );

        if (!req.body.realm) {
            req.body.realm = environment.defaultRealm;
        }
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyGetCharacterPerformance(
    req: Request,
    res: Response,
    next: NextFunction
) {
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
            req.body.realm = environment.defaultRealm;
        }
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");
        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyGetRaidSummary(
    req: Request,
    res: Response,
    next: NextFunction
) {
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

export function verifyGetBoss(req: Request, res: Response, next: NextFunction) {
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

export function verifyGetBossKillCount(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.body.raidId || !validRaidId(req.body.raidId))
            throw new Error(`${req.body.raidId} is not a valid raid id.`);

        if (
            !req.body.bossName ||
            !validBossName(req.body.raidId, req.body.bossName)
        )
            throw new Error(`${req.body.bossName} is not a valid boss name.`);

        if (
            !req.body.difficulty ||
            !validDifficulty(req.body.raidId, req.body.difficulty)
        )
            throw new Error(`${req.body.difficulty} is not valid difficulty.`);

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyGetBossRecentKills(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.body.raidId || !validRaidId(req.body.raidId))
            throw new Error(`${req.body.raidId} is not a valid raid id.`);

        if (
            !req.body.bossName ||
            !validBossName(req.body.raidId, req.body.bossName)
        )
            throw new Error(`${req.body.bossName} is not a valid boss name.`);

        if (
            !req.body.difficulty ||
            !validDifficulty(req.body.raidId, req.body.difficulty)
        )
            throw new Error(`${req.body.difficulty} is not valid difficulty.`);

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyGetLog(req: Request, res: Response, next: NextFunction) {
    try {
        if (!req.body.logId) throw new Error("Invalid log id name.");
        req.body.logId = req.body.logId.trim().replace(/\s+/g, " ");

        if (!req.body.realm) req.body.realm = environment.defaultRealm;
        req.body.realm = req.body.realm.trim();
        if (!validRealm(req.body.realm)) throw new Error("Invalid realm name.");

        next();
    } catch (err) {
        res.send({ success: false, errorstring: err.message });
    }
}

export function verifyCharacterRecentKills(
    req: Request,
    res: Response,
    next: NextFunction
) {
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

export function verifyCharacterLeaderboard(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!req.body.dataId)
            throw new Error(
                `${req.body.dataId} is not a valid leaderboard id.`
            );

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: err.message
        });
    }
}

export function verifyGetItems(
    req: Request,
    res: Response,
    next: NextFunction
) {
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

export function updateDatabase(req: Request, _1: Response, next: NextFunction) {
    if (minutesAgo(req.db.lastUpdated) > 30 && !req.db.isUpdating) {
        try {
            req.db.updateDatabase(false);
        } catch (err) {
            console.log(err);
        }
    }
    next();
}
