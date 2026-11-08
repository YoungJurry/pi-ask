//#region src/internal/utils.ts
/**
* Creates a const map from the given values
* @param values - An array of values to be used as keys and values in the map.
* @returns A populated version of the map with the values and keys derived from the values.
*/
/*#__NO_SIDE_EFFECTS__*/
function createConstMap(values) {
	let res = {};
	const len = values.length;
	for (let lp = 0; lp < len; lp++) {
		const val = values[lp];
		if (val) res[String(val).toUpperCase().replace(/[-.]/g, "_")] = val;
	}
	return res;
}
//#endregion
export { createConstMap };

//# sourceMappingURL=utils.mjs.map