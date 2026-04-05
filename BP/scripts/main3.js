// import { system, world, Vector3 } from "@minecraft/server";

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

function* chunkGeneratorInterval(scriptState, startingLoc=null, event=null) {
	if (!startingLoc) {
		startingLoc = scriptState.root ?? {x:0,z:0};
	}
	scriptState.root = {
		x:parseFloat((startingLoc.x).toFixed(2)), 
		z: parseFloat((startingLoc.z).toFixed(2)),
	};
	scriptState.step = parseInt(scriptState.step ?? 0) || 0;
	scriptState.generator = walkChunkTaxicab(scriptState);
	try {
		world.sendMessage(`${colorCodePrefix.debug}starting root @ ${colorCodePrefix.green}${JSON.stringify(scriptState.root)}\n${colorCodePrefix.reset}starting step: ${colorCodePrefix.green}${scriptState.step}${colorCodePrefix.reset}`)
		while(!chunkToLoad.done && !scriptState.cancelRequested) {
			let currentTick = system.currentTick;
			if (scriptState.debug) {
				popupDisplay(event, scriptState, `tick: ${system.currentTick}\tlastTick: ${lastActivityTick}\nn: ${scriptState.step}`)
			}
			// action per tick here
			if (currentTick - lastActivityTick >= INTERVAL_BETWEEN_ACTIONS) {
				const chunk = chunkToLoad.next();
				scriptState.step++;
				world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.green}action #${scriptState.step} ${colorCodePrefix.gold}@ tick ${currentTick}》${JSON.stringify(chunk.value)}`);
				// do action here
				lastActivityTick = currentTick;
			}
			// Yield so the game doesn't freeze
			yield;
		}
		if (scriptState.cancelRequested) {
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


function getChunkAtStep(scriptState, stepIndex) {
    const center = scriptState.root;
    const baseX = roundForChunkEdge(center.x);
    const baseZ = roundForChunkEdge(center.z);

    // Step 0 = center
    if (stepIndex === 0) {
        return { x: baseX, z: baseZ };
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

    return {
        x: baseX + x * chunkSize,
        z: baseZ + z * chunkSize,
    };
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
	const actual = Object.entries(expectedStep).reduce((acc, [k,v]) => {acc[k]=getChunkAtStep({
	activeJob: 1,
	cancelRequested: false,
	debug: false,
	root: {x:0, z:0},
}, parseInt(k)); if (JSON.stringify(acc[k])!=JSON.stringify(v)){console.log(k, acc[k], v)} return acc;}, {})
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
	try {
		scriptState.step = parseInt(scriptState.step) || 0;
		let chunkToLoad = walkChunkTaxicab(scriptState);
		for (let i=0;i<scriptState.step; ++i) {
			chunkToLoad.next();
		}
		world.sendMessage(`${colorCodePrefix.debug}starting root @ ${colorCodePrefix.green}${JSON.stringify(scriptState.root)}\n${colorCodePrefix.reset}starting step: ${colorCodePrefix.green}${scriptState.step}${colorCodePrefix.reset}`)
		while(!chunkToLoad.done && !scriptState.cancelRequested) {
			let currentTick = system.currentTick;
			if (scriptState.debug) {
				popupDisplay(event, scriptState, `tick: ${system.currentTick}\tlastTick: ${lastActivityTick}\nn: ${scriptState.step}`)
			}
			// action per tick here
			if (currentTick - lastActivityTick >= INTERVAL_BETWEEN_ACTIONS) {
				const chunk = chunkToLoad.next();
				scriptState.step++;
				world.sendMessage(`${colorCodePrefix.yellow}${scriptPrefix} ${colorCodePrefix.green}action #${scriptState.step} ${colorCodePrefix.gold}@ tick ${currentTick}》${JSON.stringify(chunk.value)}`);
				// do action here
				lastActivityTick = currentTick;
			}
			// Yield so the game doesn't freeze
			yield;
		}
		if (scriptState.cancelRequested) {
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
	const center = scriptState.root;
	const baseX = roundForChunkEdge(center.x);
	const baseZ = roundForChunkEdge(center.z);
	
	// Always yield center first
	let step = { x: baseX, z: baseZ };
	// world.sendMessage(`0 ${JSON.stringify(step)}`); 
	yield step;
	let r = 0;
	while (true){
		//!scriptState.cancelRequested) {
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
			//	world.sendMessage(`1 ${JSON.stringify(step)}`);
			yield step;
			x++;
			z++;
		}
		
		// Bottom-right edge
		while (x > 0 && z < r) {
			step = {
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			};
			// world.sendMessage(`2 ${JSON.stringify(step)}`);
			yield step;
			x--;
			z++;
		}
		
		// Bottom-left edge
		while (x > -r && z > 0) {
			step  = {
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			}
			// world.sendMessage(`3 ${JSON.stringify(step)}`); 
			yield step; 
			x--;
			z--;
		}
		
		// Top-left edge
		while (x < 0 && z > -r) {
			step ={
				x: baseX + x * chunkSize,
				z: baseZ + z * chunkSize,
			};
			// world.sendMessage(`4 ${JSON.stringify(step)}`); 
			yield step;
			x++;
			z--;
		}
	}
	world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} stopping walker  ${stopJobId}`);
	return null;
}

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
	const job = chunkGenerator(scriptState, startingLoc, event);
	scriptState.activeJob = system.runJob(job);
	
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
		world.sendMessage(`${colorCodePrefix.warning}${scriptPrefix} stopped successfully!`)
	} catch (e) {
		console.error(e);
	}
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
	n=100
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
	k={};
	console.log(scriptState, arr)
	for (let i=0; i<n; ++i) { 
		b=a.next();
		// console.log(i, b.value.x,b.value.z)
		const gridX = Math.floor(b.value.x / chunkSize) + offset;
		const gridZ = Math.floor(b.value.z / chunkSize) + offset;
		k[i]={x:b.value.x, z:b.value.z};
		if (arr[gridX] && arr[gridX][gridZ] !== undefined) {
			arr[gridX][gridZ] = i;
		} else {
			console.warn(i, gridX, gridZ, b.value.x, b.value.z)
		}
	}
	ret=arr.map(r=>r.join("\t")).join("\n")
	ret = ret.replaceAll(/^\t*\n|\n*\t*$/gmi, "")
	console.log (ret)
	return JSON.stringify (k)
}

function test2(){
	// debug walker code
	n=100
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
	k={};
	console.log(scriptState, arr)
	for (let i=0; i<n; ++i) { 
		b={value:getChunkAtStep(scriptState, i )}
		// console.log(i, b.value.x,b.value.z)
		const gridX = Math.floor(b.value.x / chunkSize) + offset;
		const gridZ = Math.floor(b.value.z / chunkSize) + offset;
		k[i]={x:b.value.x, z:b.value.z};
		if (arr[gridX] && arr[gridX][gridZ] !== undefined) {
			arr[gridX][gridZ] = i;
		} else {
			console.warn(i, gridX, gridZ, b.value.x, b.value.z)
		}
	}
	ret=arr.map(r=>r.join("\t")).join("\n")
	ret = ret.replaceAll(/^\t*\n|\n*\t*$/gmi, "")
	console.log (ret)
	return JSON.stringify (k)
}

// ===== MOCK RUNTIME =====
function createMockMinecraft() {
	let currentTick = 0;
	let nextJobId = 1;
	const jobs = new Map();
	
	const system = {
		get currentTick() {
			return currentTick;
		},
		
		runJob(gen) {
			const id = nextJobId++;
			jobs.set(id, gen);
			return id;
		},
		
		clearJob(id) {
			jobs.delete(id);
		},
		
		afterEvents: {
			scriptEventReceive: {
				subscribed: [], 
				subscribe: (cb)=>{
					this.system.afterEvents.scriptEventReceive.subscribed.push(cb);
				}
			}
		}
	};
	
	const world = {
		sendMessage(msg) {
			const stack = new Error("just for stack trace");
			msg = msg.replaceAll(new RegExp(Object.values(colorCodePrefix).join("|"), "gmi"), "")
			console.trace(`[MSG @${currentTick}]`, msg, stack);
		}
	};
	
	function tick(n = 1) {
		for (let i = 0; i < n; i++) {
			currentTick++;
			
			for (const [id, job] of [...jobs]) {
				const res = job.next();
				if (res.done) {
					jobs.delete(id);
				}
			}
		}
	}
	
	function fireScriptEvent(id, sourceEntity = null) {
		for (const scriptEventCallback of system.afterEvents.scriptEventReceive.subscribed) {
			
			scriptEventCallback({
				id,
				sourceEntity: sourceEntity ?? {
					location: { x: 0, y: 0, z: 0 },
					onScreenDisplay: {
						setActionBar: (msg) => {
							const stack = new Error("just for stack trace");
							msg = msg.replaceAll(new RegExp(Object.values(colorCodePrefix).join("|"), "gmi"), "")
							console.trace(`[ACTIONBAR @${currentTick}]`, msg, stack);
						}
					}
				}
			});
		}
	}
	
	return { system, world, tick, fireScriptEvent };
}

const jobHandler = {
	[startJobId]: startJob,
	[stopJobId]: stopJob,
	[debugJobId]: debugJob,
};

// Inject mocks if not in Minecraft
if (typeof system === "undefined") {
	class anythingGoes {
		constructor(path = []) {
			return new Proxy(() => {}, {
				// on any property read, print what we are trying to access
				get: (target, prop) => {
					// Ignore special cases like inspection, symbols, etc.
					if (prop === Symbol.toPrimitive) return () => path.join('.');
					if (prop === 'toString') return () => path.join('.');
					if (prop === 'valueOf') return () => path.join('.');
					if (typeof prop === "symbol") return target[prop];
					const newPath = [...path, prop];
					console.log(`accessed ${newPath.join('.')}`);
					return new anythingGoes(newPath);
				},
				// on any function call, print that we tried to call it
				apply: (target, thisArg, args) => {
					console.log(`called ${path.join('.')}`);
					return new anythingGoes(path);
				}
			});
		}
	}
	Vector3 = new anythingGoes();
	
	const sim = createMockMinecraft();
	system = sim.system;
	world = sim.world;
	
	// Load your script (or paste it here)
	system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);
	
	// Simulate commands
	sim.fireScriptEvent("chunkGen:start");
	
	// Run game loop
	sim.tick(10); // simulate ticks
	sim.tick(10); // simulate ticks
	sim.fireScriptEvent("chunkGen:dbg")
	sim.tick(10); // simulate ticks
	// Stop midway (optional)
	sim.fireScriptEvent("chunkGen:stop");
	sim.tick(100);
} else {
	system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);
}

