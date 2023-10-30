import { Db } from "mongodb";
import { Collection } from ".";

export class CharacterLeaderboardDpsCollection extends Collection {
    public name: (typeof characterLeaderboardDpsCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof characterLeaderboardDpsCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const characterLeaderboardDpsCollectionMetaData = {
    name: "CharacterLeaderboardDps",
    clearable: true,
    classConstructor: CharacterLeaderboardDpsCollection,
} as const;
