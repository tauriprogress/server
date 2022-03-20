import environment from "../environment";
import { Request, Response, NextFunction } from "express";

import {
    capitalize,
    minutesAgo,
    validRaidId,
    validClass,
    validRealm,
    validRaidName,
    validBossName,
    validCombatMetric,
    validFilters,
    validPage,
    validPageSize,
    validGuildName,
    validCharacterName,
    validLogId,
    validLimit,
    validLeaderboardId,
    validItemids,
    isError,
    validIngameBossId,
} from "../helpers";
import {
    ERR_INVALID_BOSS_ID,
    ERR_INVALID_BOSS_NAME,
    ERR_INVALID_CHARACTER_CLASS,
    ERR_INVALID_CHARACTER_NAME,
    ERR_INVALID_COMBAT_METRIC,
    ERR_INVALID_FILTERS,
    ERR_INVALID_GUILD_NAME,
    ERR_INVALID_ITEM_IDS,
    ERR_INVALID_LEADERBOARD_ID,
    ERR_INVALID_LIMIT,
    ERR_INVALID_LOG_ID,
    ERR_INVALID_PAGE,
    ERR_INVALID_PAGESIZE,
    ERR_INVALID_RAID_ID,
    ERR_INVALID_RAID_NAME,
} from "../helpers/errors";

export async function waitDbCache(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        await req.db.firstCacheLoad;
        next();
    } catch (err) {
        isError;
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetGuild(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validGuildName(req.body.guildName)) throw ERR_INVALID_GUILD_NAME;

        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetCharacter(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validCharacterName(req.body.characterName))
            throw ERR_INVALID_CHARACTER_NAME;

        req.body.characterName = capitalize(req.body.characterName);

        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetCharacterPerformance(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validCharacterName(req.body.characterName))
            throw ERR_INVALID_CHARACTER_NAME;

        req.body.characterName = capitalize(req.body.characterName);

        if (!validClass(req.body.characterClass))
            throw ERR_INVALID_CHARACTER_CLASS;

        if (!validRaidName(req.body.raidName)) throw ERR_INVALID_RAID_NAME;

        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetRaidSummary(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validRaidId(req.body.raidId)) throw ERR_INVALID_RAID_ID;
        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetBossKillCount(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validIngameBossId(req.body.ingameBossId, req.body.difficulty))
            throw ERR_INVALID_BOSS_ID;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetBossRecentKills(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validIngameBossId(req.body.ingameBossId, req.body.difficulty))
            throw ERR_INVALID_BOSS_ID;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetBossFastestKills(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validIngameBossId(req.body.ingameBossId, req.body.difficulty))
            throw ERR_INVALID_BOSS_ID;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetBossCharacters(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validRaidId(req.body.raidId)) throw ERR_INVALID_RAID_ID;

        if (!validFilters(req.body.raidId, req.body.filters))
            throw ERR_INVALID_FILTERS;

        if (
            !validIngameBossId(
                req.body.ingameBossId,
                req.body.filters.difficulty
            )
        )
            throw ERR_INVALID_BOSS_ID;

        if (!validCombatMetric(req.body.combatMetric))
            throw ERR_INVALID_COMBAT_METRIC;

        if (!validPage(req.body.page)) throw ERR_INVALID_PAGE;

        if (!validPageSize(req.body.pageSize)) throw ERR_INVALID_PAGESIZE;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetLog(req: Request, res: Response, next: NextFunction) {
    try {
        if (!validLogId(req.body.logId)) throw ERR_INVALID_LOG_ID;

        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyCharacterRecentKills(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        if (!validCharacterName(req.body.characterName))
            throw ERR_INVALID_CHARACTER_NAME;

        req.body.characterName = capitalize(req.body.characterName);

        if (
            typeof req.body.logId !== "undefined" &&
            !validLogId(req.body.logId)
        )
            throw ERR_INVALID_LOG_ID;

        if (
            typeof req.body.limit !== "undefined" &&
            !validLimit(req.body.limit)
        )
            throw ERR_INVALID_LIMIT;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyCharacterLeaderboard(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validLeaderboardId(req.body.dataId))
            throw ERR_INVALID_LEADERBOARD_ID;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
    }
}

export function verifyGetItems(
    req: Request,
    res: Response,
    next: NextFunction
) {
    try {
        if (!validRealm(req.body.realm)) {
            req.body.realm = environment.defaultRealm;
        }

        if (!validItemids(req.body.ids)) throw ERR_INVALID_ITEM_IDS;

        next();
    } catch (err) {
        res.send({
            success: false,
            errorstring: isError(err) ? err.message : err,
        });
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
