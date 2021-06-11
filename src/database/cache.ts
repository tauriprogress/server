import * as NodeCache from "node-cache";

class Cache {
    public guildList: NodeCache;
    public raidSummary: NodeCache;
    public characterPerformance: NodeCache;
    public raidBoss: NodeCache;
    public leaderboard: NodeCache;
    public guildLeaderboard: NodeCache;

    constructor() {
        this.guildList = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false
        });
        this.raidSummary = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false
        });
        this.characterPerformance = new NodeCache({
            stdTTL: 4 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 150
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
}

const cache = new Cache();

export default cache;
