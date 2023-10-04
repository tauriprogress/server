import { ClientSession } from "mongodb";
import { DatabaseInterface } from ".";
import {
    WeeklyGuildFullClearDocument,
    WeeklyGuildFullClearDocumentController,
    log,
    time,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import cache from "../Cache";

export class DBWeekly {
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
                    this.dbInterface.collections.weeklyGuildFullClear
                );

                let oldData = await collection.findOne(
                    {
                        _id: newDataManager.getDocument()._id,
                    },
                    { session }
                );

                if (!oldData) {
                    await collection.insertOne(newDataManager.getDocument(), {
                        session,
                    });
                } else {
                    const oldDataManager =
                        new documentManager.weeklyGuildFullClear(oldData, log);

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
                        );

                    let guildFullClears = await collection
                        .find({
                            latestWednesday: time.dateToString(
                                time.getLatestWednesday()
                            ),
                        })
                        .toArray();
                    guildFullClears = guildFullClears.filter((doc) => doc.time);

                    guildFullClears.sort((a, b) => {
                        if (a.time && b.time) {
                            return a.time - b.time;
                        }

                        return 0;
                    });

                    cache.setWeeklyGuildFullClear(guildFullClears);
                    resolve(guildFullClears);
                }
            } catch (err) {
                reject(err);
            }
        });
    }
}

export default DBWeekly;
