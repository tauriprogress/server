import { DatabaseInterface } from "../DBInterface";
import { Collection } from "./Collection";

export class CharacterLeaderboardDpsCollection extends Collection {
    public name: (typeof characterLeaderboardDpsCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof characterLeaderboardDpsCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const characterLeaderboardDpsCollectionMetaData = {
    name: "CharacterLeaderboardDps",
    clearable: true,
    classConstructor: CharacterLeaderboardDpsCollection,
} as const;
