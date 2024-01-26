import { Collection } from "./Collection";
import { DatabaseInterface } from "../DBInterface";

export class WeeklyChallengeVotesCollection extends Collection {
    public name: (typeof weeklyChallengeVotesCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof weeklyChallengeVotesCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const weeklyChallengeVotesCollectionMetaData = {
    name: "WeeklyChallengeVotes",
    clearable: false,
    classConstructor: WeeklyChallengeVotesCollection,
} as const;
