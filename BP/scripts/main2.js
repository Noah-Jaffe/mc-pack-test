// // Code version 1.1.0
// // Date and Time 18/01/2024 8:09pm
// import { BlockPermutation, system, world, } from "@minecraft/server";
// import { TickIntervalManager } from "./tickIntervalManager";
// import { ModalFormData } from "@minecraft/server-ui";
// // Written by Programmer 745

// function Round16(value) {
//     if (value >= 0) {
//         return value - (value % 16);
//     }
//     else {
//         return value - (((value % 16) + 16) % 16);
//     }
// }

// function* walkChunkTaxicab(center) {
//     const baseX = Round16(center.x);
//     const baseZ = Round16(center.z);

//     // Always yield center first
//     yield { x: baseX, z: baseZ };
//     let r = 1;
//     while (!abortSignal) {
//         let x = 0;
//         let z = -r;

//         // 4 sides of the diamond (clockwise)

//         // Top-right edge
//         while (x < r && z < 0) {
//             yield {
//                 x: baseX + x * 16,
//                 z: baseZ + z * 16,
//             };
//             x++;
//             z++;
//         }

//         // Bottom-right edge
//         while (x > 0 && z < r) {
//             yield {
//                 x: baseX + x * 16,
//                 z: baseZ + z * 16,
//             };
//             x--;
//             z++;
//         }

//         // Bottom-left edge
//         while (x > -r && z > 0) {
//             yield {
//                 x: baseX + x * 16,
//                 z: baseZ + z * 16,
//             };
//             x--;
//             z--;
//         }

//         // Top-left edge
//         while (x < 0 && z > -r) {
//             yield {
//                 x: baseX + x * 16,
//                 z: baseZ + z * 16,
//             };
//             x++;
//             z--;
//         }
//     }
//     yield null;
// }
// const interval = new TickIntervalManager(1);
// interval.start();

// const ANCHOR_BLOCK = BlockPermutation.resolve("minecraft:diamond_block");

// system.afterEvents.scriptEventReceive.subscribe((event) => {
//     var abortSignal = new AbortController();
//     if (event.id === "afkgen") {
//         try {
//             system.runJob(StartGeneration(event.sourceEntity, abortSignal));
//         } catch {
//             console.log(`completed! ${}`)
//         }
//     }
//     if (event.id === "stopgen") {
//         abortSignal.abort();
//     }
// });

// system.afterEvents.scriptEventReceive.subscribe((event) => {
//     ...
//     if (event.id === "chunkGen:start") {
//         // starts a job for a generator function
//         ...
//         system.runJob(...)
//         ...
//     }
//     if (event.id === "chunkGen:stop") {
//         // fires something that stops the job started in "chunkGen:start"
//     }
// });


// function* StartGeneration(player, abortController) {
//     let dimension = player.getDimension();
//     let latestTick = system.currentTick + 1;
//     let lastLoadTick = latestTick - 1;
//     let chunksWalked = 0;
//     // @todo: fix interval code
//     interval.addEntry("progress", () => {
//         if (system.currentTick > test + 20) {
//             if (tickOldCount === chunksDone) {
//                 tp = true;
//             }
//             tickOldCount = chunksDone;
//             test = system.currentTick;
//         }
//         player.sendMessage(`[Pregeneration] Chunks Done: %${Math.round((chunksDone / chunksToDo) * 10000) / 100} ${chunksDone}/${chunksToDo}`);
//         if (abortSignal == true) {
//             interval.removeEntry("progress");
//             player.sendMessage(`[Pregeneration] Successfully generated ${chunksToDo} chunks!`);
//             player.teleport(originalLoc.location, {
//                 dimension: originalLoc.dimension,
//             });
//         }
//     });
//     let walker = walkChunkTaxicab(player.location)
//     for (const chunkLoc of walker) {
//         console.log(chunkLoc)
//     }
// }
// function* LoadChunks(chunkLoc, dimension, player) {
//     let chunk1Loaded = false;
//     let chunk2Loaded = false;
//     let chunk3Loaded = false;
//     let chunk4Loaded = false;
//     let loadedChunk = false;
//     let inChunk = false;
//     let success = false;
//     const worker = player.dimension.spawnEntity("searmr:worker", player.location);
//     while (!success) {
//         if (worker.isValid()) {
//             if (!inChunk) {
//                 worker.teleport(chunkLoc, { dimension: dimension });
//                 inChunk = true;
//             }
//             else if (!loadedChunk) {
//                 if (!chunk1Loaded) {
//                     const block = dimension.getBlock(chunkLoc);
//                     if (block != undefined) {
//                         const oldPerm = block.permutation;
//                         block.setPermutation(ANCHOR_BLOCK);
//                         block.setPermutation(oldPerm);
//                         chunk1Loaded = true;
//                     }
//                 }
//                 if (!chunk2Loaded) {
//                     const block = dimension.getBlock({
//                         x: chunkLoc.x + -1,
//                         y: chunkLoc.y,
//                         z: chunkLoc.z,
//                     });
//                     if (block != undefined) {
//                         const oldPerm = block.permutation;
//                         block.setPermutation(ANCHOR_BLOCK);
//                         block.setPermutation(oldPerm);
//                         chunk2Loaded = true;
//                     }
//                 }
//                 if (!chunk3Loaded) {
//                     const block = dimension.getBlock({
//                         x: chunkLoc.x + -1,
//                         y: chunkLoc.y,
//                         z: chunkLoc.z + -1,
//                     });
//                     if (block != undefined) {
//                         const oldPerm = block.permutation;
//                         block.setPermutation(ANCHOR_BLOCK);
//                         block.setPermutation(oldPerm);
//                         chunk3Loaded = true;
//                     }
//                 }
//                 if (!chunk4Loaded) {
//                     const block = dimension.getBlock({
//                         x: chunkLoc.x,
//                         y: chunkLoc.y,
//                         z: chunkLoc.z + -1,
//                     });
//                     if (block != undefined) {
//                         const oldPerm = block.permutation;
//                         block.setPermutation(ANCHOR_BLOCK);
//                         block.setPermutation(oldPerm);
//                         chunk4Loaded = true;
//                     }
//                 }
//                 if (chunk1Loaded && chunk2Loaded && chunk3Loaded && chunk4Loaded) {
//                     loadedChunk = true;
//                 }
//             }
//             else if (loadedChunk) {
//                 chunksDone += 4;
//                 worker.triggerEvent("despawn");
//                 success = true;
//             }
//         }
//         yield;
//     }
// }



