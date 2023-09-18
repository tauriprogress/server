import { Difficulty, RaidName, SpecId, CombatMetric } from "../";
import { CharacterDocument } from "../../helpers";

export type CharacterPerformance = {
    [key in RaidName]: {
        [key in Difficulty]: {
            [propName: string]: CharacterPerformanceRaidBoss;
        };
    };
};

type RaidbossSpecIds = {
    [key in SpecId]: {
        [key in CombatMetric]: CharacterPerformanceDocument;
    };
};

export interface CharacterPerformanceRaidBoss extends RaidbossSpecIds {
    class: {
        [key in CombatMetric]: CharacterPerformanceDocument | number;
    };
    all: {
        [key in CombatMetric]: CharacterPerformanceDocument | number;
    };
}

export interface CharacterPerformanceDocument extends CharacterDocument {
    performance?: number;
}
