import * as NodeCache from "node-cache";

class Cache {
    public guildList: NodeCache;
    public raidSummary: NodeCache;
    public raidBoss: NodeCache;
    public leaderboard: NodeCache;
    public guildLeaderboard: NodeCache;

    public characterPerformance: NodeCache;

    constructor() {
        this.guildList = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false
        });
        this.raidSummary = new NodeCache({
            stdTTL: 0,
            useClones: false
        });
        this.characterPerformance = new NodeCache({
            stdTTL: 0,
            useClones: false,
            maxKeys: 100
        });
        this.raidBoss = new NodeCache({
            stdTTL: 0,
            useClones: false
        });
        this.leaderboard = new NodeCache({
            stdTTL: 0,
            useClones: false
        });

        this.guildLeaderboard = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false
        });
    }

    clearRaidSummary() {
        this.raidSummary.del(this.raidSummary.keys());
    }

    clearCharacterPerformance() {
        this.characterPerformance.del(this.characterPerformance.keys());
    }
}

const cache = new Cache();

export default cache;
