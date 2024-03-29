import * as NodeCache from "node-cache";
import {
    CharacterDataResponse,
    CharacterLastRaidLogsResponse,
    ItemResponse,
    RaidLogResponse,
    Realm,
} from "../types";
import { id } from "../helpers";

class TauriAPICache {
    private items: NodeCache;
    private logs: NodeCache;
    private characters: NodeCache;
    private characterRecentKills: NodeCache;

    constructor() {
        this.items = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 1500,
        });

        this.logs = new NodeCache({
            stdTTL: 20 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 400,
        });

        this.characters = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 400,
        });

        this.characterRecentKills = new NodeCache({
            stdTTL: 5 * 60,
            checkperiod: 60,
            useClones: false,
            maxKeys: 400,
        });
    }

    setItem(itemId: number, realm: Realm, item: ItemResponse) {
        try {
            this.items.set(id.cache.itemCacheId(itemId, realm), item);
        } catch (e) {
            console.error(e);
        }
    }

    getItem(itemId: number, realm: Realm) {
        return this.items.get(id.cache.itemCacheId(itemId, realm)) as
            | ItemResponse
            | undefined;
    }

    setLog(response: RaidLogResponse, realm: Realm) {
        try {
            this.logs.set(
                id.cache.extendedLogId(response.response.log_id, realm),
                response
            );
        } catch (e) {
            console.error(e);
        }
    }

    getLog(logId: number, realm: Realm) {
        return this.logs.get(id.cache.extendedLogId(logId, realm)) as
            | RaidLogResponse
            | undefined;
    }

    setCharacter(response: CharacterDataResponse, realm: Realm) {
        try {
            this.characters.set(
                id.cache.characterApiId(response.response.name, realm),
                response
            );
        } catch (e) {
            console.error(e);
        }
    }

    getCharacter(characterName: string, realm: Realm) {
        return this.characters.get(
            id.cache.characterApiId(characterName, realm)
        ) as CharacterDataResponse | undefined;
    }

    setCharacterRecentKills(
        name: string,
        realm: Realm,
        response: CharacterLastRaidLogsResponse
    ) {
        try {
            this.characterRecentKills.set(
                id.cache.characterRecentKillsCacheId(name, realm),
                response
            );
        } catch (e) {
            console.error(e);
        }
    }

    getCharacterRecentKills(name: string, realm: Realm) {
        return this.characterRecentKills.get(
            id.cache.characterRecentKillsCacheId(name, realm)
        ) as CharacterLastRaidLogsResponse | undefined;
    }
}

const tauriApiCache = new TauriAPICache();

export default tauriApiCache;
