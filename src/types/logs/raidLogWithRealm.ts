import { RaidLog } from "../../types";

export interface RaidLogWithRealm extends RaidLog {
    realm: string;
}
