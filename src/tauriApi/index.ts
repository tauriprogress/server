import fetch from "node-fetch";
import * as url from "url";
import { environment } from "../environment";
import {
    CharacterData,
    GuildData,
    CharacterAchievements,
    RaidMaps,
    RaidLog,
    LastRaidLogs
} from "../types";

class TauriApi {
    private apikey: string;
    private apisecret: string;
    private baseUrl: string;

    constructor() {
        this.apikey = environment.TAURI_API_KEY;
        this.apisecret = environment.TAURI_API_SECRET;
        this.baseUrl = "http://chapi.tauri.hu/apiIndex.php";
    }

    request<T>(options: Object): Promise<T> {
        return new Promise(async (resolve, reject) => {
            try {
                let timeOut = setTimeout(() => {
                    reject(new Error("request timed out"));
                }, 13000);

                resolve(
                    await fetch(
                        url.parse(`${this.baseUrl}?apikey=${this.apikey}`),
                        options
                    ).then(res => {
                        clearTimeout(timeOut);
                        return res.json();
                    })
                );
            } catch (err) {
                if (err.message === "Api request timed out.") {
                    reject(err);
                } else {
                    reject(new Error("Api request failed."));
                }
            }
        });
    }

    getCharacterData(name: string, realm: string) {
        return this.request<CharacterData>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-sheet",
                    params: {
                        r: realm,
                        n: name
                    }
                })
            )
        });
    }

    getGuildData(name: string, realm: string) {
        return this.request<GuildData>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "guild-info",
                    params: {
                        r: realm,
                        gn: name
                    }
                })
            )
        });
    }

    getCharacterAchievements(name: string, realm: string) {
        return this.request<CharacterAchievements>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-achievements",
                    params: {
                        r: realm,
                        n: name
                    }
                })
            )
        });
    }

    getRaidMaps(realm: string) {
        return this.request<RaidMaps>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-maps",
                    params: {
                        r: realm
                    }
                })
            )
        });
    }

    getRaidLog(id: number, realm: string) {
        return this.request<RaidLog>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-log",
                    params: {
                        r: realm,
                        id: id
                    }
                })
            )
        });
    }

    getRaidLast(lastLogId: number = 0, realm: string) {
        return this.request<LastRaidLogs>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-last",
                    params: {
                        r: realm,
                        from: lastLogId
                    }
                })
            )
        });
    }

    getRaidPlayer(realm, characterName, logId, limit) {
        // returns latest boss kills of the player
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-player",
                    params: {
                        r: realm,
                        cn: characterName,
                        from: logId ? logId : 0,
                        limit: limit ? limit : 0
                    }
                })
            )
        });
    }

    getRaidGuild(realm, guildName) {
        // returns all of the boss kills of the guild
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-guild",
                    params: {
                        r: realm,
                        gn: guildName
                    }
                })
            )
        });
    }

    getRaidRank(realm, encounter, difficulty) {
        // return boss kills of boss, sorted by fastest kill ascending
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-rank-encounter",
                    params: {
                        r: realm,
                        encounter: encounter,
                        difficulty: difficulty
                    }
                })
            )
        });
    }

    getRaidGuildRank(realm, guildName, encounter, difficulty) {
        // similar to getRaidRank, but only returns guild kills, not including random kills
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-guildrank-encounter",
                    params: {
                        r: realm,
                        gn: guildName,
                        encounter: encounter,
                        difficulty: difficulty
                    }
                })
            )
        });
    }

    getItem(id) {
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "item-tooltip",
                    params: {
                        r: "[HU] Tauri WoW Server",
                        e: id
                    }
                })
            )
        });
    }

    getItemByGuid(guid, realm) {
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "item-tooltip",
                    params: {
                        r: realm || "[HU] Tauri WoW Server",
                        i: guid
                    }
                })
            )
        });
    }

    getCharacterTalents(name, realm) {
        return this.request({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-talents",
                    params: {
                        r: realm || "[HU] Tauri WoW Server",
                        n: name
                    }
                })
            )
        });
    }
}

module.exports = new TauriApi();
