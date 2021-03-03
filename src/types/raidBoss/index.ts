import { TrimmedLog, Character } from "../../types";

export interface RaidBoss {
    _id: string;
    raidId: number;
    name: string;
    difficulty: number;
    killCount: number;
    recentKills: TrimmedLog[];
    fastestKills: CategorizedTrimmedLogs;
    firstKills: CategorizedTrimmedLogs;
    bestDps: CategorizedCharacter;
    bestHps: CategorizedCharacter;
    bestDpsNoCat?: Character;
    bestHpsNoCat?: Character;
}

interface CategorizedTrimmedLogs {
    [propName: string]: {
        [propName: number]: TrimmedLog[];
    };
}

interface CategorizedCharacter {
    [propName: string]: {
        [propName: number]: {
            [propName: number]: {
                [propName: number]: Character[];
            };
        };
    };
}
