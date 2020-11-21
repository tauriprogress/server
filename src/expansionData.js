const constants = require("tauriprogress-constants");
const REALM_GROUP = process.env.REALM_GROUP;

let expansionData = null;

if (REALM_GROUP && REALM_GROUP === "crystalsong") {
    expansionData = constants.crystalsong;
} else {
    expansionData = constants.tauri;
}

module.exports = expansionData;
