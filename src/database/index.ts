import * as fs from "fs";
import { environment } from "../environment";
import cache from "./cache";

import { getBossCollectionName } from "../helpers";

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

    async initalizeDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                console.log("db: Initalizing database");
                this.db.dropDatabase();

                console.log("db: Creating maintenance collection");
                const maintenanceCollection = await this.db.collection(
                    "maintenance"
                );

                if (await maintenanceCollection.findOne({}))
                    await maintenanceCollection.deleteMany({});

                const defaultMaintenance: Maintenance = {
                    lastUpdated: 0,
                    lastGuildsUpdate: 0,
                    lastLogIds: {},
                    isInitalized: true
                };

                maintenanceCollection.insertOne(defaultMaintenance);

                console.log("db: Creating guilds collection");
                const guildsCollection = await this.db.collection("guilds");
                if (await guildsCollection.findOne({}))
                    await guildsCollection.deleteMany({});

                console.log(`db: Creating collections for raids and bosses`);
                for (const raid of environment.currentContent.raids) {
                    const raidCollection = await this.db.collection(
                        String(raid.id)
                    );

                    if (await raidCollection.findOne({}))
                        await raidCollection.deleteMany({});

                    for (const boss of raid.bosses) {
                        for (const difficulty in boss.difficultyIds) {
                            for (const combatMetric of ["dps", "hps"]) {
                                const collectionName = getBossCollectionName(
                                    boss.difficultyIds[
                                        difficulty as keyof typeof boss.difficultyIds
                                    ],
                                    Number(difficulty),
                                    combatMetric
                                );
                                const bossCollection = await this.db.collection(
                                    collectionName
                                );

                                if (await bossCollection.findOne({}))
                                    await bossCollection.deleteMany({});
                            }
                        }
                    }
                }

                await this.update(true);
                console.log("db: Initalization done.");
                resolve(true);
            } catch (err) {
                this.isUpdating = false;
                reject(err);
            }
        });
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

    async isInitalized() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.db) throw new Error(connectionErrorMessage);

                const maintenance = (await this.db
                    .collection("maintenance")
                    .findOne({})) as Maintenance | null;

                resolve(maintenance ? maintenance.isInitalized : false);
            } catch (err) {
                reject(err);
            }
        });
    }
}

const db = new Database();

export default db;
