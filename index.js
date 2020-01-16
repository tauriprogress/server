require("dotenv").config();
const app = require("express")();
const cors = require("cors");
const bodyParser = require("body-parser");
const db = require("./database");
const port = process.env.PORT || 3001;
const {
    verifyGetGuild,
    verifyGetPlayer,
    verifyGetRaid,
    verifyGetboss,
    verifyGetLog,
    verifyPlayerBossKills,
    verifyGetPlayerPerformance,
    collectStats,
    updateDatabase
} = require("./middlewares");
const tauriApi = require("./tauriApi");
const { minutesAgo, secsAgo } = require("./helpers");

(async function() {
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
            origin: "https://tauriprogress.github.io",
            optionsSuccessStatus: 200
        })
    );
    app.use(bodyParser.json());
    app.use(updateDatabase(db));

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

    app.post("/getplayer", verifyGetPlayer, async (req, res) => {
        try {
            let player = await tauriApi.getCharacter(
                req.body.realm,
                req.body.playerName
            );
            if (!player.success) throw new Error(player.errorstring);

            res.send({
                success: true,
                response: { ...player.response }
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post(
        "/getplayerperformance",
        verifyGetPlayerPerformance,
        async (req, res) => {
            try {
                let performance = await db.getPlayerPerformance({
                    playerName: req.body.playerName,
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

    app.post("/getraid", verifyGetRaid, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await db.getRaid(req.body.raidName)
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/getboss", verifyGetboss, async (req, res) => {
        try {
            res.send({
                success: true,
                response: await db.getRaidBoss(
                    req.body.raidName,
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

    app.post("/getitem", async (req, res) => {
        try {
            let item = (
                await tauriApi.getItemByGuid(req.body.id, req.body.realm)
            ).response;

            res.send({
                success: true,
                response: item
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message
            });
        }
    });

    app.post("/playerBossKills", verifyPlayerBossKills, async (req, res) => {
        try {
            res.send({
                success: true,
                response: (
                    await tauriApi.getRaidPlayer(
                        req.body.realm,
                        req.body.playerName,
                        req.body.logId,
                        req.body.limit
                    )
                ).response
            });
        } catch (err) {
            res.send({
                success: false,
                errorstring: err.message,
                lastUpdated: secsAgo(lastUpdateTime)
            });
        }
    });

    app.listen(port, () => console.log(`Server running on port ${port}`));
})();
