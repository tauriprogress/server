import {
    Difficulty,
    LooseObject,
    RaidId,
    Realm,
    TrimmedLog,
    Faction,
    CombatMetric,
    ClassId,
    SpecId,
} from "../../types";
import {
    getNestedObjectValue,
    addNestedObjectValue,
    capitalize,
    id,
    CharacterDocument,
} from "..";
import environment from "../../environment";

import { Document } from "mongodb";

export interface RaidBossDocument extends Document {
    _id: ReturnType<typeof id.raidBossId>;
    raidId: RaidId;
    name: string;
    difficulty: Difficulty;
    killCount: number;
    latestKills: TrimmedLog[];
    fastestKills: CategorizedTrimmedLogs;
    firstKills: CategorizedTrimmedLogs;
    bestDps: CategorizedCharacter;
    bestHps: CategorizedCharacter;
    bestDpsNoCat?: CharacterDocument;
    bestHpsNoCat?: CharacterDocument;
}

type CategorizedTrimmedLogs = {
    [key in Realm]?: {
        [key in Faction]?: TrimmedLog[];
    };
};

type CategorizedCharacter = {
    [key in Realm]?: {
        [key in Faction]?: {
            [key in ClassId]?: {
                [key in SpecId]?: CharacterDocument[];
            };
        };
    };
};

interface RaidBossForSummary
    extends Omit<
        RaidBossDocument,
        "killCount" | "recentKills" | "bestDpsNoCat" | "bestHpsNoCat"
    > {}

type ContructorObject = {
    raidId: RaidId;
    bossId: string;
    bossName: string;
    difficulty: Difficulty;
};

export class RaidBossDocumentController {
    private _id: string;
    private raidId: RaidId;
    private name: string;
    private difficulty: Difficulty;
    private killCount: number;
    private latestKills: TrimmedLog[];
    private fastestKills: CategorizedTrimmedLogs;
    private firstKills: CategorizedTrimmedLogs;
    private bestDps: CategorizedCharacter;
    private bestHps: CategorizedCharacter;
    private bestDpsNoCat?: CharacterDocument;
    private bestHpsNoCat?: CharacterDocument;

    constructor(obj: ContructorObject | RaidBossDocument) {
        if (this.isRaidBossDocument(obj)) {
            obj = JSON.parse(JSON.stringify(obj)) as RaidBossDocument;

            this._id = obj._id;
            this.raidId = obj.raidId;
            this.name = obj.name;
            this.difficulty = obj.difficulty;
            this.killCount = obj.killCount;
            this.latestKills = obj.latestKills;
            this.fastestKills = obj.fastestKills;
            this.firstKills = obj.firstKills;
            this.bestDps = obj.bestDps;
            this.bestHps = obj.bestHps;
            this.bestDpsNoCat = obj.bestDpsNoCat;
            this.bestHpsNoCat = obj.bestHpsNoCat;
        } else {
            this._id = obj.bossId;
            this.raidId = obj.raidId;
            this.name = obj.bossName;
            this.difficulty = obj.difficulty;
            this.killCount = 0;
            this.latestKills = [];
            this.fastestKills = {};
            this.firstKills = {};
            this.bestDps = {};
            this.bestHps = {};
            this.bestDpsNoCat = undefined;
            this.bestHpsNoCat = undefined;
        }
    }

    getDocument(): RaidBossDocument {
        return {
            _id: this._id,
            raidId: this.raidId,
            name: this.name,
            difficulty: this.difficulty,
            killCount: this.killCount,
            latestKills: this.latestKills,
            fastestKills: this.fastestKills,
            firstKills: this.firstKills,
            bestDps: this.bestDps,
            bestHps: this.bestHps,
            bestDpsNoCat: this.bestDpsNoCat,
            bestHpsNoCat: this.bestHpsNoCat,
        };
    }

