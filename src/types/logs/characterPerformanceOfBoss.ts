import { CharacterDocument, CombatMetric } from "..";

export type CharacterPerformanceOfBoss = {
    [bossId: string]: {
        [K in CombatMetric]: {
            [characterId: string]: CharacterDocument;
        };
    };
};
