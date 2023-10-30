import { Db } from "mongodb";
import { Collection } from ".";

export class WeeklyGuildFullClearCollection extends Collection {
    public name: (typeof weeklyGuildFullClearCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof weeklyGuildFullClearCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const weeklyGuildFullClearCollectionMetaData = {
    name: "WeeklyGuildFullClear",
    clearable: true,
    classConstructor: WeeklyGuildFullClearCollection,
} as const;
