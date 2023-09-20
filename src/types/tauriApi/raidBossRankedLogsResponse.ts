import { MilliSecond, Second } from "../global";

export interface RaidBossRankedLogsResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: RaidBossRankedLogs;
}

export interface RaidBossRankedLogs {
    logs: RaidBossRankedLog[];
}

interface RaidBossRankedLog {
    rank: number;
    log_id: number;
    map_id: number;
    mapentry: Mapentry;
    difficulty: number;
    rid: number;
    guildid: number;
    guildrid: number;
    guilddata: Guilddata;
    killtime: Second;
    wipes: number;
    deahts_total: number;
    fight_time: MilliSecond;
    deaths_fight: number;
    resurrects_fight: number;
    encounter_id: number;
    encounter_data: EncounterData;
    member_count: number;
    item_count: number;
}

interface EncounterData {
    encounter_id: number;
    encounter_map: number;
    encounter_difficulty: number;
    encounter_name: string;
    encounter_sorting: number;
    encounter_index: number;
}

interface Guilddata {
    name?: string;
    faction?: number;
    leadername?: string;
}

interface Mapentry {
    id: number;
    expansion: number;
    type: number;
    name: string;
}
