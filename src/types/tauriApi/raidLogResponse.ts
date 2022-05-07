import { Faction, ClassId, SpecId, Race } from "../";
import { Difficulty, RaidId, RaidName } from "../global";

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
    difficulty: Difficulty;
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
    id: RaidId;
    expansion: number;
    type: number;
    name: RaidName;
}

interface Member {
    valid_player: boolean;
    guid: number;
    race: Race;
    class: ClassId;
    gender: number;
    name: string;
    link: string;
    spec: SpecId;
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
    talents?: string;
    trinket_0?: Trinket;
    trinket_1?: Trinket;
}

type Trinket = {
    entry: number;
    guid: number;
    originalicon: string;
    icon: string;
    rarity: number;
    stackcount: number;
    ilevel: number;
    originalname: string;
    name: string;
    transmogid: number;
    transmogitemname: string;
    transmogitemicon: string;
    gems: [];
    ench: {};
};
