import { LastRaidLog } from "../tauriApi";

export interface LastRaidLogWithRealm extends LastRaidLog {
    realm: string;
}
