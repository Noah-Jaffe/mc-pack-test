import { system, world, Vector3 } from "@minecraft/server";

const scriptPrefix = `chunkGen`;
const startJobId = `${scriptPrefix}:start`;
const stopJobId = `${scriptPrefix}:stop`;
const debugJobId = `${scriptPrefix}:dbg`;
const INTERVAL_BETWEEN_ACTIONS = 60;
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
	debug: false,
	root: null,
	step: null,
	generator: null, 
}

const chunkSize = 16;

function chunkGeneratorInterval(scriptState) {
	world.sendMessage(`${colorCodePrefix.info}>${scriptPrefix}: #${scriptState?.step} @T ${system.currentTick}`);
	if (scriptState.cancelRequested) {
		world.sendMessage(`${colorCodePrefix.warning}: abort flag recognized!`);
		return resetJobState(scriptState);
	}
	world.sendMessage("0")
	scriptState.root = {
		x:parseFloat((parseFloat(scriptState?.root?.x)||0).toFixed(2)), 
		z:parseFloat((parseFloat(scriptState?.root?.z)||0).toFixed(2)),
	};
	scriptState.step = parseInt(scriptState?.step) || 0;
	world.sendMessage("1")
	if (scriptState.debug) {
		popupDisplay(null, scriptState, `tick: ${system.currentTick}`)
	}
	world.sendMessage("2")
	// action per tick here
	const chunk = getChunkAtStep(scriptState.root.x, scriptState.root.z, scriptState.step);
	world.sendMessage(JSON.stringify (chunk))
	scriptState.step++;
	// @todo: do something with chunk coords here
	
	// Yield so the game doesn't freeze
	scriptState.activeJob = system.runTimeout(()=>{
		 chunkGeneratorInterval(scriptState);
	}, INTERVAL_BETWEEN_ACTIONS);
	world.sendMessage(`${colorCodePrefix.info}R ${scriptPrefix} #${scriptState.step-1} @T ${system.currentTick}=${JSON.stringify(chunk)}\n${colorCodePrefix.info}Q ${scriptPrefix} #${scriptState.step} @T ${system.currentTick + INTERVAL_BETWEEN_ACTIONS} (+${(INTERVAL_BETWEEN_ACTIONS/20).toFixed(2).replace(/\.00$|0$/gmi, "")}s)`);
}

