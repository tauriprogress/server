import * as express from "express";
import * as cors from "cors";
import * as bodyParser from "body-parser";
import * as slowDown from "express-slow-down";

import db from "./database";
import dbTaskManager from "./DBTaskManger";

import {
    verifyGetGuild,
    verifyGetCharacter,
    verifyGetRaidSummary,
    verifyGetBossKillCount,
    verifyGetBossLatestKills,
    verifyGetBossFastestKills,
    verifyGetBossCharacters,
    verifyGetLog,
    verifyCharacterRecentKills,
    verifyGetCharacterPerformance,
    verifyGetItems,
    verifyCharacterLeaderboard,
    waitDbCache,
} from "./middlewares";
import tauriApi from "./tauriApi";

import { isError, minutesAgo } from "./helpers";
import { LooseObject } from "./types";
import environment from "./environment";
import cache from "./database/cache";
import { ERR_UNKNOWN } from "./helpers/errors";

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
        await db.connect();
        if (!(await db.isInitalized())) {
            await db.initalizeDatabase();
        } else if (environment.forceInit) {
            const confirmation = prompt(
                "The database is already initalized, are you sure to reinitalize it? (Y/n)"
            );

            if (confirmation === "y" || confirmation === "Y") {
                await db.initalizeDatabase();
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
    app.use((req, _1, next) => {
        req.db = db;
        next();
    });

    dbTaskManager.start();

    app.get("/guildlist", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await db.getGuildList(),
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
                response: await db.getGuild(req.body.realm, req.body.guildName),
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
            const apiResponse = await tauriApi.getCharacterData(
                req.body.characterName,
                req.body.realm
            );

            res.send({
                success: true,
                response: { ...apiResponse.response },
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
                let performance = await db.getCharacterPerformance(
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
                response: await db.getRaidSummary(req.body.raidId),
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
                        killCount: await db.getRaidBossKillCount(
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
                        recentKills: await db.getRaidBossLatestKills(
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
                        fastestKills: await db.getRaidBossFastestKills(
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
                    response: await db.getRaidBossCharacters(
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

    app.get("/lastupdated", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: {
                    lastUpdated: minutesAgo(await db.getLastUpdated()),
                    isUpdating: db.isUpdating,
                    status: db.updateStatus,
                },
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: isError(err) ? err.message : err,
            });
        }
    });

    app.post("/getlog", verifyGetLog, async (req, res) => {
        try {
            let log = (
                await tauriApi.getRaidLog(req.body.logId, req.body.realm)
            ).response;
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
            for (let guid of req.body.ids) {
                let item = cache.getItem(guid);

                if (!item) {
                    const data = await tauriApi.getItemByGuid(
                        guid,
                        req.body.realm,
                        req.body.isEntry
                    );

                    if (data.success) {
                        item = { ...data.response, guid };
                        cache.items.set(guid, item);
                    } else {
                        continue;
                    }
                }

                if (item) {
                    items[guid] = item;
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
                    response: await db.getCharacterLeaderboard(
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
                response: await db.getGuildLeaderboard(),
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
