"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { ChunkLoader } from "./ChunkLoader.js";
import { mconsole as console } from "./debug.js"; 
// import { chunkSize, roundForChunkEdge, getChunkAtStep } from "./commmon/ChunkMath.js";
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
		//console.log(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
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
	//console.log(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}

const SCRIPT_STATE = {
	// script instance generic
	namespace: `chunkGen`,
	interval: 5,
	jobId: null,
	id: null,
	step: null,
	debug: true,
	/** run once, before the first onTick */
	onStart(event){
		// @todo refactor to onStart
		if (this.state.root != null && this.step> 10) {
			world.sendMessage(`${ColorCodes.green}RESUMING FROM PREVIOUS STATE ${ColorCodes.info}${JSON.stringify(this.state.root)} #${this.step}`);
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
	},
	/** onStop is run as the final action, not necessarily when the stop command is fired/requested. */ 
	onStop(){
		world.sendMessage(`${ColorCodes.info}Last step:${ColorCodes.green}${this.step}\n${ColorCodes.info}Last coords:${ColorCodes.green}${JSON.stringify(this.state.lastCoords)}\n${ColorCodes.info}Last exe tick:${ColorCodes.green}${this.state.lastTick}`);
		this.cancelRequested = null;
		this.jobId = null;
		this.state.chunkLoader = null;
	},
	/** run at each tick interval */
	onTick(){
		const coords = getChunkAtStep(this?.state?.root?.x ?? 0, this?.state?.root?.z ?? 0, this.step);
		coords.y = -64;
		(async () => await this.state.chunkLoader.load(coords).then(() => {
			this.state.dimension.setBlockType(coords, 'minecraft:glowstone');
			this.state.chunkLoader.unload(coords);
		}))();
		this.state.lastTick = system.currentTick;
		this.state.lastCoords = coords;
	},
	/** run once, before onStart */
	onRegister(){
		world.sendMessage(`${ColorCodes.info}start with\n${ColorCodes.green}/scriptEvent ${startJobId}`);
	},
	
	state: {
		// script instance specific
		root: null,
		lastCoords: null,
		lastTick: null,
		chunkLoader: null,
		dimension: null,
	}
};
const chunkSize = 16;
const startJobId = `${SCRIPT_STATE.namespace}:start`;
const stopJobId = `${SCRIPT_STATE.namespace}:stop`;
const debugJobId = `${SCRIPT_STATE.namespace}:dbg`;

function repeatableLoop(scriptState){
	console.log(`repeatable: step =${SCRIPT_STATE?.step}; id=${scriptState?.jobId}`);
	if (scriptState.cancelRequested) {
		// abort loop enacted
		world.sendMessage(`${ColorCodes.warn}Active ${SCRIPT_STATE.namespace} (${scriptState.jobId}) aborted!\n${ColorCodes.warn}To start again, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`);
		scriptState.onStop();
		return;
	}
	scriptState.onTick();
	scriptState.jobId=system.runTimeout(()=>{
		// console.log(`repeatable loop inner timeout running`);
		repeatableLoop(scriptState);
	}, SCRIPT_STATE.interval);
	scriptState.step++;
	// console.log(`Queued for step ${scriptState.step}`);
}

function startLoop(event, scriptState) {
	// @todo read event.message for the custom args
	if (scriptState.cancelRequested && scriptState.jobId != null) {
		world.sendMessage(`${ColorCodes.warn}Active ${SCRIPT_STATE.namespace} (${scriptState.jobId}) is in the process of aborting, please wait and try again!!`);
		return null;
	}
	scriptState.onStart(event);
	console.log(`Queued start of loop`);
	scriptState.jobId=system.runTimeout(()=>{
		console.log(`starting loop inner timeout running`);
		repeatableLoop(scriptState);
	}, 1);
}
function stopLoop(event, scriptState) {
	if (scriptState.jobId == null){
		world.sendMessage(`${ColorCodes.warn}No active ${SCRIPT_STATE.namespace} running!\nTo start one, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`);
		return;
	}
	scriptState.cancelRequested = true;
	world.sendMessage(`${ColorCodes.warn}Raised the ${SCRIPT_STATE.namespace} stop flag!`);
}

function dbgCmd(event, scriptState){
	if (typeof (console.toggle) != "undefined") {
		const curr = console.enabled;
		console.toggle();
		world.sendMessage(`${ColorCodes.blue}console debug mode set from ${curr ? ColorCodes.green : ColorCodes.red}${!!curr}${ColorCodes.blue} to ${console.enabled ? ColorCodes.green : ColorCodes.red}${!!console.enabled}`);
	}
	
}

const jobHandler = {
	[startJobId]: startLoop,
	[stopJobId]: stopLoop,
	[debugJobId]: dbgCmd,
	
};

/**
* Listen for script events
*/
function recognizeMyEvents(event) {
	if (event.id in jobHandler) {
		console.log(`${ColorCodes.info}Attempting to start: ${ColorCodes.green}${event.id}`);
		try {
			jobHandler[event.id](event, SCRIPT_STATE);
		} catch (e) {
			console.log(`${ColorCodes.error}Error in: ${event.id} ${ColorCodes.dark_purple}[${system.scriptVersion}]`);
			console.log(`${ColorCodes.error}${e}`);
			console.error(e);
		}
		console.log(`${ColorCodes.info}spawned job: ${ColorCodes.blue}${event.id}`);
	}
	
}

system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);
system.runTimeout(() => {
	SCRIPT_STATE.onRegister();
}, 20*5);