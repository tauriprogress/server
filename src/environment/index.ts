import * as constants from "tauriprogress-constants";

class Environment {
    readonly REALM_GROUP: string | undefined;
    readonly TAURI_API_KEY: string | undefined;
    readonly TAURI_API_SECRET: string | undefined;
    readonly MONGODB_USER: string | undefined;
    readonly MONGODB_PASSWORD: string | undefined;
    readonly MONGODB_ADDRESS: string | undefined;

    constructor() {
        this.REALM_GROUP = process.env.REALM_GROUP;
        this.TAURI_API_KEY = process.env.REALM_GROUP;
        this.TAURI_API_SECRET = process.env.REALM_GROUP;
        this.MONGODB_USER = process.env.REALM_GROUP;
        this.MONGODB_PASSWORD = process.env.REALM_GROUP;
        this.MONGODB_ADDRESS = process.env.REALM_GROUP;
    }
}

const environment = new Environment();

export { environment };
