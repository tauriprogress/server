import { environment } from "../environment";

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
