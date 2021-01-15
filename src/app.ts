import * as express from "express";
import * as cors from "cors";
import * as bodyParser from "body-parser";

import db from "./database";

import {
    verifyGetGuild,
    verifyGetCharacter,
    verifyGetRaidSummary,
    verifyGetBoss,
    verifyGetLog,
    verifyCharacterRecentKills,
    verifyGetCharacterPerformance,
    verifyGetItems,
    verifyGetLeaderboard,
    updateDatabase,
    waitDbCache
} from "./middlewares";

import tauriApi from "./tauriApi";

import { minutesAgo } from "./helpers";

const app = express();

(async function () {
    try {
        await db.connect();
        if (!(await db.isInitalized())) {
            await db.initalizeDatabase();
        }
    } catch (err) {
        console.error(err);
        db.disconnect().catch(err => console.error(err));
        process.exit(1);
    }

    app.use(
        cors({
            origin: "http://localhost:3000",
            optionsSuccessStatus: 200
        })
    );

    app.use(bodyParser.json());
    app.use((req, res, next) => {
        req.db = db;
        next();
    });

    app.use(updateDatabase);

    app.get("/getguildlist", async (req, res) => {
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
            let character = await tauriApi.getCharacter(
                req.body.realm,
                req.body.characterName
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
                let performance = await db.getCharacterPerformance({
                    characterName: req.body.characterName,
                    characterClass: req.body.characterClass,
                    realm: req.body.realm,
                    raidName: req.body.raidName
                });
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

    app.get("/lastupdated", async (req, res) => {
        try {
            res.send({
                success: true,
                response: {
                    lastUpdated: minutesAgo(await db.getLastUpdated()),
                    isUpdating: db.isUpdating
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
                await tauriApi.getRaidLog(req.body.realm, req.body.logId)
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
            let items = {};
            for (let guid of req.body.ids) {
                let data;

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

                if (data.success) items[guid] = { ...data.response, guid };
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
                        await tauriApi.getRaidPlayer(
                            req.body.realm,
                            req.body.characterName,
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
        "/getleaderboard",
        waitDbCache,
        verifyGetLeaderboard,
        async (req, res) => {
            try {
                let data = await db.getLeaderboardData(req.body.dataId);
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

    db.updateRequiredData();
})();

export default app;
