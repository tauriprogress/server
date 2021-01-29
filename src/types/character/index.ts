import { getCharacterId } from "../../helpers";

export interface Character {
    _id: ReturnType<typeof getCharacterId>;
    realm: string;
    class: number;
    name: string;
    spec: number;
    ilvl: number;
    date: number;
    logId: number;
    f: 0 | 1;
}
