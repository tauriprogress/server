import { DatabaseInterface } from "../DBInterface";
import { Collection } from "./Collection";

export class WeeklyGuildFullClearCollection extends Collection {
    public name: (typeof weeklyGuildFullClearCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof weeklyGuildFullClearCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const weeklyGuildFullClearCollectionMetaData = {
    name: "WeeklyGuildFullClear",
    clearable: true,
    classConstructor: WeeklyGuildFullClearCollection,
} as const;
