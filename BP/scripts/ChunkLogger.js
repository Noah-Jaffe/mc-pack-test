import { ColorCodes } from "./ColorCodes.js";
import { mconsole as console } from "./debug.js";

export class ChunkLogger {
    #enabled;
    #prefix = "ChunkLoader";
    constructor(enabled = false) {
        this.#enabled = enabled;
    }

    enable() {
        this.#enabled = true;
    }

    disable() {
        this.#enabled = false;
    }

    isEnabled() {
        return this.#enabled;
    }

    synchronized(key) {
        if (!this.#enabled) return;
        
        console.log(`${this.#prefix}: Chunks synchronized: ${key}`);
    }

    loaded(key) {
        if (!this.#enabled) return;
        console.log(`${this.#prefix}: Chunk loaded at ${key}`);
    }

    unloaded(key) {
        if (!this.#enabled) return;
        console.log(`${this.#prefix}: Chunk unloaded ${key}`);
    }

    unloadedAll(count) {
        if (!this.#enabled) return;
        console.log(`${this.#prefix}: ${count} chunks unloaded`);
    }

    error(message) {
        if (!this.#enabled) return;
        console.error(`${this.#prefix}: ERROR - ${message}`);
    }

    info(message) {
        if (!this.#enabled) return;
        console.log(`${this.#prefix}: ${message}`);
    }
}