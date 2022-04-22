import {
    Difficulty,
    RaidBossDocument,
    LooseObject,
    RaidId,
    Realm,
    TrimmedLog,
    Faction,
    CharacterDocument,
    CombatMetric,
    RaidBossForSummary,
    ClassId,
    SpecId,
} from "../../types";
import {
    getNestedObjectValue,
    addNestedObjectValue,
    getRaidBossId,
    capitalize,
} from "..";
import environment from "../../environment";
import { combatMetrics, factions } from "../../constants";

export function createRaidBossDocument(
    raidId: RaidId,
    bossId: ReturnType<typeof getRaidBossId>,
    bossName: string,
    difficulty: Difficulty
): RaidBossDocument {
    return {
        _id: bossId,
        raidId: raidId,
        name: bossName,
        difficulty: difficulty,
        killCount: 0,
        latestKills: [],
        fastestKills: {},
        firstKills: {},
        bestDps: {},
        bestHps: {},
        bestDpsNoCat: undefined,
        bestHpsNoCat: undefined,
    };
}

export function addLogToRaidBossDocument(
    raidBossDocument: RaidBossDocument,
    trimmedLog: TrimmedLog,
    realm: Realm,
    faction: Faction
) {
    raidBossDocument.killCount += 1;

    raidBossDocument.latestKills.unshift(trimmedLog);
    raidBossDocument.latestKills = raidBossDocument.latestKills.slice(0, 50);

    const logCategorization = [realm, faction];

    const fastestExists = !!getNestedObjectValue(
        raidBossDocument.fastestKills,
        logCategorization
    );

    if (!fastestExists) {
        raidBossDocument.fastestKills = addNestedObjectValue(
            raidBossDocument.fastestKills,
            logCategorization,
            [trimmedLog]
        );
    } else {
        const arr = raidBossDocument.fastestKills[realm]![faction];
        for (let i = 0; i < arr.length; i++) {
            if (trimmedLog.fightLength < arr[i].fightLength) {
                raidBossDocument.fastestKills[realm]![faction].splice(
                    i,
                    0,
                    trimmedLog
                );
                raidBossDocument.fastestKills[realm]![faction] =
                    raidBossDocument.fastestKills[realm]![faction].slice(0, 50);
                break;
            }
        }
    }

    const oldFirstKills = getNestedObjectValue(
        raidBossDocument.firstKills,
        logCategorization
    );

    if (!oldFirstKills) {
        raidBossDocument.firstKills = addNestedObjectValue(
            raidBossDocument.firstKills,
            logCategorization,
            [trimmedLog]
        );
    } else if (oldFirstKills.length < 3) {
        const arr = raidBossDocument.firstKills[realm]![faction];
        for (let i = 0; i < arr.length; i++) {
            if (i === arr.length - 1) {
                raidBossDocument.firstKills[realm]![faction].push(trimmedLog);
                break;
            } else if (trimmedLog.date < arr[i].date) {
                raidBossDocument.firstKills[realm]![faction].splice(
                    i,
                    0,
                    trimmedLog
                );

                break;
            }
        }
        raidBossDocument.firstKills[realm]![faction] =
            raidBossDocument.firstKills[realm]![faction].slice(0, 3);
    }

    return raidBossDocument;
}

