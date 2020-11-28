const NodeCache = require("node-cache");

class Cache {
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
        this.character = new NodeCache({
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
    }
}

const cache = new Cache();

module.exports = cache;
