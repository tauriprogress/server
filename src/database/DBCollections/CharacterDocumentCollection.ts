import { Collection } from "./Collection";
import environment from "../../environment";
import { id } from "../../helpers";
import { Difficulty } from "../../types";
import { DatabaseInterface } from "../DBInterface";

export class CharacterDocumentCollection extends Collection {
    public name: CharacterDocumentCollectionMetaDataType["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: CharacterDocumentCollectionMetaDataType
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

type CharacterDocumentCollectionMetaDataType = {
    name: ReturnType<typeof charaterDocumentCollectionsArray>[number]["name"];
    clearable: true;
    classConstructor: Object;
};

function charaterDocumentCollectionsArray() {
    let collections = [];

    for (const raid of environment.currentContent.raids) {
        for (const boss of raid.bosses) {
            for (const difficulty in boss.bossIdOfDifficulty) {
                for (const combatMetric of environment.combatMetrics) {
                    const diff = Number(difficulty) as Difficulty;

                    const ingameBossId =
                        boss.bossIdOfDifficulty[
                            diff as keyof typeof boss.bossIdOfDifficulty
                        ];
                    const val = {
                        name: id.characterDocumentCollectionId(
                            ingameBossId,
                            diff,
                            combatMetric
                        ),
                        clearable: true,
                        classConstructor: CharacterDocumentCollection,
                    } as const;
                    collections.push(val);
                }
            }
        }
    }

    return collections;
}

type CharacterDocumentCollections = {
    [key in CharacterDocumentCollectionMetaDataType["name"]]: CharacterDocumentCollection;
};

export function generateCharacterDocumentCollections(
    dbInterface: DatabaseInterface
): CharacterDocumentCollections {
    let collections = charaterDocumentCollectionsArray();

    let obj = {} as CharacterDocumentCollections;

    for (let collectionMetaData of collections) {
        obj[collectionMetaData.name] = new collectionMetaData.classConstructor(
            dbInterface,
            collectionMetaData
        );
    }

    return obj;
}
