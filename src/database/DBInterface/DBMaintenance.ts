import { DBTaskManager } from "./../DBTaskManager";
import { ClientSession, ObjectId } from "mongodb";
import { DatabaseInterface } from ".";
import environment from "../../environment";
import { LastLogIds } from "../../helpers";
import { ERR_DB_DOC_DOES_NOT_EXIST } from "../../helpers/errors";
import { Realm } from "../../types";
import dbConnection from "../DBConnection";
const prompt = require("prompt-sync")();

export interface MaintenanceDocument {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: {
        [key in Realm]?: number;
    };
    isInitalized: boolean;
}

export class DBMaintenance {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: LastLogIds;
    isInitalized: boolean;

    private dbInterface: DatabaseInterface;
    private dbTaskManager: DBTaskManager;

    constructor(dbInterface: DatabaseInterface, dBTaskManager: DBTaskManager) {
        this.dbInterface = dbInterface;
        this.dbTaskManager = dBTaskManager;

        this._id = new ObjectId();
        this.lastUpdated = 0;
        this.lastGuildsUpdate = 0;
        this.lastLogIds = {};
        this.isInitalized = true;
    }

    async start() {
        try {
            await dbConnection.connect();
            if (!(await this.dbInterface.initializer.isInitalized())) {
                await this.dbInterface.initializer.initalizeDatabase();
            } else if (environment.forceInit) {
                const confirmation = prompt(
                    "The database is already initalized, are you sure to reinitalize it? (Y/n)"
                );

                if (confirmation === "y" || confirmation === "Y") {
                    await this.dbInterface.initializer.initalizeDatabase();
                    process.exit(0);
                }
            }

            const connection = dbConnection.getConnection();
            const maintenanceCollection =
                connection.collection<MaintenanceDocument>(
                    this.dbInterface.collections.maintenance
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

        this.dbTaskManager.start();
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
                        this.dbInterface.collections.maintenance
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

    getClient() {
        return dbConnection.getClient();
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

export default DBMaintenance;
