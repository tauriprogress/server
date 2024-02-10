import environment from "../environment";
import {
    GetPatreonUserInfoResponse,
    PatreonAuthResponse,
    PatreonError,
} from "../types";

class PatreonApi {
    private baseUrl = "https://www.patreon.com/api/oauth2";
    getAuthToken(code: string): Promise<PatreonAuthResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: PatreonAuthResponse | PatreonError =
                    await fetch(
                        `${this.baseUrl}/token?code=${code}&grant_type=authorization_code&client_id=${environment.PATREON_CLIENT}&client_secret=${environment.PATREON_SECRET}&redirect_uri=${environment.CORS_ORIGIN}/${environment.REALM_GROUP}/login`,
                        {
                            method: "POST",
                        }
                    ).then((res) => res.json());

                if ("error" in response) {
                    throw new Error(response.error);
                }

                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    }

    refreshToken(token: string): Promise<PatreonAuthResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: PatreonAuthResponse | PatreonError =
                    await fetch(
                        `${this.baseUrl}/token?grant_type=refresh_token&refresh_token=${token}&client_id=${environment.PATREON_CLIENT}&client_secret=${environment.PATREON_SECRET}&redirect_uri=${environment.CORS_ORIGIN}/${environment.REALM_GROUP}/login`,
                        {
                            method: "POST",
                        }
                    ).then((res) => res.json());

                if ("error" in response) {
                    throw new Error(response.error);
                }

                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    }

    getUserInfo(authToken: string): Promise<GetPatreonUserInfoResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: GetPatreonUserInfoResponse | PatreonError =
                    await fetch(
                        encodeURI(
                            `${this.baseUrl}/v2/identity?include=memberships`
                        ),
                        {
                            method: "GET",
                            headers: {
                                Authorization: `Bearer ${authToken}`,
                            },
                        }
                    ).then((res) => res.json());

                if ("error" in response) {
                    throw new Error(response.error);
                }

                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    }
}

export default PatreonApi;
