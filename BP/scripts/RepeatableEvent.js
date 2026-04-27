"use strict";
import { system, world } from "@minecraft/server";
import { mconsole as console } from "./debug.js";
import { ColorCodes } from "./ColorCodes.js"
/**
* @class RepeatableEvent
* Standard lifecycle from RepeatableEventManager:
* 1. World is loaded, then RepeatableEvent.onRegister is called.
* 2. Command is executed: `/scriptEvent <namespace>:start`, then the RepeatableEvent.onStart is called followed by the first RepeatableEvent.onTick
* 3. RepeatableEvent.onTick is called every RepeatableEvent.interval ticks.
* 4. Command is executed: `/scriptEvent <namespace>:stop`, then the RepeatableEvent.onStop is called. the following RepeatableEvent.onTick is expected to check 
*/
export /* abstract */ class RepeatableEvent {
	namespace = null;
	interval = 20;
	step = 0;
	state = {};
	jobId;
	cancelRequested = false;
	commandMapping = {};
	isRegistered = false;
	constructor() {
		this.isRegistered = false;
	}
	
	onScriptEventReceive(event) {
		console.log(`${this?.constructor?.name}: checking if owner of: ${event.id}`);
		let id = event.id?.toString()?.toLowerCase().replace(this.namespace?.toLowerCase()+":","");
		if (id in this.commandMapping) {
			console.log(`${ColorCodes.info}Attempting to start: ${ColorCodes.green}${event.id}`);
			try {
				this[this.commandMapping[id]](event);
			} catch (e) {
				console.log(`${ColorCodes.error}Error in: ${event.id} (${this.constructor.name}.${id}) ${ColorCodes.dark_purple}[${system.scriptVersion}]`);
				console.log(`${ColorCodes.error}${e}`);
				console.error(e);
			}
			console.log(`${ColorCodes.info}spawned job: ${ColorCodes.blue}${event.id}`);
		}
	}

	/**
	* Called when the event starts.
	* Default: does nothing.
	* @param {Event} event - source event that Called the /scriptEvent command
	*/
	onStart(event/*:Event*/)/*: void */{
	  // default no-op
	  console.log(`Called onStart`);
	}
	
	/**
	* Called when stopping the event
	* @note: should reset non-persistant values if needed
	* Default: does nothing.
	* @param {Event} event - source event that Called the /scriptEvent command
	*/
	onStop(event/*:Event*/)/*: void */{
	  // default no-op
	  console.log(`Called onStop`);
	}
	
	/**
	* Called each time the script is activated - this is the repeatable event.
	* Default: does nothing.
	*/
	onTick(event)/*: void */{
	  // default no-op
	  console.log(`Called doTick`);
	}
	repeatableLoop(event){
		console.log(`repeatable: step =${this.step}; id=${this.jobId}`);
		if (this.cancelRequested) {
			// abort loop enacted
			world.sendMessage(`${ColorCodes.warn}Active ${this.namespace} (${this.jobId}) aborted!`);//\n${ColorCodes.warn}To start again, run:\n${ColorCodes.light_purple}/scriptEvent ${}start`);
			this.onStop(event);
			return;
		}
		this.onTick(event);
		this.jobId=system.runTimeout(()=>{
			// console.log(`repeatable loop inner timeout running`);
			this.repeatableLoop(event);
		}, this.interval);
		this.step++;
		// console.log(`Queued for step ${this.step}`);
	}
	startLoop(event) {
		// @todo read event.message for the custom args
		if (this.cancelRequested && this.jobId != null) {
			world.sendMessage(`${ColorCodes.warn}Active ${this.namespace} (${this.jobId}) is in the process of aborting, please wait and try again!!`);
			return null;
		}
		this.onStart(event);
		console.log(`Queued start of loop`);
		this.jobId=system.runTimeout(()=>{
			console.log(`starting loop inner timeout running`);
			this.repeatableLoop(event);
		}, 1);
	}
	stopLoop(event) {
		if (this.jobId == null){
			world.sendMessage(`${ColorCodes.warn}No active ${this.namespace} running!`);//\nTo start one, run:\n${ColorCodes.light_purple}/scriptEvent ${startJobId}`);
			return;
		}
		this.cancelRequested = true;
		world.sendMessage(`${ColorCodes.warn}Raised the ${this.namespace} stop flag!`);
	}
	
	register() {
		this.commandMapping = Object.entries(this.commandMapping ?? {}).reduce((acc, [k,v]) => { acc[k?.toString()?.toLowerCase().replace(this.namespace+":","")] = v; return acc; }, {} );
		if (!this.isRegistered) {
			system.afterEvents.scriptEventReceive.subscribe(this.onScriptEventReceive.bind(this));
			this.isRegistered = true;
		}
	}
}