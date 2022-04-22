import { Document } from "mongodb";
import { ClassId, Realm, SpecId, Faction } from "..";
import { getCharacterId } from "../../helpers";

export interface DefaultCharacterDocument extends Document {
    _id: ReturnType<typeof getCharacterId>;
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
}

export interface DamageCharacterDocument extends DefaultCharacterDocument {
    dps: number;
}

export interface HealCharacterDocument extends DefaultCharacterDocument {
    hps: number;
}

export type CharacterDocument = DamageCharacterDocument | HealCharacterDocument;

export default CharacterDocument;
