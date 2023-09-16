import { ClientSession, ObjectId } from "mongodb";
import { Realm, LastLogIds } from "../types";
import dbConnection from "./DBConnection";
import dbInterface from "./DBInterface";
import environment from "../environment";
import dbTaskManager from "./DBTaskManager";
import { ERR_DB_DOC_DOES_NOT_EXIST } from "../helpers/errors";

export interface MaintenanceDocument {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: {
        [key in Realm]?: number;
    };
    isInitalized: boolean;
}

class DBMaintenance {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: LastLogIds;
    isInitalized: boolean;

    constructor() {
        this._id = new ObjectId();
        this.lastUpdated = 0;
        this.lastGuildsUpdate = 0;
        this.lastLogIds = {};
        this.isInitalized = true;
    }

    async start() {
        try {
            await dbConnection.connect();
            if (!(await dbInterface.initializer.isInitalized())) {
                await dbInterface.initializer.initalizeDatabase();
            } else if (environment.forceInit) {
                const confirmation = prompt(
                    "The database is already initalized, are you sure to reinitalize it? (Y/n)"
                );

                if (confirmation === "y" || confirmation === "Y") {
                    await dbInterface.initializer.initalizeDatabase();
                    process.exit(0);
                }
            }

            const connection = dbConnection.getConnection();
            const maintenanceCollection =
                connection.collection<MaintenanceDocument>(
                    dbInterface.collections.maintenance
                );

            const doc = await maintenanceCollection.findOne();

            if (!doc) throw ERR_DB_DOC_DOES_NOT_EXIST;
            this._id = doc._id;
            this.lastUpdated = doc.lastUpdated;
            this.lastGuildsUpdate = doc.lastGuildsUpdate;
            this.isInitalized = doc.isInitalized;
            this.lastLogIds = doc.lastLogIds;
        } catch (err) {
            console.error(err);
            process.exit(1);
        }

        dbTaskManager.start();
    }

    updateDocument(
        doc: Partial<MaintenanceDocument>,
        session?: ClientSession
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const oldDoc = this.getDocument();

                const updatedDocument = {
                    ...oldDoc,
                    ...doc,
                    lastLogIds: {
                        ...oldDoc.lastLogIds,
                        ...doc.lastLogIds,
                    },
                };

                this._id = updatedDocument._id;
                this.lastUpdated = updatedDocument.lastUpdated;
                this.lastGuildsUpdate = updatedDocument.lastGuildsUpdate;
                this.isInitalized = updatedDocument.isInitalized;
                this.lastLogIds = updatedDocument.lastLogIds;

                await this.saveDocument(session);
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    private saveDocument(session?: ClientSession): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const connection = dbConnection.getConnection();
                const maintenanceCollection =
                    connection.collection<MaintenanceDocument>(
                        dbInterface.collections.maintenance
                    );

                await maintenanceCollection.updateOne(
                    {},
                    {
                        $set: this.getDocument(),
                    },
                    {
                        session,
                    }
                );
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }

    getConnection() {
        return dbConnection.getConnection();
    }

    getDocument(): MaintenanceDocument {
        return {
            _id: this._id,
            lastUpdated: this.lastUpdated,
            lastGuildsUpdate: this.lastGuildsUpdate,
            lastLogIds: this.lastLogIds,
            isInitalized: this.isInitalized,
        };
    }
}

export const dbMaintenance = new DBMaintenance();

export default dbMaintenance;
