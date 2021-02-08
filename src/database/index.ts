import * as fs from "fs";
import { environment } from "../environment";
import cache from "./cache";

import { MongoClient, Db } from "mongodb";
import { Maintenance } from "../types";

const connectionErrorMessage = "Not connected to database.";

class Database {
    public db: Db | undefined;

    private client: MongoClient | undefined;

    private lastUpdated: number;
    private lastGuildsUpdate: number;
    private isUpdating: boolean;
    private updateStatus: string;

    constructor() {
        this.db = undefined;
        this.client = undefined;

        this.lastUpdated = 0;
        this.lastGuildsUpdate = 0;
        this.isUpdating = false;
        this.updateStatus = "";
    }

    async connect() {
        try {
            console.log("Connecting to database");
            this.client = await MongoClient.connect(
                `mongodb+srv://${environment.MONGODB_USER}:${environment.MONGODB_PASSWORD}@${environment.MONGODB_ADDRESS}`,
                {
                    useUnifiedTopology: true,
                    useNewUrlParser: true
                }
            );

            this.db = this.client.db("tauriprogress");

            this.lastUpdated = await this.getLastUpdated();
            this.lastGuildsUpdate = await this.getLastGuildsUpdate();
        } catch (err) {
            throw err;
        }
    }

    async getLastUpdated(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as Maintenance | null;

                resolve(maintenance ? maintenance.lastUpdated : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getLastGuildsUpdate(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as Maintenance | null;

                resolve(maintenance ? maintenance.lastGuildsUpdate : 0);
            } catch (err) {
                reject(err);
            }
        });
    }
}

const db = new Database();

export default db;
