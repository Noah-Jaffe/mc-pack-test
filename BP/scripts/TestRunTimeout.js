"use strict";
import { system, world, Vector3 } from "@minecraft/server";


const scriptPrefix = `chunkGen`;
const startJobId = `${scriptPrefix}:start`;
const stopJobId = `${scriptPrefix}:stop`;
const debugJobId = `${scriptPrefix}:dbg`;
const INTERVAL_BETWEEN_ACTIONS = 60;
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
}

const chunkSize = 16;

function chunkGeneratorInterval(scriptState) {
	world.sendMessage(`${colorCodePrefix.info}>${scriptPrefix}: #${scriptState?.step} @T ${system.currentTick}`);
	if (scriptState.cancelRequested) {
		world.sendMessage(`${colorCodePrefix.warning}: abort flag recognized!`);
		return resetJobState(scriptState);
	}
	scriptState.root = {
		x:parseFloat((parseFloat(scriptState?.root?.x)||0).toFixed(2)), 
		z:parseFloat((parseFloat(scriptState?.root?.z)||0).toFixed(2)),
	};
	scriptState.step = parseInt(scriptState?.step) || 0;
	if (scriptState.debug) {
		//popupDisplay(null, scriptState, `tick: ${system.currentTick}`)
		world.sendMessage(JSON.debugStringify(scriptState))
		world.sendMessage("debugStringify ok")
	}
	world.sendMessage(`getchunk? ${[scriptState?.root?.x ?? 0, scriptState?.root?.z ?? 0, scriptState?.step]}`)
	// action per tick here
	const chunk = getChunkAtStep(scriptState?.root?.x ?? 0, scriptState?.root?.z ?? 0, scriptState.step);
	world.sendMessage("got chunk ok")
	world.sendMessage(JSON.stringify (chunk))
	scriptState.step++;
	// @todo: do something with chunk coords here
	
	// Yield so the game doesn't freeze
	scriptState.activeJob = system.runTimeout(()=>{
		chunkGeneratorInterval(scriptState);
	}, INTERVAL_BETWEEN_ACTIONS);
	world.sendMessage(`${colorCodePrefix.info}R ${scriptPrefix} #${scriptState.step-1} @T ${system.currentTick}=${JSON.stringify(chunk)}\n${colorCodePrefix.info}Q ${scriptPrefix} #${scriptState.step} @T ${system.currentTick + INTERVAL_BETWEEN_ACTIONS} (+${(INTERVAL_BETWEEN_ACTIONS/20).toFixed(2).replace(/\.00$|0$/gmi, "")}s)`);
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
		world.sendMessage(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
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
	world.sendMessage(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}
function repeatableLoop(scriptState){
	//scriptState.debug(`${dbgPrefix()}repeatable`);
	if (typeof scriptState.debug == "undefined") {
		scriptState.debug = world?.getPlayers()[0].onScreenDisplay.setActionBar ?? defaultDebug;
	}
	scriptState.debug(`${dbgPrefix()}repeatable: arg '${scriptState?.step}' global '${SCRIPT_STATE?.step}' id '${scriptState?.id}'`);
	const myActivity = getChunkAtStep(scriptState?.root?.x ?? 0, scriptState?.root?.z ?? 0, scriptState.step);
	scriptState.debug(`${dbgPrefix()}Action results: ${JSON.stringify(myActivity)}`);
	scriptState.id=system.runTimeout(()=>{
		scriptState.debug(`${dbgPrefix()}repeatable loop inner timeout running`);
		repeatableLoop(scriptState)
	}, 10);
	scriptState.step++;
	scriptState.debug(`${dbgPrefix()}Queued for step ${scriptState.step}`);
}
function dbgPrefix() {
	return `${colorCodePrefix.gold}${new Date().toLocaleTimeString("en-us", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits: 3, hour12:false })} ${colorCodePrefix.blue}(${colorCodePrefix.yellow}${system.currentTick}${colorCodePrefix.blue})${colorCodePrefix.reset}:`;
}
function startLoop(event, scriptState) {
	scriptState.step = 0;
	scriptState.root = {x:0, z:0};
	scriptState.debug = event.sourceEntity?.onScreenDisplay?.setActionBar ?? world?.getPlayers()[0].onScreenDisplay.setActionBar ?? defaultDebug;
	scriptState.debug(`${dbgPrefix()}Queued start of loop`);
	scriptState.id=system.runTimeout(()=>{
		scriptState.debug(`${dbgPrefix()}starting loop inner timeout running`);
		repeatableLoop(scriptState)
	}, 1);
}

function dbgCmd(event, scriptState){
	world.sendMessage({translate: "pack.description"})
}

const jobHandler = {
	[startJobId]: startLoop,
	[debugJobId]: dbgCmd,
}
JSON.debugStringify = (node) => {
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

/**
* Listen for script events
*/
function recognizeMyEvents(event) {
	
	if (event.id in jobHandler) {
		world.sendMessage(`${colorCodePrefix.info}Attempting to start: ${colorCodePrefix.green}${event.id}`)
		try {
			jobHandler[event.id](event, SCRIPT_STATE);
		} catch (e) {
			world.sendMessage(`${colorCodePrefix.error}Error in: ${event.id} ${colorCodePrefix.dark_purple}[${system.scriptVersion}]`);
			world.sendMessage(`${colorCodePrefix.error}${e}`);
			console.error(e);
		}
		world.sendMessage(`${colorCodePrefix.info}spawned job: ${colorCodePrefix.blue}${event.id}`)
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

const defaultDebug = typeof world ? world?.sendMessage : console.log;
system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);