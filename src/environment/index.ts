import * as constants from "tauriprogress-constants";

const realmGroups = {
    tauri: "",
    crystalsong: ""
};

type realmGroupType = keyof typeof realmGroups;

function isRealmGroup(x: string): x is realmGroupType {
    return realmGroups.hasOwnProperty(x);
}

class Environment {
    readonly REALM_GROUP: realmGroupType;
    readonly TAURI_API_KEY: string;
    readonly TAURI_API_SECRET: string;
    readonly MONGODB_USER: string;
    readonly MONGODB_PASSWORD: string;
    readonly MONGODB_ADDRESS: string;

    constructor() {
        if (process.env.REALM_GROUP && isRealmGroup(process.env.REALM_GROUP)) {
            this.REALM_GROUP = process.env.REALM_GROUP;
        } else {
            console.error(
                `Environment variable REALM_GROUP=${process.env.REALM_GROUP} is invalid.`
            );
            process.exit(0);
        }

        this.TAURI_API_KEY = process.env.REALM_GROUP;
        this.TAURI_API_SECRET = process.env.REALM_GROUP;
        this.MONGODB_USER = process.env.REALM_GROUP;
        this.MONGODB_PASSWORD = process.env.REALM_GROUP;
        this.MONGODB_ADDRESS = process.env.REALM_GROUP;
    }
}

const environment = new Environment();

export { environment };
