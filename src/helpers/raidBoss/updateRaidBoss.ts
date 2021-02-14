import { LooseObject, RaidBoss, Character } from "../../types";

import { getNestedObjectValue, addNestedObjectValue } from "../../helpers";

export function updateRaidBoss(oldBoss: RaidBoss, boss: RaidBoss) {
    let updatedRaidBoss: RaidBoss = {
        ...JSON.parse(JSON.stringify(oldBoss)),
        recentKills: boss.recentKills.concat(oldBoss.recentKills).slice(0, 50),
        killCount: oldBoss.killCount + boss.killCount
    };

    for (const realm in boss.fastestKills) {
        for (const faction in boss.fastestKills[realm]) {
            const categorization = [realm, faction];

            const oldLogs: typeof oldBoss.fastestKills[string][number] =
                getNestedObjectValue(oldBoss.fastestKills, categorization) ||
                [];

            const newLogs: typeof boss.fastestKills[string][number] = getNestedObjectValue(
                boss.fastestKills,
                categorization
            );

            const updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.fightLength - b.fightLength)
                .slice(0, 50);

            updatedRaidBoss.fastestKills = addNestedObjectValue(
                updatedRaidBoss.fastestKills,
                categorization,
                updatedLogs
            );
        }
    }

    for (const realm in boss.firstKills) {
        for (const faction in boss.firstKills[realm]) {
            const categorization = [realm, faction];

            const oldLogs: typeof oldBoss.firstKills[string][number] =
                getNestedObjectValue(oldBoss.firstKills, categorization) || [];

            const newLogs: typeof boss.firstKills[string][number] = getNestedObjectValue(
                boss.firstKills,
                categorization
            );

            const updatedLogs = oldLogs
                .concat(newLogs)
                .sort((a, b) => a.date - b.date)
                .slice(0, 3);

            updatedRaidBoss.firstKills = addNestedObjectValue(
                updatedRaidBoss.firstKills,
                categorization,
                updatedLogs
            );
        }
    }

    for (const combatMetric of ["dps", "hps"] as const) {
        const bestOfNoCatKey =
            combatMetric === "dps" ? "bestDpsNoCat" : "bestHpsNoCat";

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

        const bestOfKey = combatMetric === "dps" ? "bestDps" : "bestHps";

        for (const realm in boss[bestOfKey]) {
            for (const faction in boss[bestOfKey][realm]) {
                for (const characterClass in boss[bestOfKey][realm][faction]) {
                    for (const characterSpec in boss[bestOfKey][realm][faction][
                        characterClass
                    ]) {
                        const categorization = [
                            bestOfKey,
                            realm,
                            faction,
                            characterClass,
                            characterSpec
                        ];

                        const oldBestsOfCombatMetric: typeof oldBoss[typeof bestOfKey][string][number][number][number] =
                            getNestedObjectValue(oldBoss, categorization) || [];

                        const newBestsOfCombatMetric: typeof boss[typeof bestOfKey][string][number][number][number] =
                            getNestedObjectValue(boss, categorization) || [];

                        const bestCharacters: LooseObject = {};

                        for (const bestCharacter of [
                            ...oldBestsOfCombatMetric,
                            ...newBestsOfCombatMetric
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
                                bestCharacters[
                                    bestCharacter._id
                                ] = bestCharacter;
                            }
                        }

                        const updatedBestsOfCombatMetric: Character[] = [];

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
                        ) as RaidBoss;
                    }
                }
            }
        }
    }

    return updatedRaidBoss;
}
