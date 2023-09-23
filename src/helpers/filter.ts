import { Role } from "tauriprogress-constants/build/globalTypes";
import environment from "../environment";
import { ClassId, Difficulty, Faction, Realm, SpecId } from "../types";
import { CharacterDocumentAggregationMatch } from "./documents";
import validator from "./validators";

export type Filters = {
    difficulty: Difficulty;
    class?: ClassId;
    spec?: SpecId;
    role?: Role;
    faction?: Faction;
    realm?: Realm;
};

class Filter {
    isValidFilter(raidId: number, filters: any) {
        if (
            typeof filters === "object" &&
            filters !== null &&
            !Array.isArray(filters)
        ) {
            if (
                filters.difficulty === undefined ||
                !validator.validDifficulty(raidId, filters.difficulty)
            ) {
                return false;
            }

            if (
                filters.realm !== undefined &&
                !validator.validRealm(filters.realm)
            ) {
                return false;
            }

            if (
                filters.class !== undefined &&
                !validator.validClass(filters.class)
            ) {
                return false;
            }

            if (
                filters.spec !== undefined &&
                !validator.validSpec(filters.spec)
            ) {
                return false;
            }

            if (
                filters.role !== undefined &&
                !validator.validRole(filters.role)
            ) {
                return false;
            }

            if (
                filters.faction !== undefined &&
                !validator.validFaction(filters.faction)
            ) {
                return false;
            }

            return true;
        }

        return false;
    }

    filtersToAggregationMatchQuery(filters: Filters) {
        let matchQuery: CharacterDocumentAggregationMatch = {};
        if (filters.class) {
            matchQuery.class = filters.class;
        }

        if (typeof filters.faction === "number") {
            matchQuery.f = filters.faction;
        }
        if (filters.realm) {
            matchQuery.realm = filters.realm;
        }

        if (filters.spec) {
            matchQuery.spec = filters.spec;
            if (
                filters.role &&
                environment.specs[
                    filters.spec as keyof typeof environment.specs
                ].role !== filters.role
            ) {
                matchQuery.spec = -1;
            }
        } else if (filters.role) {
            let validSpecs: SpecId[] = [];
            for (const key in environment.specs) {
                const specId = Number(key) as keyof typeof environment.specs;
                const spec = environment.specs[specId];
                if (spec.role === filters.role) {
                    validSpecs.push(specId);
                }
            }

            matchQuery.spec = { $in: validSpecs };
        }
        return matchQuery;
    }
}

export const filter = new Filter();

export default filter;
