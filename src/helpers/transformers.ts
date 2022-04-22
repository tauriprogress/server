import environment from "../environment";
import {
    LooseObject,
    RaidLogWithRealm,
    Filters,
    SpecId,
    CharacterDocumentAggregationMatch,
    CharacterDocument,
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

export function capitalize<T extends string>(str: T): Capitalize<T> {
    const capitalized = (str.charAt(0).toUpperCase() +
        str.slice(1)) as Capitalize<T>;

    return capitalized.length === str.length
        ? capitalized
        : (str as Capitalize<T>);
}

export function logBugHandler(logs: RaidLogWithRealm[]): RaidLogWithRealm[] {
    return logs.reduce((acc, log) => {
        let fixedLog: RaidLogWithRealm = JSON.parse(JSON.stringify(log));

        for (const bug of environment.logBugs) {
            switch (bug.type) {
                case "ignoreLogOfId":
                    if (
                        bug.id === fixedLog.log_id &&
                        bug.realm === fixedLog.realm
                    ) {
                        return acc;
                    }
                    break;
                case "ignoreBossOfDate":
                    if (
                        bug.bossId === fixedLog.encounter_data.encounter_id &&
                        bug.date.from < fixedLog.killtime &&
                        bug.date.to > fixedLog.killtime
                    ) {
                        return acc;
                    }
                    break;
                case "changeSpecDmgDoneOfDate":
                    fixedLog.members = fixedLog.members.map((member: any) => {
                        if (
                            member.spec === bug.specId &&
                            bug.date.from < fixedLog.killtime &&
                            bug.date.to > fixedLog.killtime
                        ) {
                            return {
                                ...member,
                                dmg_done: bug.changeTo,
                            };
                        }
                        return member;
                    });

                    break;
                case "ignoreLogOfCharacter":
                    for (const member of fixedLog.members) {
                        if (
                            bug.name === member.name &&
                            bug.realm === fixedLog.realm
                        ) {
                            return acc;
                        }
                    }

                    break;
                case "overwriteSpecOfCharacter":
                    if (
                        bug.logId === fixedLog.log_id &&
                        bug.realm === fixedLog.realm
                    ) {
                        fixedLog.members = fixedLog.members.map(
                            (member: any) => {
                                if (bug.characterName === member.name) {
                                    return {
                                        ...member,
                                        spec: bug.specId,
                                    };
                                }
                                return member;
                            }
                        );
                    }
                    break;

                case "ignoreCharacter":
                    fixedLog.members = fixedLog.members.filter((member) => {
                        if (
                            bug.name === member.name &&
                            bug.realm === fixedLog.realm
                        ) {
                            return false;
                        }
                        return true;
                    });
                    break;
                case "changeKilltimeOfLog":
                    if (bug.id === fixedLog.log_id) {
                        fixedLog.killtime = bug.changeTo;
                    }
                    break;

                case "changeGuildData":
                    if (bug.guildIds[fixedLog.guildid]) {
                        fixedLog.guilddata = bug.changeTo;
                        fixedLog.guildid = bug.id;
                    }
                    break;
            }
        }

        acc.push(fixedLog);

        return acc;
    }, [] as RaidLogWithRealm[]);
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

export function updateCharacterOfLeaderboard() {
    /*
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
        race: updatedRace,
    };
    */
}

export function applyCharacterFilters(
    characters: CharacterDocument[],
    filters: Filters
) {
    return characters.filter((character) => {
        if (filters.class !== undefined && character.class !== filters.class) {
            return false;
        }

        if (filters.spec !== undefined && character.spec !== filters.spec) {
            return false;
        }

        if (filters.faction !== undefined && character.f !== filters.faction) {
            return false;
        }

        if (filters.realm !== undefined && character.realm !== filters.realm) {
            return false;
        }

        if (
            filters.role !== undefined &&
            environment.specs[character.spec as keyof typeof environment.specs]
                .role !== filters.role
        ) {
            return false;
        }

        return true;
    });
}

export function filtersToAggregationMatchQuery(filters: Filters) {
    let matchQuery: CharacterDocumentAggregationMatch = {};
    if (filters.class) {
        matchQuery.class = filters.class;
    }

    if (typeof filters.faction === "number") {
        matchQuery.f = filters.faction;
    }
    if (filters.realm) {
        matchQuery.realm = filters.realm;
    }

    if (filters.spec) {
        matchQuery.spec = filters.spec;
    } else if (filters.role) {
        let validSpecs: SpecId[] = [];
        for (const key in environment.specs) {
            const specId = Number(key) as keyof typeof environment.specs;
            const spec = environment.specs[specId];
            if (spec.role === filters.role) {
                validSpecs.push(specId);
            }
        }

        matchQuery.spec = { $in: validSpecs };
    }
    return matchQuery;
}
