import { WeeklyGuildFullClearDocument } from "./../helpers/documents/weeklyGuildFullClear";
import * as NodeCache from "node-cache";
import {
    CharacterPerformance,
    GuildLeaderboard,
    GuildList,
    RaidBossDocument,
    WeeklyChallengeVoteDocument,
    id,
} from "../helpers";
import { LeaderboardCharacterScoredDocument } from "../helpers/documents/leaderboardCharacter";
import { RaidSummary } from "../types";
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
    public weeklyChallengeCurrentVotes: NodeCache;

    public guildListId: string;
    public guildLeaderboardId: string;
    public weeklyGuildFullClearId: string;
    public weeklyChallengeId: string;
    public weeklyChallengeCurrentVotesId: string;

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

        this.weeklyChallengeCurrentVotesId = "WeeklyChallengeVotesId";
        this.weeklyChallengeCurrentVotes = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
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

    getWeeklyChallengeCurrentVotes() {
        return this.weeklyChallengeCurrentVotes.get(
            this.weeklyChallengeCurrentVotesId
        ) as WeeklyChallengeVoteDocument[] | undefined;
    }

    setWeeklyChallengeCurrentVotes(votes: WeeklyChallengeVoteDocument[]) {
        try {
            this.weeklyChallengeCurrentVotes.set(
                this.weeklyChallengeCurrentVotesId,
                votes
            );
        } catch (e) {
            console.error(e);
        }
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

    clearWeeklyCurrentVotes() {
        this.weeklyChallengeCurrentVotes.del(
            this.weeklyChallengeCurrentVotes.keys()
        );
    }
}

const cache = new Cache();

export default cache;
