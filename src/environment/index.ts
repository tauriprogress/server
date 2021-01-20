import * as constants from "tauriprogress-constants";

import * as dotenv from "dotenv";
import { SSL_OP_SINGLE_DH_USE } from "constants";
dotenv.config();

const defaultPort = 3001;

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
    readonly PORT: number;

    readonly defaultRealm: string;
    readonly raids;

    constructor() {
        if (process.env.REALM_GROUP && isRealmGroup(process.env.REALM_GROUP)) {
            this.REALM_GROUP = process.env.REALM_GROUP;
        } else {
            console.error(
                `Environment variable REALM_GROUP=${process.env.REALM_GROUP} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.TAURI_API_KEY === "string") {
            this.TAURI_API_KEY = process.env.TAURI_API_KEY;
        } else {
            console.error(
                `Environment variable TAURI_API_KEY=${process.env.TAURI_API_KEY} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.TAURI_API_SECRET === "string") {
            this.TAURI_API_SECRET = process.env.TAURI_API_SECRET;
        } else {
            console.error(
                `Environment variable TAURI_API_SECRET=${process.env.TAURI_API_SECRET} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.MONGODB_USER === "string") {
            this.MONGODB_USER = process.env.MONGODB_USER;
        } else {
            console.error(
                `Environment variable MONGODB_USER=${process.env.MONGODB_USER} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.MONGODB_PASSWORD === "string") {
            this.MONGODB_PASSWORD = process.env.MONGODB_PASSWORD;
        } else {
            console.error(
                `Environment variable MONGODB_PASSWORD=${process.env.MONGODB_PASSWORD} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.MONGODB_ADDRESS === "string") {
            this.MONGODB_ADDRESS = process.env.MONGODB_ADDRESS;
        } else {
            console.error(
                `Environment variable MONGODB_ADDRESS=${process.env.MONGODB_ADDRESS} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.PORT === "string") {
            this.PORT = Number(process.env.PORT)
                ? Number(process.env.PORT)
                : (this.PORT = defaultPort);
        } else {
            this.PORT = defaultPort;
        }

        if (this.REALM_GROUP === "tauri") {
            this.defaultRealm =
                constants.tauri.realms[
                    Object.keys(
                        constants.tauri.realms
                    )[0] as keyof typeof constants.tauri.realms
                ];

            this.raids = constants.tauri.currentContent.raids;
        } else {
            this.defaultRealm =
                constants.crystalsong.realms[
                    Object.keys(
                        constants.crystalsong.realms
                    )[0] as keyof typeof constants.crystalsong.realms
                ];

            this.raids = constants.crystalsong.currentContent.raids;
        }
    }
}

const environment = new Environment();

export { environment };
