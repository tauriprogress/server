import { MaintenanceDocument } from "../../types";
import { ObjectId } from "mongodb";

export function createMaintenanceDocument(): MaintenanceDocument {
    return {
        _id: new ObjectId(),
        lastUpdated: 0,
        lastGuildsUpdate: 0,
        lastLogIds: {},
        isInitalized: true,
        lastLeaderboardUpdate: 0,
    };
}
