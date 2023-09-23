import { ClientSession } from "mongodb";
import { GuildDocument, id } from "../helpers";
import documentManager, { GuildList } from "../helpers/documents";
import { ERR_GUILD_NOT_FOUND } from "../helpers/errors";
import { Realm } from "../types";
import cache from "./Cache";
import dbInterface from "./DBInterface";
import dbMaintenance from "./DBMaintenance";

class DBGuild {
    async getGuildList(): Promise<GuildList> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbMaintenance.getConnection();

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
                const db = dbMaintenance.getConnection();

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

    async saveGuild(guildDocument: GuildDocument, session?: ClientSession) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = dbMaintenance.getConnection();

                const guildsCollection = db.collection<GuildDocument>(
                    dbInterface.collections.guilds
                );

                let oldGuild = await guildsCollection.findOne(
                    {
                        _id: guildDocument._id,
                    },
                    { session }
                );

                if (!oldGuild) {
                    await guildsCollection.insertOne(guildDocument, {
                        session,
                    });
                } else {
                    const guildDocumentManager = new documentManager.guild(
                        oldGuild
                    );
                    guildDocumentManager.mergeGuildDocument(guildDocument);
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
                const db = dbMaintenance.getConnection();

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
