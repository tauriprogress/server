import * as constants from "tauriprogress-constants";

const REALM_GROUP = process.env.REALM_GROUP;

export const expansionData =
    REALM_GROUP && REALM_GROUP === "crystalsong"
        ? constants.crystalsong
        : constants.tauri;
