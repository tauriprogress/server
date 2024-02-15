import { Request } from "express";
import {
    PatreonAuthResponse,
    GetPatreonUserInfoResponse,
    PatreonUserInfo,
    isPatreonUserInfo,
} from "../types";
import cipher from "./cipher";
import * as cookie from "cookie";
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

function decodeUser(req: Request): PatreonUserInfo | undefined {
    if (req.headers.cookie) {
        const userToken: string | undefined = cookie.parse(
            req.headers.cookie
        ).user;

        if (userToken) {
            let decoded = jwt.decode(userToken);

            if (
                typeof decoded !== "string" &&
                decoded !== null &&
                isPatreonUserInfo(decoded)
            ) {
                return decoded;
            }
        }
    }
    return undefined;
}

export default {
    getUserData,
    decodeUser,
};
