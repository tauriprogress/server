import {
    Difficulty,
    RaidBossDocument,
    RaidId,
    Realm,
    TrimmedLog,
    Faction,
    CharacterDocument,
    CombatMetric,
} from "../../types";
import { raidBossId } from "../ids";
import { getNestedObjectValue, addNestedObjectValue } from "..";

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