    addLog(trimmedLog: TrimmedLog, realm: Realm, faction: Faction): void {
        this.killCount += 1;

        this.latestKills.unshift(trimmedLog);
        this.latestKills = this.latestKills.slice(0, 50);

        const logCategorization = [realm, faction];

        const fastestKills = this.fastestKills[realm]?.[faction];

        if (!fastestKills) {
            this.fastestKills = addNestedObjectValue(
                this.fastestKills,
                logCategorization,
                [trimmedLog]
            );
        } else {
            for (let i = 0; i < fastestKills.length; i++) {
                if (trimmedLog.fightLength < fastestKills[i].fightLength) {
                    fastestKills.splice(i, 0, trimmedLog);
                    this.fastestKills = addNestedObjectValue(
                        this.fastestKills,
                        logCategorization,
                        fastestKills.slice(0, 50)
                    );
                    break;
                }
            }
        }

        const firstKills = this.firstKills[realm]?.[faction];

        if (!firstKills) {
            this.firstKills = addNestedObjectValue(
                this.firstKills,
                logCategorization,
                [trimmedLog]
            );
        } else if (firstKills.length < 3) {
            for (let i = 0; i < firstKills.length; i++) {
                if (i === firstKills.length - 1) {
                    firstKills.push(trimmedLog);
                    this.firstKills = addNestedObjectValue(
                        this.firstKills,
                        logCategorization,
                        firstKills.slice(0, 3)
                    );
                    break;
                } else if (trimmedLog.date < firstKills[i].date) {
                    firstKills.splice(i, 0, trimmedLog);
                    this.firstKills = addNestedObjectValue(
                        this.firstKills,
                        logCategorization,
                        firstKills.slice(0, 3)
                    );
                    break;
                }
            }
        }
    }

    addCharacterDocument(
        characterDocument: CharacterDocument,
        combatMetric: CombatMetric,
        realm: Realm
    ): void {
        const characterCategorization = [
            realm,
            characterDocument.f,
            characterDocument.class,
            characterDocument.spec,
        ];

        const bestNoCatKey = `best${capitalize(combatMetric)}NoCat` as const;
        const bestNoCat = this[bestNoCatKey];
        const bestNoCatPerformance =
            bestNoCat && (bestNoCat[combatMetric] as number);
        const characterPerformance = characterDocument[combatMetric] || 0;

        if (!bestNoCat || !bestNoCatPerformance) {
            this[bestNoCatKey] = characterDocument;
        } else if (
            bestNoCatPerformance &&
            bestNoCatPerformance < characterPerformance
        ) {
            this[bestNoCatKey] = characterDocument;
        }

        const bestKey = `best${capitalize(combatMetric)}` as const;
        let categorizedBest = getNestedObjectValue(
            this[bestKey],
            characterCategorization
        ) as CharacterDocument[];
        let categorizedBestUpdated = false;

        if (!categorizedBest) {
            categorizedBestUpdated = true;
            categorizedBest = [characterDocument];
        } else {
            const lastBestPerformance = categorizedBest[
                categorizedBest.length - 1
            ][combatMetric] as number;

            const indexOfSameChar = categorizedBest.findIndex(
                (document) => document._id === characterDocument._id
            );

            if (indexOfSameChar >= 0) {
                const sameCharPerformance = categorizedBest[indexOfSameChar][
                    combatMetric
                ] as number;

                if (sameCharPerformance < characterPerformance) {
                    categorizedBest[indexOfSameChar] = characterDocument;
                    categorizedBestUpdated = true;
                }
            } else if (categorizedBest.length < 10) {
                categorizedBest.push(characterDocument);
                categorizedBestUpdated = true;
            } else if (lastBestPerformance < characterPerformance) {
                categorizedBest.push(characterDocument);
                categorizedBestUpdated = true;
            }
        }

        if (categorizedBestUpdated) {
            this[bestKey] = addNestedObjectValue(
                this[bestKey],
                characterCategorization,
                categorizedBest
                    .sort(
                        (a, b) =>
                            (b[combatMetric] || 0) - (a[combatMetric] || 0)
                    )
                    .slice(0, 10)
            );
        }
    }

