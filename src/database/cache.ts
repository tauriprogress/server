import * as NodeCache from "node-cache";
import { getRaidSummaryCacheId } from "../helpers";
import {
    GuildList,
    CharacterPerformance,
    ItemWithGuid,
    RaidBossDocument,
    RaidSummary,
} from "../types";

class Cache {
    public guildList: NodeCache;
    public raidSummary: NodeCache;
    public raidBoss: NodeCache;
    public characterLeaderboard: NodeCache;
    public guildLeaderboard: NodeCache;
    public characterPerformance: NodeCache;

    public items: NodeCache;

    public guildListId: string;
    public guildLeaderboardId: string;

    constructor() {
        this.guildListId = "GuildList";
        this.guildList = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false,
        });

        this.raidSummary = new NodeCache({
            stdTTL: 0,
            useClones: false,
        });

        this.characterPerformance = new NodeCache({
            stdTTL: 0,
            useClones: false,
            maxKeys: 100,
        });

        this.raidBoss = new NodeCache({
            stdTTL: 0,
            useClones: false,
        });

        this.characterLeaderboard = new NodeCache({
            stdTTL: 0,
            useClones: false,
        });

        this.guildLeaderboardId = "guildLeaderboard";
        this.guildLeaderboard = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false,
        });

        this.items = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 1500,
        });
    }
    getGuildList() {
        return this.guildList.get(this.guildListId) as GuildList | undefined;
    }

    getRaidSummary(cacheId: ReturnType<typeof getRaidSummaryCacheId>) {
        return this.raidSummary.get(cacheId) as RaidSummary | undefined;
    }

    getCharacterPerformance(characterId: string) {
        return this.characterPerformance.get(characterId) as
            | CharacterPerformance
            | undefined;
    }

    getRaidBoss(bossId: string) {
        return this.raidBoss.get(bossId) as RaidBossDocument | undefined;
    }

    getCharacterLeaderboard(leaderboardId: string) {
        return this.characterLeaderboard.get(leaderboardId) as
            | CharacterLeaderboard
            | undefined;
    }

    getGuildLeaderboard() {
        return this.guildLeaderboard.get(this.guildLeaderboardId) as
            | GuildLeaderboard
            | undefined;
    }

    getItem(itemId: number) {
        return this.items.get(itemId) as ItemWithGuid | undefined;
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
