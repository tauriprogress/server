import * as constants from "tauriprogress-constants";

import * as dotenv from "dotenv";
dotenv.config();

const defaultPort = 3001;

const realmGroups = {
    tauri: "",
    crystalsong: "",
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
    readonly realms;
    readonly characterClassNames;
    readonly shortRealms;
    readonly currentContent;
    readonly characterRaceToFaction;
    readonly specs;
    readonly characterSpecToClass;
    readonly logBugs;
    readonly guildFactionBugs;
    readonly characterClassToSpec;
    readonly difficultyNames;
    readonly forceInit;
    readonly seasonal;
    readonly seasons;

    constructor() {
        if (process.env.FORCE_INIT && process.env.FORCE_INIT === "true") {
            this.forceInit = true;
        } else {
            this.forceInit = false;
        }

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

        const realmGroupEnv =
            this.REALM_GROUP === "tauri"
                ? constants.tauri
                : constants.crystalsong;

        this.realms = realmGroupEnv.realms;
        this.characterClassNames = realmGroupEnv.characterClassNames;
        this.specs = realmGroupEnv.specs;
        this.logBugs = realmGroupEnv.logBugs;
        this.guildFactionBugs = realmGroupEnv.guildFactionBugs;
        this.difficultyNames = realmGroupEnv.difficultyNames;
        this.seasons = realmGroupEnv.seasons;
        this.defaultRealm =
            realmGroupEnv.realms[
                Object.keys(
                    realmGroupEnv.realms
                )[0] as keyof typeof realmGroupEnv.realms
            ];

        this.shortRealms = constants.shortRealms;
        this.characterRaceToFaction = constants.characterRaceToFaction;
        this.characterSpecToClass = constants.characterSpecToClass;
        this.characterClassToSpec = constants.characterClassToSpec;

        if (process.env.SEASONAL && process.env.SEASONAL === "true") {
            this.seasonal = true;

            const currentContent = {
                ...realmGroupEnv.currentContent,
                raids: [realmGroupEnv.currentContent.raids[0]],
            };

            this.currentContent = currentContent;
        } else {
            this.seasonal = false;
            this.currentContent = realmGroupEnv.currentContent;
        }
    }
}

const environment = new Environment();

export { environment };
