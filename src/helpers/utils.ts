export function runGC() {
    try {
        if (global.gc) {
            global.gc();
        }
    } catch (e) {
        console.log("global.gc is undefined");
    }
}
