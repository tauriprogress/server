import { ClientSession, ReadConcern } from "mongodb";
import { Faction } from "tauriprogress-constants/build/globalTypes";
import { DatabaseInterface } from ".";
import environment from "../../environment";
import {
    CharacterDocument,
    GuildDocument,
    LastLogIds,
    RaidBossDocument,
    RaidBosses,
    id,
    log,
    runGC,
    time,
    validator,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import {
    ERR_DB_ALREADY_UPDATING,
    ERR_DB_TANSACTION,
    ERR_GUILD_NOT_FOUND,
} from "../../helpers/errors";
import { ClassId, CombatMetric, LooseObject, Realm, SpecId } from "../../types";
import cache from "../Cache";

export class DBUpdate {
    public isUpdating: boolean;
    private updatedRaidbosses: ReturnType<typeof id.raidBossId>[];

    private updatedCharacterDocumentCollections: ReturnType<
        typeof id.characterDocumentCollectionId
    >[];
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
        this.isUpdating = false;
        this.updatedRaidbosses = [];
        this.updatedCharacterDocumentCollections = [];
    }

    addToUpdatedCharacterDocumentCollections(
        characterDocumentCollectionId: ReturnType<
            typeof id.characterDocumentCollectionId
        >
    ) {
        this.updatedCharacterDocumentCollections.push(
            characterDocumentCollectionId
        );
    }

    getUpdatedCharacterDocumentCollectionIds() {
        let ids: { [key: string]: true } = {};

        for (const collectionName of this.updatedCharacterDocumentCollections) {
            ids[collectionName] = true;
        }
        return Object.keys(ids);
    }

    resetUpdatedCharacterDocumentCollections() {
        this.updatedCharacterDocumentCollections = [];
    }

    addToUpdatedRaidbosses(bossId: ReturnType<typeof id.raidBossId>) {
        this.updatedRaidbosses.push(bossId);
    }

    getUpdatedBossIds() {
        let bossIds: { [key: string]: true } = {};

        for (const bossId of this.updatedRaidbosses) {
            bossIds[bossId] = true;
        }
        return Object.keys(bossIds);
    }

    resetUpdatedBossIds() {
        this.updatedRaidbosses = [];
    }

    async saveLogs(
        {
            bosses,
            guilds,
            characterCollection,
        }: ReturnType<typeof log.processLogs>,
        {
            lastLogIds,
            updateStarted,
        }: { lastLogIds: LastLogIds; updateStarted: number },
        session?: ClientSession
    ) {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                await this.bulkWriteRaidBosses(bosses, session);
                runGC();

                console.log("db: Saving guilds");
                for (const guildId in guilds) {
                    await this.dbInterface.guild.saveGuild(
                        guilds[guildId],
                        session
                    );
                }

                console.log("Saving chars");
                const operationsOfCharacterDocumentCollections: LooseObject =
                    {};

                for (const bossId in characterCollection) {
                    for (const combatMetricKey in characterCollection[bossId]) {
                        const combatMetric = combatMetricKey as CombatMetric;
                        for (const charId in characterCollection[bossId][
                            combatMetric
                        ]) {
                            const [ingameBossId, difficulty] =
                                id.deconstruct.raidBossId(bossId);
                            const characterDocumentCollectionId =
                                id.characterDocumentCollectionId(
                                    ingameBossId,
                                    difficulty,
                                    combatMetric
                                );

                            const char =
                                characterCollection[bossId][combatMetric][
                                    charId
                                ];

                            if (
                                !operationsOfCharacterDocumentCollections[
                                    characterDocumentCollectionId
                                ]
                            ) {
                                operationsOfCharacterDocumentCollections[
                                    characterDocumentCollectionId
                                ] = [];
                            }

                            operationsOfCharacterDocumentCollections[
                                characterDocumentCollectionId
                            ].push(
                                {
                                    updateOne: {
                                        filter: {
                                            _id: char._id,
                                        },
                                        update: {
                                            $setOnInsert: char,
                                        },
                                        upsert: true,
                                    },
                                },
                                {
                                    updateOne: {
                                        filter: {
                                            _id: char._id,
                                            [combatMetric]: {
                                                $lt: char[combatMetric],
                                            },
                                        },
                                        update: { $set: char },
                                    },
                                }
                            );
                        }
                    }
                }

                for (const characterDocumentCollectionId in operationsOfCharacterDocumentCollections) {
                    console.log(`${characterDocumentCollectionId}`);

                    const bossCollection = db.collection<CharacterDocument>(
                        characterDocumentCollectionId
                    );
                    await bossCollection.bulkWrite(
                        operationsOfCharacterDocumentCollections[
                            characterDocumentCollectionId
                        ],
                        { session }
                    );

                    this.addToUpdatedCharacterDocumentCollections(
                        characterDocumentCollectionId
                    );
                }

                console.log("Saving chars done");

                console.log("Saving characters to leaderboard.");
                for (const bossId in characterCollection) {
                    for (const combatMetricKey in characterCollection[bossId]) {
                        const combatMetric = combatMetricKey as CombatMetric;

                        const [ingameBossId, difficulty] =
                            id.deconstruct.raidBossId(bossId);
                        const raidName =
                            environment.getRaidNameFromIngamebossId(
                                ingameBossId
                            );

                        const bossName =
                            environment.getRaidBossNameFromIngameBossId(
                                ingameBossId
                            );

                        if (raidName && bossName)
                            await this.dbInterface.leaderboard.saveCharactersToLeaderboard(
                                Object.values(
                                    characterCollection[bossId][combatMetric]
                                ),
                                raidName,
                                difficulty,
                                bossName,
                                combatMetric,
                                session
                            );
                    }
                }

                console.log("Characters saved to leaderboards.");

                await this.dbInterface.maintenance.updateDocument(
                    {
                        lastUpdated: updateStarted,
                        lastLogIds: lastLogIds,
                        isInitalized: true,
                    },
                    session
                );
            } catch (err) {
                this.resetUpdatedBossIds();
                this.resetUpdatedCharacterDocumentCollections();
                reject(err);
            }
            resolve(true);
        });
    }

    async bulkWriteRaidBosses(
        bosses: RaidBosses,
        session?: ClientSession
    ): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                console.log("db: Saving raid bosses");
                const raidBossCollection = db.collection<RaidBossDocument>(
                    this.dbInterface.collections.raidBosses
                );

                const oldBosses = (await raidBossCollection
                    .aggregate(
                        [
                            {
                                $match: {
                                    _id: {
                                        $in: Object.keys(bosses),
                                    },
                                },
                            },
                        ],
                        { session }
                    )
                    .toArray()) as RaidBossDocument[];

                let operations = [];

                for (const bossId in bosses) {
                    const currentBoss = bosses[bossId];
                    const oldBoss = oldBosses.find(
                        (boss) => boss._id === bossId
                    );
                    if (!oldBoss) continue;

                    const raidBossDocumentManager =
                        new documentManager.raidBoss(oldBoss);

                    raidBossDocumentManager.mergeRaidBossDocument(
                        currentBoss.getDocument()
                    );

                    const newDocument = raidBossDocumentManager.getDocument();

                    operations.push({
                        updateOne: {
                            filter: {
                                _id: oldBoss._id,
                            },
                            update: {
                                $set: newDocument,
                            },
                        },
                    });
                }

                if (operations.length) {
                    await raidBossCollection.bulkWrite(operations, {
                        session,
                    });

                    for (const operation of operations) {
                        this.addToUpdatedRaidbosses(
                            operation.updateOne.filter._id
                        );
                    }
                }

                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    public updateDatabase() {
        return new Promise(async (resolve, reject) => {
            try {
                const client = this.dbInterface.maintenance.getClient();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                console.log("Updating database.");
                const updateStarted = time.getCurrentDateInSeconds();
                this.isUpdating = true;

                const maintenanceDocument =
                    this.dbInterface.maintenance.getDocument();

                const lastLogIds = maintenanceDocument.lastLogIds;

                let { logs, lastLogIds: newLastLogIds } =
                    await log.requestRaidLogs(lastLogIds);

                logs = log.filterRaidLogBugs(logs);
                const session = client.startSession();

                try {
                    console.log("Opening new transaction session");
                    const processedData = log.processLogs(logs);
                    await session.withTransaction(
                        async () => {
                            await this.saveLogs(
                                processedData,
                                {
                                    lastLogIds: newLastLogIds,
                                    updateStarted,
                                },
                                session
                            );
                        },
                        {
                            readConcern: new ReadConcern("majority"),
                            writeConcern: {
                                w: "majority",
                                j: true,
                            },
                        }
                    );
                } catch (err) {
                    console.log("transaction error");
                    console.error(err);
                    throw ERR_DB_TANSACTION;
                } finally {
                    session.endSession();
                    console.log("Transaction session closed");
                }

                await this.dbInterface.raidboss.updateRaidBossCache();
                await this.updateCharacterDocumentRanks();

                cache.clearRaidSummary();
                cache.clearCharacterPerformance();
                cache.clearCharacterLeaderboard();
                cache.clearWeeklyGuildFullClear();

                this.isUpdating = false;

                console.log("Database update finished");
                resolve(true);
            } catch (err) {
                if (
                    !validator.isError(err) ||
                    err.message !== ERR_DB_ALREADY_UPDATING.message
                ) {
                    console.log(`Database update error`);
                    this.isUpdating = false;
                }

                reject(err);
            }
        });
    }

    updateGuilds(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();
                if (this.isUpdating) throw ERR_DB_ALREADY_UPDATING;

                const maintenanceDocument =
                    this.dbInterface.maintenance.getDocument();

                if (
                    time.minutesAgo(maintenanceDocument.lastGuildsUpdate) >
                    60 * 36
                ) {
                    const updateStarted = new Date().getTime() / 1000;

                    console.log("Updating guilds");
                    this.isUpdating = true;

                    await this.dbInterface.maintenance.updateDocument({
                        lastGuildsUpdate: updateStarted,
                    });

                    const guilds = (await db
                        .collection<GuildDocument>(
                            this.dbInterface.collections.guilds
                        )
                        .find()
                        .project({
                            _id: 1,
                            name: 1,
                            realm: 1,
                            f: 1,
                        })
                        .toArray()) as {
                        _id: ReturnType<typeof id.guildId>;
                        name: string;
                        realm: Realm;
                        f: Faction;
                    }[];

                    let total = guilds.length;
                    let current = 0;

                    for (let guild of guilds) {
                        try {
                            current++;
                            console.log(
                                `Updating ${guild.name} ${current}/${total}`
                            );

                            const newGuildDoc = new documentManager.guild(
                                {
                                    guildName: guild.name,
                                    realm: guild.realm,
                                    faction: guild.f,
                                },
                                log
                            );

                            await newGuildDoc.extendData();

                            await this.dbInterface.guild.saveGuild(newGuildDoc);
                        } catch (err) {
                            if (
                                validator.isError(err) &&
                                err.message &&
                                err.message.includes(
                                    ERR_GUILD_NOT_FOUND.message
                                )
                            ) {
                                this.dbInterface.guild.removeGuild(guild._id);
                            } else {
                                console.log(
                                    `Error while updating ${guild.name}:`
                                );
                                console.error(err);
                            }
                        }
                    }

                    this.isUpdating = false;

                    console.log("Guilds updated.");
                } else {
                    console.log("Guild update is not due yet.");
                }

                resolve();
            } catch (err) {
                if (
                    !validator.isError(err) ||
                    !err.message.includes(ERR_DB_ALREADY_UPDATING.message)
                ) {
                    this.isUpdating = false;
                }

                reject(err);
            }
        });
    }

    updateCharacterDocumentRanks() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log("Updating character ranks.");
                const db = this.dbInterface.maintenance.getConnection();

                const collectionsToUpdate =
                    this.getUpdatedCharacterDocumentCollectionIds();
                for (const collectionId of collectionsToUpdate) {
                    const collection =
                        db.collection<CharacterDocument>(collectionId);
                    const [_1, _2, combatMetric] =
                        id.deconstruct.characterDocumentCollectionId(
                            collectionId
                        );

                    await collection.bulkWrite(
                        getCharacterDocumentRankBulkwriteOperations(
                            await collection
                                .find()
                                .sort({
                                    [combatMetric]: -1,
                                })
                                .toArray()
                        )
                    );
                }

                this.resetUpdatedCharacterDocumentCollections();

                console.log("Character ranks updated.");

                resolve(true);
            } catch (e) {
                reject(e);
            }
        });
    }
}

export function getCharacterDocumentRankBulkwriteOperations(
    characters: CharacterDocument[]
) {
    let classes = environment.classIds.reduce((acc, classId) => {
        acc[classId] = 0;
        return acc;
    }, {} as { [key: number]: number }) as { [key in ClassId]: number };

    let specs = environment.specIds.reduce((acc, specId) => {
        acc[specId] = 0;
        return acc;
    }, {} as { [key: number]: number }) as { [key in SpecId]: number };

    return characters.map((character, i) => {
        classes[character.class] += 1;
        specs[character.spec] += 1;
        return {
            updateOne: {
                filter: {
                    _id: character._id,
                },
                update: {
                    $set: {
                        rank: i + 1,
                        cRank: classes[character.class],
                        sRank: specs[character.spec],
                    },
                },
            },
        };
    });
}

export default DBUpdate;