    mergeRaidBossDocument(raidBossDocument: RaidBossDocument): void {
        const mergeKillCount = () => {
            this.killCount = this.killCount + raidBossDocument.killCount;
        };

        const mergeLatestKills = () => {
            this.latestKills = raidBossDocument.latestKills
                .concat(this.latestKills)
                .slice(0, 50);
        };

        const mergeBestCombatMetricNoCat = () => {
            for (const combatMetric of environment.combatMetrics) {
                const bestOfNoCatKey = `best${capitalize(
                    combatMetric
                )}NoCat` as const;

                const oldBestChar = this[bestOfNoCatKey];
                const newBestChar = raidBossDocument[bestOfNoCatKey];

                if (!oldBestChar) {
                    this[bestOfNoCatKey] = newBestChar;
                } else if (newBestChar) {
                    const oldBestPerformance = oldBestChar[combatMetric];
                    const newBestPerformance = newBestChar[combatMetric];

                    if (
                        oldBestPerformance &&
                        newBestPerformance &&
                        newBestPerformance > oldBestPerformance
                    ) {
                        this[bestOfNoCatKey] = newBestChar;
                    }
                }
            }
        };

        const mergeFastestKills = () => {
            for (const realm of environment.realms) {
                for (const faction of environment.factions) {
                    const oldFastestKills =
                        this.fastestKills?.[realm]?.[faction] || [];
                    const newFastestKills =
                        raidBossDocument.fastestKills?.[realm]?.[faction];

                    if (!!newFastestKills) {
                        this.fastestKills = addNestedObjectValue(
                            this.fastestKills,
                            [realm, faction],
                            newFastestKills
                                .concat(oldFastestKills)
                                .sort((a, b) => a.fightLength - b.fightLength)
                                .slice(0, 50)
                        );
                    }
                }
            }
        };

        const mergeFirstKills = () => {
            for (const realm of environment.realms) {
                for (const faction of environment.factions) {
                    const oldFirstKills =
                        this.firstKills?.[realm]?.[faction] || [];
                    const newFirstKills =
                        raidBossDocument.firstKills?.[realm]?.[faction];

                    if (!!newFirstKills) {
                        this.firstKills = addNestedObjectValue(
                            this.firstKills,
                            [realm, faction],
                            oldFirstKills
                                .concat(newFirstKills)
                                .sort((a, b) => a.date - b.date)
                                .slice(0, 3)
                        );
                    }
                }
            }
        };

        const mergeBestCombatMetric = () => {
            for (const realm of environment.realms) {
                for (const faction of environment.factions) {
                    for (const classId of environment.classIds) {
                        for (const specId of environment.specIdsOfClass[
                            classId
                        ]) {
                            for (const combatMetric of environment.combatMetrics) {
                                const bestOfKey = `best${capitalize(
                                    combatMetric
                                )}` as const;

                                const categorization = [
                                    realm,
                                    faction,
                                    classId,
                                    specId,
                                ];

                                let oldChars =
                                    this[bestOfKey]?.[realm]?.[faction]?.[
                                        classId
                                    ]?.[specId] || [];

                                let newChars =
                                    raidBossDocument[bestOfKey]?.[realm]?.[
                                        faction
                                    ]?.[classId]?.[specId] || [];

                                const bestCharacters: LooseObject = {};

                                for (const bestCharacter of [
                                    ...oldChars,
                                    ...newChars,
                                ]) {
                                    const currentPerformance =
                                        bestCharacter[combatMetric];
                                    if (
                                        !bestCharacters[bestCharacter._id] ||
                                        (bestCharacters[bestCharacter._id] &&
                                            currentPerformance &&
                                            currentPerformance >
                                                bestCharacters[
                                                    bestCharacter._id
                                                ][combatMetric])
                                    ) {
                                        bestCharacters[bestCharacter._id] =
                                            bestCharacter;
                                    }
                                }

                                const updatedBestsOfCombatMetric: CharacterDocument[] =
                                    [];

                                for (const charId in bestCharacters) {
                                    updatedBestsOfCombatMetric.push(
                                        bestCharacters[charId]
                                    );
                                }

                                this[bestOfKey] = addNestedObjectValue(
                                    this[bestOfKey],
                                    categorization,
                                    updatedBestsOfCombatMetric
                                        .sort((a, b) => {
                                            const bPerf = b[combatMetric];
                                            const aPerf = a[combatMetric];
                                            if (bPerf && aPerf) {
                                                return bPerf - aPerf;
                                            } else {
                                                return 0;
                                            }
                                        })
                                        .slice(0, 10)
                                ) as CategorizedCharacter;
                            }
                        }
                    }
                }
            }
        };

        mergeKillCount();
        mergeLatestKills();
        mergeBestCombatMetricNoCat();
        mergeFastestKills();
        mergeFirstKills();
        mergeBestCombatMetric();
    }

