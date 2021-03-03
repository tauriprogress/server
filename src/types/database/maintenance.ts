import { ObjectId } from "mongodb";

export interface DbMaintenance {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: {
        [propName: string]: number;
    };
    isInitalized: boolean;
}
