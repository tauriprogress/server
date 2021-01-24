export interface RaidBossRankedLogs {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: Response;
}

export interface Response {
    logs: Log[];
}

export interface Log {
    rank: number;
    log_id: number;
    map_id: number;
    mapentry: Mapentry;
    difficulty: number;
    rid: number;
    guildid: number;
    guildrid: number;
    guilddata: Guilddata;
    killtime: number;
    wipes: number;
    deahts_total: number;
    fight_time: number;
    deaths_fight: number;
    resurrects_fight: number;
    encounter_id: number;
    encounter_data: EncounterData;
    member_count: number;
    item_count: number;
}

export interface EncounterData {
    encounter_id: number;
    encounter_map: number;
    encounter_difficulty: number;
    encounter_name: string;
    encounter_sorting: number;
    encounter_index: number;
}

export interface Guilddata {
    name?: string;
    faction?: number;
    leadername?: string;
}

export interface Mapentry {
    id: number;
    expansion: number;
    type: number;
    name: string;
}
