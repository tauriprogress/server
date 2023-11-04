import { WeeklyGuildFullClearDocument } from "./../helpers/documents/weeklyGuildFullClear";
import * as NodeCache from "node-cache";
import {
    CharacterPerformance,
    GuildLeaderboard,
    GuildList,
    RaidBossDocument,
    id,
} from "../helpers";
import { LeaderboardCharacterScoredDocument } from "../helpers/documents/leaderboardCharacter";
import {
    CharacterData,
    ItemWithGuid,
    RaidLog,
    RaidSummary,
    Realm,
} from "../types";
import { WeeklyChallenge } from "./DBInterface/DBWeeklyChallenge";

class Cache {
    public guildList: NodeCache;
    public raidSummary: NodeCache;
    public raidBoss: NodeCache;
    public characterLeaderboard: NodeCache;
    public guildLeaderboard: NodeCache;
    public characterPerformance: NodeCache;
    public weeklyGuildFullClear: NodeCache;
    public weeklyChallenge: NodeCache;

    public items: NodeCache;
    public logs: NodeCache;
    public characters: NodeCache;

    public guildListId: string;
    public guildLeaderboardId: string;
    public weeklyGuildFullClearId: string;
    public weeklyChallengeId: string;

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
        this.logs = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 400,
        });
        this.characters = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 400,
        });

        this.weeklyGuildFullClearId = "WeeklyGuildFullClear";
        this.weeklyGuildFullClear = new NodeCache({
            stdTTL: 0,
            useClones: false,
        });

        this.weeklyChallengeId = "WeeklyChallenge";
        this.weeklyChallenge = new NodeCache({
            stdTTL: 0,
            useClones: false,
        });
    }

    getGuildList() {
        return this.guildList.get(this.guildListId) as GuildList | undefined;
    }

    getRaidSummary(cacheId: ReturnType<typeof id.cache.raidSummaryCacheId>) {
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
            | LeaderboardCharacterScoredDocument[]
            | undefined;
    }

    getGuildLeaderboard() {
        return this.guildLeaderboard.get(this.guildLeaderboardId) as
            | GuildLeaderboard
            | undefined;
    }

    setItem(itemId: number, item: ItemWithGuid) {
        try {
            cache.items.set(itemId, item);
        } catch (e) {
            console.error(e);
        }
    }

    getItem(itemId: number) {
        return this.items.get(itemId) as ItemWithGuid | undefined;
    }

    setLog(log: RaidLog, realm: Realm) {
        try {
            cache.logs.set(id.cache.extendedLogId(log.log_id, realm), log);
        } catch (e) {
            console.error(e);
        }
    }

    getLog(logId: number, realm: Realm) {
        return this.logs.get(id.cache.extendedLogId(logId, realm)) as
            | RaidLog
            | undefined;
    }

    setCharacter(character: CharacterData, realm: Realm) {
        try {
            cache.characters.set(
                id.cache.characterApiId(character.name, realm),
                character
            );
        } catch (e) {
            console.error(e);
        }
    }

    getCharacter(characterName: string, realm: Realm) {
        return this.characters.get(
            id.cache.characterApiId(characterName, realm)
        ) as CharacterData | undefined;
    }

    setWeeklyGuildFullClear(
        documentManagerArr: WeeklyGuildFullClearDocument[]
    ) {
        try {
            cache.weeklyGuildFullClear.set(
                this.weeklyGuildFullClearId,
                documentManagerArr
            );
        } catch (e) {
            console.error(e);
        }
    }

    getWeeklyFullClear() {
        return this.weeklyGuildFullClear.get(this.weeklyGuildFullClearId) as
            | WeeklyGuildFullClearDocument[]
            | undefined;
    }

    setWeeklyChallenge(weeklyChallenge: WeeklyChallenge) {
        try {
            cache.weeklyChallenge.set(this.weeklyChallengeId, weeklyChallenge);
        } catch (e) {
            console.error(e);
        }
    }

    getWeeklyChallenge() {
        return this.weeklyChallenge.get(this.weeklyChallengeId) as
            | WeeklyChallenge
            | undefined;
    }

    clearRaidSummary() {
        this.raidSummary.del(this.raidSummary.keys());
    }

    clearCharacterPerformance() {
        this.characterPerformance.del(this.characterPerformance.keys());
    }

    clearCharacterLeaderboard() {
        this.characterLeaderboard.del(this.characterLeaderboard.keys());
    }

    clearWeeklyGuildFullClear() {
        this.weeklyGuildFullClear.del(this.weeklyGuildFullClear.keys());
    }

    clearWeeklyChallenge() {
        this.weeklyChallenge.del(this.weeklyChallenge.keys());
    }
}

const cache = new Cache();

export default cache;
