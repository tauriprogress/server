import {
    CharacterDocument,
    Realm,
    CombatMetric,
    ValidMember,
} from "../../types";
import { getCharacterId } from "..";
import { characterRaceFaction } from "tauriprogress-constants";

export function createCharacterDocument(
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
        _id: getCharacterId(character.name, realm, character.spec),
        name: character.name,
        realm: realm,
        class: character.class,
        spec: character.spec,
        f: characterRaceFaction[character.race],
        ilvl: character.ilvl,
        race: `${character.race},${character.gender}`,
        logId: logId,
        date: date,
        rank: 0,
        cRank: 0,
        sRank: 0,
    };
}
