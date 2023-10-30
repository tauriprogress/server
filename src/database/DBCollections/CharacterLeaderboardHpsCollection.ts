import { Db } from "mongodb";
import { Collection } from ".";

export class CharacterLeaderboardHpsCollection extends Collection {
    public name: (typeof characterLeaderboardHpsCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof characterLeaderboardHpsCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const characterLeaderboardHpsCollectionMetaData = {
    name: "CharacterLeaderboardHps",
    clearable: true,
    classConstructor: CharacterLeaderboardHpsCollection,
} as const;