export function addCharacterDocumentToRaidBossDocument(
    characterDocument: CharacterDocument,
    raidBossDocument: RaidBossDocument,
    combatMetric: CombatMetric,
    realm: Realm
): RaidBossDocument {
    const characterCategorization = [
        realm,
        characterDocument.f,
        characterDocument.class,
        characterDocument.spec,
    ];

    const bestNoCatKey = `best${capitalize(combatMetric)}NoCat` as const;
    const bestNoCat = raidBossDocument[bestNoCatKey];
    const bestNoCatPerformance =
        bestNoCat && (bestNoCat[combatMetric] as number);

    if (!bestNoCat || !bestNoCatPerformance) {
        raidBossDocument[bestNoCatKey] = characterDocument;
    } else if (
        bestNoCatPerformance &&
        bestNoCatPerformance < characterDocument[combatMetric]
    ) {
        raidBossDocument[bestNoCatKey] = characterDocument;
    }

    const bestKey = `best${capitalize(combatMetric)}` as const;
    let categorizedBest = getNestedObjectValue(
        raidBossDocument[bestKey],
        characterCategorization
    ) as CharacterDocument[];
    let categorizedBestUpdated = false;

    if (!categorizedBest) {
        categorizedBestUpdated = true;
        categorizedBest = [characterDocument];
    } else {
        const lastBestPerformance = categorizedBest[categorizedBest.length - 1][
            combatMetric
        ] as number;

        const indexOfSameChar = categorizedBest.findIndex(
            (document) => document._id === characterDocument._id
        );

        if (indexOfSameChar >= 0) {
            const sameCharPerformance = categorizedBest[indexOfSameChar][
                combatMetric
            ] as number;

            if (sameCharPerformance < characterDocument[combatMetric]) {
                categorizedBest[indexOfSameChar] = characterDocument;
                categorizedBestUpdated = true;
            }
        } else if (categorizedBest.length < 10) {
            categorizedBest.push(characterDocument);
            categorizedBestUpdated = true;
        } else if (
            lastBestPerformance &&
            lastBestPerformance < characterDocument[combatMetric]
        ) {
            categorizedBest.push(characterDocument);
            categorizedBestUpdated = true;
        }
    }

    if (categorizedBestUpdated) {
        raidBossDocument[bestKey] = addNestedObjectValue(
            raidBossDocument[bestKey],
            characterCategorization,
            categorizedBest
                .sort((a, b) => (b[combatMetric] || 0) - (a[combatMetric] || 0))
                .slice(0, 10)
        );
    }
    return raidBossDocument;
}

export function updateRaidBossDocument(
    oldBoss: RaidBossDocument,
    boss: RaidBossDocument
) {
    let updatedRaidBoss: RaidBossDocument = {
        ...JSON.parse(JSON.stringify(oldBoss)),
        latestKills: boss.latestKills.concat(oldBoss.latestKills).slice(0, 50),
        killCount: oldBoss.killCount + boss.killCount,
    };

    for (const combatMetric of combatMetrics) {
        const bestOfNoCatKey = `best${capitalize(combatMetric)}NoCat` as const;

        const oldBestChar = oldBoss[bestOfNoCatKey];
        const newBestChar = boss[bestOfNoCatKey];

        if (!oldBestChar) {
            updatedRaidBoss[bestOfNoCatKey] = newBestChar;
        } else if (newBestChar) {
            const oldBest = oldBestChar[combatMetric];
            const newBest = newBestChar[combatMetric];

            if (oldBest && newBest && newBest > oldBest) {
                updatedRaidBoss[bestOfNoCatKey] = newBestChar;
            }
        }
    }

    for (const realm of environment.realms) {
        for (const faction of factions) {
            const fastestKills = boss.fastestKills?.[realm]?.[faction];
            if (fastestKills) {
                let updatedFastestKills = fastestKills;
                const oldFastestKills =
                    oldBoss.fastestKills?.[realm]?.[faction];

                if (oldFastestKills) {
                    updatedFastestKills = fastestKills.concat(oldFastestKills);
                }

                updatedRaidBoss.fastestKills = addNestedObjectValue(
                    updatedRaidBoss.fastestKills,
                    [realm, faction],
                    updatedFastestKills
                        .sort((a, b) => a.fightLength - b.fightLength)
                        .slice(0, 50)
                );
            }

            const firstKills = boss.firstKills?.[realm]?.[faction];
            if (firstKills) {
                let updatedFirstKills = firstKills;
                const oldFirstKills = oldBoss.firstKills?.[realm]?.[faction];

                if (oldFirstKills) {
                    updatedFirstKills = firstKills.concat(oldFirstKills);
                }

                updatedRaidBoss.firstKills = addNestedObjectValue(
                    updatedRaidBoss.firstKills,
                    [realm, faction],
                    updatedFirstKills
                        .sort((a, b) => a.date - b.date)
                        .slice(0, 3)
                );
            }

            for (const key in environment.characterClassSpecs) {
                const classId =
                    key as unknown as keyof typeof environment.characterClassNames;

                for (const key of environment.characterClassSpecs[classId]) {
                    const specId =
                        key as unknown as typeof environment.characterClassSpecs[typeof classId][number];

                    for (const combatMetric of combatMetrics) {
                        const bestOfKey = `best${capitalize(
                            combatMetric
                        )}` as const;

                        const categorization = [
                            bestOfKey,
                            realm,
                            faction,
                            classId,
                            specId,
                        ];

                        let oldChars =
                            oldBoss[bestOfKey]?.[realm]?.[faction]?.[classId]?.[
                                specId
                            ] || [];

                        let newChars =
                            boss[bestOfKey]?.[realm]?.[faction]?.[classId]?.[
                                specId
                            ] || [];

                        const bestCharacters: LooseObject = {};

                        for (const bestCharacter of [
                            ...oldChars,
                            ...newChars,
                        ]) {
                            const currentPerformance =
                                bestCharacter[combatMetric];
                            if (
                                !bestCharacters[bestCharacter._id] ||
                                (bestCharacters[bestCharacter._id] &&
                                    currentPerformance &&
                                    currentPerformance >
                                        bestCharacters[bestCharacter._id][
                                            combatMetric
                                        ])
                            ) {
                                bestCharacters[bestCharacter._id] =
                                    bestCharacter;
                            }
                        }

                        const updatedBestsOfCombatMetric: CharacterDocument[] =
                            [];

                        for (const charId in bestCharacters) {
                            updatedBestsOfCombatMetric.push(
                                bestCharacters[charId]
                            );
                        }

                        updatedRaidBoss = addNestedObjectValue(
                            updatedRaidBoss,
                            categorization,
                            updatedBestsOfCombatMetric
                                .sort((a, b) => {
                                    const bPerf = b[combatMetric];
                                    const aPerf = a[combatMetric];
                                    if (bPerf && aPerf) {
                                        return bPerf - aPerf;
                                    } else {
                                        return 0;
                                    }
                                })
                                .slice(0, 10)
                        ) as RaidBossDocument;
                    }
                }
            }
        }
    }

    return updatedRaidBoss;
}

