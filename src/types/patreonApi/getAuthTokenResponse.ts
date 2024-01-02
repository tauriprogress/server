export interface GetAuthTokenResponse {
    access_token: string;
    expires_in: number;
    token_type: "Bearer";
    scope: "identity";
    refresh_token: string;
    version: string;
}
