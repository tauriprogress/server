import { Db } from "mongodb";
import { ERR_DB_COLLECTION_NOT_CLEARABLE } from "../../helpers/errors";
import { generateCharacterDocumentCollections } from "./CharacterDocumentCollection";
import { characterLeaderboardDpsCollectionMetaData } from "./CharacterLeaderboardDpsCollection";
import { characterLeaderboardHpsCollectionMetaData } from "./CharacterLeaderboardHpsCollection";
import { guildsCollectionMetaData } from "./DBGuildsCollection";
import { maintenanceCollectionMetaData } from "./DBMaintenanceCollection";
import { raidBossesCollectionMetaData } from "./DBRaidBossesCollection";
import { weeklyGuildFullClearCollectionMetaData } from "./DBWeeklyGuildFullClearCollection";

export class Collection {
    public name;
    public clearable;
    private dbConnection;

    constructor(dbConnection: Db, collectionMetaData: CollectionMetaData) {
        this.name = collectionMetaData.name;
        this.clearable = collectionMetaData.clearable;
        this.dbConnection = dbConnection;
    }

    clearCollection(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.clearable) {
                    throw ERR_DB_COLLECTION_NOT_CLEARABLE;
                }

                await this.dbConnection.collection(this.name).deleteMany();

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }
}

export type CollectionMetaData = {
    name: string;
    clearable: boolean;
};

export function createCollections(db: Db) {
    return {
        guilds: new guildsCollectionMetaData.classConstructor(
            db,
            guildsCollectionMetaData
        ),
        maintenance: new maintenanceCollectionMetaData.classConstructor(
            db,
            maintenanceCollectionMetaData
        ),
        raidBosses: new raidBossesCollectionMetaData.classConstructor(
            db,
            raidBossesCollectionMetaData
        ),
        weeklyGuildFullClear:
            new weeklyGuildFullClearCollectionMetaData.classConstructor(
                db,
                weeklyGuildFullClearCollectionMetaData
            ),
        characterLeaderboardDps:
            new characterLeaderboardDpsCollectionMetaData.classConstructor(
                db,
                characterLeaderboardDpsCollectionMetaData
            ),
        characterLeaderboardHps:
            new characterLeaderboardHpsCollectionMetaData.classConstructor(
                db,
                characterLeaderboardHpsCollectionMetaData
            ),
        ...generateCharacterDocumentCollections(db),
    } as const;
}
