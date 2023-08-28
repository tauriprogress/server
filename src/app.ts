import * as bodyParser from "body-parser";
import * as cors from "cors";
import * as express from "express";
import * as slowDown from "express-slow-down";

import dbInterface from "./database";
import dbTaskManager from "./database/DBTaskManager";

import {
    verifyCharacterLeaderboard,
    verifyCharacterRecentKills,
    verifyGetBossCharacters,
    verifyGetBossFastestKills,
    verifyGetBossKillCount,
    verifyGetBossLatestKills,
    verifyGetCharacter,
    verifyGetCharacterPerformance,
    verifyGetGuild,
    verifyGetItems,
    verifyGetLog,
    verifyGetRaidSummary,
    waitDbCache,
} from "./middlewares";
import tauriApi from "./tauriApi";

import cache from "./database/Cache";
import dbConnection from "./database/DBConnection";
import environment from "./environment";
import { isError } from "./helpers";
import { ERR_UNKNOWN } from "./helpers/errors";
import { LooseObject } from "./types";

const app = express();
const prompt = require("prompt-sync")();

const speedLimiter = slowDown({
    windowMs: 40 * 1000,
    delayAfter: 15,
    delayMs: 300,
    maxDelayMs: 2 * 1000,
});

(async function () {
    try {
        await dbConnection.connect();
        if (!(await dbInterface.update.isInitalized())) {
            await dbInterface.update.initalizeDatabase();
        } else if (environment.forceInit) {
            const confirmation = prompt(
                "The database is already initalized, are you sure to reinitalize it? (Y/n)"
            );

            if (confirmation === "y" || confirmation === "Y") {
                await dbInterface.update.initalizeDatabase();
                process.exit(0);
            }
        }
    } catch (err) {
        console.error(err);
        process.exit(1);
    }

    app.use(
        cors({
            origin: "https://tauriprogress.github.io",
            optionsSuccessStatus: 200,
        })
    );

    app.use(speedLimiter);

    app.use(bodyParser.json());

    dbTaskManager.start();

    app.get("/guildlist", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await dbInterface.guild.getGuildList(),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post("/getguild", verifyGetGuild, async (req, res) => {
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
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post("/getcharacter", verifyGetCharacter, async (req, res) => {
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
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post(
        "/getcharacterperformance",
        waitDbCache,
        verifyGetCharacterPerformance,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post("/getraidsummary", verifyGetRaidSummary, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await dbInterface.getRaidSummary(req.body.raidId),
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post(
        "/getboss/killCount",
        waitDbCache,
        verifyGetBossKillCount,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        "/getboss/latestKills",
        waitDbCache,
        verifyGetBossLatestKills,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        "/getboss/fastestKills",
        waitDbCache,
        verifyGetBossFastestKills,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        "/getboss/characters",
        waitDbCache,
        verifyGetBossCharacters,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post("/getlog", verifyGetLog, async (req, res) => {
        try {
            let log = cache.getLog(req.body.logId, req.body.realm);

            if (!log) {
                log = (
                    await tauriApi.getRaidLog(req.body.logId, req.body.realm)
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
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post("/getitems", verifyGetItems, async (req, res) => {
        try {
            let items: LooseObject = {};
            for (let itemMeta of req.body.items) {
                let item = cache.getItem(itemMeta.id);

                if (!item) {
                    const data = req.body.isEntry
                        ? await tauriApi.getItem(itemMeta.id, req.body.realm)
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
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post(
        "/characterrecentkills",
        verifyCharacterRecentKills,
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
                    errorstring: isError(err) ? err.message : err,
                });
            }
        }
    );

    app.post(
        "/leaderboard/character",
        waitDbCache,
        verifyCharacterLeaderboard,
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
                    errorstring: isError(err) ? err.message : err,
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
                errorstring: isError(err) ? err.message : err,
            });
        }
    });
})();

export default app;
