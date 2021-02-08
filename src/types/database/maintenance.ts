export interface Maintenance {
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: {
        [propName: string]: number;
    };
    isInitalized: boolean;
}
