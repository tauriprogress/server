import { initializer } from "./DBInitializer";
import {
    Lock,
    getRaidBossId,
    getRaidBossSummary,
    getRaidInfoFromId,
    getRaidSummaryCacheId,
} from "../helpers";
import { Difficulty, RaidId, RaidSummary } from "../types";
import cache from "./Cache";
import dbCharacter from "./DBCharacter";
import dbGuild from "./DBGuild";
import dbLeaderboard from "./DBLeaderboard";
import dbRaidboss from "./DBRaidboss";
import dbUpdate from "./DBUpdate";
import dbWeekly from "./DBWeekly";
const raidSummaryLock = new Lock();

const collectionNames = {
    guilds: "Guilds",
    maintenance: "Maintenance",
    raidBosses: "RaidBosses",
    weeklyFullClearData: "WeeklyFullClearData",
    characterLeaderboardDps: "CharacterLeaderboardDps",
    characterLeaderboardHps: "CharacterLeaderboardHps",
} as const;

class DBInterface {
    public collections: typeof collectionNames;

    public guild: typeof dbGuild;
    public update: typeof dbUpdate;
    public raidboss: typeof dbRaidboss;
    public leaderboard: typeof dbLeaderboard;
    public character: typeof dbCharacter;
    public dbWeekly: typeof dbWeekly;
    public initializer: typeof initializer;

    constructor() {
        this.collections = collectionNames;

        this.guild = dbGuild;
        this.update = dbUpdate;
        this.raidboss = dbRaidboss;
        this.leaderboard = dbLeaderboard;
        this.character = dbCharacter;
        this.dbWeekly = dbWeekly;
        this.initializer = initializer;
    }

    async getRaidSummary(raidId: RaidId): Promise<RaidSummary> {
        return new Promise(async (resolve, reject) => {
            try {
                await raidSummaryLock.acquire();

                const cacheId = getRaidSummaryCacheId(raidId);
                const cachedData = cache.getRaidSummary(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    let raidSummary: RaidSummary = {};

                    const bosses = getRaidInfoFromId(raidId).bosses;
                    for (const bossInfo of bosses) {
                        for (const key in bossInfo.bossIdOfDifficulty) {
                            const difficulty = Number(
                                key
                            ) as unknown as Difficulty;
                            const ref =
                                key as keyof typeof bossInfo.bossIdOfDifficulty;
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[ref];
                            const bossId = getRaidBossId(
                                ingameBossId,
                                difficulty
                            );

                            raidSummary[bossId] = getRaidBossSummary(
                                await this.raidboss.getRaidBoss(
                                    ingameBossId,
                                    difficulty
                                )
                            );
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

const db = new DBInterface();

export type Database = typeof db;

export default db;
