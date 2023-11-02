import { DatabaseInterface } from "../DBInterface";
import { Collection } from "./Collection";

export class RaidBossesCollection extends Collection {
    public name: (typeof raidBossesCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof raidBossesCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const raidBossesCollectionMetaData = {
    name: "RaidBosses",
    clearable: true,
    classConstructor: RaidBossesCollection,
} as const;
