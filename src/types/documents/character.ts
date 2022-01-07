import { Document } from "mongodb";
import { ClassId, Realm, SpecId, Faction } from "..";
import { characterId } from "../../helpers";

export interface DefaultCharacterDocument extends Document {
    _id: ReturnType<typeof characterId>;
    realm: Realm;
    class: ClassId;
    name: string;
    spec: SpecId;
    ilvl: number;
    date: number;
    logId: number;
    f: Faction;
    race: string;
}

export interface DamageCharacterDocument extends DefaultCharacterDocument {
    dps: number;
}

export interface HealCharacterDocument extends DefaultCharacterDocument {
    hps: number;
}

type CharacterDocument = DamageCharacterDocument | HealCharacterDocument;

export default CharacterDocument;
