import * as fs from "fs";
import * as path from "path";

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
