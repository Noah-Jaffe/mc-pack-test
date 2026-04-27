"use strict";
import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { mconsole as console } from "./debug.js"; 
// import custom command implementations here
import { AutoChunkGenerator } from "./AutoChunkGeneratorEvent.js";

const MY_PLUGINS = [
	AutoChunkGenerator
	// Add your custom script events above here as instances.
];

// on loading the script, call the events "register" function which is responsible for subscribing to the appropriate event
system.runTimeout(() => {
	world.sendMessage("loading...");
let loaded = 0;
for (let i = 0; i < MY_PLUGINS.length; ++i) {
	let event = MY_PLUGINS[i];
	try {
		if (typeof event == "function") {
			// MY_PLUGINS entry is a class type 
			console.log(`[${i}/${MY_PLUGINS.length}] attempting to initialize ${event.name}`)
			event = new event();
			console.log(`[${i}/${MY_PLUGINS.length}] initialized custom plug-in instance: ${event.constructor.name}`)
		} else {
			// MY_PLUGINS entry is an instance?
			console.log(`[${i}/${MY_PLUGINS.length}] custom plug-in already initalized: ${event?.constructor?.name}`)
		}
		console.log(`[${i}/${MY_PLUGINS.length}] calling register`)
		event.register();
		loaded++;
		console.log(`[${i}/${MY_PLUGINS.length}] custom plug-in registered: ${event.constructor.name}`)
		MY_PLUGINS[i] = event;
	} catch (err) {
		system.runTimeout(() => {
		console.log(`${ColorCodes.error}Error initalizing or registering event ${event.constructor.name}: ${err.name}`);
		console.error(err);
		}, 20*2);
	}
}

system.runTimeout(() => {
	world.sendMessage("loaded my plugins!")
	console.log(`Loaded ${loaded}/${MY_PLUGINS.length} plugins`);
}, 20*5);
}, 20*5);