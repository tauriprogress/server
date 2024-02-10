import { PatreonUserId } from "./getUserInfoResponse";

export type PatreonUserInfo = {
    encryptedToken: string;
    encryptedRefreshToken: string;
    expiresAt: number;
    id: PatreonUserId;
    isMember: boolean;
};

export function isPatreonUserInfo(obj: Object): obj is PatreonUserInfo {
    let testOjb = obj as PatreonUserInfo;

    if (typeof testOjb.encryptedToken !== "string") {
        return false;
    }

    if (typeof testOjb.encryptedRefreshToken !== "string") {
        return false;
    }

    if (typeof testOjb.expiresAt !== "number") {
        return false;
    }

    if (typeof testOjb.id !== "string") {
        return false;
    }

    if (typeof testOjb.isMember !== "boolean") {
        return false;
    }

    return true;
}
