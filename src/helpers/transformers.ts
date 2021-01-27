import { LooseObject } from "../types";

export function addNestedObjectValue<T>(
    obj: LooseObject,
    keys: Array<string>,
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
