"use strict";
import { system, world, Vector3 } from "@minecraft/server";


const scriptPrefix = `chunkGen`;
const startJobId = `${scriptPrefix}:start`;
const stopJobId = `${scriptPrefix}:stop`;
const debugJobId = `${scriptPrefix}:debug`;
const INTERVAL_BETWEEN_ACTIONS = 20;
const colorCodePrefix = {
	"black": "§0",
	"dark_blue": "§1",
	"dark_green": "§2",
	"dark_aqua": "§3",
	"dark_red": "§4",
	"dark_purple": "§5",
	"gold": "§6",
	"debug": "§6",
	"gray": "§7",
	"dark_gray": "§8",
	"blue": "§9",
	"green": "§a",
	"aqua": "§b",
	"red": "§c",
	"error": "§c",
	"light_purple": "§d",
	"yellow": "§e",
	"warning": "§e",
	"white": "§f",
	"info": "§f",
	"minecoin_gold": "§g",
	"material_quartz": "§h",
	"material_iron": "§i",
	"material_netherite": "§j",
	"material_redstone": "§m",
	"material_copper": "§n",
	"material_gold": "§p",
	"material_emerald": "§q",
	"material_diamond": "§s",
	"material_lapis": "§t",
	"material_amethyst": "§u",
	"material_resin": "§v",
	"reset": "§r",
	"obfuscate": "§k",
	"bold": "§l",
	"italic": "§o",
	
}
// Store current job + cancel state
const SCRIPT_STATE = {
	id: null,
	step: null,
	root: null,
	lastCoords: null,
	lastTick: null,
	debug: true,
}
const chunkSize = 16;

/**
 * print to console or world.sendMessage depending on the global SCRIPT_STATE.debug
 * @params arguments passed directly to the debug print function
 */
function debugPrint() {
	if (SCRIPT_STATE.debug) {
		world.sendMessage(...arguments);
	} else {
		console.log(...arguments);
	}
}
/**
 * @param {any} node a value to be stringified and then formatted with colors.
 * @retueh {string}
 */
