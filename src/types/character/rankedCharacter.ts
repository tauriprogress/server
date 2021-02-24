import { Character } from "../../types";

export interface RankedCharacter extends Character {
    rank: number;
    cRank: number;
    sRank: number;
}
