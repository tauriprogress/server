class Time {
    getLatestWednesday(currentDate: Date = new Date()) {
        const currentDay = currentDate.getUTCDay();

        const wednesdayDaysAgo =
            (currentDay < 3 ? currentDay + 7 : currentDay) - 3;

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

    unshiftDateDay(day: number) {
        // date.getDay returns a number that represents the day, 0 by deafult is sunday, instead i prefer 0 to be monday, thats the reason for this function
        return day - 1 >= 0 ? day - 1 : 6;
    }

    minutesAgo(seconds: number) {
        return Math.round((new Date().getTime() / 1000 - Number(seconds)) / 60);
    }
}

export const time = new Time();

export default time;