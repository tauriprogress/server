import environment from "../environment";
import { Difficulty, Realm, SpecId } from "../types";

export type WeekId = string;
export type GuildId = string;
export type RaidBossId = string;
export type CharacterId = string;

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

    characterId(name: string, realm: Realm, spec: SpecId): CharacterId {
        return `${name},${environment.shortRealms[realm]},${spec}`;
    }
}

export const id = new Id();

export default id;
