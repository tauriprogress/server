import { Collection } from "./Collection";
import { DatabaseInterface } from "../DBInterface";

export class WeeklyChallengeCollection extends Collection {
    public name: (typeof weeklyChallengeCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof weeklyChallengeCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const weeklyChallengeCollectionMetaData = {
    name: "WeeklyChallenge",
    clearable: false,
    classConstructor: WeeklyChallengeCollection,
} as const;
