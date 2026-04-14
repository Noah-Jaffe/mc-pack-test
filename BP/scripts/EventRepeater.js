"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { ChunkLoader } from "./ChunkLoader.js";

// @todo refactor script state layout
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

const SCRIPT_STATE = {
	// script instance generic
	namespace: `chunkGen`,
	interval: 20,
	jobId: null,
	id: null,
	step: null,
	debug: true,
	/** run once, before the first onTick */
	onStart(event){
		world.sendMessage("onstart");
		// @todo refactor to onStart
		if (this.state.root != null && this.step> 10) {
			world.sendMessage(`${dbgPrefix()}${ColorCodes.green}RESUMING FROM PREVIOUS STATE ${ColorCodes.info}${JSON.stringify(this.state.root)} #${this.step}`)
		} else {
			this.step = 0;
			const startingLoc = event?.sourceEntity?.location ?? {x: 0, z: 0};
			this.state.root = {x:startingLoc.x, z: startingLoc.z};
			this.cancelRequested = null;
			this.state.dimension = event?.sourceEntity?.dimension ?? world.getDimension('overworld');
		}
		if (!this.state.chunkLoader) {
			// persistent will keep created chunks loaded across server restarts, until unloaded manually
			this.state.chunkLoader = new ChunkLoader(this.state.dimension, { persistent: true, logs: true });
		}
		this.state.chunkLoader.checkWorld().then(e=>world.sendMessage(`"check wotld ${e}`)) 
	},
	/** onStop is run as the final action, not necessarily when the stop command is fired/requested. */ 
	onStop(){
		world.sendMessage("onstop")
		world.sendMessage(`${ColorCodes.info}Last step:${ColorCodes.green}${this.step}\n${ColorCodes.info}Last coords:${ColorCodes.green}${JSON.stringify(this.state.lastCoords)}\n${ColorCodes.info}Last exe tick:${ColorCodes.green}${this.state.lastTick}`);
		this.cancelRequested = null;
		this.jobId = null;
		this.state.chunkLoader = null;
	},
	/** run at each tick interval */
	onTick(){
		world.sendMessage("ontick")
		const coords = getChunkAtStep(this?.state?.root?.x ?? 0, this?.state?.root?.z ?? 0, this.step);
		coords.y = -64;
		(async () => await this.state.chunkLoader.load(coords).then(() => {
			world.sendMessage ("then!")
			this.state.dimension.setBlockType(coords, 'minecraft:glowstone')
			chunk.unload(coords)
		}))();
		this.state.lastTick = system.currentTick;
		this.state.lastCoords = coords;
	},
	/** run once, before onStart */
	onRegister(){
		
	},
	
	state: {
		// script instance specific
		root: null,
		lastCoords: null,
		lastTick: null,
		chunkLoader: null,
		dimension: null,
	}
}
const chunkSize = 16;
const startJobId = `${SCRIPT_STATE.namespace}:start`;
const stopJobId = `${SCRIPT_STATE.namespace}:stop`;
const debugJobId = `${SCRIPT_STATE.namespace}:dbg`;
function debugPrint() {
	if (SCRIPT_STATE.debug) {
		world.sendMessage(...arguments);
	} else {
		console.log(...arguments);
	}
}
function dbgPrefix() {
	return `${ColorCodes.gold}${new Date().toLocaleTimeString("en-us", { hour:"2-digit", minute:"2-digit", second:"2-digit", fractionalSecondDigits: 3, hour12:false })} ${ColorCodes.blue}(${ColorCodes.yellow}${system.currentTick}${ColorCodes.blue})${ColorCodes.reset}:`;
}

function repeatableLoop(scriptState){
	debugPrint(`${dbgPrefix()}repeatable: step =${SCRIPT_STATE?.step}; id=${scriptState?.jobId}`);
	if (scriptState.cancelRequested) {
		// abort loop enacted
		world.sendMessage(`${dbgPrefix()}${ColorCodes.warning}Active ${SCRIPT_STATE.namespace} (${scriptState.jobId}) aborted!\n${ColorCodes.warning}To start again, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`);
		scriptState.onStop();
		return;
	}
	const myActivity = scriptState.onTick();
	debugPrint(`${dbgPrefix()}Action results: ${JSON.stringify(myActivity)}`);
	scriptState.jobId=system.runTimeout(()=>{
		debugPrint(`${dbgPrefix()}repeatable loop inner timeout running`);
		repeatableLoop(scriptState)
	}, SCRIPT_STATE.interval);
	scriptState.step++;
	debugPrint(`${dbgPrefix()}Queued for step ${scriptState.step}`);
}

function startLoop(event, scriptState) {
	// @todo read event.message for the custom args
	if (scriptState.cancelRequested && scriptState.jobId != null) {
		world.sendMessage(`${dbgPrefix()}${ColorCodes.warning}Active ${SCRIPT_STATE.namespace} (${scriptState.jobId}) is in the process of aborting, please wait and try again!!`);
		return null;
	}
	scriptState.onStart(event);
	debugPrint(`${dbgPrefix()}Queued start of loop`);
	scriptState.jobId=system.runTimeout(()=>{
		debugPrint(`${dbgPrefix()}starting loop inner timeout running`);
		repeatableLoop(scriptState);
	}, 1);
}
function stopLoop(event, scriptState) {
	if (scriptState.jobId == null){
		world.sendMessage(`${dbgPrefix()}${ColorCodes.warning}No active ${SCRIPT_STATE.namespace} running!\nTo start one, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`)
		return;
	}
	scriptState.cancelRequested = true;
	world.sendMessage(`${dbgPrefix()}${ColorCodes.warning}Raised the ${SCRIPT_STATE.namespace} stop flag!`)
}

function dbgCmd(event, scriptState){
	debugPrint({ rawtext: [ {text: "version "}, {translate: "pack.description"}]})
}

const jobHandler = {
	[startJobId]: startLoop,
	[stopJobId]: stopLoop,
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
system.runTimeout(()=>{
	world.sendMessage(`${ColorCodes.info}start with\n${ColorCodes.green}/scriptEvent ${startJobId}`);
	world.sendMessage(
  JSON.stringify(Object.keys(world))
);
}, 20*5);