function debugStringify(node) {
	let root = true;
	return JSON.stringify(node, (key, value) => {
		if (root && typeof(value) == "object") {
			root = false;
			var replacement = {};
			for (var k in value) {
				if (Object.hasOwnProperty.call(value, k)) {
					replacement[`${colorCodePrefix.yellow}${k}${colorCodePrefix.reset}`] = value[k];
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
}
/** @returns printable string with some useful information for debugging */
function debugPrefix() {
	return `${colorCodePrefix.gold}${new Date().toLocaleTimeString("en-us", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits: 3, hour12:false })} ${colorCodePrefix.blue}(${colorCodePrefix.yellow}${system.currentTick}${colorCodePrefix.blue})${colorCodePrefix.reset}:`;
}
/** 
 * /scriptEvent {@link debugJobId}
 * Debug command, toggles the debug mode
 * @param {Event} event the source event
 * @param {SCRIPT_STATE} scriptState reference by address to the script state
 */
function debugCommand(event, scriptState){
	scriptState.debug = !scriptState.debug;
	world.sendMessage(`${colorCodePrefix.info}Set debug mode to: ${scriptState.debug ? colorCodePrefix.green : colorCodePrefix.red}${scriptState.debug}`);
}

/** 
 * /scriptEvent {@link startJobId}
 * Start the repeatable event command (if one is not yet running)
 * @note Stop the repeatable event with a /scriptEvent {@link stopJobId}
 * @param {Event} event the source event
 * @param {SCRIPT_STATE} scriptState reference by address to the script state. The {@link SCRIPT_STATE.id} determines if a new one can be started or it is already running.
 */
function startLoop(event, scriptState) {
	// @todo read event.message for the custom args
	if (scriptState.cancelRequested && scriptState.id != null) {
		world.sendMessage(`${debugPrefix()}${colorCodePrefix.warning}Active ${scriptPrefix} (${scriptState.id}) is in the process of aborting, please wait and try again!!`);
		return null;
	}
	if (scriptState.root != null && scriptState.step> 10) {
		world.sendMessage(`${debugPrefix()}${colorCodePrefix.green}RESUMING FROM PREVIOUS STATE ${colorCodePrefix.info}${JSON.stringify(scriptState.root)} #${scriptState.step}`)
	} else {
		scriptState.step = 0;
		const startingLoc = event?.sourceEntity?.location ?? {x: 0, z: 0};
		scriptState.root = {x:startingLoc.x, z: startingLoc.z};
		scriptState.cancelRequested = null;
	}
	debugPrint(`${debugPrefix()}Queued start of loop`);
	scriptState.id=system.runTimeout(()=>{
		debugPrint(`${debugPrefix()}starting loop inner timeout running`);
		repeatableLoop(scriptState)
	}, 1);
}

/** 
 * /scriptEvent {@link stopJobId}
 * Stop the repeatable event command
 * @param {Event} event the source event
 * @param {SCRIPT_STATE} scriptState reference by address to the script state. The {@link SCRIPT_STATE.id} determines which job is to be stopped.
 */
function stopLoop(event, scriptState) {
	if (scriptState.id == null){
		world.sendMessage(`${debugPrefix()}${colorCodePrefix.warning}No active ${scriptPrefix} running!\nTo start one, run:\n${colorCodePrefix.light_purple}/scriptEvent ${startJobId}`)
		return;
	}
	scriptState.cancelRequested = true;
	world.sendMessage(`${debugPrefix()}${colorCodePrefix.warning}Raised the ${scriptPrefix} stop flag!`)
}

function repeatableLoop(scriptState){
	//debugPrint(`${debugPrefix()}repeatable`);
	debugPrint(`${debugPrefix()}repeatable: arg '${scriptState?.step}' global '${SCRIPT_STATE?.step}' id '${scriptState?.id}'`);
	if (scriptState.cancelRequested) {
		// abort loop enacted
		world.sendMessage(`${debugPrefix()}${colorCodePrefix.warning}Active ${scriptPrefix} (${scriptState.id}) aborted!\n${colorCodePrefix.warning}To start again, run:\n${colorCodePrefix.light_purple}/scriptEvent ${startJobId}\n\n${colorCodePrefix.info}Last step:${colorCodePrefix.green}${scriptState.step}\n${colorCodePrefix.info}Last coords:${colorCodePrefix.green}${JSON.stringify(scriptState.lastCoords)}\n${colorCodePrefix.info}Last exe tick:${colorCodePrefix.green}${scriptState.lastTick}`);
		scriptState.cancelRequested = null;
		scriptState.id = null;
		return;
	}
	const myActivity = getChunkAtStep(scriptState?.root?.x ?? 0, scriptState?.root?.z ?? 0, scriptState.step);
	debugPrint(`${debugPrefix()}Action results: ${JSON.stringify(myActivity)}`);
	// save persistent successful state
	scriptState.lastTick = system.currentTick;
	scriptState.lastCoords = myActivity;
	scriptState.id=system.runTimeout(()=>{
		debugPrint(`${debugPrefix()}repeatable loop inner timeout running`);
		repeatableLoop(scriptState)
	}, INTERVAL_BETWEEN_ACTIONS);
	scriptState.step++;
	debugPrint(`${debugPrefix()}Queued for step ${scriptState.step}`);
}

function roundForChunkEdge(value) {
	if (value >= 0) {
		return value - (value % chunkSize);
	}
	else {
		return value - (((value % chunkSize) + chunkSize) % chunkSize);
	}
}
function getChunkAtStep(raw_x, raw_z, stepIndex) {
	const baseX = roundForChunkEdge(raw_x);
	const baseZ = roundForChunkEdge(raw_z);
	
	// Step 0 = center
	if (stepIndex === 0) {
		let ret = { x: baseX, z: baseZ };
		debugPrint(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
		return ret;
	}
	
	// ---- Find ring r ----
	// Total points up to ring r: 1 + 2r(r+1)
	let r = Math.floor((Math.sqrt(2 * stepIndex + 1) - 1) / 2);
	
	// Ensure r is correct (fix boundary cases)
	while (1 + 2 * r * (r + 1) <= stepIndex) r++;
	while (1 + 2 * (r - 1) * r > stepIndex) r--;
	
	// First index in this ring
	const ringStart = 1 + 2 * (r - 1) * r;
	
	const offset = stepIndex - ringStart; // 0 → 4r-1
	
	const sideLen = r;
	
	let x, z;
	
	if (offset < sideLen) {
		// Top-right edge
		x = offset;
		z = -r + offset;
	} 
	else if (offset < 2 * sideLen) {
		// Bottom-right edge
		const o = offset - sideLen;
		x = r - o;
		z = o;
	} 
	else if (offset < 3 * sideLen) {
		// Bottom-left edge
		const o = offset - 2 * sideLen;
		x = -o;
		z = r - o;
	} 
	else {
		// Top-left edge
		const o = offset - 3 * sideLen;
		x = -r + o;
		z = -o;
	}
	
	let ret = {
		x: baseX + x * chunkSize,
		z: baseZ + z * chunkSize,
	};
	debugPrint(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}

const jobHandler = {
	[startJobId]: startLoop,
	[stopJobId]: stopLoop,
	[debugJobId]: debugCommand,
	
}

/**
* Listen for script events
*/
function recognizeMyEvents(event) {
	
	if (event.id in jobHandler) {
		debugPrint(`${colorCodePrefix.info}Attempting to start: ${colorCodePrefix.green}${event.id}`)
		try {
			jobHandler[event.id](event, SCRIPT_STATE);
		} catch (e) {
			debugPrint(`${colorCodePrefix.error}Error in: ${event.id} ${colorCodePrefix.dark_purple}[${system.scriptVersion}]`);
			debugPrint(`${colorCodePrefix.error}${e}`);
			console.error(e);
		}
		debugPrint(`${colorCodePrefix.info}spawned job: ${colorCodePrefix.blue}${event.id}`)
	}
	
}

/*
function createMockMinecraft() {
	let currentTick = 0;
	let nextJobId = 1;
	const jobs = new Map();
	const timeouts = [];
	
	const system = {
		get currentTick() {
			return currentTick;
		},
		
		runJob(gen) {
			const id = nextJobId++;
			jobs.set(id, gen);
			return id;
		},
		runTimeout(callback, delayTicks = 0) {
			const id = nextJobId++;
			const runAt = currentTick + Math.max(0, delayTicks);
			
			timeouts.push({
				runAt,
				callback
			});
			return id;
		},
		clearJob(id) {
			jobs.delete(id);
		},
		
		afterEvents: {
			scriptEventReceive: {
				subscribed: [], 
				subscribe: (cb)=>{
					system.afterEvents.scriptEventReceive.subscribed.push(cb);
				}
			}
		}
	};
	
	const world = {
		sendMessage(msg) {
			const stack = new Error("just for stack trace");
			msg = msg.replaceAll(new RegExp(Object.values(colorCodePrefix).join("|"), "gmi"), "")
			console.trace(`[MSG @${currentTick}]`, msg, stack);
		}
	};
	
	function tick(n = 1) {
		for (let i = 0; i < n; i++) {
			currentTick++;
			console.log(`CURRENT TICK ${currentTick}`)
			
			// ---- RUN TIMEOUTS ----
			
			for (let j = timeouts.length - 1; j >= 0; j--) {
				if (timeouts[j].runAt <= currentTick) {
					try {
						timeouts[j].callback();
					} catch (e) {
						console.error("Timeout error:", e);
					}
					
					timeouts.splice(j, 1);
				}
			}
			
			// ---- RUN JOBS ----
			
			for (const [id, job] of [...jobs]) {
				try {
					const res = job.next();
					
					if (res.done) {
						jobs.delete(id);
					}
					
				} catch (e) {
					console.error("Job error:", e);
					jobs.delete(id);
				}
			}
		}
	}
	
	function fireScriptEvent(id, sourceEntity = null) {
		for (const scriptEventCallback of system.afterEvents.scriptEventReceive.subscribed) {
			
			scriptEventCallback({
				id,
				sourceEntity: sourceEntity ?? {
					location: { x: 0, y: 0, z: 0 },
					onScreenDisplay: {
						setActionBar: (msg) => {
							const stack = new Error("just for stack trace");
							msg = msg.replaceAll(new RegExp(Object.values(colorCodePrefix).join("|"), "gmi"), "")
							console.trace(`[ACTIONBAR @${currentTick}]`, msg, stack);
						}
					}
				}
			});
		}
	}
	
	return { system, world, tick, fireScriptEvent };
}



const sim = createMockMinecraft();
const system = sim.system;
const world = sim.world;

// Load your script (or paste it here)
system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);

sim.tick(5);
// Simulate commands
sim.fireScriptEvent("chunkGen:start");

// Run game loop
sim.tick(25); // simulate ticks

*/

system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);