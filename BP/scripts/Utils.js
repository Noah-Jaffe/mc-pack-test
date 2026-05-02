

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


export function findByKeys(obj, keyReg) {
	let found = 0;
	let ret = Object.entries(obj).reduce((acc, [k,v]) => {
		if (k.match(keyReg)) {
			acc[k] = v;
			found++;
		}
		return acc;
	},
	{});
	
	if (found == 1) {
		ret = ret[Object.keys(ret)[0]];
	} else if (found == 0) {
		ret = undefined;
	}
	return ret;
}

/*
const tests = {};
tests.flatten = ()=> {
	const toTest = 	[
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
tests.findByKeys = () => {
const toTest = [
  { arg: [{ a: 1, b: 2 }, /a/], expected: 1 },
  { arg: [{ a: 1, b: 2 }, /b/], expected: 2 },
  { arg: [{ a: 1, b: 2 }, /c/], expected: undefined },
  { arg: [{ foo: 'x', bar: 'y' }, /foo/], expected: 'x' },
  { arg: [{ foo: 'x', bar: 'y' }, /ba/], expected: 'y' },
  { arg: [{ foo: 'x', bar: 'y' }, /z/], expected: undefined },
  { arg: [{ one: 1, two: 2, three: 3 }, /t/], expected: { two: 2, three: 3 } },
  { arg: [{ one: 1, two: 2, three: 3 }, /^one$/], expected: 1 },
  { arg: [{ 'a-b': 10, 'a_b': 20 }, /a-/], expected: 10 },
  { arg: [{ 'a-b': 10, 'a_b': 20 }, /a_/], expected: 20 },
  { arg: [{ nested: { x: 1 }, other: { y: 2 } }, /nested/], expected: { x: 1 } },
  { arg: [{}, /.+/], expected: undefined },
  { arg: [{ present: null, missing: 5 }, /present/], expected: null },
  { arg: [{ dup1: 'v1', dup2: 'v2' }, /dup/], expected: { dup1: 'v1', dup2: 'v2' } },
  { arg: [{ num0: 0, num1: 1 }, /num0/], expected: 0 }
];
		toTest.forEach((arg, i, arr)=>{
			const actual = findByKeys(...arg.arg);
			const a = JSON.stringify(actual);
			const e = JSON.stringify(arg.expected);
			if(a!=e) {
				console.error(`TEST ${i+1}/${arr.length} FAILED: findByKeys failed test for ${JSON.stringify(arg.arg)}.\nExpected:${e}\nActual:\n${a}`)
			}
		});
};

(()=>Object.entries(tests).forEach(([k,v]) => v()))();
//*/