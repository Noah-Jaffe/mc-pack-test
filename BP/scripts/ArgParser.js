/**
* ParseArgs.js
* Utility for parsing script event messages into normalized argument objects.
*/
import { mconsole as console } from "./debug.js";

/**
* Attempts to parse a raw script event message into a normalized object.
* Priority:
* 1. JSON parsing
* 2. CLI-style argument parsing
*
* @param {string} rawMessage - The raw message string from event.message
* @returns {Object|string|number|boolean|null} Parsed and normalized value.
* - Returns object/array if JSON or structured args detected
* - Returns primitive if message is a single value
* - Returns empty object if nothing parsable
*/
function parseScriptEventMessageForArgs(rawMessage) {
	if (typeof rawMessage !== "string" || rawMessage.trim() === "") {
		return {};
	}
	
	const trimmed = rawMessage.trim();
	
	// 1. Try JSON parsing first
	const jsonResult = tryParseJSON(trimmed);
	if (jsonResult != trimmed) {
		return jsonResult;
	}
	
	// 2. Try CLI-style parsing
	const cliResult = parseCLIArgs(trimmed);
	if (Object.keys(cliResult).length > 0) {
		return cliResult;
	}
	
	// 3. Fallback: return primitive if possible
	return coerceType(trimmed);
}

/**
* Attempts to safely parse a JSON string.
*
* @param {string} input - String to parse
* @returns {any} Resulting parsed object, or the original value if it was not parsable.
*/
function tryParseJSON(input) {
	try {
		return JSON.parse(input);
	} catch {
		return input;
	}
}

/**
* Parses a CLI-style argument string into an object.
* Supports:
* - --key=value
* - --key value
* - -k value
* - boolean flags (--flag)
* - repeated flags
* - comma-separated values
*
* @param {string} input - CLI-style argument string
* @returns {Object} Parsed arguments as key-value pairs
*/
function parseCLIArgs(input) {
	const tokens = tokenize(input);
	let result = {};
	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i];
		
		// Long flag: --key=value
		if (token.startsWith("--")) {
			const [key, value] = splitKeyValue(token.substring(2));
			
			if (value !== undefined) {
				assignValue(result, key, value);
			} else {
				// Check next token for value
				const next = tokens[i + 1];
				if (next && !isFlag(next)) {
					assignValue(result, key, next);
					i++;
				} else {
					assignValue(result, key, true);
				}
			}
		}
		
		// Short flag: -k
		else if (token.startsWith("-") && token.length > 1) {
			const flags = token.substring(1).split("");
			
			// Handle grouped flags like -abc
			for (let j = 0; j < flags.length; j++) {
				const flag = flags[j];
				
				// If last flag, allow value
				if (j === flags.length - 1) {
					const next = tokens[i + 1];
					if (next && !isFlag(next)) {
						assignValue(result, flag, next);
						i++;
					} else {
						assignValue(result, flag, true);
					}
				} else {
					assignValue(result, flag, true);
				}
			}
		}
		
		// colon-based
		else if (token.match(/^\s*(\w+):.*/gmi)) {
			//	token.includes(":")) {
			const parts = token.split(":");
			if (parts.length >= 2) {
				const key = parts[0];
				const value = parts.slice(1).join(":");
				assignValue(result, key, value);
			}
		}
		
		// Positional fallback
		else {
			assignValue(result, i, token, true);
		}
	}
	
	// condense positional arguments into single value if it resolved to a single value in an array
	// { 0: ["hello"], 1: ["world","ok"], ... 2222:[1] } 
	//  ==>
	// { 0: "hello", 1: ["world", "ok"], ... 2222:[1] }
	result = Object.entries(result).reduce((acc, [k,v]) => {
		acc[k] = v;
		let n = Number(k);
		if (!isNaN(n) && Number.isInteger(n) && n>=0 && n <= 1024) {
			if (Array.isArray(v) && v?.length == 1) {
				acc[k] = v[0];
			}
		}
		if (typeof acc[k] == "string") {
			acc[k] = tryParseJSON(acc[k]);
		}
		return acc;
	}, {});
	return result;
}

/**
* Splits a key=value string.
*
* @param {string} input - Input string
* @returns {[string, string|undefined]} Key and value
*/
function splitKeyValue(input) {
	const index = input.indexOf("=");
	if (index === -1) return [input, undefined];
	
	const key = input.substring(0, index);
	const value = input.substring(index + 1);
	return [key, value];
}

/**
* Assigns a value to a result object, supporting repeated keys.
*
* @param {Object} obj - Target object
* @param {string} key - Key name
* @param {any} value - Value to assign
* @param {boolean} [append=false] - Whether to append positional values
*/
function assignValue(obj, key, value, append = false) {
	const parsedValue = parseValue(value);
	
	if (append || obj[key] !== undefined) {
		if (!Array.isArray(obj[key])) {
			obj[key] = obj[key] !== undefined ? [obj[key]] : [];
		}
		obj[key].push(parsedValue);
	} else {
		obj[key] = parsedValue;
	}
}

/**
* Converts a string value into an appropriate type.
*
* @param {string} value - Input string
* @returns {string|number|boolean|Array} Parsed value
*/
function parseValue(value) {
	if (typeof value !== "string") return value;
	
	// CSV support
	if (value.includes(",")) {
		return value.split(",").map(v => coerceType(v.trim()));
	}
	
	return coerceType(value);
}

/**
* Attempts to coerce a string into a primitive type.
*
* @param {string} value - Input string
* @returns {string|number|boolean|null}
*/
function coerceType(value) {
	if (value === "true") return true;
	if (value === "false") return false;
	if (value === "null") return null;
	
	const num = Number(value);
	if (!isNaN(num) && value !== "") return num;
	
	// if (typeof value == "string") value = value.trim();
	return value;
}

/**
* Determines if a token is a flag.
*
* @param {string} token - Token to check
* @returns {boolean}
*/
function isFlag(token) {
	return token.startsWith("-");
}

/**
* Tokenizes a CLI string while respecting quoted substrings.
*
* @param {string} input - Raw CLI string
* @returns {string[]} Array of tokens
*/
function tokenize(input) {
	const regex = /"([^"]*)"|'([^']*)'|[^\s]+/g;
	const tokens = [];
	let match;
	
	while ((match = regex.exec(input)) !== null) {
		tokens.push(match[1] || match[2] || match[0]);
	}
	
	return tokens;
}

// auto run tests?
/*
(()=>{
	[
	{ arg: '--port=3000 --debug', expected: { port: 3000, debug: true }, },
	{ arg:'{"player":"Steve"}', expected: { player: "Steve" }, },
	{ arg:'--tag=a,b,c', expected: { tag: ["a","b","c"] }, },
	{ arg:'user:create', expected: { user: "create" }, },
	{ arg:'-p -p --pp=4 qq:5 --name poop', expected: { p: [true, true], pp:4, qq:5, name:"poop"}, },
	{ arg:'position1 p2 p3 p4 p5 {"a":"p6"}', expected: {0:"position1",1: "p2",2:"p3",3:"p4",4:"p5", 5:{"a":"p6"}}, }
	].forEach((arg)=>{
		let actual = parseScriptEventMessageForArgs(arg.arg);
		const a = JSON.stringify(actual);
		const e = JSON.stringify(arg.expected);
		if(a!=e) {
			console.error(`TEST FAILED: parseScriptEventMessageForArgs failed test for ${arg.arg}.\nExpected:${e}\nActual:\n${a}`)
		}
	});
})()
*/