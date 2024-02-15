import { NextFunction, Request, Response } from "express";
import environment from "../environment";

import { raidNameId } from "tauriprogress-constants";
import dbInterface from "../database/DBInterface";
import { capitalize, patreonUser, validator } from "../helpers";
import {
    ERR_INVALID_BOSS_ID,
    ERR_INVALID_CHARACTER_CLASS,
    ERR_INVALID_CHARACTER_NAME,
    ERR_INVALID_CODE,
    ERR_INVALID_COMBAT_METRIC,
    ERR_INVALID_DIFFICULTY,
    ERR_INVALID_FILTERS,
    ERR_INVALID_GUILD_NAME,
    ERR_INVALID_ITEM_IDS,
    ERR_INVALID_LIMIT,
    ERR_INVALID_LOG_ID,
    ERR_INVALID_PAGE,
    ERR_INVALID_PAGESIZE,
    ERR_INVALID_RAID_ID,
    ERR_INVALID_RAID_NAME,
    ERR_NOT_LOGGED_IN,
} from "../helpers/errors";
import { RaidName } from "../types";
import PatreonApi from "../patreonApi";
import cipher from "../helpers/cipher";
import * as jwt from "jsonwebtoken";
import * as cookie from "cookie";

class Middlewares {
    async waitDbCache(_1: Request, res: Response, next: NextFunction) {
        try {
            await dbInterface.raidboss.firstRaidbossCacheLoad;
            next();
        } catch (err) {
            validator.isError;
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetGuild(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validGuildName(req.body.guildName))
                throw ERR_INVALID_GUILD_NAME;

            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetCharacter(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validCharacterName(req.body.characterName))
                throw ERR_INVALID_CHARACTER_NAME;

            req.body.characterName = capitalize(req.body.characterName);

            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetCharacterPerformance(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            if (!validator.validCharacterName(req.body.characterName))
                throw ERR_INVALID_CHARACTER_NAME;

            req.body.characterName = capitalize(req.body.characterName);

            if (!validator.validClass(req.body.characterClass))
                throw ERR_INVALID_CHARACTER_CLASS;

            if (!validator.validRaidName(req.body.raidName))
                throw ERR_INVALID_RAID_NAME;

            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetRaidSummary(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validRaidId(req.body.raidId))
                throw ERR_INVALID_RAID_ID;
            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetBossKillCount(req: Request, res: Response, next: NextFunction) {
        try {
            if (
                !validator.validIngameBossId(
                    req.body.ingameBossId,
                    req.body.difficulty
                )
            )
                throw ERR_INVALID_BOSS_ID;

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetBossLatestKills(req: Request, res: Response, next: NextFunction) {
        try {
            if (
                !validator.validIngameBossId(
                    req.body.ingameBossId,
                    req.body.difficulty
                )
            )
                throw ERR_INVALID_BOSS_ID;

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetBossFastestKills(req: Request, res: Response, next: NextFunction) {
        try {
            if (
                !validator.validIngameBossId(
                    req.body.ingameBossId,
                    req.body.difficulty
                )
            )
                throw ERR_INVALID_BOSS_ID;

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetBossCharacters(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validRaidId(req.body.raidId))
                throw ERR_INVALID_RAID_ID;

            if (!validator.validFilters(req.body.raidId, req.body.filters))
                throw ERR_INVALID_FILTERS;

            if (
                !validator.validIngameBossId(
                    req.body.ingameBossId,
                    req.body.filters.difficulty
                )
            )
                throw ERR_INVALID_BOSS_ID;

            if (!validator.validCombatMetric(req.body.combatMetric))
                throw ERR_INVALID_COMBAT_METRIC;

            if (!validator.validPage(req.body.page)) throw ERR_INVALID_PAGE;

            if (!validator.validPageSize(req.body.pageSize))
                throw ERR_INVALID_PAGESIZE;

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetLog(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validRaidLogId(req.body.logId))
                throw ERR_INVALID_LOG_ID;

            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyCharacterRecentKills(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            if (!validator.validCharacterName(req.body.characterName))
                throw ERR_INVALID_CHARACTER_NAME;

            req.body.characterName = capitalize(req.body.characterName);

            if (
                typeof req.body.logId !== "undefined" &&
                !validator.validRaidLogId(req.body.logId)
            )
                throw ERR_INVALID_LOG_ID;

            if (
                typeof req.body.limit !== "undefined" &&
                !validator.validLimit(req.body.limit)
            )
                throw ERR_INVALID_LIMIT;

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyCharacterLeaderboard(
        req: Request,
        res: Response,
        next: NextFunction
    ) {
        try {
            if (!validator.validRaidName(req.body.raidName))
                throw ERR_INVALID_RAID_NAME;
            const raidId = raidNameId[req.body.raidName as RaidName];

            if (!validator.validFilters(raidId, req.body.filters))
                throw ERR_INVALID_FILTERS;
            if (!validator.validDifficulty(raidId, req.body.filters.difficulty))
                throw ERR_INVALID_DIFFICULTY;

            if (!validator.validCombatMetric(req.body.combatMetric))
                throw ERR_INVALID_COMBAT_METRIC;

            if (!validator.validPage(req.body.page)) throw ERR_INVALID_PAGE;

            if (!validator.validPageSize(req.body.pageSize))
                throw ERR_INVALID_PAGESIZE;

            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }
            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyGetItems(req: Request, res: Response, next: NextFunction) {
        try {
            if (!validator.validRealm(req.body.realm)) {
                req.body.realm = environment.defaultRealm;
            }

            if (!validator.validItems(req.body.items))
                throw ERR_INVALID_ITEM_IDS;

            req.body.isEntry = !!req.body.isEntry;
            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    verifyLogin(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.body.code || typeof req.body.code !== "string") {
                throw ERR_INVALID_CODE;
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    attachUser(req: Request, res: Response, next: NextFunction) {
        try {
            const user = patreonUser.decodeUser(req);

            if (user) {
                req.user = user;
            } else {
                req.user = {
                    invalid: "invalid",
                };
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }

    async verifyUser(req: Request, res: Response, next: NextFunction) {
        try {
            if (!req.user || (req.user && "invalid" in req.user)) {
                throw ERR_NOT_LOGGED_IN;
            }

            const api = new PatreonApi();

            if (patreonUser.isExpired(req.user)) {
                try {
                    const authResponse = await api.refreshToken(
                        cipher.decrypt(req.user.encryptedRefreshToken)
                    );
                    const userInfoResponse = await api.getUserInfo(
                        authResponse.access_token
                    );
                    const newUserInfo = patreonUser.getUserData(
                        authResponse,
                        userInfoResponse
                    );

                    const token = jwt.sign(
                        newUserInfo,
                        environment.ENCRYPTION_KEY
                    );

                    res.setHeader(
                        "Set-Cookie",
                        cookie.serialize("user", token)
                    );
                    next();
                } catch (e) {
                    throw ERR_NOT_LOGGED_IN;
                }
            }

            const newUserInfo = await api.getUserInfo(
                cipher.decrypt(req.user.encryptedToken)
            );
            if (!patreonUser.isSameUser(req.user, newUserInfo)) {
                throw ERR_NOT_LOGGED_IN;
            }

            if (req.user.isMember !== patreonUser.isMember(newUserInfo)) {
                req.user.isMember === patreonUser.isMember(newUserInfo);
            }

            next();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    }
}

export const middlewares = new Middlewares();

export default middlewares;
