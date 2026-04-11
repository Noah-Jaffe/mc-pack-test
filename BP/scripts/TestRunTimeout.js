"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { debugPrefix, debugStringify, } from "./debug.js";

import { ScriptState } from "./ScriptState.js";

const scriptPrefix = `sample`;
const startJobId = `${scriptPrefix}:start`;
const stopJobId = `${scriptPrefix}:stop`;
const debugJobId = `${scriptPrefix}:debug`;

// Store current job + cancel state
const SCRIPT_STATE = {
	id: null,
	step: null,
	tickInterval: 20,
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
 * /scriptEvent {@link debugJobId}
 * Debug command, toggles the debug mode
 * @param {Event} event the source event
 * @param {SCRIPT_STATE} scriptState reference by address to the script state
 */
function debugCommand(event, scriptState){
	scriptState.debug = !scriptState.debug;
	world.sendMessage(`${ColorCodes.info}Set debug mode to: ${scriptState.debug ? ColorCodes.green : ColorCodes.red}${scriptState.debug}`);
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
		world.sendMessage(`${debugPrefix()}${ColorCodes.warning}Active ${scriptPrefix} (${scriptState.id}) is in the process of aborting, please wait and try again!!`);
		return null;
	}
	if (scriptState.root != null && scriptState.step> 10) {
		world.sendMessage(`${debugPrefix()}${ColorCodes.green}RESUMING FROM PREVIOUS STATE ${ColorCodes.info}${JSON.stringify(scriptState.root)} #${scriptState.step}`)
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
		world.sendMessage(`${debugPrefix()}${ColorCodes.warning}No active ${scriptPrefix} running!\nTo start one, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`)
		return;
	}
	scriptState.cancelRequested = true;
	world.sendMessage(`${debugPrefix()}${ColorCodes.warning}Raised the ${scriptPrefix} stop flag!`)
}

function repeatableLoop(scriptState){
	//debugPrint(`${debugPrefix()}repeatable`);
	debugPrint(`${debugPrefix()}repeatable: arg '${scriptState?.step}' global '${SCRIPT_STATE?.step}' id '${scriptState?.id}'`);
	if (scriptState.cancelRequested) {
		// abort loop enacted
		world.sendMessage(`${debugPrefix()}${ColorCodes.warning}Active ${scriptPrefix} (${scriptState.id}) aborted!\n${ColorCodes.warning}To start again, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}\n\n${ColorCodes.info}Last step:${ColorCodes.green}${scriptState.step}\n${ColorCodes.info}Last coords:${ColorCodes.green}${JSON.stringify(scriptState.lastCoords)}\n${ColorCodes.info}Last exe tick:${ColorCodes.green}${scriptState.lastTick}`);
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
	}, scriptState.tickInterval);
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
		debugPrint(`${ColorCodes.info}Attempting to start: ${ColorCodes.green}${event.id}`)
		try {
			jobHandler[event.id](event, SCRIPT_STATE);
		} catch (e) {
			debugPrint(`${ColorCodes.error}Error in: ${event.id} ${ColorCodes.dark_purple}[${system.scriptVersion}]`);
			debugPrint(`${ColorCodes.error}${e}`);
			console.error(e);
		}
		debugPrint(`${ColorCodes.info}spawned job: ${ColorCodes.blue}${event.id}`)
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
			msg = msg.replaceAll(new RegExp(Object.values(ColorCodes).join("|"), "gmi"), "")
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
							msg = msg.replaceAll(new RegExp(Object.values(ColorCodes).join("|"), "gmi"), "")
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