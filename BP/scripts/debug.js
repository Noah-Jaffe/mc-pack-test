import { world, system } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";

const DEFAULT_DEBUG_MODE = true;
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
		}, 0.1);
	} catch (err) {
		return `[Unseralizable object: ${err}]`;
	}
	return "";
}

/** @returns printable string with some useful information for debugging */
export function debugPrefix() {
	return `${ColorCodes.gold}${new Date().toLocaleTimeString("en-us", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits: 3, hour12:false })} ${ColorCodes.blue}(${ColorCodes.yellow}${system.currentTick}${ColorCodes.blue})${ColorCodes.reset}:`;
}

/**
* mconsole is a mimic of js console, but also can toggle printing to mc ""console""
* @property {bool} enabled - if printing to the additional mc console is enabled.
* @property {function} logger - the function to call that is the additional mc console
*/
const mconsole = {
	/** @property {bool} _isEnabled - internal state to do printing to additional mc console or not
	* @type {bool}
	*/
	_isEnabled: DEFAULT_DEBUG_MODE,
	
	/** @function toggle - changes the enabled state
	* @param {bool?} value - if provided, will set an explicit value, otherwise will toggle the mode
	*/
	toggle(value) {
		this._isEnabled = value ?? !this._isEnabled;
	},
	
	/** @function disable - disable logging to additional mc console */
	disable() { this._isEnabled = false; },
	/** @function enable - enable logging to additional mc console */
	enable() { this._isEnabled = true; },
	/** @type {bool} - dont let users write the `enabled` key. */
	set enabled(value) {
		const e = new TypeError("Cannot set enabled. Use toggle(value) instead!");
		console.error(e);
		throw e;
	},
	/** @type {bool} - read enabled state */
	get enabled() {
		return this._isEnabled;
	},
	
	/** @property {function} _logger - the function that is called as the additional mc console.
	* @type {function}
	* @default {@link world.sendMessage}
	*/ 
	_logger: world.sendMessage,
	/** @property {function} _logger - where to send the data to be logged - defaults to world.sendMessage */
	get logger() {
		return this._logger ?? world.sendMessage;
	},
	/** @property {function} _logger - where to send the data to be logged */
	set logger(value) {
		if (typeof value == "function") {
			this._logger = value;
		} else {
			const e = new TypeError("`logger` must be a function!");
			console.error(e);
			throw e;
		}
	},
	/** send value to the mc console
	* @param {*} value - value to be passed to the mc console
	*/
	logger(value) {
		return this._logger(value);
	},
};

// dynamically duplicate console
for (const key of Object.getOwnPropertyNames(console)) {
	if (typeof console[key] !== "function") {
		// @todo any reason to store non funcs?
		// mconsole[key] = console[key];
		continue;
	}
	
	// duplicate/"override" the console function 
	mconsole[key] = function (...args) {
		// Call original and store result for consistent returns
		const result = console[key](...args);
		if (mconsole.enabled) {
			try {
				
				// custom behavior: log to in-game "console"
				const fnColor = ColorCodes[key] ?? ColorCodes.reset;
				let msg = args;
				if (Array.isArray(args) && ((args?.length == 1 && typeof args[0] === "object") || args.length > 1)) {
					msg = debugStringify(args[0]);
				}
				if (result != null) {
					msg += `\n${ColorCodes.yellow}==>${ColorCodes.gray}${result}`;
				}
				mconsole.logger(`${debugPrefix()}` +` ${ColorCodes.gray}[${key}] ` +`${fnColor}` +`${msg}`);
			} catch (err) {
				// Prevent recursive console crashes
				const m = `mconsole error in ${key}: ${err}`;
				world.sendMessage(m);
				console.error(m);
			}
		}
		// Return original return value
		return result;
	};
}

system.runTimeout(()=>{
	world.sendMessage(`debug.js seems ok?`);
}, 20*5);

export { mconsole }; 
