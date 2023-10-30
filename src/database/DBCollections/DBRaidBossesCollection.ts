import { Db } from "mongodb";
import { Collection } from ".";

export class RaidBossesCollection extends Collection {
    public name: (typeof raidBossesCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof raidBossesCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const raidBossesCollectionMetaData = {
    name: "RaidBosses",
    clearable: true,
    classConstructor: RaidBossesCollection,
} as const;
