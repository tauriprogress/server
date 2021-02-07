import { GuildBoss } from "../../types";

export function getDefaultGuildBoss(): GuildBoss {
    return {
        killCount: 0,
        fastestKills: [],
        firstKill: undefined,
        dps: {},
        hps: {}
    };
}
