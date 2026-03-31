import { system, world, Vector3 } from "@minecraft/server";
const scriptPrefix = `chunkGen`
const startJobId = `${scriptPrefix}:start`
const stopJobId = `${scriptPrefix}:stop`
const colorCodePrefix = {
  "black": "§0",
  "dark_blue": "§1",
  "dark_green": "§2",
  "dark_aqua": "§3",
  "dark_red": "§4",
  "dark_purple": "§5",
  "gold": "§6",
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
  "material_resin": "§v"
}
// Store current job + cancel state
const SCRIPT_STATE = {
    activeJob: null,
    cancelRequested: false
}
let activeJob = null;
let cancelRequested = false;

function resetJobState(scriptState) {
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
function* chunkGenerator(scriptState, startingLoc=null) {
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
            world.sendMessage(`${colorCodePrefix.info}dbg: ${scriptState.activeJob} ${scriptState.cancelRequested} ${i} ${system.currentTick}`)
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
    const baseX = round16(center.x);
    const baseZ = round16(center.z);

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
function round16(value) {
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
function startJob(scriptState, event) {
    if (activeJob) {
        world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is already running! to stop, run: ${colorCodePrefix.white}/scriptEvent ${stopJobId}`);
        return;
    }

    cancelRequested = false;
    const startingLoc = event?.sourceEntity?.location;
    const job = chunkGenerator(scriptState, startingLoc);
    system.runJob(job);

    world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} started.`);
}

/**
 * Stop the job safely
 */
function stopJob(event, scriptState) {
    if (scriptState.activeJob == null) {
        world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is not running! To start, run: ${colorCodePrefix.white}/scriptEvent ${startJobId}`);
        return;
    } else {
        try {
            system.clearJob(activeJob);
        } catch (e){
            console.error(e);
        }
    }

    // Signal the generator to stop
    scriptState.cancelRequested = true;
}

/**
 * Listen for script events
 */
system.afterEvents.scriptEventReceive.subscribe((event) => {
    const jobHandler = {
        [startJobId]: startJob,
        [stopJobId]: stopJob,
    }
    
    if (event.id in jobHandler) {
        world.sendMessage(`${colorCodePrefix.info}Attempting to start: ${colorCodePrefix.green}${event.id}`)
        try {
            jobHandler[event.id](SCRIPT_STATE, event);
        } catch (e) {
            world.sendMessage(`${colorCodePrefix.error}Error in: ${event.id}`);
            world.sendMessage(`${colorCodePrefix.error}${e}`);
            console.error(e);
        }
        world.sendMessage(`${colorCodePrefix.info}Started job: ${colorCodePrefix.green}${event.id}`)
    }
    
});