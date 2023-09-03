import { classIds, specIds } from "../constants";
import environment from "../environment";
import {
    LooseObject,
    RaidLogWithRealm,
    LastLogIds,
    Faction,
    Realm,
    CharacterDocument,
    ClassId,
    SpecId,
    CharacterPerformance,
    RaidName,
    Difficulty,
    CombatMetric,
} from "../types";
import {
    ERR_INVALID_BOSS_NAME,
    ERR_INVALID_RAID_ID,
    ERR_INVALID_RAID_NAME,
} from "./errors";

export function getLatestWednesday(currentDate: Date = new Date()) {
    const currentDay = currentDate.getUTCDay();

    const wednesdayDaysAgo = (currentDay < 3 ? currentDay + 7 : currentDay) - 3;

    let lastWednesdayDate = currentDate.getUTCDate() - wednesdayDaysAgo;

    if (currentDay === 3 && currentDate.getUTCHours() < 7) {
        lastWednesdayDate -= 7;
    }

    return new Date(
        Date.UTC(
            currentDate.getUTCFullYear(),
            currentDate.getUTCMonth(),
            lastWednesdayDate,
            7
        )
    );
}

export function unshiftDateDay(day: number) {
    // date.getDay returns a number that represents the day, 0 by deafult is sunday, instead i prefer 0 to be monday, thats the reason for this function
    return day - 1 >= 0 ? day - 1 : 6;
}

export function getLogFaction(log: RaidLogWithRealm): Faction {
    let alliance = 0;
    let horde = 0;
    for (let member of log.members) {
        const race = member.race;

        if (environment.characterRaceFaction[race] === 0) {
            alliance++;
        } else {
            horde++;
        }
    }

    return horde > alliance ? 1 : 0;
}

export function getNestedObjectValue(
    obj: LooseObject,
    keys: Array<string | number>
): any {
    let currentKey = keys[0];

    if (keys.length === 1) {
        return obj[currentKey];
    } else {
        return obj.hasOwnProperty(currentKey)
            ? getNestedObjectValue(obj[currentKey], keys.slice(1, keys.length))
            : undefined;
    }
}

export function minutesAgo(seconds: number) {
    return Math.round((new Date().getTime() / 1000 - Number(seconds)) / 60);
}

export function getLastLogIds<T extends { log_id: number; realm: Realm }>(
    logs: T[]
) {
    let lastLogIds: LastLogIds = {};

    for (let log of logs) {
        lastLogIds[log.realm] = log.log_id;
    }

    return lastLogIds;
}

export function getRaidInfoFromId(raidId: number) {
    for (const raid of environment.currentContent.raids) {
        if (raid.id === raidId) {
            return raid;
        }
    }

    throw ERR_INVALID_RAID_ID;
}

export function getBossInfo(raidId: number, bossName: string) {
    let idFound = false;
    for (const raid of environment.currentContent.raids) {
        if (raid.id === raidId) {
            idFound = true;
            for (const boss of raid.bosses) {
                if (boss.name === bossName) {
                    return boss;
                }
            }
        }
    }
    if (idFound) {
        throw ERR_INVALID_RAID_ID;
    } else {
        throw ERR_INVALID_BOSS_NAME;
    }
}

export function getRelativePerformance(
    currentPerformance: number,
    bestPerformance: number
) {
    if (currentPerformance === 0 || bestPerformance === 0) return 0;
    return Math.round((currentPerformance / bestPerformance) * 1000) / 10;
}

export function getRaidInfoFromName(raidName: string) {
    for (const raid of environment.currentContent.raids) {
        if (raid.name === raidName) {
            return raid;
        }
    }

    throw ERR_INVALID_RAID_NAME;
}

export function getRaidNameFromIngamebossId(ingameBossId: number) {
    for (const raid of environment.currentContent.raids) {
        for (const boss of raid.bosses) {
            for (const key in boss.bossIdOfDifficulty) {
                const difficulty = Number(
                    key
                ) as keyof typeof boss.bossIdOfDifficulty;

                if (ingameBossId === boss.bossIdOfDifficulty[difficulty])
                    return raid.name;
            }
        }
    }
    return false;
}

export function getRaidBossNameFromIngameBossId(ingameBossId: number) {
    for (const raid of environment.currentContent.raids) {
        for (const boss of raid.bosses) {
            for (const key in boss.bossIdOfDifficulty) {
                const difficulty = Number(
                    key
                ) as keyof typeof boss.bossIdOfDifficulty;

                if (ingameBossId === boss.bossIdOfDifficulty[difficulty])
                    return boss.name;
            }
        }
    }
    return false;
}

export function getCharacterDocumentRankBulkwriteOperations(
    characters: CharacterDocument[]
) {
    let classes = classIds.reduce((acc, classId) => {
        acc[classId] = 0;
        return acc;
    }, {} as { [key: number]: number }) as { [key in ClassId]: number };

    let specs = specIds.reduce((acc, specId) => {
        acc[specId] = 0;
        return acc;
    }, {} as { [key: number]: number }) as { [key in SpecId]: number };

    return characters.map((character, i) => {
        classes[character.class] += 1;
        specs[character.spec] += 1;
        return {
            updateOne: {
                filter: {
                    _id: character._id,
                },
                update: {
                    $set: {
                        rank: i + 1,
                        cRank: classes[character.class],
                        sRank: specs[character.spec],
                    },
                },
            },
        };
    });
}

export function getPropertiesFromCharacterPerformance(
    characterPerformance: CharacterPerformance,
    raidName: RaidName,
    difficulty: Difficulty,
    combatMetric: CombatMetric
): { f: Faction; race: string } | { f: Faction } {
    let f: Faction = 1;
    let recentDate = 0;
    let race;
    const bosses = getRaidInfoFromName(raidName).bosses;
    for (const boss of bosses) {
        const bossPerformance =
            characterPerformance[raidName][difficulty][boss.name];

        for (const keyString in bossPerformance) {
            const key = keyString as keyof typeof bossPerformance;
            const document = bossPerformance[key][combatMetric];
            if (typeof document === "number" || !document.performance) continue;

            if (document.date > recentDate) {
                recentDate = document.date;
                f = document.f;
                race = document.race;
            }
        }
    }
    if (race) {
        return { f, race };
    }
    return { f };
}
