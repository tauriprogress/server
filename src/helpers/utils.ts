import * as fs from "fs";
import * as path from "path";
import { LooseObject } from "../types";

export function runGC() {
    try {
        if (global.gc) {
            global.gc();
        }
    } catch (e) {
        console.log("global.gc is undefined");
    }
}

export function sleep(ms: number): Promise<true> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}

export function ensureFile(filePath: string) {
    if (!fs.existsSync(filePath)) {
        const dirname = path.dirname(filePath);
        if (dirname && !fs.existsSync(dirname)) {
            fs.mkdirSync(dirname);
        }
        fs.closeSync(fs.openSync(filePath, "w"));
    }
}

export function capitalize<T extends string>(str: T): Capitalize<T> {
    const capitalized = (str.charAt(0).toUpperCase() +
        str.slice(1).toLowerCase()) as Capitalize<T>;

    return capitalized.length === str.length
        ? capitalized
        : (str as Capitalize<T>);
}

export function getRelativePerformance(
    currentPerformance: number,
    bestPerformance: number
) {
    if (currentPerformance === 0 || bestPerformance === 0) return 0;
    return Math.round((currentPerformance / bestPerformance) * 1000) / 10;
}

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

export function getNestedObjectValue(
    obj: LooseObject,
    keys: Array<string | number>
): any {
    let currentKey = keys[0];

    if (keys.length === 1) {
        return obj[currentKey];
    } else {
        return obj.hasOwnProperty(currentKey)
            ? getNestedObjectValue(obj[currentKey], keys.slice(1, keys.length))
            : undefined;
    }
}
