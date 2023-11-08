import { createCollections } from "./../DBCollections";
import environment from "../../environment";
import { Lock, id } from "../../helpers";
import documentManager from "../../helpers/documents";
import { Difficulty, RaidId, RaidSummary } from "../../types";
import cache from "../cache";
import DBTaskManager from "../DBTaskManager";
import DBCharacter from "./DBCharacter";
import DBGuild from "./DBGuild";
import DBInitializer from "./DBInitializer";
import DBLeaderboard from "./DBLeaderboard";
import DBMaintenance from "./DBMaintenance";
import DBRaidboss from "./DBRaidboss";
import DBUpdate from "./DBUpdate";
import DBWeeklyGuildFullClear from "./DBWeeklyGuildFullClear";
import DBWeeklyChallenge from "./DBWeeklyChallenge";
const raidSummaryLock = new Lock();

class DBInterface {
    public collections;
    public guild: DBGuild;
    public update: DBUpdate;
    public raidboss: DBRaidboss;
    public leaderboard: DBLeaderboard;
    public character: DBCharacter;
    public weeklyGuildFullClear: DBWeeklyGuildFullClear;
    public weeklyChallenge: DBWeeklyChallenge;
    public initializer: DBInitializer;
    public maintenance: DBMaintenance;

    constructor() {
        this.guild = new DBGuild(this);
        this.update = new DBUpdate(this);
        this.raidboss = new DBRaidboss(this);
        this.leaderboard = new DBLeaderboard(this);
        this.character = new DBCharacter(this);
        this.weeklyGuildFullClear = new DBWeeklyGuildFullClear(this);
        this.weeklyChallenge = new DBWeeklyChallenge(this);
        this.initializer = new DBInitializer(this);
        this.maintenance = new DBMaintenance(this, new DBTaskManager(this));
        this.collections = createCollections(this);
    }

    async getRaidSummary(raidId: RaidId): Promise<RaidSummary> {
        return new Promise(async (resolve, reject) => {
            try {
                await raidSummaryLock.acquire();

                const cacheId = id.cache.raidSummaryCacheId(raidId);
                const cachedData = cache.getRaidSummary(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    let raidSummary: RaidSummary = {};

                    const bosses = environment.getRaidInfoFromId(raidId).bosses;
                    for (const bossInfo of bosses) {
                        for (const key in bossInfo.bossIdOfDifficulty) {
                            const difficulty = Number(
                                key
                            ) as unknown as Difficulty;
                            const ref =
                                difficulty as keyof typeof bossInfo.bossIdOfDifficulty;
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[ref];
                            const bossId = id.raidBossId(
                                ingameBossId,
                                difficulty
                            );

                            const raidBossDocManager =
                                new documentManager.raidBoss(
                                    await this.raidboss.getRaidBoss(
                                        ingameBossId,
                                        difficulty
                                    )
                                );

                            raidSummary[bossId] =
                                raidBossDocManager.getSummary();
                        }
                    }

                    cache.raidSummary.set(cacheId, raidSummary);

                    resolve(raidSummary);
                }
            } catch (err) {
                reject(err);
            } finally {
                raidSummaryLock.release();
            }
        });
    }
}

export const dbInterface = new DBInterface();

export type DatabaseInterface = typeof dbInterface;

export default dbInterface;
