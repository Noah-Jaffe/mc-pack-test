/**
* ChunkLoader 
* 
* A Script for Minecraft Bedrock that manages chunk loading and unloading.
* @author gameza_src
* @version 1.0.0
* @license MIT
* 
* Discord: gameza_src
* GitHub: https://github.com/gamezaSRC
*/
import { Dimension, world } from "@minecraft/server";
import { IChunkManager } from "./Interfaces/IChunkManager.js";
import { ChunkLogger } from "./ChunkLogger.js";
import { Chunk } from "./Chunk.js";
import { ColorCodes} from "./ColorCodes.js";

const LOADED_CHUNKS = new Map();
const DIMENSION_ID_MAP = {
	'minecraft:overworld': 0,
	'minecraft:nether': 1,
	'minecraft:the_end': 2
};

export class ChunkLoader extends IChunkManager {
	/**@type { Dimension } */
	#dimension;
	#tickingAreaManager = world.tickingAreaManager;
	#limit;
	#count;
	#logger;
	#persistent;
	constructor(dimension, { persistent = false, logs = false } = {}) {
		super();
		this.#dimension = dimension;
		this.#persistent = persistent;
		this.#logger = new ChunkLogger(logs);
		this.#count = this.#tickingAreaManager.chunkCount;
		this.#limit = this.#tickingAreaManager.maxChunkCount;
		this.#logger.info(`NOTE: max ticking areas = ${this.#limit}`);
		if (this.#persistent)
		this.#synchronizeChunks();
	}
	async #synchronizeChunks() {
		const savedChunks = world.getDynamicPropertyIds()
		.filter(propId => propId.startsWith('CL_') && world.getDynamicProperty(propId));
		if (savedChunks.length === 0) return;
		const promises = [];
		let alreadyLoaded = 0;
		for (const key of savedChunks) {
			const [, coordStr] = key.split('_');
			const [x, z, dimId] = coordStr.split(',').map(Number);
			if (dimId !== this.getDimensionId()) continue;
			const location = { x: x * 16, z: z * 16 };
			if (this.#tickingAreaManager.getTickingArea(key)) {
				LOADED_CHUNKS.set(key, new Chunk(location, this.#dimension));
				this.#logger.synchronized(key);
				continue;
			}
			const promise = this.load(location).then(() => {
				this.#logger.synchronized(key);
			}).catch((error) => {
				this.#logger.error(`Failed to synchronize chunk ${key}: ${error}`);
				world.setDynamicProperty(key);
			});
			promises.push(promise);
		}
		await Promise.all(promises);
		this.#logger.info(`Synchronization complete: ${alreadyLoaded + promises.length} chunks loaded`);
	}
	
	async load(location) {
		if (this.#count >= this.#limit)
		throw new Error("Ticking Area limit reached! Cannot load more chunks.");
		const chunk = new Chunk(location, this.#dimension);
		const dimId = this.getDimensionId();
		const key = `CL_${chunk.x},${chunk.z},${dimId}`;
		if (LOADED_CHUNKS.has(key))
		return LOADED_CHUNKS.get(key);
		if (!this.#tickingAreaManager.hasTickingArea(key)) {
			const chunkStartX = chunk.x * 16;
			const chunkStartZ = chunk.z * 16;
			await this.#tickingAreaManager.createTickingArea(key, {
				dimension: this.#dimension,
				from: { x: chunkStartX, y: -64, z: chunkStartZ },
				to: { x: chunkStartX + 15, y: 320, z: chunkStartZ + 15 }
			});
			LOADED_CHUNKS.set(key, chunk);
			if (this.#persistent)
			world.setDynamicProperty(key, true);
			this.#count++;
			this.#logger.loaded(key);
		}
		return chunk;
	}
	
	unload(location) {
		const chunk = new Chunk(location, this.#dimension);
		const dimId = this.getDimensionId();
		const key = `CL_${chunk.x},${chunk.z},${dimId}`;
		if (!LOADED_CHUNKS.has(key))
		throw new Error("This chunk is not loaded");
		this.#tickingAreaManager.removeTickingArea(key);
		LOADED_CHUNKS.delete(key);
		if (this.#persistent)
		world.setDynamicProperty(key);
		this.#count--;
		this.#logger.unloaded(key);
	}
	
	unloadAll() {
		const dimId = this.getDimensionId();
		const keysToUnload = Array.from(LOADED_CHUNKS.keys()).filter(key => key.endsWith(`,${dimId}`));
		for (const key of keysToUnload) {
			this.#tickingAreaManager.removeTickingArea(key);
			LOADED_CHUNKS.delete(key);
			if (this.#persistent)
			world.setDynamicProperty(key);
			this.#count--;
			this.#logger.unloaded(key);
		}
		this.#logger.unloadedAll(keysToUnload.length);
	}
	
	isLoaded(location) {
		const chunk = new Chunk(location, this.#dimension);
		const dimId = this.getDimensionId();
		return LOADED_CHUNKS.has(`CL_${chunk.x},${chunk.z},${dimId}`);
	}
	
	list() {
		const dimId = this.getDimensionId();
		const chunks = Array.from(LOADED_CHUNKS.entries())
		.filter(([key]) => key.endsWith(`,${dimId}`))
		.map(([, chunk]) => ({
			x: chunk.x,
			z: chunk.z
		}));
		return chunks;
	}
	
	keyList() {
		const dimId = this.getDimensionId();
		const keys = Array.from(LOADED_CHUNKS.keys())
		.filter(key => key.endsWith(`,${dimId}`));
		return keys;
	}
	
	getCenter(location) {
		const chunk = new Chunk(location, this.#dimension);
		return chunk.location;
	}
	
	getTickingArea(location) {
		const chunk = new Chunk(location, this.#dimension);
		const dimId = this.getDimensionId();
		const key = `CL_${chunk.x},${chunk.z},${dimId}`;
		if (!LOADED_CHUNKS.has(key))
		return undefined;
		return this.#tickingAreaManager.getTickingArea(key);
	}
	
	getDimensionId() {
		return DIMENSION_ID_MAP[this.#dimension.id] ?? 0;
	}
	
	isPersistent() {
		return this.#persistent;
	}
	
	getLimit() {
		return this.#limit;
	}
	
	getCount() {
		return this.#count;
	}
}