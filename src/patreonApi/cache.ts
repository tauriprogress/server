import * as NodeCache from "node-cache";
import { GetPatreonUserInfoResponse } from "../types";

class PatreonCache {
    public userInfo: NodeCache;

    constructor() {
        this.userInfo = new NodeCache({
            stdTTL: 1 * 60,
            checkperiod: 60,
            useClones: false,
        });
    }

    getUserInfo(authToken: string) {
        return this.userInfo.get(authToken) as
            | GetPatreonUserInfoResponse
            | undefined;
    }

    setUserInfo(
        authToken: string,
        userInfoResponse: GetPatreonUserInfoResponse
    ) {
        try {
            this.userInfo.set(authToken, userInfoResponse);
        } catch (e) {
            console.error(e);
        }
    }
}

const patreonCache = new PatreonCache();

export default patreonCache;
