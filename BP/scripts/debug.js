import { world } from "@minecraft/server";

// Keep original console methods (optional but useful)
const _console = {
    debug: console.debug,
    log: console.log,
    error: console.error,
    warn: console.warn,
};

// Helper to stringify safely
function formatMessage(args) {
    return args.map(a => {
        try {
            if (typeof a === "object") return JSON.stringify(a);
            return String(a);
        } catch {
            return "[Unserializable Object]";
        }
    }).join(" ");
}

console.debug = (...args) => {
    const msg = formatMessage(args);
    world.sendMessage(`§7[DEBUG] §r${msg}`);
    _console.debug(...args);
};

console.log = (...args) => {
    const msg = formatMessage(args);
    world.sendMessage(`§7[LOG] §r${msg}`);
    _console.log(...args); // optional (keeps original behavior)
};

console.warn = (...args) => {
    const msg = formatMessage(args);
    world.sendMessage(`§e[WARN] §r${msg}`);
    _console.warn(...args);
};

console.error = (...args) => {
    const msg = formatMessage(args);
    world.sendMessage(`§c[ERROR] ${msg}`);
    if (args[0] instanceof Error) {
        world.sendMessage(`§8${args[0].stack}`);
    }
    _console.error(...args);
};

