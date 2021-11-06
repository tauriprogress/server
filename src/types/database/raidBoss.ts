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
    [propName: number]: ExtendedRaidBoss;
}

export interface ExtendedRaidBoss extends RaidBoss {
    dps: RankedCharacter[];
    hps: RankedCharacter[];
    fiftyFastestKills: TrimmedLog[];
}

export interface DbRaidBossDataResponse {
    _id: ObjectId;
    name: string;
    [propName: number]: DbRaidBossResponse;
}

interface DbRaidBossResponse extends RaidBoss {
    dps: Character[];
    hps: Character[];
}
