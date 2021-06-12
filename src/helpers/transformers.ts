import {
    Character,
    LooseObject,
    RaidLogWithRealm,
    RankedCharacter,
    CharacterOfLeaderboard
} from "../types";

export function addNestedObjectValue<T>(
    obj: LooseObject,
    keys: Array<string | number>,
    value: T
) {
    let currentKey = keys[0];

    if (currentKey !== undefined) {
        obj[currentKey] = addNestedObjectValue(
            obj.hasOwnProperty(currentKey) ? obj[currentKey] : {},
            keys.slice(1, keys.length),
            value
        );
        return obj;
    } else {
        return value !== undefined ? value : {};
    }
}

export function capitalize(string: string) {
    const capitalized = string.charAt(0).toUpperCase() + string.slice(1);

    return capitalized.length === string.length ? capitalized : string;
}

export function logBugHandler(
    log: LooseObject,
    bug: LooseObject
): RaidLogWithRealm | false {
    if (log) {
        switch (bug.type) {
            case "log":
                if (log.log_id === bug.logId && log.realm === bug.realm) {
                    return false;
                }

                break;
            case "boss":
                if (
                    log.encounter_data.encounter_id === bug.boss &&
                    log.killtime > bug.date.from &&
                    log.killtime < bug.date.to
                ) {
                    return false;
                }

                break;
            case "spec":
                log.members = log.members.map((member: any) => {
                    if (
                        member.spec === bug.specId &&
                        log.killtime > bug.date.from &&
                        log.killtime < bug.date.to
                    ) {
                        return {
                            ...member,
                            [bug.changeKey.key]: bug.changeKey.value
                        };
                    }
                    return member;
                });

                break;

            case "guildData":
                if (bug.guildIds[log.guildid]) {
                    const key = bug.changeKey.key as keyof typeof log;

                    log[key] = bug.changeKey.value;
                    log.guildid = bug.id;
                }
                break;
            case "date":
                if (log.log_id === bug.id) {
                    log[bug.changeKey.key] = bug.changeKey.value;
                }
                break;
            case "ignoreLogOfCharacter":
                for (const member of log.members) {
                    if (member.name === bug.characterName) {
                        return false;
                    }
                }

                break;
            case "overwriteSpec":
                if (log.log_id === bug.logId && log.realm === bug.realm) {
                    log.members = log.members.map((member: any) => {
                        if (member.name === bug.characterName) {
                            return {
                                ...member,
                                spec: bug.specId
                            };
                        }
                        return member;
                    });
                }
                break;
            default:
        }
    }

    return log as RaidLogWithRealm;
}

export function uniqueLogs<T extends { id: number }>(logs: T[]): T[] {
    let logIds: LooseObject = {};
    const uniqueLogs: T[] = [];

    for (const log of logs) {
        if (!logIds[log.id]) {
            logIds[log.id] = true;
            uniqueLogs.push(log);
        }
    }
    return uniqueLogs;
}

export function applyCharacterPerformanceRanks(
    characters: Character[],
    combatMetric: "dps" | "hps"
) {
    let classes: { [propName: number]: number } = {};
    let specs: { [propName: number]: number } = {};
    let sortedCharacters = characters.sort((a, b) => {
        const bPerf = b[combatMetric];
        const aPerf = a[combatMetric];
        if (bPerf && aPerf) {
            return bPerf - aPerf;
        }
        return 0;
    });

    let rankedCharacters: RankedCharacter[] = [];

    for (let i = 0; i < sortedCharacters.length; i++) {
        let character = sortedCharacters[i];

        if (!classes[character.class]) {
            classes[character.class] = 1;
        } else {
            classes[character.class] += 1;
        }

        if (!specs[character.spec]) {
            specs[character.spec] = 1;
        } else {
            specs[character.spec] += 1;
        }

        rankedCharacters.push({
            ...character,
            rank: i + 1,
            cRank: classes[character.class],
            sRank: specs[character.spec]
        });
    }

    return rankedCharacters;
}

export function updateCharacterOfLeaderboard(
    previousCharacter: CharacterOfLeaderboard,
    currentCharacter: CharacterOfLeaderboard
): CharacterOfLeaderboard {
    const updatedDate =
        previousCharacter.date > currentCharacter.date
            ? previousCharacter.date
            : currentCharacter.date;

    const updatedFaction =
        previousCharacter.date > currentCharacter.date
            ? previousCharacter.f
            : currentCharacter.f;

    const updatedRace =
        previousCharacter.date > currentCharacter.date
            ? previousCharacter.race
            : currentCharacter.race;

    const updatedIlvl =
        previousCharacter.ilvl > currentCharacter.ilvl
            ? previousCharacter.ilvl
            : currentCharacter.ilvl;

    const updatedTopPercent =
        previousCharacter.topPercent > currentCharacter.topPercent
            ? previousCharacter.topPercent
            : currentCharacter.topPercent;

    return {
        ...previousCharacter,
        date: updatedDate,
        f: updatedFaction,
        ilvl: updatedIlvl,
        topPercent: updatedTopPercent,
        race: updatedRace
    };
}
