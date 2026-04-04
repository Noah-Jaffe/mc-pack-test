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
	debug: true,
	root: null,
	step: null,
	
}

const chunkSize = 16;

function resetJobState(scriptState) {
	// 	scriptState.lastCalled="resetJobState"
	scriptState.activeJob = null;
	scriptState.cancelRequested = false;
	try {
		world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} stopped successfully!`)
	} catch (e) {
		console.error(e);
	}
}

/**
* Example generator job
* This simulates chunk generation work over time
*/
function* chunkGenerator(scriptState, startingLoc=null, event=null) {
	let lastActivityTick = -1;
	if (!startingLoc) {
		startingLoc = scriptState.root ?? {x:0,z:0};
	}
	scriptState.root = {x:parseFloat((startingLoc.x).toFixed(2)), z: parseFloat((startingLoc.z).toFixed(2))};
	world.sendMessage(`${colorCodePrefix.green}starting @ ${JSON.stringify(scriptState.root)}`)
	world.sendMessage(`${colorCodePrefix.info}dbg: ${scriptState.activeJob} ${scriptState.cancelRequested}`)
	try {
		let n = parseInt(scriptState.step) || 0;
		let chunkToLoad = walkChunkTaxicab(scriptState);
		world.sendMessage(`${colorCodePrefix.debug}starting step: ${n}\nchunkToLoad truthy ${chunkToLoad?true:false}`)
		while(!scriptState.cancelRequested && chunkToLoad) {
			let currentTick = system.currentTick;
			if (scriptState.debug) {
				popupDisplay(event, scriptState, `tick: ${system.currentTick}\tlastTick: ${lastActivityTick}\nchunkToLoad: ${JSON.stringify(chunkToLoad.value)}`)
			}
			// Simulated work (replace with real logic)
			if (currentTick - lastActivityTick >= 60) {
				chunkToLoad = chunkToLoad.next();
				n++;
				world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.green}#${n} ${colorCodePrefix.gold}@ ${currentTick}`);
				// do action here
				lastActivityTick = currentTick;
			}
			// Yield so the game doesn't freeze
			yield;
		}
		if (scriptState.cancelRequested) {
			scriptState.step = n;
			world.sendMessage(`${colorCodePrefix.warning}: abort flag recognized!`);
			return resetJobState(scriptState);
		}
		
	} catch (e) {
		world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.error}Error occured during runtime!`);
		world.sendMessage(`${colorCodePrefix.error}${e}`);
		console.error(e);
	}
	world.sendMessage(`${colorCodePrefix.blue} ?????`)
	return resetJobState(scriptState);
}

// @note: infinite generator
function* walkChunkTaxicab(scriptState) {
	//  // scriptState.lastCalled="walkChunkTaxicab";
	const center = scriptState.root;
	
	const baseX = roundForChunkEdge(center.x);
	const baseZ = roundForChunkEdge(center.z);
	
	// Always yield center first
	let step = { x: baseX, z: baseZ };
	yield step;
	let r = (scriptState.step ?? 0 )|| 0;
	while (!scriptState.cancelRequested) {
		r++;
		let x = 0;
		let z = -r;
		
		// 4 sides of the diamond (clockwise)
		
		// Top-right edge
		while (x < r && z < 0) {
			step = {
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			};
			/*world.sendMessage(`${JSON.stringify(step)}`); */yield step;
			x++;
			z++;
		}
		
		// Bottom-right edge
		while (x > 0 && z < r) {
			step = {
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			};
			/*world.sendMessage(`${JSON.stringify(step)}`); */yield step;
			x--;
			z++;
		}
		
		// Bottom-left edge
		while (x > -r && z > 0) {
			step  = {
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			}
			/*world.sendMessage(`${JSON.stringify(step)}`); */yield step; 
			x--;
			z--;
		}
		
		// Top-left edge
		while (x < 0 && z > -r) {
			step ={
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			};
			/*world.sendMessage(`${JSON.stringify(step)}`); */yield step;
			x++;
			z--;
		}
	}
	world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} stopping walker  ${stopJobId}`);
}


function roundForChunkEdge(value) {
	//   // scriptState.lastCalled="roundForChunkEdge"
	if (value >= 0) {
		return value - (value % chunkSize);
	}
	else {
		return value - (((value % chunkSize) + chunkSize) % chunkSize);
	}
}

/**
* Start the job safely
*/
function startJob(event, scriptState) {
	//   scriptState.lastCalled="startJob";
	
	if (scriptState.activeJob) {
		world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is already running! to stop, run: ${colorCodePrefix.white}/scriptEvent ${stopJobId}`);
		return;
	}
	
	scriptState.cancelRequested = false;
	const startingLoc = event?.sourceEntity?.location;
	scriptState.root = {x:startingLoc.x, z: startingLoc.z};
	scriptState.step = 0;
	const job = chunkGenerator(scriptState, startingLoc, event);
	scriptState.activeJob = system.runJob(job);
	
	world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} started id: ${scriptState.activeJob}`);
}

/**
* Stop the job safely
*/
function stopJob(event, scriptState) {
	//   scriptState.lastCalled="stopJob";
	
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
	// 	scriptState.lastCalled="debugJob"
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
function recognizeMyEvents(event) {
	
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
	
}


function test(){
	// debug walker code
	n=1000
	radius = Math.ceil(Math.sqrt(n));
	size = radius * 2 + 1;
	arr = new Array(size)
	.fill(null)
	.map(() => new Array(size).fill(null));
	scriptState = SCRIPT_STATE 
	scriptState.root = {x:n/12 ,z:n/12};
	scriptState.step = 0;
	a=walkChunkTaxicab(scriptState)
	offset = Math.ceil(Math.ceil(radius) / 2) +2;
	
	console.log(scriptState, arr)
	for (let i=0; i<n; ++i) { 
		b=a.next();
		// console.log(i, b.value.x,b.value.z)
		const gridX = Math.floor(b.value.x / chunkSize) + offset;
		const gridZ = Math.floor(b.value.z / chunkSize) + offset;
		
		if (arr[gridX] && arr[gridX][gridZ] !== undefined) {
			arr[gridX][gridZ] = i;
		} else {
			console.warn(i, gridX, gridZ, b.value.x, b.value.z)
		}
	}
	console.log(arr.map(r=>r.join("\t")).join("\n"))
}


const jobHandler = {
	[startJobId]: startJob,
	[stopJobId]: stopJob,
	[debugJobId]: debugJob,
};


if (typeof system == "undefined") {
	test()
} else {
	
	system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);
	world.sendMessage(Object.keys(jobHandler).map(k=> `/scriptevent ${k}`).join("\n") ?? "loaded!")
}
