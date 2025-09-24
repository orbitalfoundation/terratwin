// Deep clone function that handles functions
export function deepClone(obj) {
	if (obj === null || typeof obj !== 'object') return obj;
	if (obj instanceof Date) return new Date(obj.getTime());
	if (obj instanceof Array) return obj.map(item => deepClone(item));
	
	const cloned = {};
	for (const key in obj) {
		if (obj.hasOwnProperty(key)) {
			cloned[key] = deepClone(obj[key]);
		}
	}
	
	// Copy functions and prototype methods
	const prototype = Object.getPrototypeOf(obj);
	if (prototype !== Object.prototype) {
		Object.setPrototypeOf(cloned, prototype);
	}
	
	return cloned;
}
