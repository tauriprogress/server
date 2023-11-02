import { Collection } from "./Collection";
import { DatabaseInterface } from "../DBInterface";

export class MaintenanceCollection extends Collection {
    public name: (typeof maintenanceCollectionMetaData)["name"];

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: typeof maintenanceCollectionMetaData
    ) {
        super(dbInterface, collectionMetaData);
        this.name = collectionMetaData.name;
    }
}

export const maintenanceCollectionMetaData = {
    name: "Maintenance",
    clearable: true,
    classConstructor: MaintenanceCollection,
} as const;
