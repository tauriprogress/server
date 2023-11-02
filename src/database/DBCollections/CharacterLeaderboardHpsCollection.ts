import { Collection } from "./Collection";
import { DatabaseInterface } from "../DBInterface";

export class CharacterLeaderboardHpsCollection extends Collection {
    public name: (typeof characterLeaderboardHpsCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof characterLeaderboardHpsCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const characterLeaderboardHpsCollectionMetaData = {
    name: "CharacterLeaderboardHps",
    clearable: true,
    classConstructor: CharacterLeaderboardHpsCollection,
} as const;
