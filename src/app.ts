import * as express from "express";
import * as cors from "cors";
import * as bodyParser from "body-parser";
import * as slowDown from "express-slow-down";

import db from "./database";

import {
    verifyGetGuild,
    verifyGetCharacter,
    verifyGetRaidSummary,
    verifyGetBoss,
    verifyGetBossKillCount,
    verifyGetBossRecentKills,
    verifyGetBossFastestKills,
    verifyGetLog,
    verifyCharacterRecentKills,
    verifyGetCharacterPerformance,
    verifyGetItems,
    verifyCharacterLeaderboard,
    updateDatabase,
    waitDbCache
} from "./middlewares";

import tauriApi from "./tauriApi";

import { minutesAgo, runGC } from "./helpers";
import { LooseObject } from "./types";
import { environment } from "./environment";
import cache from "./database/cache";

const app = express();
const prompt = require("prompt-sync")();

const speedLimiter = slowDown({
    windowMs: 20 * 1000,
    delayAfter: 20,
    delayMs: 300,
    maxDelayMs: 2 * 1000,
    keyGenerator: () => "1",
    onLimitReached: () => runGC()
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
            optionsSuccessStatus: 200
        })
    );
    app.use(bodyParser.json());
    app.use((req, _1, next) => {
        req.db = db;
        next();
    });

    app.use(updateDatabase);

    app.use(speedLimiter);

    app.get("/getguildlist", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await db.getGuildList()
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/getguild", verifyGetGuild, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await db.getGuild(req.body.realm, req.body.guildName)
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/getcharacter", verifyGetCharacter, async (req, res) => {
        try {
            const character = await tauriApi.getCharacterData(
                req.body.characterName,
                req.body.realm
            );
            if (!character.success) throw new Error(character.errorstring);

            res.send({
                success: true,
                response: { ...character.response }
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
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
                    response: { ...performance }
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
                });
            }
        }
    );

    app.post("/getraidsummary", verifyGetRaidSummary, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await db.getRaidSummary(req.body.raidId)
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/getboss", waitDbCache, verifyGetBoss, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await db.getRaidBoss(
                    req.body.raidId,
                    req.body.bossName
                )
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
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
                            req.body.raidId,
                            req.body.bossName,
                            req.body.difficulty
                        )
                    }
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
                });
            }
        }
    );

    app.post(
        "/getboss/recentKills",
        waitDbCache,
        verifyGetBossRecentKills,
        async (req, res) => {
            try {
                res.send({
                    success: true,
                    response: {
                        recentKills: await db.getRaidBossRecentKills(
                            req.body.raidId,
                            req.body.bossName,
                            req.body.difficulty
                        )
                    }
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
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
                            req.body.raidId,
                            req.body.bossName,
                            req.body.difficulty
                        )
                    }
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
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
                    status: db.updateStatus
                }
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
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
                response: { ...log, realm: req.body.realm }
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/getitems", verifyGetItems, async (req, res) => {
        try {
            let items: LooseObject = {};
            for (let guid of req.body.ids) {
                let data;
                let item = cache.items.get(guid);

                if (!item) {
                    do {
                        try {
                            data = await tauriApi.getItemByGuid(
                                guid,
                                req.body.realm
                            );
                        } catch (err) {
                            data = err.message;
                        }
                    } while (!data.success && data === "request timed out");

                    if (data.success) {
                        item = { ...data.response, guid };
                        cache.items.set(guid, item);
                    } else {
                        continue;
                    }
                }

                items[guid] = item;
            }

            if (!Object.keys(items).length)
                throw new Error("Something went wrong...");

            res.send({
                success: true,
                response: items
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
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
                    ).response
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
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
                let data = await db.getCharacterLeaderboard(req.body.dataId);
                res.send({
                    success: true,
                    response: data
                });
            } catch (err) {
                res.send({
                    success: false,
                    errorstring: err.message
                });
            }
        }
    );

    app.get("/leaderboard/guild", async (_1, res) => {
        try {
            res.send({
                success: true,
                response: await db.getGuildLeaderboard()
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });
})();

export default app;
