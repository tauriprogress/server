import { PatreonAuthResponse, GetUserInfoResponse } from "../types";
import cipher from "./cipher";

function getUserData(
    authInfo: PatreonAuthResponse,
    userInfo: GetUserInfoResponse
) {
    const currentTime = new Date().getTime();
    const expiresAt = currentTime + authInfo.expires_in * 1000;

    return {
        encryptedToken: cipher.encrypt(authInfo.access_token),
        encryptedRefreshToken: cipher.encrypt(authInfo.refresh_token),
        expiresAt: expiresAt,
        id: userInfo.data.id,
        isMember: !!userInfo.data.relationships.memberships.data.length,
    };
}

export default {
    getUserData,
};
