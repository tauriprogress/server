import {
    Difficulty,
    RaidName,
    DamageCharacterDocument,
    HealCharacterDocument,
    SpecId,
    CombatMetric,
} from "../";

export type CharacterPerformance = {
    [key in RaidName]: {
        [key in Difficulty]: {
            [propName: string]: CharacterPerformanceRaidBoss;
        };
    };
};

type CustomType = {
    [key in SpecId]: {
        [key in CombatMetric]: CharacterPerformanceDocument;
    };
};

export interface CharacterPerformanceRaidBoss extends CustomType {
    class: {
        [key in CombatMetric]: CharacterPerformanceDocument;
    };
    all: {
        [key in CombatMetric]: CharacterPerformanceDocument;
    };
}

interface DamageCharPerf extends DamageCharacterDocument {
    performance: number;
}

interface HealCharPerf extends HealCharacterDocument {
    performance: number;
}

export type CharacterPerformanceDoc = DamageCharPerf | HealCharPerf;

export interface EmptyCharacterPerformanceDoc {
    performance: undefined;
}

export type CharacterPerformanceDocument =
    | CharacterPerformanceDoc
    | EmptyCharacterPerformanceDoc;
