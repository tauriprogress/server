import { RaidLog } from "../tauriApi";

export interface RaidLogWithRealm extends RaidLog {
    realm: string;
}
