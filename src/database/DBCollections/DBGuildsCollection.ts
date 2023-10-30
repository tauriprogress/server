import { Db } from "mongodb";
import { Collection } from ".";

export class GuildsCollection extends Collection {
    public name: (typeof guildsCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof guildsCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const guildsCollectionMetaData = {
    name: "Guilds",
    clearable: true,
    classConstructor: GuildsCollection,
} as const;
