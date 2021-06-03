export interface CharacterPerformance {
    [propName: string]: { [propName: string]: RaidBossCollection };
}

export interface RaidBossCollection {
    total: CharPerfBossData;
    [propName: string]: CharPerfBossData;
}

export interface CharPerfBossData {
    class: CharPerfData;
    noSpec: CharPerfData;
    [propName: string]: CharPerfData;
}

export interface CharPerfData {
    _id?: string;
    realm?: string;
    class?: number;
    name?: string;
    spec?: number;
    ilvl?: number;
    date?: number;
    logId?: number;
    f?: number;
    dps?: number;
    rank?: number;
    cRank?: number;
    sRank?: number;
    topPercent: number | null;
    hps?: number;
    race: string;
}
