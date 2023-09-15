import { ClientSession } from "mongodb";
import {
    GuildDocument,
    MaintenanceDocument,
    id,
    GuildDocumentController,
} from "../helpers";
import { ERR_GUILD_NOT_FOUND } from "../helpers/errors";
import { GuildList, Realm } from "../types";
import dbInterface from "./DBInterface";
import dbConnection from "./DBConnection";
import cache from "./Cache";
import documentManager from "../helpers/documents";

class DBGuild {
    async getLastGuildsUpdate(): Promise<number> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                const maintenance = await db
                    .collection<MaintenanceDocument>(
                        dbInterface.collections.maintenance
                    )
                    .findOne();

                resolve(maintenance ? maintenance.lastGuildsUpdate : 0);
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuildList(): Promise<GuildList> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                const guildList = cache.getGuildList();

                if (guildList) {
                    resolve(guildList);
                } else {
                    const guildList = (await db
                        .collection<GuildDocument>(
                            dbInterface.collections.guilds
                        )
                        .find()
                        .project({
                            name: 1,
                            f: 1,
                            realm: 1,
                            activity: 1,
                            ["progression.completion"]: 1,
                        })
                        .toArray()) as GuildList;

                    cache.guildList.set(cache.guildListId, guildList);

                    resolve(guildList);
                }
            } catch (err) {
                reject(err);
            }
        });
    }

    async getGuild(realm: Realm, guildName: string) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                const guild = await db
                    .collection<GuildDocument>(dbInterface.collections.guilds)
                    .findOne({
                        name: guildName,
                        realm: realm,
                    });

                if (!guild) throw ERR_GUILD_NOT_FOUND;

                resolve(guild);
            } catch (err) {
                reject(err);
            }
        });
    }

    async saveGuild(guild: GuildDocumentController, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                const guildsCollection = db.collection<GuildDocument>(
                    dbInterface.collections.guilds
                );

                let oldGuild = await guildsCollection.findOne(
                    {
                        _id: guild._id,
                    },
                    { session }
                );

                if (!oldGuild) {
                    await guildsCollection.insertOne(guild.getDocument(), {
                        session,
                    });
                } else {
                    const guildDocumentManager = new documentManager.guild(
                        oldGuild
                    );
                    guildDocumentManager.mergeGuildDocument(
                        guild.getDocument()
                    );
                    const newDocument = guildDocumentManager.getDocument();

                    await guildsCollection.updateOne(
                        {
                            _id: newDocument._id,
                        },
                        {
                            $set: newDocument,
                        },
                        { session }
                    );
                }
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }

    async removeGuild(_id: ReturnType<typeof id.guildId>) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbConnection.getConnection();

                await db
                    .collection<GuildDocument>(dbInterface.collections.guilds)
                    .deleteOne({
                        _id: _id,
                    });
                resolve(true);
            } catch (err) {
                reject(err);
            }
        });
    }
}

const dbGuild = new DBGuild();

export default dbGuild;
