import { RaidBoss, Character, RankedCharacter } from "../../types";
import { ObjectId } from "mongodb";
import { TrimmedLog } from "../logs";

export interface DbRaidBoss {
    _id: ObjectId;
    name: string;
    [propName: number]: RaidBoss;
}

export interface RaidBossDataToServe {
    _id: ObjectId;
    name: string;
    [propName: number]: ModifiedRaidBoss;
}

interface ModifiedRaidBoss
    extends Omit<
        RaidBoss,
        "bestHps" | "bestDps" | "firstKills" | "fastestKills"
    > {
    dps: RankedCharacter[];
    hps: RankedCharacter[];
    fastestKills: TrimmedLog[];
}

export interface DbRaidBossDataResponse {
    _id: ObjectId;
    name: string;
    [propName: number]: DbRaidBossResponse;
}

interface DbRaidBossResponse
    extends Omit<RaidBoss, "bestHps" | "bestDps" | "firstKills"> {
    dps: Character[];
    hps: Character[];
}
