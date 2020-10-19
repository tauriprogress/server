require("dotenv").config();
const fs = require("fs");
const { getLogs } = require("./helpers");
const oldData = require("./logData.json");

(async function () {
    if (!oldData) {
        console.log("No previous log data have been found");
        let newData = await getLogs();
        fs.writeFileSync("newLogData.json", JSON.stringify(newData));
    } else {
        let data = { ...JSON.parse(JSON.stringify(oldData)) };
        let newData = await getLogs(oldData.lastLogIds);
        data.lastLogIds = newData.lastLogIds;

        data.logs = data.logs.concat(newData.logs);
        fs.writeFileSync("newLogData.json", JSON.stringify(data));
    }
    console.log("done");
})();
