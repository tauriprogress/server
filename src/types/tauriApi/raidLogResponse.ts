export interface RaidLogResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: RaidLog;
}

export interface RaidLog {
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
    members: Member[];
    item_count: number;
    items: Item[];
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
    faction?: Faction;
    leadername?: string;
}

interface Item {
    itemid: number;
    count: number;
    random_prop: number;
    random_suffix: number;
}

interface Mapentry {
    id: number;
    expansion: number;
    type: number;
    name: string;
}

interface Member {
    valid_player: boolean;
    guid: number;
    race: number;
    class: number;
    gender: number;
    name: string;
    link: string;
    spec: number;
    dmg_done: number;
    dmg_taken: number;
    dmg_absorb: number;
    heal_done: number;
    absorb_done: number;
    overheal: number;
    heal_taken: number;
    interrupts: number;
    dispells: number;
    ilvl: number;
}

type Faction = 0 | 1;
