"use strict";
import { world } from "@minecraft/server";
import { debugPrefix } from "./debug.js";

export /*abstract*/ class RepeatableEvent {
	
  /**
   * Called when the event starts.
   * Default: does nothing.
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static onStart(event/*:Event*/, scriptState/*: ScriptState*/): void {
    // default no-op
    world.sendMessage(`${debugPrefix()}Called onStart`);
  }

  /**
   * Called to check if event should run
   * Default: always returns true.
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static conditionCheck(event/*:Event*/, scriptState/*: ScriptState*/): boolean {
  	world.sendMessage(`${debugPrefix()}Called conditionCheck`);
    return true;
  }

  /**
   * Called when stopping the event
   * @note: should reset non-persistant values if needed
   * Default: does nothing.
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static onStop(event/*:Event*/, scriptState/*: ScriptState*/): void {
    // default no-op
    world.sendMessage(`${debugPrefix()}Called onStop`);
  }
  
  /**
   * Called each time the script is activated (after onStart (once) and conditionCheck returned true)
   * Default: does nothing.
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static doTick(scriptState/*: ScriptState*/): void {
    // default no-op
    world.sendMessage(`${debugPrefix()}Called doTick`);
  }
}
