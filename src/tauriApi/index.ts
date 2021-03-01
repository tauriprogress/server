import fetch from "node-fetch";
import * as url from "url";
import { environment } from "../environment";
import {
    CharacterDataResponse,
    GuildDataResponse,
    CharacterAchievementsResponse,
    RaidMapsResponse,
    RaidLogResponse,
    LastRaidLogsResponse,
    CharacterLastRaidLogsResponse,
    GuildLastRaidLogsResponse,
    RaidBossRankedLogsResponse,
    ItemResponse,
    CharacterTalentsResponse
} from "../types";

class TauriApi {
    private apikey: string;
    private apisecret: string;
    private baseUrl: string;
    private retryCount: number;

    constructor() {
        this.apikey = environment.TAURI_API_KEY;
        this.apisecret = environment.TAURI_API_SECRET;
        this.baseUrl = "http://chapi.tauri.hu/apiIndex.php";
        this.retryCount = 3;
    }

    request<T>(options: Object): Promise<T> {
        return new Promise(async (resolve, reject) => {
            const timeOutErrorMessage = "Api request timed out.";
            let currentTry = 0;
            while (currentTry < this.retryCount) {
                try {
                    const apiRequest = fetch(
                        url.parse(`${this.baseUrl}?apikey=${this.apikey}`),
                        options
                    ).then(res => {
                        return res.json();
                    });

                    const timeOut = new Promise(resolve => {
                        setTimeout(() => {
                            resolve({
                                success: false,
                                errorstring: timeOutErrorMessage
                            });
                        }, 13000);
                    });

                    const response = await Promise.race([timeOut, apiRequest]);

                    if (response.success) {
                        resolve(response);
                        break;
                    } else {
                        throw new Error(response.errorstring);
                    }
                } catch (err) {
                    if (err.message !== timeOutErrorMessage) {
                        if (err.message === "guild not found") {
                            reject(new Error("guild not found"));
                            break;
                        } else {
                            reject(new Error("Api request failed."));
                            break;
                        }
                    }
                }
                currentTry++;
            }

            if (currentTry === 3) {
                reject(timeOutErrorMessage);
            }
        });
    }

    getCharacterData(name: string, realm: string) {
        return this.request<CharacterDataResponse>({
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

    getCharacterAchievements(name: string, realm: string) {
        return this.request<CharacterAchievementsResponse>({
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

    getCharacterRaidLogs(
        characterName: string,
        realm: string,
        logId: number = 0,
        limit: number = 0
    ) {
        return this.request<CharacterLastRaidLogsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-player",
                    params: {
                        r: realm,
                        cn: characterName,
                        from: logId,
                        limit: limit
                    }
                })
            )
        });
    }

    getCharacterTalents(name: string, realm: string) {
        return this.request<CharacterTalentsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-talents",
                    params: {
                        r: realm,
                        n: name
                    }
                })
            )
        });
    }

    getRaidMaps(realm: string) {
        return this.request<RaidMapsResponse>({
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
        return this.request<RaidLogResponse>({
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

    getRaidLastLogs(lastLogId: number = 0, realm: string) {
        return this.request<LastRaidLogsResponse>({
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

    getRaidRankedLogs(
        bossId: number,
        realm: string,
        difficulty: number,
        logId: number = 0,
        limit: number = 0
    ) {
        return this.request<RaidBossRankedLogsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-rank-encounter",
                    params: {
                        r: realm,
                        encounter: bossId,
                        difficulty: difficulty,
                        from: logId,
                        limit: limit
                    }
                })
            )
        });
    }

    getGuildData(name: string, realm: string) {
        return this.request<GuildDataResponse>({
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

    getGuildRaidLogs(
        guildName: string,
        realm: string,
        logId: number = 0,
        limit: number = 0
    ) {
        return this.request<GuildLastRaidLogsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-guild",
                    params: {
                        r: realm,
                        gn: guildName,
                        from: logId,
                        limit: limit
                    }
                })
            )
        });
    }

    getGuildRaidBossRankedLogs(
        guildName: string,
        realm: string,
        bossId: number,
        difficulty: number,
        logId: number = 0,
        limit: number = 0
    ) {
        return this.request<RaidBossRankedLogsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-guildrank-encounter",
                    params: {
                        r: realm,
                        gn: guildName,
                        encounter: bossId,
                        difficulty: difficulty,
                        from: logId,
                        limit: limit
                    }
                })
            )
        });
    }

    getItem(id: number) {
        return this.request<ItemResponse>({
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

    getItemByGuid(guid: number, realm: string) {
        return this.request<ItemResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "item-tooltip",
                    params: {
                        r: realm,
                        i: guid
                    }
                })
            )
        });
    }
}
const tauriApi = new TauriApi();

export default tauriApi;
