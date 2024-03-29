import { ClientSession } from "mongodb";
import { DatabaseInterface } from ".";
import {
    WeeklyGuildFullClearDocument,
    WeeklyGuildFullClearDocumentController,
    id,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import cache from "../cache";

export class DBWeeklyGuildFullClear {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }

    saveGuildFullClear(
        newDataManager: WeeklyGuildFullClearDocumentController,
        session?: ClientSession
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyGuildFullClearDocument>(
                    this.dbInterface.collections.weeklyGuildFullClear.name
                );

                let tempNewDoc = newDataManager.getDocument();

                let documents = await collection
                    .find(
                        {
                            difficulty: tempNewDoc.difficulty,
                            f: tempNewDoc.f,
                            realm: tempNewDoc.realm,
                            guildName: tempNewDoc.guildName,
                            latestWednesday: tempNewDoc.latestWednesday,
                        },
                        { session }
                    )
                    .toArray();

                let oldData = documents.reduce(
                    (acc: undefined | WeeklyGuildFullClearDocument, curr) => {
                        if (newDataManager.isSameRaidGroup(curr)) {
                            return curr;
                        }
                        return acc;
                    },
                    undefined
                );

                if (!oldData) {
                    await collection.insertOne(newDataManager.getDocument(), {
                        session,
                    });
                } else {
                    const oldDataManager =
                        new documentManager.weeklyGuildFullClear(oldData);

                    oldDataManager.mergeDocument(newDataManager.getDocument());
                    const newDocument = oldDataManager.getDocument();

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

    getGuildFullClear(): Promise<WeeklyGuildFullClearDocument[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const guildFullClears = cache.getWeeklyFullClear();

                if (guildFullClears) {
                    resolve(guildFullClears);
                } else {
                    const collection =
                        db.collection<WeeklyGuildFullClearDocument>(
                            this.dbInterface.collections.weeklyGuildFullClear
                                .name
                        );

                    const guildFullClears = await collection
                        .find({
                            latestWednesday: id.weekId(new Date()),
                            time: {
                                $gt: 0,
                            },
                        })
                        .sort({
                            time: 1,
                        })
                        .toArray();

                    cache.setWeeklyGuildFullClear(guildFullClears);
                    resolve(guildFullClears);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    cleanupGuildFullClear(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const collection = db.collection<WeeklyGuildFullClearDocument>(
                    this.dbInterface.collections.weeklyGuildFullClear.name
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

export default DBWeeklyGuildFullClear;
