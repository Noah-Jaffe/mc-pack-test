"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { mconsole as console } from "./debug.js"; 

// import custom command implementations here
import { AutoChunkGenerator } from "./AutoChunkLoaderEvent.js"

const MY_PLUGINS = [
	
	// Add your custom script events above here as instances.
];

// on loading the script, call the events "register" function which is responsible for subscribing to the appropriate event
for (const event of MY_PLUGINS) {
	try {
		let e;
		if (typeof event == "function") {
			// MY_PLUGINS entry is a class type 
			e = new event();
		} else {
			// MY_PLUGINS entry is an instance
			e = event;
		}
		e.register();
	} catch (err) {
		console.log(`${ColorCodes.error}Error registering or spawning event ${event.constructor.name}: ${err.name}`);
		console.error(err);
	}
}

system.runTimeout(() => {
	world.sendMessage(`${ColorCodes.info}start ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.green}/scriptEvent ${SCRIPT_STATE.namespace}:start`);
	world.sendMessage(`${ColorCodes.info}stop ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.light_red}/scriptEvent ${SCRIPT_STATE.namespace}:stop`);
	world.sendMessage(`${ColorCodes.info}toggle debug ${SCRIPT_STATE?.constructor?.name} with\n${ColorCodes.green}/scriptEvent ${SCRIPT_STATE.namespace}:debug`);
}, 20*5);