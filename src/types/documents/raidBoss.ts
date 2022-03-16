import {
    Difficulty,
    RaidId,
    TrimmedLog,
    Realm,
    Faction,
    ClassId,
    CharacterDocument,
    SpecId,
} from "..";
import { getRaidBossId } from "../../helpers";
import { Document } from "mongodb";

export interface RaidBossDocument extends Document {
    _id: ReturnType<typeof getRaidBossId>;
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
        [key in Faction]: TrimmedLog[];
    };
};

type CategorizedCharacter = {
    [key in Realm]?: {
        [key in Faction]: {
            [key in ClassId]: {
                [key in SpecId]?: CharacterDocument[];
            };
        };
    };
};
