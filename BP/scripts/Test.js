"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { ChunkLoader } from "./ChunkLoader.js";
import { mconsole as console } from "./debug.js"; 
import { chunkSize, roundForChunkEdge, getChunkAtStep } from "./ChunkMath.js";


class EVT {
	// script instance generic
	constructor(){
	this.namespace = `chunkGen`;
	this.interval = 5;
	this.jobId= null;
	this.id= null;
	this.step= null;
	this.debug= true;
	this.state= {
		// script instance specific
		root: null,
		lastCoords: null,
		lastTick: null,
		chunkLoader: null,
		dimension: null,
	};
	}
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
	}
	/** onStop is run as the final action, not necessarily when the stop command is fired/requested. */ 
	onStop(){
		world.sendMessage(`${ColorCodes.info}Last step:${ColorCodes.green}${this.step}\n${ColorCodes.info}Last coords:${ColorCodes.green}${JSON.stringify(this.state.lastCoords)}\n${ColorCodes.info}Last exe tick:${ColorCodes.green}${this.state.lastTick}`);
		this.cancelRequested = null;
		this.jobId = null;
		this.state.chunkLoader = null;
	}
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
	}
	/** run once, before onStart */
	onRegister(){
		world.sendMessage(`${ColorCodes.info}start with\n${ColorCodes.green}/scriptEvent ${startJobId}`);
	}
};
const SCRIPT_STATE = new EVT();
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
			world.sendMessage(`${ColorCodes.info}start ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.green}/scriptEvent ${SCRIPT_STATE.namespace}:start`);
		world.sendMessage(`${ColorCodes.info}stop ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.light_red}/scriptEvent ${SCRIPT_STATE.namespace}:stop`);
		world.sendMessage(`${ColorCodes.info}toggle debug ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.green}/scriptEvent ${SCRIPT_STATE.namespace}:debug`);
}, 20*5);