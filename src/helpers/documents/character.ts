import { CharacterDocument, Realm, RaidLog, CombatMetric } from "../../types";
import { characterId } from "..";
import { characterRaceFaction } from "tauriprogress-constants";

export function createCharacterDocument(
    character: RaidLog["members"][number],
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

    return {
        ...combatMetricDoc,
        _id: characterId(character.name, realm, character.spec),
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
