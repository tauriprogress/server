const tauriApi = require("./build/tauriApi").default;
const environment = require("./build/environment").default;
const fs = require("fs");

const { ensureFile, log, validator } = require("./build/helpers");

const realmNames = environment.realms;

const pathToLogs = "./logs/logs.txt";
const pathToLastLogIds = "./logs/lastLogIds.json";

const constantLogIds = {
    "[HU] Tauri WoW Server": 340181,
    "[HU] Warriors of Darkness": 109584,
    "[EN] Evermoon": 187600,
};

let logsOfRealms = {};
for (const realm of realmNames) {
    logsOfRealms[realm] = [];
}

(async function () {
    const logFileManager = new log.fileManager(pathToLogs, pathToLastLogIds);

    let lastLogIds = { ...constantLogIds, ...logFileManager.getLastLogIds() };

    const startLogIds = JSON.parse(JSON.stringify(lastLogIds));

    let freshLogIds = await getFreshLogIds();

    ensureFile(pathToLogs);

    const writer = fs.createWriteStream(pathToLogs, {
        flags: "a",
    });

    while (true) {
        try {
            let finished = true;

            for (const realm of realmNames) {
                if (lastLogIds[realm] < freshLogIds[realm]) {
                    finished = false;
                }
            }

            if (finished) {
                console.log("\n");
                console.log("Logs updated");
                process.exit(1);
            }

            let oldestKillTime = Infinity;
            let oldestKillTimeRealmName = undefined;

            for (const realm of realmNames) {
                if (
                    logsOfRealms[realm].length === 0 &&
                    lastLogIds[realm] <= freshLogIds[realm]
                ) {
                    const logs = await getLogsOfRealm(
                        lastLogIds[realm],
                        realm,
                        1000
                    );
                    logsOfRealms[realm].push(...logs);
                }
                if (logsOfRealms[realm].length) {
                    let currentLog =
                        logsOfRealms[realm][logsOfRealms[realm].length - 1];

                    if (currentLog.killtime < oldestKillTime) {
                        oldestKillTime = currentLog.killtime;
                        oldestKillTimeRealmName = currentLog.realm;
                    }
                }
            }

            const logData = logsOfRealms[oldestKillTimeRealmName].pop();

            if (validator.validRaidLog(logData)) {
                const response = await tauriApi.getRaidLog(
                    logData.log_id,
                    logData.realm
                );
                if (response.success) {
                    const log = response.response;

                    await logFileManager.writeLogs(
                        [
                            {
                                ...log,
                                realm: logData.realm,
                                encounter_data: {
                                    ...log.encounter_data,
                                    encounter_name:
                                        log.encounter_data.encounter_name.trim(),
                                },
                            },
                        ],
                        writer
                    );
                } else {
                    throw new Error(response.errorstring);
                }
            }

            lastLogIds[logData.realm] = logData.log_id;

            let progressMessage = "";

            for (const realm of realmNames) {
                const endOfProgress = freshLogIds[realm] - startLogIds[realm];
                const currentPosition = lastLogIds[realm] - startLogIds[realm];

                const progress = (
                    (currentPosition / endOfProgress) *
                    100
                ).toFixed(2);

                progressMessage = progressMessage.concat(
                    ` | ${realm}: ${progress}%`
                );
            }

            process.stdout.write(progressMessage + "\r");
        } catch (e) {
            console.log("\n");
            console.error(e);
            process.exit();
        }
    }
})();

async function getLogsOfRealm(lastLogId, realm, limit) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await tauriApi.getRaidLastLogs(
                lastLogId | 0,
                realm,
                limit
            );

            if (response.success) {
                resolve(
                    response.response.logs.map((log) => ({
                        ...log,
                        realm: realm,
                        encounter_data: {
                            ...log.encounter_data,
                            encounter_name:
                                log.encounter_data.encounter_name.trim(),
                        },
                    }))
                );
            } else {
                throw new Error(response.errorstring);
            }
        } catch (e) {
            reject(e);
        }
    });
}

async function getFreshLogIds() {
    return new Promise(async (resolve, reject) => {
        try {
            let freshLogIds = {};
            for (let realm of realmNames) {
                freshLogIds[realm] = await getFreshIdOfRealm(realm);
            }

            resolve(freshLogIds);
        } catch (e) {
            reject(e);
        }
    });
}

async function getFreshIdOfRealm(realmName) {
    return new Promise(async (resolve, reject) => {
        try {
            const response = await tauriApi.getRaidLastLogs(0, realmName, 1);
            if (response.success) {
                resolve(response.response.logs[0].log_id);
            } else {
                throw new Error(response.errorstring);
            }
        } catch (e) {
            reject(e);
        }
    });
}
