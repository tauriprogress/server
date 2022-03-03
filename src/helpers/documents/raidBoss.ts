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
} from "../../types";
import {
    getNestedObjectValue,
    addNestedObjectValue,
    raidBossId,
    capitalize,
} from "..";
import environment from "../../environment";
import { combatMetrics, factions } from "../../constants";

export function createRaidBossDocument(
    raidId: RaidId,
    bossId: ReturnType<typeof raidBossId>,
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
    raidBossDocument.latestKills.splice(50);

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
                raidBossDocument.fastestKills[realm]![faction].splice(50);
            }
        }
    }

    const firstExists = !!getNestedObjectValue(
        raidBossDocument.firstKills,
        logCategorization
    );

    if (!firstExists) {
        raidBossDocument.firstKills = addNestedObjectValue(
            raidBossDocument.firstKills,
            logCategorization,
            [trimmedLog]
        );
    } else {
        const arr = raidBossDocument.firstKills[realm]![faction];
        for (let i = 0; i < arr.length; i++) {
            if (trimmedLog.date < arr[i].date) {
                raidBossDocument.firstKills[realm]![faction].splice(
                    i,
                    0,
                    trimmedLog
                );
                raidBossDocument.firstKills[realm]![faction].splice(3);
            }
        }
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

    const bestNoCatKey =
        combatMetric === "dps" ? "bestDpsNoCat" : "bestHpsNoCat";

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

    const bestKey = combatMetric === "dps" ? "bestDps" : "bestHps";
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
        latestKills: boss.latestKills.concat(oldBoss.recentKills).splice(50),
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
                        .splice(50)
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
                    updatedFirstKills.sort((a, b) => a.date - b.date).splice(3)
                );
            }

            for (const key in environment.characterClassSpecs) {
                const classId =
                    key as unknown as keyof typeof environment.characterClassNames;

                for (const key in environment.characterClassSpecs[classId]) {
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
