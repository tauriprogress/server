import { ClientSession } from "mongodb";
import { DatabaseInterface } from ".";
import { GuildDocument, GuildList, id } from "../../helpers";
import documentManager, {
    GuildDocumentController,
} from "../../helpers/documents";
import { ERR_GUILD_NOT_FOUND } from "../../helpers/errors";
import { Realm } from "../../types";
import cache from "../Cache";
import log from "../../helpers/log";

export class DBGuild {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }
    async getGuildList(): Promise<GuildList> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const guildList = cache.getGuildList();

                if (guildList) {
                    resolve(guildList);
                } else {
                    const guildList = (await db
                        .collection<GuildDocument>(
                            this.dbInterface.collections.guilds
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
                const db = this.dbInterface.maintenance.getConnection();

                const guild = await db
                    .collection<GuildDocument>(
                        this.dbInterface.collections.guilds
                    )
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
                const db = this.dbInterface.maintenance.getConnection();

                const guildsCollection = db.collection<GuildDocument>(
                    this.dbInterface.collections.guilds
                );

                let oldGuild = await guildsCollection.findOne(
                    {
                        _id: guild.getDocument()._id,
                    },
                    { session }
                );

                if (!oldGuild) {
                    guild.refreshValues();
                    await guildsCollection.insertOne(guild.getDocument(), {
                        session,
                    });
                } else {
                    const guildDocumentManager = new documentManager.guild(
                        oldGuild,
                        log
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
                const db = this.dbInterface.maintenance.getConnection();

                await db
                    .collection<GuildDocument>(
                        this.dbInterface.collections.guilds
                    )
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

export default DBGuild;
