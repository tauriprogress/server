import { DatabaseInterface } from ".";
import environment from "../../environment";
import {
    WeeklyChallengeVoteDocument,
    WeeklyChallengeVoteDocumentController,
    id,
    time,
} from "../../helpers";
import { PatreonUserInfo } from "../../types";
import cache from "../cache";
import { RaffleItem } from "./DBWeeklyChallenge";

export class DBWeeklyChallengeVote {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }

    saveVote(
        voteDocumentManager: WeeklyChallengeVoteDocumentController
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeVoteDocument>(
                    this.dbInterface.collections.weeklyChallengeVotes.name
                );

                const newDoc = voteDocumentManager.getDocument();

                const currentDoc = await collection.findOne({
                    _id: newDoc._id,
                });

                if (currentDoc) {
                    await collection.updateOne(
                        {
                            _id: newDoc._id,
                        },
                        {
                            $set: newDoc,
                        }
                    );
                } else {
                    await collection.insertOne(newDoc);
                }

                cache.clearWeeklyCurrentVotes();

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    getCurrentWeekVotes(user?: PatreonUserInfo): Promise<{
        votes: RaffleItem[];
        currentVote: undefined | WeeklyChallengeVoteDocument;
    }> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeVoteDocument>(
                    this.dbInterface.collections.weeklyChallengeVotes.name
                );
                const weekId = id.weekId(new Date());

                let votes = cache.getWeeklyChallengeCurrentVotes();

                if (!votes) {
                    votes = await collection
                        .find({
                            weekId: weekId,
                        })
                        .toArray();

                    cache.setWeeklyChallengeCurrentVotes(votes);
                }

                const result = {
                    votes: this.getRaffleItemsFromVotes(votes),
                    currentVote: votes.find((vote) => {
                        return vote.userId === (user && user.id);
                    }),
                };

                resolve(result);
            } catch (e) {
                reject(e);
            }
        });
    }

    getLastWeekVotes(): Promise<RaffleItem[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeVoteDocument>(
                    this.dbInterface.collections.weeklyChallengeVotes.name
                );
                const weekId = id.weekId(
                    new Date(time.getLatestWednesday().getTime() - 100000)
                );
                const votes = await collection
                    .find({
                        weekId: weekId,
                    })
                    .toArray();

                resolve(this.getRaffleItemsFromVotes(votes));
            } catch (e) {
                reject(e);
            }
        });
    }

    private getRaffleItemsFromVotes(
        votes: WeeklyChallengeVoteDocument[]
    ): RaffleItem[] {
        let obj: { [str: string]: number } = {};

        for (let vote of votes) {
            if (!obj[vote.bossName]) {
                obj[vote.bossName] = 0;
            }

            obj[vote.bossName] += vote.weight;
        }

        return environment.getDefaultRaffleItems().map((vote) => {
            return {
                name: vote.name,
                weight: vote.weight + (obj[vote.name] || 0),
            };
        });
    }
}

export default DBWeeklyChallengeVote;
