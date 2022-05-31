import { ObjectId, Document } from "mongodb";
import { Realm } from "..";

export interface MaintenanceDocument extends Document {
    _id: ObjectId;
    lastUpdated: number;
    lastGuildsUpdate: number;
    lastLogIds: {
        [key in Realm]?: number;
    };
    isInitalized: boolean;
}
