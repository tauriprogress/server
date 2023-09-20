import environment from "../../environment";
import {
    ClassId,
    CombatMetric,
    Difficulty,
    Faction,
    RaidName,
    Realm,
    SpecId,
    ValidMember,
} from "../../types";
import id from "../id";

export type CharacterPerformance = {
    [key in RaidName]: {
        [key in Difficulty]: {
            [propName: string]: CharacterPerformanceRaidBoss;
        };
    };
};

type RaidbossSpecIds = {
    [key in SpecId]: {
        [key in CombatMetric]: CharacterPerformanceDocument;
    };
};

export interface CharacterPerformanceRaidBoss extends RaidbossSpecIds {
    class: {
        [key in CombatMetric]: CharacterPerformanceDocument | number;
    };
    all: {
        [key in CombatMetric]: CharacterPerformanceDocument | number;
    };
}

export interface CharacterPerformanceDocument extends CharacterDocument {
    performance?: number;
}

export type CharacterDocumentAggregationMatch = {
    class?: number;
    f?: number;
    realm?: string;

    spec?: number | { $in: SpecId[] };
};

export interface CharacterDocument {
    _id: ReturnType<typeof id.characterId>;
    realm: Realm;
    class: ClassId;
    name: string;
    spec: SpecId;
    ilvl: number;
    date: number;
    logId: number;
    f: Faction;
    race: string;
    rank: number;
    cRank: number;
    sRank: number;
    dps?: number;
    hps?: number;
    talents?: string;
    trinkets?: Trinket[];
}

type Trinket = {
    id: number;
    icon: string;
};

export function characterDocument(
    character: ValidMember,
    realm: Realm,
    logId: number,
    date: number,
    fightTime: number,
    combatMetric: CombatMetric
): CharacterDocument {
    const combatMetricDoc =
        combatMetric === "dps"
            ? {
                  dps: character.dmg_done / (fightTime / 1000),
              }
            : {
                  hps:
                      (character.heal_done + character.absorb_done) /
                      (fightTime / 1000),
              };

    const talentsAndTrinkets =
        character.talents && character.trinket_0 && character.trinket_1
            ? {
                  talents: character.talents,
                  trinkets: [
                      {
                          id: character.trinket_0.entry,
                          icon: character.trinket_0.icon,
                      },
                      {
                          id: character.trinket_1.entry,
                          icon: character.trinket_1.icon,
                      },
                  ],
              }
            : {};

    return {
        ...combatMetricDoc,
        ...talentsAndTrinkets,
        _id: id.characterId(character.name, realm, character.spec),
        name: character.name,
        realm: realm,
        class: character.class,
        spec: character.spec,
        f: environment.characterRaceFaction[character.race],
        ilvl: character.ilvl,
        race: `${character.race},${character.gender}`,
        logId: logId,
        date: date,
        rank: 0,
        cRank: 0,
        sRank: 0,
    };
}