function getChunkAtStep(raw_x, raw_z, stepIndex) {
	const baseX = roundForChunkEdge(raw_x);
	const baseZ = roundForChunkEdge(raw_z);
	
	// Step 0 = center
	if (stepIndex === 0) {
		let ret = { x: baseX, z: baseZ };
		world.sendMessage(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
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
	
	ret = {
		x: baseX + x * chunkSize,
		z: baseZ + z * chunkSize,
	};
	world.sendMessage(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}
function test_getChunkAtStep() {
	const expected2d = [
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,79,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,80,56,78,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,81,57,37,55,77,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,82,58,38,22,36,54,76,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,83,59,39,23,11,21,35,53,75,null,null,null,null,null,null,null,null,null],
		[null,null,84,60,40,24,12,4,10,20,34,52,74,null,null,null,null,null,null,null,null],
		[85,61,41,25,13,5,1,0,3,9,19,33,51,73,99,null,null,null,null,null,null],
		[null,86,62,42,26,14,6,2,8,18,32,50,72,98,null,null,null,null,null,null,null],
		[null,null,87,63,43,27,15,7,17,31,49,71,97,null,null,null,null,null,null,null,null],
		[null,null,null,88,64,44,28,16,30,48,70,96,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,89,65,45,29,47,69,95,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,90,66,46,68,94,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,91,67,93,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,92,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null],
		[null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]
		];
		const expectedStep = {
			"0":{"x":0,"z":0},"1":{"x":0,"z":-16},"2":{"x":16,"z":0},"3":{"x":0,"z":16},"4":{"x":-16,"z":0},"5":{"x":0,"z":-32},"6":{"x":16,"z":-16},"7":{"x":32,"z":0},"8":{"x":16,"z":16},"9":{"x":0,"z":32},"10":{"x":-16,"z":16},"11":{"x":-32,"z":0},"12":{"x":-16,"z":-16},"13":{"x":0,"z":-48},"14":{"x":16,"z":-32},"15":{"x":32,"z":-16},"16":{"x":48,"z":0},"17":{"x":32,"z":16},"18":{"x":16,"z":32},"19":{"x":0,"z":48},"20":{"x":-16,"z":32},"21":{"x":-32,"z":16},"22":{"x":-48,"z":0},"23":{"x":-32,"z":-16},"24":{"x":-16,"z":-32},"25":{"x":0,"z":-64},"26":{"x":16,"z":-48},"27":{"x":32,"z":-32},"28":{"x":48,"z":-16},"29":{"x":64,"z":0},"30":{"x":48,"z":16},"31":{"x":32,"z":32},"32":{"x":16,"z":48},"33":{"x":0,"z":64},"34":{"x":-16,"z":48},"35":{"x":-32,"z":32},"36":{"x":-48,"z":16},"37":{"x":-64,"z":0},"38":{"x":-48,"z":-16},"39":{"x":-32,"z":-32},"40":{"x":-16,"z":-48},"41":{"x":0,"z":-80},"42":{"x":16,"z":-64},"43":{"x":32,"z":-48},"44":{"x":48,"z":-32},"45":{"x":64,"z":-16},"46":{"x":80,"z":0},"47":{"x":64,"z":16},"48":{"x":48,"z":32},"49":{"x":32,"z":48},"50":{"x":16,"z":64},"51":{"x":0,"z":80},"52":{"x":-16,"z":64},"53":{"x":-32,"z":48},"54":{"x":-48,"z":32},"55":{"x":-64,"z":16},"56":{"x":-80,"z":0},"57":{"x":-64,"z":-16},"58":{"x":-48,"z":-32},"59":{"x":-32,"z":-48},"60":{"x":-16,"z":-64},"61":{"x":0,"z":-96},"62":{"x":16,"z":-80},"63":{"x":32,"z":-64},"64":{"x":48,"z":-48},"65":{"x":64,"z":-32},"66":{"x":80,"z":-16},"67":{"x":96,"z":0},"68":{"x":80,"z":16},"69":{"x":64,"z":32},"70":{"x":48,"z":48},"71":{"x":32,"z":64},"72":{"x":16,"z":80},"73":{"x":0,"z":96},"74":{"x":-16,"z":80},"75":{"x":-32,"z":64},"76":{"x":-48,"z":48},"77":{"x":-64,"z":32},"78":{"x":-80,"z":16},"79":{"x":-96,"z":0},"80":{"x":-80,"z":-16},"81":{"x":-64,"z":-32},"82":{"x":-48,"z":-48},"83":{"x":-32,"z":-64},"84":{"x":-16,"z":-80},"85":{"x":0,"z":-112},"86":{"x":16,"z":-96},"87":{"x":32,"z":-80},"88":{"x":48,"z":-64},"89":{"x":64,"z":-48},"90":{"x":80,"z":-32},"91":{"x":96,"z":-16},"92":{"x":112,"z":0},"93":{"x":96,"z":16},"94":{"x":80,"z":32},"95":{"x":64,"z":48},"96":{"x":48,"z":64},"97":{"x":32,"z":80},"98":{"x":16,"z":96},"99":{"x":0,"z":112}
		};
		const actual = Object.entries(expectedStep).reduce((acc, [k,v]) => {acc[k]=getChunkAtStep(0, 0, parseInt(k)); if (JSON.stringify(acc[k])!=JSON.stringify(v)){console.log(k, acc[k], v)} return acc;}, {})
}

/**
 * @dependancy global const `chunkSize`!
 * @param value {x: number, z:number} the x z coords to be rounded to the nearest chunk edge
 * @returns {x: number, z:number} 
 */
function roundForChunkEdge(value) {
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
	if (scriptState.activeJob) {
		world.sendMessage(`${colorCodePrefix.error}${scriptPrefix} is already running! to stop, run: ${colorCodePrefix.white}/scriptEvent ${stopJobId}`);
		return;
	}
	
	scriptState.cancelRequested = false;
	const startingLoc = event?.sourceEntity?.location;
	scriptState.root = {x:startingLoc.x, z: startingLoc.z};
	scriptState.step = 0;
	scriptState.activeJob = system.runTimeout(()=>{
		 chunkGeneratorInterval(scriptState);
	}, 1);
	
	world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} started id: ${scriptState.activeJob}`);
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
			system.clearJob(scriptState.activeJob);
		} catch (e){
			console.error(e);
			world.sendMessage(`Error trying to stop:\n${e}`)
		}
	}
	
	// Signal the generator to stop
	scriptState.cancelRequested = true;
}

function debugJob(event, scriptState) {
	scriptState.debug = !scriptState.debug;
	world.sendMessage(`${colorCodePrefix.info}Set debug mode to: ${scriptState.debug ? colorCodePrefix.green : colorCodePrefix.red}${scriptState.debug}`)
}

function resetJobState(scriptState) {
	scriptState.activeJob = null;
	scriptState.cancelRequested = false;
	try {
		world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} reset!!`)
	} catch (e) {
		console.error(e);
		world.sendMessage(`Error trying to reset:\n${e}`)
	}
}

function popupDisplay(event, scriptState) {
	const lines = [];
	try {
		lines.push(`${colorCodePrefix.blue}EVENT:`)
		let js = JSON.debugStringify(event);
		js.replaceAll(/^{\n|\n}$/gmi,"").split('\n').forEach(e=> lines.push(`${colorCodePrefix.debug}${e}`));
	} catch {
		lines.push(`${colorCodePrefix.error}Failed to format event data`)
	}
	
	try {
		lines.push(`${colorCodePrefix.blue}SCRIPTSTATE:`)
		let js = JSON.debugSringify(scriptState)
		js.replaceAll(/^{\n|\n}$/gmi,"").split('\n').forEach(e=> lines.push(`${colorCodePrefix.debug}${e}`));
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

JSON.debugStringify = (node) => {
	let root = true;
	return JSON.stringify(node, (key, value) => {
		if (root && typeof(value) == "object") {
			root = false;
			var replacement = {};
			for (var k in value) {
				if (Object.hasOwnProperty.call(value, k)) {
					replacement[`${colorCodePrefix.yellow}${k}${colorCodePrefix.reset}`] = value[k];
				}
			}
			return replacement;
		}
		root = false;
		switch (typeof (value)) {
			case "number":
				return parseFloat(value.toFixed(2));
			case "function":
				return value.toString();
		}
		return value;
	}, 0.1)
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


const jobHandler = {
	[startJobId]: startJob,
	[stopJobId]: stopJob,
	[debugJobId]: debugJob,
};


system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);