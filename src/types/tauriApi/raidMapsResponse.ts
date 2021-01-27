export interface RaidMapsResponse {
    success: boolean;
    errorcode: number;
    errorstring: string;
    response: RaidMaps;
}

export interface RaidMaps {
    map_exp_0: MapExp[];
    map_exp_1: MapExp[];
    map_exp_2: MapExp[];
    map_exp_3: MapExp[];
    map_exp_4: MapExp[];
}

interface MapExp {
    id: number;
    expansion: number;
    type: number;
    name: string;
    available_difficulties: AvailableDifficulty[];
    encounters: Encounter[];
}

interface AvailableDifficulty {
    id: number;
    name: string;
}

interface Encounter {
    encounter_id: number;
    encounter_map: number;
    encounter_difficulty: number;
    encounter_name: string;
    encounter_order: number;
    encounter_index: number;
}
