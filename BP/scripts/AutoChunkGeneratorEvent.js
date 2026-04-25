"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { ChunkLoader } from "./ChunkLoader.js";
import { mconsole as console } from "./debug.js";
import { getChunkAtStep } from "./ChunkMath.js";
import { RepeatableEvent } from "./RepeatableEvent.js";

/**
* @typedef {Object} RootPosition
* @property {?number} x - Root X coordinate (nullable).
* @property {?number} z - Root Z coordinate (nullable).
*/
/**
* @typedef {"overworld"|"nether"|"the_end"|Dimension} DimensionLike string for Dimension name, or actual {@link Dimension} object.
*/
/**
* @typedef {Object} AutoChunkGeneratorState
* @property {RootPosition} root {x,z} coords of center of spiral.
* @property {RootPosition} lastCoords last x,z coords loaded
*  @property {?number} lastTick the last tick the onTick was successfully fired
*  @property {ChunkLoader} chunkLoader the ChunkLoader instance
*  @property {DimensionLike} dimension dimension that chunks should be loaded for
*/

/**
* A {@link RepeatableEvent} implementation that progressively loads chunks in an outward spiral centered on a root position.
* Primarily used for pre-generating terrain or forcing chunk creation around an entity or fixed coordinate.
*
* Each tick interval loads the next chunk in the spiral and enforces the persistent save in the chunks.dat files.
*
* @extends RepeatableEvent
*/
export class AutoChunkGenerator extends RepeatableEvent {
	// @todo possibly add jobHandler dict to this object?
	// add register function that is passed system?
	// then have the main.js call a list of known events?
	/** @property {string} namespace Namespace used for this event type */
	namespace = `chunkGen`;
	
	/** @property {number} interval Tick interval between executions */
	interval = 5;
	
	/** @property {number} step Current spiral step index */
	step = 0;
	
	/** @property {AutoChunkGeneratorState} state Persistent runtime state. */
	state = {
		root: { x: 0, z: 0 },
		lastCoords: { x: null, z: null },
		lastTick: null,
		chunkLoader: null,
		dimension: null,
	};
	
	/** command mapping keys are for /scriptEvent {this.namespace}:<key> -> calls this.<value>(event)
	commandMapping: {
	"start": "onStart",
	"stop": "onStop",
	"debug": "onDebug",
	"dbg": "onDebug",
	};
	
	/**
	* @lifecycle {0} - after "module loaded" and before {@link onRegister}.
	* Creates an AutoChunkGenerator Event instance
	* @param {Partial<AutoChunkGeneratorState> & { interval?: number }} [options] Instance configuration options.
	* @param {number} [options.interval=20] Tick interval between executions.
	*/
	constructor({
		namespace=null,
		interval=20,
		dimension="overworld",
		chunkLoader=null,
		root={ x: null, z: null },
		x=null,
		z= null,
	}={}) {
		super();
		this.step = 0;
		this.namespace = namespace?.toString() ?? this.namespace;
		this.interval = parseInt(interval) || this.interval;
		this.state = this.state ?? {};
		this.state.dimension = dimension ?? this.state?.dimension;
		this.state.root = {
			'x': root?.x ?? x ?? this.state?.root?.x ?? this.state?.lastCoords?.x ?? 0, 
			'z': root?.z ?? z ?? this.state?.root?.z ?? this.state?.lastCoords?.z ?? 0,
		};
		this.state.chunkLoader = chunkLoader ?? this.state?.chunkLoader;
	}
	
	/**
	* @lifecycle {2} Runs once before the first {@link onTick}.
	* Initializes root position, dimension, and creates the {@link ChunkLoader}.
	* @param {ScriptEventCommandMessageEvent} event
	* Source event that triggered the job.
	*
	* @returns {void}
	*/
	onStart(event){
		// @todo read event.message for the custom args
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
	onStop(event){
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
	/**
	* @@lifecycle {1} Runs once when the class/event is registered/subscribed for scriptEvents.
	* Outputs the command required to start this event. 
	* @todo: Also essentially a `/scriptEvent {@link namespace}:help`command?
	*/
	onRegister(){
		world.sendMessage(`${ColorCodes.info}start ${this.constructor.name} with\n${ColorCodes.green}/scriptEvent ${this.namespace}:start`);
		world.sendMessage(`${ColorCodes.info}stop ${this.constructor.name} with\n${ColorCodes.material_redstone}/scriptEvent ${this.namespace}:stop`);
		world.sendMessage(`${ColorCodes.info}toggle debug ${this.constructor.name} with\n${ColorCodes.green}/scriptEvent ${this.namespace}:debug`);
	}
	
	/** on debug command, toggle debug printing */
	onDebug(event) {
		if (typeof (console.toggle) != "undefined") {
			const curr = console.enabled;
			let setTo = undefined;
			if (event.message.toString().match(/true/gmi)) {
				setTo = true;
			} else if (event.message.toString().match(/false/gmi)) {
				setTo = false;
			}
			console.toggle(setTo);
			world.sendMessage(`${ColorCodes.blue}console debug mode set from ${curr ? ColorCodes.green : ColorCodes.red}${!!curr}${ColorCodes.blue} to ${console.enabled ? ColorCodes.green : ColorCodes.red}${!!console.enabled}`);
			
		}
	}
}
