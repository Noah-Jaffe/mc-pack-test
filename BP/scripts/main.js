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
for (let i = 0; i < MY_PLUGINS.length; ++i) {
	try {
		let e = MY_PLUGINS[i];
		if (typeof e == "function") {
			// MY_PLUGINS entry is a class type 
			e = new event();
		} else {
			// MY_PLUGINS entry is an instance?
		}
		e.register();
		MY_PLUGINS[i] = e;
	} catch (err) {
		console.log(`${ColorCodes.error}Error registering or spawning event ${event.constructor.name}: ${err.name}`);
		console.error(err);
	}
}

system.runTimeout(() => {
	world.sendMessage("loaded my plugins!")
	console.log(`Loaded ${MY_PLUGINS.length} plugins`);
}, 20*5);