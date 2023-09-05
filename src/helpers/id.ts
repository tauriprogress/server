import { Difficulty, Realm } from "../types";

export type WeekId = string;
export type GuildId = string;
export type RaidBossId = string;

class Id {
    weekId(date: Date): WeekId {
        return date.getTime().toString();
    }

    guildId(guildName: string, guildRealm: Realm): GuildId {
        return `${guildName} ${guildRealm}`;
    }

    raidBossId(ingameBossId: number, difficulty: Difficulty): RaidBossId {
        return `${ingameBossId} ${difficulty}`;
    }
}

export const id = new Id();

export default id;
