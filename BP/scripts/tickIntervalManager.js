import { system } from "@minecraft/server";
export class TickIntervalManager {
    constructor(tickInterval) {
        this.runId = 0;
        this.callbacks = new Map();
        this.tickInterval = tickInterval;
    }
    addEntry(id, callback) {
        if (this.callbacks.has(id)) {
            console.warn(`Callback with id ${id} is already active`);
        }
        else {
            this.callbacks.set(id, callback);
        }
    }
    removeEntry(id) {
        if (this.callbacks.has(id)) {
            this.callbacks.delete(id);
        }
        else {
            console.warn(`Callback with id ${id} does not exist`);
        }
    }
    start() {
        this.runId = system.runInterval(() => this.callbacks.forEach((callback) => callback()), this.tickInterval);
    }
    stop() {
        system.clearRun(this.runId);
    }
    activeAmount() {
        return this.callbacks.size;
    }
}
