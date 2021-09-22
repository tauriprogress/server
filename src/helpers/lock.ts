import { EventEmitter } from "stream";

export class Lock {
    private _locked: boolean;
    private _ee: EventEmitter;

    constructor() {
        this._locked = false;
        this._ee = new EventEmitter();
    }

    acquire(): Promise<void> {
        return new Promise(resolve => {
            if (!this._locked) {
                this._locked = true;
                return resolve();
            }

            const tryAcquire = () => {
                if (!this._locked) {
                    this._locked = true;
                    this._ee.removeListener("release", tryAcquire);
                    return resolve();
                }
            };
            this._ee.on("release", tryAcquire);
        });
    }

    release() {
        this._locked = false;
        setImmediate(() => this._ee.emit("release"));
    }
}
