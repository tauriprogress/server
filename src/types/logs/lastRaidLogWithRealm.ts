import { LastRaidLog, Realm } from "../../types";

export interface LastRaidLogWithRealm extends LastRaidLog {
    realm: Realm;
}
