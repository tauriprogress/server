import { addNestedObjectValue, id, log } from "..";
import {
    ClassId,
    CombatMetric,
    Difficulty,
    RaidLogWithRealm,
    SpecId,
    TrimmedLog,
} from "../../types";

import { Document } from "mongodb";
import { WeekId } from "../id";
import { CharacterDocument } from "./character";
import environment from "../../environment";
import documentManager from ".";

type CategorizedCharacter = {
    [key in ClassId]?: {
        [key in SpecId]?: CharacterDocument[];
    };
};

export interface WeeklyChallengeDocument extends Document {
    _id: ReturnType<typeof id.weeklyChallengeRaidBossId>;
    bossName: string;
    difficulty: Difficulty;
    latestWednesday: WeekId;
    killCount: number;
    fastestKills: TrimmedLog[];
    dps: CategorizedCharacter;
    hps: CategorizedCharacter;
}

export class WeeklyChallengeDocumentController {
    private _id: ReturnType<typeof id.weeklyChallengeRaidBossId>;
    private bossName: string;
    private difficulty: Difficulty;
    private latestWednesday: WeekId;
    private killCount: number;
    private fastestKills: TrimmedLog[];
    private dps: CategorizedCharacter;
    private hps: CategorizedCharacter;

    constructor(
        obj:
            | { bossName: string; difficulty: Difficulty }
            | WeeklyChallengeDocument
    ) {
        if (this.isWeeklyChallangeDocument(obj)) {
            const doc = JSON.parse(
                JSON.stringify(obj)
            ) as WeeklyChallengeDocument;
            this._id = doc._id;
            this.bossName = doc.bossName;
            this.difficulty = doc.difficulty;
            this.killCount = doc.killCount;
            this.fastestKills = doc.fastestKills;
            this.dps = doc.dps;
            this.hps = doc.hps;
            this.latestWednesday = doc.latestWednesday;
        } else {
            const weekId = id.weekId(new Date());
            this._id = id.weeklyChallengeRaidBossId({
                bossName: obj.bossName,
                difficulty: obj.difficulty,
                weekId,
            });
            this.bossName = obj.bossName;
            this.difficulty = obj.difficulty;
            this.latestWednesday = weekId;
            this.killCount = 0;
            this.fastestKills = [];
            this.dps = {};
            this.hps = {};
        }
    }

    getDocument(): WeeklyChallengeDocument {
        return {
            _id: this._id,
            bossName: this.bossName,
            difficulty: this.difficulty,
            fastestKills: this.fastestKills,
            killCount: this.killCount,
            dps: this.dps,
            hps: this.hps,
            latestWednesday: this.latestWednesday,
        };
    }

    addLog(raidLog: RaidLogWithRealm): void {
        if (!this.isChallengeLog(raidLog)) {
            return;
        }

        this.killCount += 1;
        this.mergeFastestKills([log.trimLog(raidLog)]);

        for (const character of raidLog.members) {
            if (log.validMember(character)) {
                for (const combatMetric of environment.combatMetrics) {
                    const characterDocument = documentManager.character({
                        character,
                        realm: raidLog.realm,
                        logId: raidLog.log_id,
                        date: raidLog.killtime,
                        fightTime: raidLog.fight_time,
                        combatMetric,
                    });

                    this.mergeCharacterDocuments(
                        combatMetric,
                        characterDocument.class,
                        characterDocument.spec,
                        [characterDocument]
                    );
                }
            }
        }
    }

    mergeDocument(document: WeeklyChallengeDocument): void {
        if (!this.isSameChallenge(document)) {
            return;
        }

        this.killCount = this.killCount = document.killCount;
        this.mergeFastestKills(document.fastestKills);
        for (const combatMetric of environment.combatMetrics) {
            for (const classKey in document[combatMetric]) {
                const classId = Number(classKey) as ClassId;

                for (const specKey in document[combatMetric]?.[classId]) {
                    const specId = Number(specKey) as SpecId;

                    const characterDocuments =
                        document[combatMetric][classId]?.[specId] || [];
                    this.mergeCharacterDocuments(
                        combatMetric,
                        classId,
                        specId,
                        characterDocuments
                    );
                }
            }
        }
    }

    isChallengeLog(raidLog: RaidLogWithRealm): boolean {
        const bossName = raidLog.encounter_data.encounter_name;
        const difficulty = raidLog.difficulty;
        const weekId = id.weekId(new Date(raidLog.killtime * 1000));
        if (
            bossName === this.bossName &&
            difficulty === this.difficulty &&
            this.latestWednesday === weekId
        ) {
            return true;
        }

        return false;
    }

    isSameChallenge(document: WeeklyChallengeDocument): boolean {
        if (
            this.bossName === document.bossName &&
            this.difficulty === document.difficulty &&
            this.latestWednesday === document.latestWednesday
        ) {
            return true;
        }

        return false;
    }

    private mergeFastestKills(kills: TrimmedLog[]): void {
        this.fastestKills = this.fastestKills
            .concat(kills)
            .sort((a, b) => a.fightLength - b.fightLength)
            .slice(0, 3);
    }

    private mergeCharacterDocuments(
        combatMetric: CombatMetric,
        classId: ClassId,
        specId: SpecId,
        characters: CharacterDocument[]
    ): void {
        const prevChars = this[combatMetric][classId]?.[specId];

        const newValue = (prevChars || [])
            .concat(characters)
            .sort((a, b) => {
                return (a[combatMetric] || 0) - (b[combatMetric] || 0);
            })
            .slice(0, 10);

        this[combatMetric] = addNestedObjectValue(
            this[combatMetric],
            [classId, specId],
            newValue
        );
    }

    private isWeeklyChallangeDocument(
        obj: any
    ): obj is WeeklyChallengeDocument {
        if (obj && obj._id) {
            return true;
        }

        return false;
    }
}

export default WeeklyChallengeDocumentController;
