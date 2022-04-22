import { Realm } from "../";

export type LastLogIds = {
    [K in Realm]?: number;
};
