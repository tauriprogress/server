import { ClientSession } from "mongodb";
import { DatabaseInterface } from ".";
import environment from "../../environment";
import { WeeklyChallengeDocument, id } from "../../helpers";
import documentManager, {
    WeeklyChallengeDocumentController,
} from "../../helpers/documents";
import { Difficulty } from "../../types";
import cache from "../cache";

export type WeeklyChallenge = {
    [key in Difficulty]: WeeklyChallengeDocument;
};

type RaffleItem = {
    name: string;
    weight: number;
};

function raffle(items: RaffleItem[]): string {
    const maxPoint = items.reduce((acc, curr) => acc + curr.weight, 0);

    const selectedPoint = Math.floor(Math.random() * maxPoint);

    let point = 0;

    let selectedName = items[0].name;

    for (const item of items) {
        point += item.weight;
        if (point >= selectedPoint) {
            selectedName = item.name;
            break;
        }
    }

    return selectedName;
}

export class DBWeeklyChallenge {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }

    getChallengeDocuments(): Promise<WeeklyChallenge> {
        return new Promise(async (resolve, reject) => {
            try {
                const weeklyChallenge = cache.getWeeklyChallenge();

                if (weeklyChallenge) {
                    resolve(weeklyChallenge);
                } else {
                    const db = this.dbInterface.maintenance.getConnection();

                    const collection = db.collection<WeeklyChallengeDocument>(
                        this.dbInterface.collections.weeklyChallenge.name
                    );

                    const doesChallengeExist = await collection.findOne(
                        {
                            latestWednesday: id.weekId(new Date()),
                        },
                        {
                            projection: {
                                bossName: 1,
                            },
                        }
                    );

                    if (!doesChallengeExist) {
                        await this.selectNewChallenge();
                    }

                    const data = await collection
                        .find({
                            latestWednesday: id.weekId(new Date()),
                        })
                        .toArray();

                    let weeklyChallenge = {} as WeeklyChallenge;

                    for (let document of data) {
                        weeklyChallenge[document.difficulty] = document;
                    }

                    cache.setWeeklyChallenge(weeklyChallenge);

                    resolve(weeklyChallenge);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    getCurrentChallenge(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeDocument>(
                    this.dbInterface.collections.weeklyChallenge.name
                );
                const data = await collection.findOne(
                    {
                        latestWednesday: id.weekId(new Date()),
                    },
                    {
                        projection: {
                            bossName: 1,
                        },
                    }
                );

                if (!data) {
                    const newChallenge = await this.selectNewChallenge();
                    resolve(newChallenge);
                } else {
                    resolve(data.bossName);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    selectNewChallenge(): Promise<string> {
        return new Promise(async (resolve, reject) => {
            try {
                const raffleItems =
                    environment.currentContent.raids[0].bosses.map((boss) => ({
                        name: boss.name,
                        weight: 100,
                    }));

                const selectedChallenge = raffle(raffleItems);

                const documentManagers =
                    environment.currentContent.completionDifficulties.map(
                        (difficulty) =>
                            new documentManager.weeklyChallenge({
                                bossName: selectedChallenge,
                                difficulty: difficulty,
                            })
                    );

                for (const document of documentManagers) {
                    await this.saveChallenge(document);
                }

                resolve(selectedChallenge);
            } catch (err) {
                reject(err);
            }
        });
    }

    saveChallenge(
        newDataManager: WeeklyChallengeDocumentController,
        session?: ClientSession
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeDocument>(
                    this.dbInterface.collections.weeklyChallenge.name
                );

                const docId = newDataManager.getDocument()._id;

                const oldData = await collection.findOne(
                    { _id: docId },
                    { session }
                );

                if (!oldData) {
                    await collection.insertOne(newDataManager.getDocument(), {
                        session,
                    });
                } else {
                    const oldDocumentManager =
                        new documentManager.weeklyChallenge(oldData);

                    oldDocumentManager.mergeDocument(
                        newDataManager.getDocument()
                    );
                    const newDocument = oldDocumentManager.getDocument();

                    await collection.updateOne(
                        {
                            _id: newDocument._id,
                        },
                        {
                            $set: newDocument,
                        },
                        { session }
                    );
                }

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    cleanupWeeklyChallenge(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyChallengeDocument>(
                    this.dbInterface.collections.weeklyChallenge.name
                );

                await collection.deleteMany({
                    latestWednesday: {
                        $ne: id.weekId(new Date()),
                    },
                });

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }
}

export default DBWeeklyChallenge;
