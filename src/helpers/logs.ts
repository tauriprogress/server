import { environment } from "../environment";
import {
    addNestedObjectValue,
    validBossName,
    validDifficulty,
    validRaidName
} from "../helpers";
import { tauriApi } from "../tauriApi";
import {
    LastLogIds,
    LastRaidLogsResponse,
    LastRaidLogWithRealm,
    RaidLogWithRealm
} from "../types";

export async function getLogs(lastLogIds: LastLogIds) {
    return new Promise(async (resolve, reject) => {
        try {
            let unfilteredLogs: Array<LastRaidLogWithRealm> = [];
            let logs: Array<RaidLogWithRealm> = [];
            let newLastLogIds: LastLogIds = {};

            for (const realmName of Object.values(environment.realms)) {
                const lastLogId = lastLogIds[realmName];
                let data: LastRaidLogsResponse;

                try {
                    data = await tauriApi.getRaidLastLogs(
                        lastLogId | 0,
                        realmName
                    );
                } catch (err) {
                    throw new Error(err.message);
                }

                unfilteredLogs = unfilteredLogs.concat(
                    data.response.logs.map(log => ({
                        ...log,
                        realm: realmName,
                        encounter_data: {
                            ...log.encounter_data,
                            encounter_name: log.encounter_data.encounter_name.trim()
                        }
                    }))
                );
            }

            for (let log of unfilteredLogs.sort((a, b) =>
                a.killtime < b.killtime ? -1 : 1
            )) {
                if (
                    validRaidName(log.mapentry.name) &&
                    validDifficulty(log.mapentry.id, log.difficulty) &&
                    validBossName(
                        log.mapentry.id,
                        log.encounter_data.encounter_name
                    ) &&
                    log.fight_time > 10000
                ) {
                    const logData = await tauriApi.getRaidLog(
                        log.log_id,
                        log.realm
                    );

                    logs.push({
                        ...logData.response,
                        realm: log.realm,
                        encounter_data: {
                            ...logData.response.encounter_data,
                            encounter_name: logData.response.encounter_data.encounter_name.trim()
                        }
                    });

                    newLastLogIds = addNestedObjectValue(
                        newLastLogIds,
                        [log.realm],
                        log.log_id
                    );
                }
            }

            resolve({
                logs,
                lastLogIds: { ...lastLogIds, ...newLastLogIds }
            });
        } catch (err) {
            reject(err);
        }
    });
}
