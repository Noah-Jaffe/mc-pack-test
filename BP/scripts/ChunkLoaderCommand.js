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

export function roundForChunkEdge(value) {
	if (value >= 0) {
		return value - (value % chunkSize);
	}
	else {
		return value - (((value % chunkSize) + chunkSize) % chunkSize);
	}
}

export function getChunkAtStep(raw_x, raw_z, stepIndex) {
	const baseX = roundForChunkEdge(raw_x);
	const baseZ = roundForChunkEdge(raw_z);
	
	// Step 0 = center
	if (stepIndex === 0) {
		let ret = { x: baseX, z: baseZ };
		//debugPrint(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
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
	//debugPrint(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}