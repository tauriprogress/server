import { ERR_DB_COLLECTION_NOT_CLEARABLE } from "../../helpers/errors";
import { DatabaseInterface } from "../DBInterface";

export class Collection {
    public name;
    public clearable;
    private dbInterface;

    constructor(
        dbInterface: DatabaseInterface,
        collectionMetaData: CollectionMetaData
    ) {
        this.name = collectionMetaData.name;
        this.clearable = collectionMetaData.clearable;
        this.dbInterface = dbInterface;
    }

    clearCollection(): Promise<void> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.clearable) {
                    throw ERR_DB_COLLECTION_NOT_CLEARABLE;
                }

                await this.dbInterface.maintenance
                    .getConnection()
                    .collection(this.name)
                    .deleteMany();

                resolve();
            } catch (e) {
                reject(e);
            }
        });
    }
}

export type CollectionMetaData = {
    name: string;
    clearable: boolean;
};
