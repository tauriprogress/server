import environment from "../../environment";

const raidNames = environment.currentContent.raids.map((raid) => raid.name);
const raidIds = environment.currentContent.raids.map((raid) => raid.id);

export type ValueOf<T> = T[keyof T];
export type KeyOfUnion<T> = T extends T ? keyof T : never;

export type CombatMetric = "dps" | "hps";
export type Realm = (typeof environment.realms)[number];
export type ShortRealm = (typeof environment.shortRealms)[Realm];
export type Faction = 0 | 1;
export type ClassId = keyof typeof environment.specIdsOfClass;
export type SpecId = keyof typeof environment.characterSpecClass;
export type Difficulty = KeyOfUnion<typeof environment.difficultyNames>;
export type RaidName = (typeof raidNames)[number];
export type RaidId = (typeof raidIds)[number];
export type Race = keyof typeof environment.characterRaceFaction;

export type Second = number;
export type MilliSecond = number;
export * from "./looseObject";
