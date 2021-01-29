import { LooseObject } from "../types";

export function addNestedObjectValue<T>(
    obj: LooseObject,
    keys: Array<string | number>,
    value: T
) {
    let currentKey = keys[0];

    if (currentKey !== undefined) {
        obj[currentKey] = addNestedObjectValue(
            obj.hasOwnProperty(currentKey) ? obj[currentKey] : {},
            keys.slice(1, keys.length),
            value
        );
        return obj;
    } else {
        return value !== undefined ? value : {};
    }
}

export function capitalize(string: string) {
    const capitalized = string.charAt(0).toUpperCase() + string.slice(1);

    return capitalized.length === string.length ? capitalized : string;
}
