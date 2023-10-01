import { DatabaseInterface } from ".";
import environment from "../../environment";
import {
    CharacterDocument,
    LastLogIds,
    LeaderboardCharacterDocument,
    id,
    log,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import { ERR_DB_ALREADY_UPDATING } from "../../helpers/errors";
import { CombatMetric, Difficulty } from "../../types";
import { MaintenanceDocument } from "./DBMaintenance";

export class DBInitializer {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }
    async initalizeDatabase(): Promise<true> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();
                if (this.dbInterface.update.isUpdating)
                    throw ERR_DB_ALREADY_UPDATING;

                console.log("Initalizing database.");
                await db.dropDatabase();

                const maintenanceCollection =
                    db.collection<MaintenanceDocument>(
                        this.dbInterface.collections.maintenance
                    );

                maintenanceCollection.insertOne(
                    this.dbInterface.maintenance.getDocument()
                );

                for (const raid of environment.currentContent.raids) {
                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.bossIdOfDifficulty) {
                            const diff = Number(difficulty) as Difficulty;
                            const ingameBossId =
                                boss.bossIdOfDifficulty[
                                    difficulty as keyof typeof boss.bossIdOfDifficulty
                                ];
                            const raidBossDocumentManager =
                                new documentManager.raidBoss({
                                    raidId: raid.id,
                                    bossName: boss.name,
                                    difficulty: diff,
                                    bossId: id.raidBossId(ingameBossId, diff),
                                });

                            await this.dbInterface.raidboss.saveRaidBoss(
                                raidBossDocumentManager.getDocument()
                            );

                            for (const combatMetric of environment.combatMetrics) {
                                const collectionName =
                                    id.characterDocumentCollectionId(
                                        ingameBossId,
                                        diff,
                                        combatMetric
                                    );
                                const bossCollection =
                                    db.collection(collectionName);

                                if (await bossCollection.findOne({}))
                                    await bossCollection.deleteMany({});

                                await bossCollection.createIndex({
                                    [combatMetric]: -1,
                                });
                            }
                        }
                    }
                }

                for (const combatMetric of environment.combatMetrics) {
                    const leaderboardCollection =
                        db.collection<LeaderboardCharacterDocument>(
                            combatMetric === "dps"
                                ? this.dbInterface.collections
                                      .characterLeaderboardDps
                                : this.dbInterface.collections
                                      .characterLeaderboardHps
                        );
                    if (await leaderboardCollection.findOne({}))
                        await leaderboardCollection.deleteMany({});

                    await leaderboardCollection.createIndex({
                        [combatMetric]: -1,
                    });
                }

                const updateStarted = new Date().getTime() / 1000;
                this.dbInterface.update.isUpdating = true;
                const lastLogIds = {};

                let { logs, lastLogIds: newLastLogIds } =
                    await this.getRaidLogs(lastLogIds);

                logs = log.filterRaidLogBugs(logs);

                const logFileManager = new log.fileManager();

                if (!logFileManager.areLogsPreserved()) {
                    console.log(
                        "Saving logs in case something goes wrong in the initalization process."
                    );
                    await logFileManager.writeLogs(logs);
                }

                console.log("Processing logs.");
                const { bosses, guilds, characterCollection } =
                    log.processLogs(logs);

                console.log("Saving raid bosses.");
                for (const bossId in bosses) {
                    await this.dbInterface.raidboss.saveRaidBoss(
                        bosses[bossId].getDocument()
                    );
                }

                // initalization should keep this empty since there is no update
                this.dbInterface.update.resetUpdatedBossIds();

                console.log("Saving guilds.");
                for (const guildId in guilds) {
                    await this.dbInterface.guild.saveGuild(
                        guilds[guildId].getDocument()
                    );
                }

                console.log("Saving characters.");
                for (const bossId in characterCollection) {
                    console.log(`Filling collection ${bossId}`);

                    for (let combatMetricKey in characterCollection[bossId]) {
                        const combatMetric = combatMetricKey as CombatMetric;
                        let characters: CharacterDocument[] = [];
                        for (const charId in characterCollection[bossId][
                            combatMetric
                        ]) {
                            characters.push(
                                characterCollection[bossId][combatMetric][
                                    charId
                                ]
                            );
                        }

                        const [ingameBossId, difficulty] =
                            id.deconstruct.raidBossId(bossId);

                        const collectionName = id.characterDocumentCollectionId(
                            ingameBossId,
                            difficulty,
                            combatMetric
                        );
                        const bossCollection =
                            db.collection<CharacterDocument>(collectionName);

                        try {
                            await bossCollection.insertMany(characters);

                            const raidName =
                                environment.getRaidNameFromIngamebossId(
                                    ingameBossId
                                );

                            const bossName =
                                environment.getRaidBossNameFromIngameBossId(
                                    ingameBossId
                                );
                            if (raidName && bossName)
                                await this.dbInterface.leaderboard.saveCharactersToLeaderboard(
                                    characters,
                                    raidName,
                                    difficulty,
                                    bossName,
                                    combatMetric
                                );
                            this.dbInterface.update.addToUpdatedCharacterDocumentCollections(
                                collectionName
                            );
                        } catch (err) {
                            console.error(err);
                        }
                    }
                }
                console.log("Characters saved.");

                console.log("Update character ranks");
                await this.dbInterface.update.updateCharacterDocumentRanks();
                console.log("Character ranks updated");

                await this.dbInterface.maintenance.updateDocument({
                    lastUpdated: updateStarted,
                    lastLogIds: newLastLogIds,
                    isInitalized: true,
                });

                await this.dbInterface.update.updateGuilds();

                await this.dbInterface.raidboss.updateRaidBossCache();

                this.dbInterface.update.isUpdating = false;

                console.log("Initalization done.");
                resolve(true);
            } catch (err) {
                this.dbInterface.update.isUpdating = false;
                reject(err);
            }
        });
    }

    async isInitalized(): Promise<boolean> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const maintenance = await db
                    .collection<MaintenanceDocument>(
                        this.dbInterface.collections.maintenance
                    )
                    .findOne({});

                resolve(maintenance ? maintenance.isInitalized : false);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getRaidLogs(
        lastLogIds: LastLogIds
    ): Promise<Awaited<ReturnType<typeof log.requestRaidLogs>>> {
        const logFileManager = new log.fileManager();

        if (logFileManager.areLogsPreserved()) {
            console.log("Loading logs from file");
            return {
                logs: await logFileManager.getLogs(),
                lastLogIds: logFileManager.getLastLogIds(),
            };
        } else {
            console.log("Logs are not preserved, downloading logs");
            return await log.requestRaidLogs(lastLogIds);
        }
    }
}

export default DBInitializer;