    getBestPerformanceOfClass(
        classId: ClassId,
        combatMetric: CombatMetric
    ): CharacterDocument | undefined {
        let bestOfClass: CharacterDocument | undefined;
        let performance = 0;

        const key = `best${capitalize(combatMetric)}` as const;

        const categorizedCharacters = this[key];

        for (const realm of environment.realms) {
            for (const faction of environment.factions) {
                for (const specId of environment.specIdsOfClass[classId]) {
                    const character =
                        categorizedCharacters?.[realm]?.[faction]?.[classId]?.[
                            specId
                        ]?.[0];

                    const characterPerformance =
                        character && character[combatMetric]
                            ? character[combatMetric] || 0
                            : 0;

                    if (character && characterPerformance > performance) {
                        bestOfClass = character;
                        performance = characterPerformance;
                    }
                }
            }
        }

        return bestOfClass;
    }

    getBestPerformanceOfSpec(specId: SpecId, combatMetric: CombatMetric) {
        const classId = environment.getClassOfSpec(specId);

        let bestOfSpec: CharacterDocument | undefined;
        let performance = 0;

        const key = `best${capitalize(combatMetric)}` as const;

        const categorizedCharacters = this[key];

        for (const realm of environment.realms) {
            for (const faction of environment.factions) {
                const character =
                    categorizedCharacters?.[realm]?.[faction]?.[classId]?.[
                        specId
                    ]?.[0];

                const characterPerformance =
                    character && character[combatMetric]
                        ? character[combatMetric] || 0
                        : 0;
                if (character && characterPerformance > performance) {
                    bestOfSpec = character;
                    performance = characterPerformance;
                }
            }
        }

        return bestOfSpec;
    }

    getBestPerformance(combatMetric: CombatMetric) {
        let best: CharacterDocument | undefined;
        let performance = 0;

        const key = `best${capitalize(combatMetric)}` as const;

        const categorizedCharacters = this[key];

        for (const realm of environment.realms) {
            for (const faction of environment.factions) {
                for (const classId of environment.classIds) {
                    for (const specId of environment.specIdsOfClass[classId]) {
                        const character =
                            categorizedCharacters?.[realm]?.[faction]?.[
                                classId
                            ]?.[specId]?.[0];

                        const characterPerformance =
                            character && character[combatMetric]
                                ? character[combatMetric] || 0
                                : 0;
                        if (character && characterPerformance > performance) {
                            best = character;
                            performance = characterPerformance;
                        }
                    }
                }
            }
        }

        return best;
    }

    getSummary(): RaidBossForSummary {
        let raidBossForSummary = JSON.parse(
            JSON.stringify(this.getDocument())
        ) as RaidBossForSummary;

        for (const key in raidBossForSummary.fastestKills) {
            const realmName = key as unknown as Realm;
            for (const key in raidBossForSummary.fastestKills[realmName]) {
                const faction = Number(key) as unknown as Faction;
                raidBossForSummary.fastestKills[realmName][faction] =
                    raidBossForSummary.fastestKills?.[realmName]?.[
                        faction
                    ].slice(0, 3);
            }
        }

        delete raidBossForSummary.killCount;
        delete raidBossForSummary.latestKills;
        delete raidBossForSummary.bestDpsNoCat;
        delete raidBossForSummary.bestHpsNoCat;

        return raidBossForSummary;
    }

    private isRaidBossDocument(obj: any): obj is RaidBossDocument {
        if (obj && obj._id) {
            return true;
        }
        return false;
    }
}

export default RaidBossDocumentController;
