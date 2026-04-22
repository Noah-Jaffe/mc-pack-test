"use strict";
import { world, system } from "@minecraft/server";
import { mconsole as console } from "./debug.js";

/**
 * @class RepeatableEvent
 * Standard lifecycle from RepeatableEventManager:
 * 1. World is loaded, then RepeatableEvent.onRegister is called.
 * 2. Command is executed: `/scriptEvent <namespace>:start`, then the RepeatableEvent.onStart is called followed by the first RepeatableEvent.onTick
 * 3. RepeatableEvent.onTick is called every RepeatableEvent.interval ticks.
 * 4. Command is executed: `/scriptEvent <namespace>:stop`, then the RepeatableEvent.onStop is called. the following RepeatableEvent.onTick is expected to check 
export /*abstract*/ 
export /* abstract */ class RepeatableEvent {
	namespace = null;
	interval = 20;
	state = {};
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
  onTick()/*: void */{
    // default no-op
    console.log(`Called doTick`);
  }
}