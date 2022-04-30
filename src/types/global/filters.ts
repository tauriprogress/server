import { Role } from "tauriprogress-constants/build/globalTypes";
import { ClassId, Difficulty, Faction, Realm, SpecId } from ".";

export type Filters = {
    difficulty: Difficulty;
    class?: ClassId;
    spec?: SpecId;
    role?: Role;
    faction?: Faction;
    realm?: Realm;
};
