import constants, { realmGroups } from "tauriprogress-constants";

import * as dotenv from "dotenv";
dotenv.config();

const defaultPort = 3001;

type RealmGroup = (typeof realmGroups)[number];

function isRealmGroup(str: string): str is RealmGroup {
    let index = -1;
    for (let i = 0; i < realmGroups.length; i++) {
        const realmGroup = realmGroups[i];
        if (realmGroup === str) {
            index = i;
        }
    }

    return index > -1 ? true : false;
}

class Environment {
    readonly REALM_GROUP: RealmGroup;
    readonly TAURI_API_KEY: string;
    readonly TAURI_API_SECRET: string;
    readonly MONGODB_USER: string;
    readonly MONGODB_PASSWORD: string;
    readonly MONGODB_ADDRESS: string;
    readonly PORT: number;
    readonly CORS_ORIGIN: string;

    readonly apiUrl;
    readonly defaultRealm;
    readonly defaultDifficulty;
    readonly expansion;
    readonly realms;
    readonly characterClassNames;
    readonly shortRealms;
    readonly currentContent;
    readonly characterRaceFaction;
    readonly specs;
    readonly characterSpecClass;
    readonly logBugs;
    readonly guildFactionBugs;
    readonly characterClassSpecs;
    readonly difficultyNames;
    readonly forceInit;
    readonly seasonal;
    readonly seasons;
    readonly maxCharacterScore;

    constructor() {
        if (process.env.FORCE_INIT && process.env.FORCE_INIT === "true") {
            this.forceInit = true;
        } else {
            this.forceInit = false;
        }

        if (typeof process.env.CORS_ORIGIN === "string") {
            this.CORS_ORIGIN = process.env.CORS_ORIGIN;
        } else {
            console.error(
                `Environment variable CORS_ORIGIN=${process.env.CORS_ORIGIN} is invalid. Example: https://tauriprogress.github.io`
            );
            process.exit(0);
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

        const realmGroupEnv = constants[this.REALM_GROUP];

        this.realms = realmGroupEnv.realms;
        this.characterClassNames = realmGroupEnv.characterClassNames;
        this.specs = realmGroupEnv.specs;
        this.logBugs = realmGroupEnv.logBugs;
        this.guildFactionBugs = realmGroupEnv.guildFactionBugs;
        this.difficultyNames = realmGroupEnv.difficultyNames;
        this.seasons = realmGroupEnv.seasons;
        this.defaultRealm = realmGroupEnv.defaultRealm;
        this.defaultDifficulty = realmGroupEnv.defaultDifficulty;
        this.apiUrl = realmGroupEnv.urls.api;
        this.expansion = realmGroupEnv.expansion;

        this.shortRealms = constants.shortRealms;
        this.characterRaceFaction = constants.characterRaceFaction;
        this.characterSpecClass = constants.characterSpecClass;
        this.characterClassSpecs = constants.characterClassSpecs;
        this.maxCharacterScore = constants.maxCharacterScore;

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
export default environment;
