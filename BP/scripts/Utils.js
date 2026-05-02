

export function flatten(obj, sep = '.') {
	const out = {};
	(function recurse(val, prefix = '') {
		if (val && typeof val === 'object') {
			if (Array.isArray(val)) {
				val.forEach((item, i) => recurse(item, `${prefix}[${i}]`));
			} else {
				for (const [k, v] of Object.entries(val)) {
					recurse(v, prefix ? `${prefix}${sep}${k}` : k);
				}
			}
		} else {
			out[prefix] = val;
		}
	})(obj);
	return out;
}

/*
const tests = {};
tests.flatten = ()=> {
	const toTest = [
		{ arg: { a: { b: 1 }, c: 2 }, expected: { "a.b": 1, c: 2 } },
		{ arg: { a: { b: [1, 2] } }, expected: { "a.b[0]": 1, "a.b[1]": 2 } },
		{ arg: { a: null, b: { c: undefined } }, expected: { a: null, "b.c": undefined } },
		{ arg: {}, expected: {} },
		{ arg: { "a.b": { c: 1 }, a: { b: 2 } }, expected: { "a.b.c": 1, "a.b": 2 } },
		{ arg: { a: { b: { c: { d: 4 } } } }, expected: { "a.b.c.d": 4 } },
		{ arg: { a: { b: 1 }, c: 2 }, expected: { "a.b": 1, c: 2 } },
		{ arg: { arr: [10, { x: 20 }] }, expected: { "arr[0]": 10, "arr[1].x": 20 } },
		{ arg: { a: [{ b: 1 }, { c: [2, 3] }] }, expected: { "a[0].b": 1, "a[1].c[0]": 2, "a[1].c[1]": 3 } },
		{ arg: { a: null, b: { c: undefined } }, expected: { a: null, "b.c": undefined } },
		{ arg: {}, expected: {} },
		{ arg: { "a.b": { "c[d]": 1 } }, expected: { "a.b.c[d]": 1 } },
		{ arg: 42, expected: { "": 42 } },
	];
	toTest.forEach((arg, i, arr)=>{
		let actual = flatten(arg.arg);
		const a = JSON.stringify(actual);
		const e = JSON.stringify(arg.expected);
		if(a!=e) {
			console.error(`TEST ${i+1}/${arr.length} FAILED: flatten failed test for ${JSON.stringify(arg.arg)}.\nExpected:${e}\nActual:\n${a}`)
		}
	});
};

(()=>Object.entries(tests).forEach(([k,v]) => v()))();
*/