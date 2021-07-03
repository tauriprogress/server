import { environment } from "../environment";
import { LooseObject, RaidLogWithRealm, LastLogIds } from "../types";

export function getCharacterId(
    name: string,
    realm: keyof typeof environment.shortRealms,
    spec: number
) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function getBossCollectionName(
    id: number,
    difficulty: number,
    combatMetric: string
) {
    return `${id} ${difficulty} ${combatMetric}`;
}

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

export function getLogFaction(log: RaidLogWithRealm) {
    /**
     * The reasons for this function:
     *  - There is no reference to the faction the kill took place in
     *  - The only way to determine faction is to look at guild or character data
     *  - The guild/character data is unreliable to determine faction
     *      because it is picked from a relational table at the time of the request based on a guild/char id,
     *      this means that the guild/char data may change over time
     *      (eg: guild/char gone through a faction change)
     *
     * To determine faction with higher probability,
     *  this function counts the faction each char belongs to and picks the highest
     *
     */

    let alliance = 0;
    let horde = 0;
    for (let member of log.members) {
        const race = String(
            member.race
        ) as keyof typeof environment.characterRaceToFaction;
        if (environment.characterRaceToFaction[race] === 0) {
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

export function getLastLogIds<T extends { log_id: number; realm: string }>(
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

    throw new Error("Invalid raid id.");
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
        throw new Error("Invalid raid id.");
    } else {
        throw new Error("Invalid boss name.");
    }
}

export function getRaidBossCacheId(raidId: number, bossName: string) {
    return `${raidId}${bossName}`;
}

export function getRelativePerformance(
    currentPerformance: number,
    bestPerformance: number
) {
    return Math.round((currentPerformance / bestPerformance) * 1000) / 10;
}

export function getLeaderboardCacheId(
    raidId: number,
    combatMetric: string,
    spec?: string
) {
    if (spec) {
        return `${raidId}${spec}${combatMetric}`;
    }

    return `${raidId}${combatMetric}`;
}

export function getRaidInfoFromName(raidName: string) {
    for (const raid of environment.currentContent.raids) {
        if (raid.name === raidName) {
            return raid;
        }
    }

    throw new Error("Invalid raid name.");
}
