import { environment } from "../environment";

export function createCharacterId(
    name: string,
    realm: keyof typeof environment.shortRealms,
    spec: number
) {
    return `${name},${environment.shortRealms[realm]},${spec}`;
}
