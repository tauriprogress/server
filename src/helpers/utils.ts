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
    return new Promise(resolve => {
        setTimeout(() => {
            resolve(true);
        }, ms);
    });
}
