import { DatabaseInterface } from ".";
import environment from "../../environment";
import {
    CharacterDocument,
    CharacterDocumentCollectionId,
    CharacterPerformance,
    addNestedObjectValue,
    capitalize,
    getNestedObjectValue,
    getRelativePerformance,
    id,
} from "../../helpers";
import documentManager from "../../helpers/documents";
import { ClassId, CombatMetric, RaidName, Realm, SpecId } from "../../types";
import cache from "../cache";

export class DBCharacter {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }

    async getCharacterPerformance(
        characterName: string,
        characterClass: ClassId,
        realm: Realm,
        raidName: RaidName
    ): Promise<CharacterPerformance> {
        return new Promise(async (resolve, reject) => {
            try {
                const db = this.dbInterface.maintenance.getConnection();

                const cacheId = id.cache.characterPerformanceCacheId(
                    characterName,
                    realm,
                    raidName
                );

                const cachedData = cache.getCharacterPerformance(cacheId);

                if (cachedData) {
                    resolve(cachedData);
                } else {
                    const specs = environment.getSpecsOfClass(characterClass);

                    const characterIds = specs.map((specId) =>
                        id.characterId(characterName, realm, specId)
                    );

                    const bosses =
                        environment.getRaidInfoFromName(raidName).bosses;
                    const bossCount =
                        environment.getRaidInfoFromName(raidName).bossCount;

                    let facetCounter = 1;
                    let lookupCounter = 1;
                    let facet: { $facet: { [key: string]: object[] } } = {
                        $facet: {},
                    };

                    for (let bossInfo of bosses) {
                        const difficulties = Object.keys(
                            bossInfo.bossIdOfDifficulty
                        ).map((key) =>
                            Number(key)
                        ) as (keyof typeof bossInfo.bossIdOfDifficulty)[];

                        for (let difficulty of difficulties) {
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[difficulty];

                            for (let combatMetric of environment.combatMetrics) {
                                const collectionName =
                                    id.characterDocumentCollectionId(
                                        ingameBossId,
                                        difficulty,
                                        combatMetric
                                    );
                                if (!facet.$facet[facetCounter]) {
                                    facet.$facet[facetCounter] = [
                                        { $limit: 1 },
                                        { $project: { _id: 1 } },
                                    ];
                                }
                                facet.$facet[facetCounter].push({
                                    $lookup: {
                                        from: collectionName,
                                        pipeline: [
                                            {
                                                $match: {
                                                    _id: {
                                                        $in: characterIds,
                                                    },
                                                },
                                            },
                                        ],
                                        as: collectionName,
                                    },
                                });

                                lookupCounter += 1;
                                if (lookupCounter === 40) {
                                    facetCounter += 1;
                                    lookupCounter = 0;
                                }
                            }
                        }
                    }

                    const result = (
                        await db
                            .collection(
                                this.dbInterface.collections.maintenance.name
                            )
                            .aggregate([
                                { $limit: 1 },
                                { $project: { _id: 1 } },
                                facet,
                            ])
                            .toArray()
                    )[0];

                    let characterData = {} as {
                        [
                            key: CharacterDocumentCollectionId
                        ]: CharacterDocument[];
                    };

                    for (let i = 1; i <= facetCounter; i++) {
                        characterData = { ...characterData, ...result[i][0] };
                    }

                    let characterPerformance: CharacterPerformance =
                        {} as CharacterPerformance;

                    for (let bossInfo of bosses) {
                        const difficulties = Object.keys(
                            bossInfo.bossIdOfDifficulty
                        ).map((key) =>
                            Number(key)
                        ) as (keyof typeof bossInfo.bossIdOfDifficulty)[];

                        for (let difficulty of difficulties) {
                            const ingameBossId =
                                bossInfo.bossIdOfDifficulty[difficulty];

                            for (let combatMetric of environment.combatMetrics) {
                                const categorization = [
                                    raidName,
                                    difficulty,
                                    bossInfo.name,
                                ];
                                const bestOfNoCatKey = `best${capitalize(
                                    combatMetric
                                )}NoCat` as const;

                                const collectionId =
                                    id.characterDocumentCollectionId(
                                        ingameBossId,
                                        difficulty,
                                        combatMetric
                                    );

                                const characterDocuments =
                                    characterData[collectionId];

                                const raidBossManager =
                                    new documentManager.raidBoss(
                                        await this.dbInterface.raidboss.getRaidBoss(
                                            ingameBossId,
                                            difficulty
                                        )
                                    );

                                let bestOfCharacter: CharacterDocument = {
                                    [combatMetric]: 0,
                                } as unknown as CharacterDocument;

                                for (const specId of environment.specIdsOfClass[
                                    characterClass
                                ]) {
                                    const bestOfSpec =
                                        raidBossManager.getBestPerformanceOfSpec(
                                            specId,
                                            combatMetric
                                        );

                                    const characterDoc =
                                        characterDocuments.find(
                                            (document) =>
                                                document.spec === specId
                                        );
                                    if (!characterDoc) {
                                        addToPerformance(
                                            categorization,
                                            specId,
                                            combatMetric,
                                            {
                                                [combatMetric]: 0,
                                            } as unknown as CharacterDocument,
                                            bestOfSpec
                                        );
                                        continue;
                                    } else {
                                        addToPerformance(
                                            categorization,
                                            specId,
                                            combatMetric,
                                            characterDoc,
                                            bestOfSpec
                                        );
                                        addToPerformance(
                                            [
                                                ...categorization.slice(
                                                    0,
                                                    categorization.length - 1
                                                ),
                                                "total",
                                            ],
                                            specId,
                                            combatMetric,
                                            characterDoc,
                                            bestOfSpec
                                        );
                                    }

                                    const characterDocPerf =
                                        characterDoc[combatMetric];
                                    const bestOfCharPerf =
                                        bestOfCharacter[combatMetric];

                                    if (
                                        typeof characterDocPerf === "number" &&
                                        typeof bestOfCharPerf === "number" &&
                                        characterDocPerf > bestOfCharPerf
                                    ) {
                                        bestOfCharacter = characterDoc;
                                    }
                                }

                                const currentBest =
                                    raidBossManager[bestOfNoCatKey] ||
                                    ({
                                        dps: 0,
                                        hps: 0,
                                    } as unknown as CharacterDocument);
                                addToPerformance(
                                    categorization,
                                    "all",
                                    combatMetric,
                                    bestOfCharacter,
                                    currentBest
                                );

                                const bestOfClass =
                                    raidBossManager.getBestPerformanceOfClass(
                                        characterClass,
                                        combatMetric
                                    );

                                addToPerformance(
                                    categorization,
                                    "class",
                                    combatMetric,
                                    bestOfCharacter,
                                    bestOfClass
                                );

                                addToPerformance(
                                    [
                                        ...categorization.slice(
                                            0,
                                            categorization.length - 1
                                        ),
                                        "total",
                                    ],
                                    "class",
                                    combatMetric,
                                    bestOfCharacter,
                                    bestOfClass
                                );

                                addToPerformance(
                                    [
                                        ...categorization.slice(
                                            0,
                                            categorization.length - 1
                                        ),
                                        "total",
                                    ],
                                    "all",
                                    combatMetric,
                                    bestOfCharacter,
                                    currentBest
                                );
                            }
                        }
                    }

                    for (const key in characterPerformance[raidName]) {
                        const difficulty = Number(
                            key
                        ) as keyof (typeof characterPerformance)[typeof raidName];

                        for (const key in characterPerformance[raidName][
                            difficulty
                        ].total) {
                            const spec = key as "class" | SpecId;
                            for (let combatMetric of environment.combatMetrics) {
                                const performance =
                                    characterPerformance[raidName][difficulty]
                                        .total[spec][combatMetric];

                                if (typeof performance !== "number") continue;

                                characterPerformance[raidName][
                                    difficulty
                                ].total[spec][combatMetric] =
                                    (performance / bossCount / 100) *
                                    environment.maxCharacterScore;
                            }
                        }
                    }

                    try {
                        cache.characterPerformance.set(
                            cacheId,
                            characterPerformance
                        );
                    } catch (err) {}

                    resolve(characterPerformance);

                    function addToPerformance(
                        categorization: Array<string | number>,
                        keyName: string | number,
                        combatMetric: CombatMetric,
                        doc: CharacterDocument,
                        bestDoc: CharacterDocument | undefined
                    ): void {
                        const docCombatMetric = doc[combatMetric];
                        const bestDocCombatMetric =
                            bestDoc && bestDoc[combatMetric];

                        if (typeof docCombatMetric !== "number") {
                            return;
                        }

                        if (
                            categorization[categorization.length - 1] ===
                            "total"
                        ) {
                            const fullPathToValue = [
                                ...categorization,
                                keyName,
                                combatMetric,
                            ];
                            const performance = getNestedObjectValue(
                                characterPerformance,
                                fullPathToValue
                            );
                            const currentPerformance = getRelativePerformance(
                                docCombatMetric,
                                bestDocCombatMetric || docCombatMetric
                            );

                            characterPerformance = addNestedObjectValue(
                                characterPerformance,
                                fullPathToValue,
                                performance
                                    ? performance + currentPerformance
                                    : currentPerformance
                            ) as CharacterPerformance;
                        } else {
                            characterPerformance = addNestedObjectValue(
                                characterPerformance,
                                [...categorization, keyName, combatMetric],
                                {
                                    ...doc,
                                    performance: getRelativePerformance(
                                        docCombatMetric,
                                        bestDocCombatMetric || docCombatMetric
                                    ),
                                }
                            ) as CharacterPerformance;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                reject(err);
            }
        });
    }
}

export default DBCharacter;
