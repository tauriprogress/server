import {
    Difficulty,
    RaidBossDocument,
    RaidId,
    Realm,
    TrimmedLog,
    Faction,
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
