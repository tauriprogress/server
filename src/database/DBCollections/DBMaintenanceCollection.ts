import { Db } from "mongodb";
import { Collection } from ".";

export class MaintenanceCollection extends Collection {
    public name: (typeof maintenanceCollectionMetaData)["name"];

    constructor(
        dbConnection: Db,
        collectionMetaData: typeof maintenanceCollectionMetaData
    ) {
        super(dbConnection, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const maintenanceCollectionMetaData = {
    name: "Maintenance",
    clearable: true,
    classConstructor: MaintenanceCollection,
} as const;
