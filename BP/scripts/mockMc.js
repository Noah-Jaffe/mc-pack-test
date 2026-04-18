
export function createMockMinecraft() {
	let currentTick = 0;
	let nextJobId = 1;
	const jobs = new Map();
	const timeouts = [];
	
	const system = {
		get currentTick() {
			return currentTick;
		},
		
		runJob(gen) {
			const id = nextJobId++;
			jobs.set(id, gen);
			return id;
		},
		runTimeout(callback, delayTicks = 0) {
			const id = nextJobId++;
			const runAt = currentTick + Math.max(0, delayTicks);
			
			timeouts.push({
				runAt,
				callback
			});
			return id;
		},
		clearJob(id) {
			jobs.delete(id);
		},
		
		afterEvents: {
			scriptEventReceive: {
				subscribed: [], 
				subscribe: (cb)=>{
					system.afterEvents.scriptEventReceive.subscribed.push(cb);
				}
			}
		}
	};
	
	const world = {
		sendMessage(msg) {
			const stack = new Error("just for stack trace");
			msg = msg.replaceAll(new RegExp(Object.values(ColorCodes).join("|"), "gmi"), "")
			console.trace(`[MSG @${currentTick}]`, msg, stack);
		}
	};
	
	function tick(n = 1) {
		for (let i = 0; i < n; i++) {
			currentTick++;
			console.log(`CURRENT TICK ${currentTick}`)
			
			// ---- RUN TIMEOUTS ----
			
			for (let j = timeouts.length - 1; j >= 0; j--) {
				if (timeouts[j].runAt <= currentTick) {
					try {
						timeouts[j].callback();
					} catch (e) {
						console.error("Timeout error:", e);
					}
					
					timeouts.splice(j, 1);
				}
			}
			
			// ---- RUN JOBS ----
			
			for (const [id, job] of [...jobs]) {
				try {
					const res = job.next();
					
					if (res.done) {
						jobs.delete(id);
					}
					
				} catch (e) {
					console.error("Job error:", e);
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
							msg = msg.replaceAll(new RegExp(Object.values(ColorCodes).join("|"), "gmi"), "")
							console.trace(`[ACTIONBAR @${currentTick}]`, msg, stack);
						}
					}
				}
			});
		}
	}
	
	return { system, world, tick, fireScriptEvent };
}

/*
example usage:
1. comment out imports
2. ensure all mocked features implemented 
3. copy paste the following code as a starting example:
```
	const sim = createMockMinecraft();
	const system = sim.system;
	const world = sim.world;
	
	// Load your script (or paste it here)
	system.afterEvents.scriptEventReceive.subscribe(recognizeMyEvents);
	
	sim.tick(5);
	// Simulate commands
	sim.fireScriptEvent("chunkGen:start");
	
	// Run game loop
	sim.tick(25); // simulate ticks
```
*/

