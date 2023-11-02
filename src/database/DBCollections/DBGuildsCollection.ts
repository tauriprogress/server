import { Collection } from "./Collection";
import { DatabaseInterface } from "../DBInterface";

export class GuildsCollection extends Collection {
    public name: (typeof guildsCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof guildsCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const guildsCollectionMetaData = {
    name: "Guilds",
    clearable: true,
    classConstructor: GuildsCollection,
} as const;
