import environment from "../environment";
import { ClassId, SpecId } from "../types";

export const week = 1000 * 60 * 60 * 24 * 7;
export const pathToLastLogIds = "./logs/lastLogIds.json";
export const pathToLogs = "./logs/logs.txt";
export const factions = [0, 1] as const;
export const combatMetrics = ["dps", "hps"] as const;
export const classIds = Object.keys(environment.characterClassNames).map(
    (classId) => Number(classId)
) as ClassId[];
export const specIds = Object.keys(environment.specs).map((specId) =>
    Number(specId)
) as SpecId[];