export function getRaidBossSummary(boss: RaidBossDocument): RaidBossForSummary {
    let raidBossForSummary = JSON.parse(
        JSON.stringify(boss)
    ) as RaidBossForSummary;

    for (const key in boss.fastestKills) {
        const realmName = key as unknown as Realm;
        for (const key in boss.fastestKills[realmName]) {
            const faction = Number(key) as unknown as Faction;
            raidBossForSummary.fastestKills[realmName][faction] =
                boss.fastestKills?.[realmName]?.[faction].slice(0, 3);
        }
    }

    delete raidBossForSummary.killCount;
    delete raidBossForSummary.latestKills;
    delete raidBossForSummary.bestDpsNoCat;
    delete raidBossForSummary.bestHpsNoCat;

    return raidBossForSummary;
}

export function getRaidBossBestOfClass(
    raidBoss: RaidBossDocument,
    classId: ClassId,
    combatMetric: CombatMetric
) {
    let bestOfClass: CharacterDocument = {
        [combatMetric]: 0,
    } as unknown as CharacterDocument;

    const key = `best${capitalize(combatMetric)}` as const;

    const categorizedCharacters = raidBoss[key];

    for (const realm of environment.realms) {
        for (const faction of factions) {
            for (const specId of environment.characterClassSpecs[classId]) {
                const character =
                    categorizedCharacters?.[realm]?.[faction]?.[classId]?.[
                        specId
                    ]?.[0];
                if (
                    character &&
                    character[combatMetric] > bestOfClass[combatMetric]
                ) {
                    bestOfClass = character;
                }
            }
        }
    }

    return bestOfClass[combatMetric] ? bestOfClass : undefined;
}

export function getRaidBossBestOfSpec(
    raidBoss: RaidBossDocument,
    specId: SpecId,
    combatMetric: CombatMetric
) {
    const classId = environment.characterSpecClass[specId];
    let bestOfSpec: CharacterDocument = {
        [combatMetric]: 0,
    } as unknown as CharacterDocument;

    const key = `best${capitalize(combatMetric)}` as const;

    const categorizedCharacters = raidBoss[key];

    for (const realm of environment.realms) {
        for (const faction of factions) {
            const character =
                categorizedCharacters?.[realm]?.[faction]?.[classId]?.[
                    specId
                ]?.[0];
            if (
                character &&
                character[combatMetric] > bestOfSpec[combatMetric]
            ) {
                bestOfSpec = character;
            }
        }
    }

    return bestOfSpec[combatMetric] ? bestOfSpec : undefined;
}
