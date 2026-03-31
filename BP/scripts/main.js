// // Code version 1.1.0
// // Date and Time 18/01/2024 8:09pm
// import { BlockPermutation, system, world, } from "@minecraft/server";
// import { TickIntervalManager } from "./tickIntervalManager";
// import { ModalFormData } from "@minecraft/server-ui";
// // Written by Programmer 745
// let originalLoc = {
//     dimension: world.getDimension("overworld"),
//     location: { x: 0, y: 0, z: 0 },
// };
// let tp = false;
// let radius = 1024;
// let loc = { x: 0, y: 60, z: 0 };
// let chunksDone = 0;
// const interval20 = new TickIntervalManager(1);
// interval20.start();
// function Round16(value) {
//     if (value >= 0) {
//         return value - (value % 16);
//     }
//     else {
//         return value - (((value % 16) + 16) % 16);
//     }
// }
// function GetTotalChunks(radius) {
//     let radius16 = radius * 2;
//     radius16 /= 16;
//     return Math.pow(radius16, 2) + radius16 * 4 + 4;
// }
// function randomNum(min, max) {
//     return min + (max - min) * Math.random();
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
//                         block.setPermutation(BlockPermutation.resolve("minecraft:diamond_block"));
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
//                         block.setPermutation(BlockPermutation.resolve("minecraft:diamond_block"));
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
//                         block.setPermutation(BlockPermutation.resolve("minecraft:diamond_block"));
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
//                         block.setPermutation(BlockPermutation.resolve("minecraft:diamond_block"));
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
// function* StartGeneration(player, dimension) {
//     if (tp === true) {
//         while (dimension.getBlock({ x: 0, y: 40, z: 0 }) === undefined) {
//             player.teleport({ x: 0, y: 0, z: 0 }, { dimension: dimension });
//             tp = false;
//             yield;
//         }
//     }
//     chunksDone = 0;
//     let chunkCount = 0;
//     let hanging = false;
//     let hangLoc = { x: 0, y: 0, z: 0 };
//     const chunksToDo = GetTotalChunks(radius);
//     let test = system.currentTick;
//     let oldChunkCount = 0;
//     let tickOldCount = 0;
//     tickOldCount = chunksDone;
//     interval20.addEntry("progress", () => {
//         if (system.currentTick > test + 20) {
//             if (tickOldCount === chunksDone) {
//                 tp = true;
//             }
//             tickOldCount = chunksDone;
//             test = system.currentTick;
//         }
//         if (chunksDone != chunksToDo) {
//             player.sendMessage(`[Pregeneration] Chunks Done: %${Math.round((chunksDone / chunksToDo) * 10000) / 100} ${chunksDone}/${chunksToDo}`);
//         }
//         else if (chunksDone === chunksToDo) {
//             interval20.removeEntry("progress");
//             player.sendMessage(`[Pregeneration] Successfully generated ${chunksToDo} chunks!`);
//             player.teleport(originalLoc.location, {
//                 dimension: originalLoc.dimension,
//             });
//         }
//     });
//     const totalRows = radius / 16 / 2;
//     for (let x = -totalRows; x <= totalRows; x++) {
//         const chunkX = loc.x + x * 32;
//         for (let z = -totalRows; z <= totalRows; z++) {
//             const chunkZ = loc.z + z * 32;
//             const loct = { x: chunkX, y: loc.y, z: chunkZ };
//             if (tp) {
//                 while (dimension.getBlock(hangLoc) === undefined) {
//                     player.teleport(hangLoc, { dimension: dimension });
//                     tp = false;
//                     yield;
//                 }
//             }
//             system.runJob(LoadChunks(loct, dimension, player));
//             if (hanging) {
//                 hangLoc = loct;
//             }
//             if (chunkCount === chunksDone) {
//                 if (!hanging) {
//                     hanging = true;
//                     hangLoc = loct;
//                 }
//             }
//             else {
//                 hanging = false;
//             }
//             chunkCount = chunksDone;
//             yield;
//         }
//     }
// }
// system.afterEvents.scriptEventReceive.subscribe((event) => {
//     var _a;
//     if (event.id === "searmr:pregen") {
//         ConfigMenu(event.sourceEntity);
//     }
//     if (event.id === "searmr:nether") {
//         (_a = event.sourceEntity) === null || _a === void 0 ? void 0 : _a.teleport({ x: 0, y: 0, z: 0 }, {
//             dimension: world.getDimension("nether"),
//         });
//     }
// });
// function ConfigMenu(player) {
//     const configMenu = new ModalFormData();
//     configMenu.title("World Pregeneration");
//     configMenu.dropdown("Dimension", ["Overworld", "The Nether", "The End"]);
//     configMenu.textField("Radius", "250", "250");
//     configMenu.textField("X Pos", "0", "0");
//     configMenu.textField("Z Pos", "0", "0");
//     configMenu.submitButton("Start");
//     configMenu.show(player).then((r) => {
//         var _a;
//         if (r.canceled)
//             return;
//         let dimension = world.getDimension("overworld");
//         const values = (_a = r.formValues) !== null && _a !== void 0 ? _a : [0];
//         switch (values[0]) {
//             case 1:
//                 dimension = world.getDimension("nether");
//                 break;
//             case 2:
//                 dimension = world.getDimension("the_end");
//                 break;
//         }
//         let validValues = true;
//         const tempRadius = parseInt(values[1]);
//         if (!Number.isNaN(tempRadius)) {
//             radius = Round16(tempRadius);
//         }
//         else {
//             validValues = false;
//         }
//         const tempX = parseFloat(values[2]);
//         if (!Number.isNaN(tempX)) {
//             loc.x = Round16(tempX);
//         }
//         else {
//             validValues = false;
//         }
//         const tempZ = parseFloat(values[3]);
//         if (!Number.isNaN(tempZ)) {
//             loc.z = Round16(tempZ);
//         }
//         else {
//             validValues = false;
//         }
//         if (player.dimension !== dimension) {
//             tp = true;
//         }
//         originalLoc.dimension = player.dimension;
//         originalLoc.location = player.location;
//         if (validValues) {
//             system.runJob(StartGeneration(player, dimension));
//         }
//     });
// }
