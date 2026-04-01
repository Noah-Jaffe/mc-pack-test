import { system, world, Vector3 } from "@minecraft/server";
const scriptPrefix = `chunkGen`
const startJobId = `${scriptPrefix}:start`
const stopJobId = `${scriptPrefix}:stop`
const debugJobId = `${scriptPrefix}:dbg`
const colorCodePrefix = {
  "black": "§0",
  "dark_blue": "§1",
  "dark_green": "§2",
  "dark_aqua": "§3",
  "dark_red": "§4",
  "dark_purple": "§5",
  "gold": "§6",
  "debug": "§6",
  "gray": "§7",
  "dark_gray": "§8",
  "blue": "§9",
  "green": "§a",
  "aqua": "§b",
  "red": "§c",
  "error": "§c",
  "light_purple": "§d",
  "yellow": "§e",
  "warning": "§e",
  "white": "§f",
  "info": "§f",
  "minecoin_gold": "§g",
  "material_quartz": "§h",
  "material_iron": "§i",
  "material_netherite": "§j",
  "material_redstone": "§m",
  "material_copper": "§n",
  "material_gold": "§p",
  "material_emerald": "§q",
  "material_diamond": "§s",
  "material_lapis": "§t",
  "material_amethyst": "§u",
  "material_resin": "§v",
  "reset": "§r",
  "obfuscate": "§k",
  "bold": "§l",
  "italic": "§o",
  
}
// Store current job + cancel state
const SCRIPT_STATE = {
    activeJob: null,
    cancelRequested: false,
    debug: false
}

function resetJobState(scriptState) {
	scriptState.lastCalled="resetJobState"
    scriptState.activeJob = null;
    scriptState.cancelRequested = false;
    try {
        world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} stopped successfully!`)
    } catch {
        console.error(e);
    }
}

/**
 * Example generator job
 * This simulates chunk generation work over time
 */
function* chunkGenerator(scriptState, startingLoc=null, event=null) {
  scriptState.lastCalled="chunkGenerator";

    // let failsafe = (() => {const abortTick = system.currentTick + 1200; return () => {return system.currentTick < abortTick} })();
    let i = 0;
    let lastActivityTick = system.currentTick;
    if (!startingLoc) {
        startingLoc = new Vector3(0,128,0);
    }
    world.sendMessage(`${colorCodePrefix.green}@ ${startingLoc.x} ${startingLoc.z}`)
    world.sendMessage(`${colorCodePrefix.info}dbg: ${scriptState.activeJob} ${scriptState.cancelRequested}`)

    try {
        while (i < 10) {
        	if (scriptState.debug) { popupDisplay(event, scriptState, `tick: ${system.currentTick}\tlastTick: ${lastActivityTick}`)  }
          //  world.sendMessage(`${colorCodePrefix.info}dbg: ${scriptState.activeJob} ${scriptState.cancelRequested} ${i} ${system.currentTick}`)
        // for (const chunkToLoad of walkChunkTaxicab(scriptState)) {
            // Check cancel flag every iteration
            if (scriptState.cancelRequested) {
                world.sendMessage(`${colorCodePrefix.warning}: abort flag recognized!`);
                return resetJobState();
            }
            let currentTick = system.currentTick;
            // Simulated work (replace with real logic)
            if (currentTick - lastActivityTick >= 60) {
                world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.green}#${i} ${colorCodePrefix.gold}@ ${currentTick}`);
                i++;
                lastActivityTick = currentTick;
            }
            // Yield so the game doesn't freeze
            yield;
        }
    } catch (e) {
        world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.error}Error occured during runtime!`);
        world.sendMessage(`${colorCodePrefix.error}${e}`);
        console.error(e);
    }
    world.sendMessage(`${colorCodePrefix.blue} ?????`)
    return resetJobState();
}

// @note: infinite generator
function* walkChunkTaxicab(center) {
  scriptState.lastCalled="walkChunkTaxicab";

    const baseX = roundForChunkEdge(center.x);
    const baseZ = roundForChunkEdge(center.z);

    // Always yield center first
    yield { x: baseX, z: baseZ };
    let r = 1;
    while (true) {
        let x = 0;
        let z = -r;

        // 4 sides of the diamond (clockwise)

        // Top-right edge
        while (x < r && z < 0) {
            yield {
                x: baseX + x * 16,
                z: baseZ + z * 16,
            };
            x++;
            z++;
        }

        // Bottom-right edge
        while (x > 0 && z < r) {
            yield {
                x: baseX + x * 16,
                z: baseZ + z * 16,
            };
            x--;
            z++;
        }

        // Bottom-left edge
        while (x > -r && z > 0) {
            yield {
                x: baseX + x * 16,
                z: baseZ + z * 16,
            };
            x--;
            z--;
        }

        // Top-left edge
        while (x < 0 && z > -r) {
            yield {
                x: baseX + x * 16,
                z: baseZ + z * 16,
            };
            x++;
            z--;
        }
    }
}


function roundForChunkEdge(value) {
  scriptState.lastCalled="roundForChunkEdge"
  const chunkSize = 15;

    if (value >= 0) {
        return value - (value % 16);
    }
    else {
        return value - (((value % 16) + 16) % 16);
    }
}

/**
 * Start the job safely
 */
function startJob(event, scriptState) {
  scriptState.lastCalled="startJob";

    if (scriptState.activeJob) {
        world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is already running! to stop, run: ${colorCodePrefix.white}/scriptEvent ${stopJobId}`);
        return;
    }

    scriptState.cancelRequested = false;
    const startingLoc = event?.sourceEntity?.location;
    const job = chunkGenerator(scriptState, startingLoc, event);
    scriptState.activeJob = system.runJob(job);

    world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} started id: ${scriptState.activeJob}`);
}

/**
 * Stop the job safely
 */
function stopJob(event, scriptState) {
  scriptState.lastCalled="stopJob";

    if (scriptState.activeJob == null) {
        world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is not running! To start, run: ${colorCodePrefix.white}/scriptEvent ${startJobId}`);
        return;
    } else {
        try {
            system.clearJob(scriptState.activeJob);
        } catch (e){
            console.error(e);
        }
    }

    // Signal the generator to stop
    scriptState.cancelRequested = true;
}

