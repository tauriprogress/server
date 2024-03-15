import {
    PatreonAuthResponse,
    GetPatreonUserInfoResponse,
    PatreonUserInfo,
    isPatreonUserInfo,
} from "../types";
import cipher from "./cipher";
import * as jwt from "jsonwebtoken";

function getUserData(
    authInfo: PatreonAuthResponse,
    userInfo: GetPatreonUserInfoResponse
): PatreonUserInfo {
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

function decodeUser(userToken: string): PatreonUserInfo | undefined {
    let decoded = jwt.decode(userToken);

    if (
        typeof decoded !== "string" &&
        decoded !== null &&
        isPatreonUserInfo(decoded)
    ) {
        return decoded;
    }

    return undefined;
}

function isExpired(user: PatreonUserInfo): boolean {
    if (user.expiresAt < new Date().getTime()) {
        return true;
    }
    return false;
}

function isSameUser(
    user: PatreonUserInfo,
    userInfoResponse: GetPatreonUserInfoResponse
): boolean {
    return user.id === userInfoResponse.data.id;
}

function isMember(userInfoResponse: GetPatreonUserInfoResponse): boolean {
    return !!userInfoResponse.data.relationships.memberships.data.length;
}

export default {
    getUserData,
    decodeUser,
    isExpired,
    isSameUser,
    isMember,
};
