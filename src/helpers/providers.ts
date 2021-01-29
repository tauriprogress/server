import { environment } from "../environment";
import { LooseObject, RaidLogWithRealm } from "../types";

export function createCharacterId(
    name: string,
    realm: keyof typeof environment.shortRealms,
    spec: number
) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}

export function getLatestWednesday(currentDate: Date = new Date()) {
    const currentDay = currentDate.getDay();

    const wednesdayDaysAgo = (currentDay < 3 ? currentDay + 7 : currentDay) - 3;

    let lastWednesdayDate = currentDate.getDate() - wednesdayDaysAgo;
    if (currentDay === 3 && currentDate.getHours() < 9) {
        lastWednesdayDate -= 7;
    }

    return new Date(
        currentDate.getFullYear(),
        currentDate.getMonth(),
        lastWednesdayDate,
        10
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
