import environment from "../environment";
import { GetAuthTokenResponse, GetUserInfoResponse } from "../types";

class PatreonApi {
    private baseUrl = "https://www.patreon.com/api/oauth2";
    getAuthToken(code: string): Promise<GetAuthTokenResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: GetAuthTokenResponse = await fetch(
                    `${this.baseUrl}/token?code=${code}&grant_type=authorization_code&client_id=${environment.PATREON_CLIENT}&client_secret=${environment.PATREON_SECRET}&redirect_uri=${environment.CORS_ORIGIN}/${environment.REALM_GROUP}/login`,
                    {
                        method: "POST",
                    }
                ).then((res) => res.json());

                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    }

    getUserInfo(authToken: string): Promise<GetUserInfoResponse> {
        return new Promise(async (resolve, reject) => {
            try {
                const response: GetUserInfoResponse = await fetch(
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

                resolve(response);
            } catch (err) {
                reject(err);
            }
        });
    }
}

export default PatreonApi;
