import { DatabaseInterface } from ".";

export class DBWeekly {
    private dbInterface: DatabaseInterface;

    constructor(dbInterface: DatabaseInterface) {
        this.dbInterface = dbInterface;
    }

    getFullClearData() {
        return this.dbInterface;
    }
}

export default DBWeekly;
