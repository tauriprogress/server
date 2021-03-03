import { LastRaidLog } from "../../types";

export interface LastRaidLogWithRealm extends LastRaidLog {
    realm: string;
}
