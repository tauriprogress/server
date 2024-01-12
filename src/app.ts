import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";
import * as slowDown from "express-slow-down";
import * as cookie from "cookie";
import * as jwt from "jsonwebtoken";

import dbInterface from "./database/DBInterface";

import tauriApi from "./tauriApi";

import cache from "./database/cache";
import environment from "./environment";
import { patreonUser, validator } from "./helpers";
import { ERR_UNKNOWN } from "./helpers/errors";
import { LooseObject } from "./types";

import { middlewares } from "./middlewares";

import PatreonApi from "./patreonApi";

const patreon = new PatreonApi();

const app = express();

const speedLimiter = slowDown({
    windowMs: 40 * 1000,
    delayAfter: 15,
    delayMs: 300,
    maxDelayMs: 2 * 1000,
});

(async function () {
    await dbInterface.maintenance.start();

    app.use(
        cors({
            origin: environment.CORS_ORIGIN,
            optionsSuccessStatus: 200,
            credentials: true,
        })
    );

    app.use(speedLimiter);

    app.use(bodyParser.json());

    app.post(
        ["/guild", "/getguild"],
        middlewares.verifyGetGuild,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: await dbInterface.guild.getGuild(
                        req.body.realm,
                        req.body.guildName
                    ),
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.get(["/guild/guildlist", "/guildlist"], async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await dbInterface.guild.getGuildList(),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });

    app.post(
        ["/character", "/getcharacter"],
        middlewares.verifyGetCharacter,
        async (req, res) => {
            try {
                let characterData = cache.getCharacter(
                    req.body.characterName,
                    req.body.realm
                );

                if (!characterData) {
                    characterData = (
                        await tauriApi.getCharacterData(
                            req.body.characterName,
                            req.body.realm
                        )
                    ).response;

                    cache.setCharacter(characterData, req.body.realm);
                }

                res.send({
                    success: true,
                    response: { ...characterData },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/character/characterperformance", "/getcharacterperformance"],
        middlewares.waitDbCache,
        middlewares.verifyGetCharacterPerformance,
        async (req, res) => {
            try {
                let performance =
                    await dbInterface.character.getCharacterPerformance(
                        req.body.characterName,
                        req.body.characterClass,
                        req.body.realm,
                        req.body.raidName
                    );
                res.send({
                    success: true,
                    response: { ...performance },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/raidsummary", "/getraidsummary"],
        middlewares.verifyGetRaidSummary,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: await dbInterface.getRaidSummary(req.body.raidId),
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/boss/killcount", "/getboss/killCount"],
        middlewares.waitDbCache,
        middlewares.verifyGetBossKillCount,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: {
                        killCount:
                            await dbInterface.raidboss.getRaidBossKillCount(
                                req.body.ingameBossId,
                                req.body.difficulty
                            ),
                    },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/boss/latestkills", "/getboss/latestKills"],
        middlewares.waitDbCache,
        middlewares.verifyGetBossLatestKills,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: {
                        recentKills:
                            await dbInterface.raidboss.getRaidBossLatestKills(
                                req.body.ingameBossId,
                                req.body.difficulty
                            ),
                    },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/boss/fastestkills", "/getboss/fastestKills"],
        middlewares.waitDbCache,
        middlewares.verifyGetBossFastestKills,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: {
                        fastestKills:
                            await dbInterface.raidboss.getRaidBossFastestKills(
                                req.body.ingameBossId,
                                req.body.difficulty
                            ),
                    },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/boss/characters", "/getboss/characters"],
        middlewares.waitDbCache,
        middlewares.verifyGetBossCharacters,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: await dbInterface.raidboss.getRaidBossCharacters(
                        req.body.ingameBossId,
                        req.body.combatMetric,
                        req.body.filters,
                        req.body.page,
                        req.body.pageSize
                    ),
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/log", "/getlog"],
        middlewares.verifyGetLog,
        async (req, res) => {
            try {
                let log = cache.getLog(req.body.logId, req.body.realm);

                if (!log) {
                    log = (
                        await tauriApi.getRaidLog(
                            req.body.logId,
                            req.body.realm
                        )
                    ).response;

                    cache.setLog(log, req.body.realm);
                }

                res.send({
                    success: true,
                    response: { ...log, realm: req.body.realm },
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/items", "/getitems"],
        middlewares.verifyGetItems,
        async (req, res) => {
            try {
                let items: LooseObject = {};
                for (let itemMeta of req.body.items) {
                    let item = cache.getItem(itemMeta.id);

                    if (!item) {
                        const data = req.body.isEntry
                            ? await tauriApi.getItem(
                                  itemMeta.id,
                                  req.body.realm
                              )
                            : await tauriApi.getItemByGuid(
                                  itemMeta.id,
                                  req.body.realm,
                                  itemMeta.pcs
                              );

                        if (data.success) {
                            item = { ...data.response, guid: itemMeta };

                            cache.setItem(itemMeta.id, item);
                        } else {
                            continue;
                        }
                    }

                    if (item) {
                        items[itemMeta.id] = item;
                    }
                }

                if (!Object.keys(items).length) throw ERR_UNKNOWN;

                res.send({
                    success: true,
                    response: items,
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        ["/character/recentkills", "/characterrecentkills"],
        middlewares.verifyCharacterRecentKills,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: (
                        await tauriApi.getCharacterRaidLogs(
                            req.body.characterName,
                            req.body.realm,
                            req.body.logId,
                            req.body.limit
                        )
                    ).response,
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        "/leaderboard/character",
        middlewares.waitDbCache,
        middlewares.verifyCharacterLeaderboard,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response:
                        await dbInterface.leaderboard.getCharacterLeaderboard(
                            req.body.raidName,
                            req.body.combatMetric,
                            req.body.filters,
                            req.body.page,
                            req.body.pageSize
                        ),
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: validator.isError(err) ? err.message : err,
                });
            }
        }
    );

    app.get("/leaderboard/guild", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await dbInterface.leaderboard.getGuildLeaderboard(),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });

    app.get("/weekly/guildfullclear", async (_1, res) => {
        try {
            res.send({
                success: true,
                response:
                    await dbInterface.weeklyGuildFullClear.getGuildFullClear(),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });

    app.get("/weekly/challenge", async (_1, res) => {
        try {
            res.send({
                success: true,
                response:
                    await dbInterface.weeklyChallenge.getChallengeDocuments(),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });

    app.post("/login", middlewares.verifyLogin, async (req, res) => {
        try {
            const authInfo = await patreon.getAuthToken(req.body.code);
            const userInfo = await patreon.getUserInfo(authInfo.access_token);

            const user = patreonUser.getUserData(authInfo, userInfo);
            const token = jwt.sign(user, environment.ENCRYPTION_KEY);

            res.setHeader("Set-Cookie", cookie.serialize("user", token));

            res.send({
                success: true,
                response: token,
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });

    app.post("/logout", async (_1, res) => {
        try {
            res.setHeader(
                "Set-Cookie",
                cookie.serialize("user", "", {
                    maxAge: 0,
                })
            );
            res.end();
        } catch (err) {
            res.send({
                success: false,
                errorstring: validator.isError(err) ? err.message : err,
            });
        }
    });
})();

export default app;
