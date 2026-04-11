import { world, system } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";

/**
* @param {any} node a value to be stringified and then formatted with colors.
* @retueh {string}
*/
export function debugStringify(node) {
	let root = true;
	try {
	return JSON.stringify(node, (key, value) => {
		if (root && typeof(value) == "object") {
			root = false;
			var replacement = {};
			for (var k in value) {
				if (Object.hasOwnProperty.call(value, k)) {
					replacement[`${ColorCodes.yellow}${k}${ColorCodes.reset}`] = value[k];
				}
			}
			return replacement;
		}
		root = false;
		switch (typeof (value)) {
			case "number":
				return parseFloat(value.toFixed(2));
				case "function":
					return value.toString();
		}
		return value;
	}, 0.1)
	} catch (err) {
		return `[Unseralizable object: ${err}]`;
	}
	return "";
}

/** @returns printable string with some useful information for debugging */
export function debugPrefix() {
	return `${ColorCodes.gold}${new Date().toLocaleTimeString("en-us", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits: 3, hour12:false })} ${ColorCodes.blue}(${ColorCodes.yellow}${system.currentTick}${ColorCodes.blue})${ColorCodes.reset}:`;
}

export class DebugConsole {
	debug (...args) {
		const msg = debugStringify(args);
		world.sendMessage(`§7[DEBUG] §r${msg}`);
		console.debug(...args);
	}
	
	log (...args) {
		const msg = debugStringify(args);
		world.sendMessage(`§7[LOG] §r${msg}`);
		console.log(...args); // optional (keeps original behavior)
	}
	
	warn (...args) {
		const msg = debugStringify(args);
		world.sendMessage(`§e[WARN] §r${msg}`);
		console.warn(...args);
	}
	
	error (...args) {
		const msg = debugStringify(args);
		world.sendMessage(`§c[ERROR] ${msg}`);
		if (args[0] instanceof Error) {
			world.sendMessage(`§8${args[0].stack}`);
		}
		console.error(...args);
	}
}