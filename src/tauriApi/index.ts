import fetch from "node-fetch";
import environment from "../environment";
import { isError } from "../helpers";
import {
    ERR_CHARACTER_NOT_FOUND,
    ERR_GUILD_NOT_FOUND,
    ERR_TAURI_API_FAILURE,
    ERR_TAURI_API_TIMEOUT,
    ERR_UNKNOWN,
} from "../helpers/errors";
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
    CharacterTalentsResponse,
    Realm,
    Difficulty,
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

    request<T extends { success: boolean; errorstring: string }>(
        options: Object
    ): Promise<T> {
        return new Promise(async (resolve, reject) => {
            let currentTry = 0;
            while (currentTry < this.retryCount) {
                try {
                    const apiRequest = fetch(
                        `${this.baseUrl}?apikey=${this.apikey}`,
                        options
                    ).then((res: any) => {
                        return res.json();
                    }) as Promise<T>;

                    const timeOut = new Promise<{
                        success: false;
                        errorstring: string;
                    }>((resolve) => {
                        setTimeout(() => {
                            resolve({
                                success: false,
                                errorstring: ERR_TAURI_API_TIMEOUT.message,
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
                    console.log(err);
                    if (
                        isError(err) &&
                        err.message !== ERR_TAURI_API_TIMEOUT.message
                    ) {
                        if (err.message === "guild not found") {
                            reject(ERR_GUILD_NOT_FOUND);
                            break;
                        } else if (err.message === "character not found") {
                            reject(ERR_CHARACTER_NOT_FOUND);
                            break;
                        } else {
                            reject(ERR_TAURI_API_FAILURE);
                            break;
                        }
                    } else {
                        reject(ERR_UNKNOWN);
                    }
                }
                currentTry++;
            }

            if (currentTry === 3) {
                reject(ERR_TAURI_API_TIMEOUT);
            }
        });
    }

    getCharacterData(name: string, realm: Realm) {
        return this.request<CharacterDataResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-sheet",
                    params: {
                        r: realm,
                        n: name,
                    },
                })
            ),
        });
    }

    getCharacterAchievements(name: string, realm: Realm) {
        return this.request<CharacterAchievementsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-achievements",
                    params: {
                        r: realm,
                        n: name,
                    },
                })
            ),
        });
    }

    getCharacterRaidLogs(
        characterName: string,
        realm: Realm,
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
                        limit: limit,
                    },
                })
            ),
        });
    }

    getCharacterTalents(name: string, realm: Realm) {
        return this.request<CharacterTalentsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "character-talents",
                    params: {
                        r: realm,
                        n: name,
                    },
                })
            ),
        });
    }

    getRaidMaps(realm: Realm) {
        return this.request<RaidMapsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-maps",
                    params: {
                        r: realm,
                    },
                })
            ),
        });
    }

    getRaidLog(id: number, realm: Realm) {
        return this.request<RaidLogResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-log",
                    params: {
                        r: realm,
                        id: id,
                    },
                })
            ),
        });
    }

    getRaidLastLogs(lastLogId: number = 0, realm: Realm, limit: number = 0) {
        return this.request<LastRaidLogsResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "raid-last",
                    params: {
                        r: realm,
                        from: lastLogId,
                        limit: limit,
                    },
                })
            ),
        });
    }

    getRaidRankedLogs(
        bossId: number,
        realm: Realm,
        difficulty: Difficulty,
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
                        limit: limit,
                    },
                })
            ),
        });
    }

    getGuildData(name: string, realm: Realm) {
        return this.request<GuildDataResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "guild-info",
                    params: {
                        r: realm,
                        gn: name,
                    },
                })
            ),
        });
    }

    getGuildRaidLogs(
        guildName: string,
        realm: Realm,
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
                        limit: limit,
                    },
                })
            ),
        });
    }

    getGuildRaidBossRankedLogs(
        guildName: string,
        realm: Realm,
        bossId: number,
        difficulty: Difficulty,
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
                        limit: limit,
                    },
                })
            ),
        });
    }

    getItem(id: number, realm: Realm) {
        return this.request<ItemResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "item-tooltip",
                    params: {
                        r: realm,
                        e: id,
                    },
                })
            ),
        });
    }

    getItemByGuid(guid: number, realm: Realm) {
        return this.request<ItemResponse>({
            method: "POST",
            body: encodeURIComponent(
                JSON.stringify({
                    secret: this.apisecret,
                    url: "item-tooltip",
                    params: {
                        r: realm,
                        i: guid,
                    },
                })
            ),
        });
    }
}
const tauriApi = new TauriApi();

export default tauriApi;
