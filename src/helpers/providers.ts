import environment from "../environment";
import {
    LooseObject,
    RaidLogWithRealm,
    LastLogIds,
    Faction,
    Realm,
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

export function minutesAgo(time: number) {
    return Math.round((new Date().getTime() / 1000 - Number(time)) / 60);
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
