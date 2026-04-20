/** @const {number} chunk size in blocks */
export const chunkSize = 16;

/**
 * @param {number} value - the number to be rounded
 * @return {number} value rounded to the appropriate {@link chunkSize} multiple
 */
export function roundForChunkEdge(value) {
	if (value >= 0) {
		return value - (value % chunkSize);
	}
	else {
		return value - (((value % chunkSize) + chunkSize) % chunkSize);
	}
}

/** 
 * @param {number} raw_x the center of the spiral x axis
 * @param {number} raw_z the center of the spiral z axis 
 * @param {number} stepIndex the step number in the spiral
 * @return {{x: number, z: number}} the x z coords of the corner of the chunk of the spiral at the given step
 * 
 * @note order of spiral:
 *      3
 *   4  0  2
 *      1
 */
export function getChunkAtStep(raw_x, raw_z, stepIndex) {
	const baseX = roundForChunkEdge(raw_x);
	const baseZ = roundForChunkEdge(raw_z);
	
	// Step 0 = center
	if (stepIndex === 0) {
		let ret = { x: baseX, z: baseZ };
		//console.log(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
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
	//console.log(`rx ${raw_x}, rz ${raw_z}, s ${stepIndex} => ${ret.x}, ${ret.z}`);
	return ret;
}
