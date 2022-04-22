import { RaidLog, Realm } from "../../types";

export interface RaidLogWithRealm extends RaidLog {
    realm: Realm;
}
