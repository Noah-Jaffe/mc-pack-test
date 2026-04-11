import { system, world } from "@minecraft/server";
import { ColorCodes } from "./ColorCodes.js";
import { debugPrefix, debugStringify, } from "./debug.js";
import { ScriptState } from "./ScriptState.js";
import { RepeatableEvent } from "./RepeatableEvent.js";

export class ChunkLoaderEvent extends RepeatableEvent {
  /**
   * Called when the event starts.
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static onStart(event/*:Event*/, scriptState/*: ScriptState*/): void {
    
  }

  /**
   * Called to check if event should run
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static conditionCheck(event/*:Event*/, scriptState/*: ScriptState*/): boolean {
  	world.sendMessage(`${debugPrefix()}Called ${arguments.callee.toString().replaceAll(/(?:[\s\S\r\n]*?function[\W\s]*)(.*?)(?:[\s\W][\s\S\r\n]*)/gmi, "$1")}`);
    return true;
  }

  /**
   * Called when stopping the event
   * @param {Event} event - source event that Called the /scriptEvent command
   * @param {ScriptState} scriptState - the ScriptState of the active event
   */
  static onStop(event/*:Event*/, scriptState/*: ScriptState*/): void {
    world.sendMessage(`${debugPrefix()}${ColorCodes.info}Last step:${ColorCodes.green}${scriptState.step}\n${ColorCodes.info}Last coords:${ColorCodes.green}${JSON.stringify(scriptState.lastCoords)}\n${ColorCodes.info}Last exe tick:${ColorCodes.green}${scriptState.lastTick}`);
		scriptState.cancelRequested = null;
		scriptState.id = null;
  }
  
  static doTick(scriptState) {
  	const myActivity = getChunkAtStep(scriptState?.root?.x ?? 0, scriptState?.root?.z ?? 0, scriptState.step);
  	// save persistent successful state
  	scriptState.lastTick = system.currentTick;
  	scriptState.lastCoords = myActivity;
  	scriptState.step = (scriptState.step ?? 0) + 1;
  	world.sendMessage(`${debugPrefix()}Completed doTick`);
  	return myActivity;
  }
}