function debugJob(event, scriptState) {
	scriptState.lastCalled="debugJob"
  scriptState.debug = !scriptState.debug;
  world.sendMessage(`${colorCodePrefix.info}Set debug mdoe to: ${scriptState.debug ? colorCodePrefix.green : colorCodePrefix.red}${scriptState.debug}`)
}

function popupDisplay(event, scriptState) {
	const lines = [];
	try {
		lines.push(`${colorCodePrefix.blue}EVENT:`)
		let js = JSON.stringify(event, null, 0)
		js.split('\n').forEach(e=> lines.push(`${colorCodePrefix.debug}${e}`));
	} catch {
		lines.push(`${colorCodePrefix.error}Failed to format event data`)
	}
	
	try {
		lines.push(`${colorCodePrefix.blue}SCRIPTSTATE:`)
		let js = JSON.stringify(SCRIPT_STATE, null, 0)
		js.split('\n').forEach(e=> lines.push(`${colorCodePrefix.debug}${e}`));
	} catch {
		lines.push(`${colorCodePrefix.error}Failed to format scriptState data`)
	}
	for (let a = 2; a < arguments.length; ++a) {
		try {
			let js;
			if (typeof a == "object") {
			js = JSON.stringify(arguments[a], null, 0)
			} else {
				js = arguments[a].toString()
			}
			js.split('\n').forEach(e=> lines.push(`${colorCodePrefix.debug}${e}`));
		} catch {
			lines.push(`${colorCodePrefix.error}Failed to format input arg[${a}`)
		}
	}
	event.sourceEntity?.onScreenDisplay?.setActionBar(lines.filter(e=>e.toString().trim()).join("\n§r"));
}

/**
 * Listen for script events
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
    const jobHandler = {
        [startJobId]: startJob,
        [stopJobId]: stopJob,
        [debugJobId]: debugJob,
    }
    
    if (event.id in jobHandler) {
        world.sendMessage(`${colorCodePrefix.info}Attempting to start: ${colorCodePrefix.green}${event.id}`)
        try {
            jobHandler[event.id](event, SCRIPT_STATE);
        } catch (e) {
            world.sendMessage(`${colorCodePrefix.error}Error in: ${event.id}`);
            world.sendMessage(`${colorCodePrefix.error}${e}`);
            console.error(e);
        }
        world.sendMessage(`${colorCodePrefix.info}spawned job: ${colorCodePrefix.blue}${event.id}`)
    }
    
});
