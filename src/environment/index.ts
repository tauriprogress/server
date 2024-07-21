import constants, { realmGroups } from "tauriprogress-constants";

import * as dotenv from "dotenv";
import { ERR_INVALID_RAID_ID, ERR_INVALID_RAID_NAME } from "../helpers/errors";
import { ClassId, CombatMetric, RaidId, RaidName, SpecId } from "../types";
import { RaffleItem } from "../database/DBInterface/DBWeeklyChallenge";
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
    readonly ENCRYPTION_KEY: string;
    readonly PATREON_CLIENT: string;
    readonly PATREON_SECRET: string;
    readonly UPDATE: boolean;

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
    readonly specIdsOfClass;
    readonly difficultyNames;
    readonly forceInit;
    readonly seasonal;
    readonly seasons;
    readonly maxCharacterScore;

    readonly combatMetrics: ["dps", "hps"];
    readonly factions: [0, 1];
    readonly week: number;
    readonly pathToLastLogIds: "./logs/lastLogIds.json";
    readonly pathToLogs: "./logs/logs.txt";
    readonly specIds: SpecId[];
    readonly classIds: ClassId[];

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

        if (typeof process.env.ENCRYPTION_KEY === "string") {
            this.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
        } else {
            console.error(
                `Environment variable ENCRYPTION_KEY=${process.env.ENCRYPTION_KEY} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.PATREON_CLIENT === "string") {
            this.PATREON_CLIENT = process.env.PATREON_CLIENT;
        } else {
            console.error(
                `Environment variable PATREON_CLIENT=${process.env.PATREON_CLIENT} is invalid.`
            );
            process.exit(0);
        }

        if (typeof process.env.PATREON_SECRET === "string") {
            this.PATREON_SECRET = process.env.PATREON_SECRET;
        } else {
            console.error(
                `Environment variable PATREON_SECRET=${process.env.PATREON_SECRET} is invalid.`
            );
            process.exit(0);
        }

        if (
            typeof process.env.UPDATE === "string" &&
            process.env.UPDATE === "false"
        ) {
            this.UPDATE = false;
        } else {
            this.UPDATE = true;
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
        this.specIdsOfClass = constants.characterClassSpecs;
        this.maxCharacterScore = constants.maxCharacterScore;

        this.combatMetrics = ["dps", "hps"];
        this.factions = [0, 1];
        this.week = 1000 * 60 * 60 * 24 * 7;
        this.pathToLastLogIds = "./logs/lastLogIds.json";
        this.pathToLogs = "./logs/logs.txt";
        this.specIds = Object.keys(this.specs).map((specId) =>
            Number(specId)
        ) as SpecId[];
        this.classIds = Object.keys(this.characterClassNames).map((key) =>
            Number(key)
        ) as ClassId[];

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

    isSpecCombatMetric(specId: SpecId, combatMetric: CombatMetric) {
        return this.specs[specId][
            `is${combatMetric === "dps" ? "Dps" : "Healer"}`
        ];
    }

    getCurrentSeason() {
        const currentDate = new Date().getTime();

        if (this.seasonal) {
            for (const season of this.seasons) {
                const start = new Date(season.start).getTime();
                const finish = new Date(season.finish).getTime();
                if (currentDate > start && currentDate < finish) {
                    return season;
                }
            }
        }

        return false;
    }

    isSeasonRunning() {
        return !!this.getCurrentSeason();
    }

    getRaidInfoFromName(raidName: RaidName) {
        for (const raid of this.currentContent.raids) {
            if (raid.name === raidName) {
                return raid;
            }
        }

        throw ERR_INVALID_RAID_NAME;
    }

    getRaidInfoFromId(raidId: RaidId) {
        for (const raid of this.currentContent.raids) {
            if (raid.id === raidId) {
                return raid;
            }
        }

        throw ERR_INVALID_RAID_ID;
    }

    getRaidNameFromIngamebossId(ingameBossId: number) {
        for (const raid of this.currentContent.raids) {
            for (const boss of raid.bosses) {
                for (const key in boss.bossIdOfDifficulty) {
                    const difficulty = Number(
                        key
                    ) as keyof typeof boss.bossIdOfDifficulty;

                    if (ingameBossId === boss.bossIdOfDifficulty[difficulty])
                        return raid.name;
                }
            }
        }
        return false;
    }

    getRaidBossNameFromIngameBossId(ingameBossId: number) {
        for (const raid of this.currentContent.raids) {
            for (const boss of raid.bosses) {
                for (const key in boss.bossIdOfDifficulty) {
                    const difficulty = Number(
                        key
                    ) as keyof typeof boss.bossIdOfDifficulty;

                    if (ingameBossId === boss.bossIdOfDifficulty[difficulty])
                        return boss.name;
                }
            }
        }
        return false;
    }

    getSpecsOfClass(classId: ClassId) {
        return this.specIdsOfClass[classId];
    }

    getClassOfSpec(specId: SpecId) {
        return this.characterSpecClass[specId];
    }

    getCurrentRaidId() {
        for (let raid of this.currentContent.raids) {
            if (raid.name === this.currentContent.name) {
                return raid.id;
            }
        }

        return this.currentContent.raids[0].id;
    }

    getDefaultRaffleItems(): RaffleItem[] {
        return this.currentContent.raids[0].bosses.map((boss) => ({
            name: boss.name,
            weight: 100,
        }));
    }
}

const environment = new Environment();
export default environment;
