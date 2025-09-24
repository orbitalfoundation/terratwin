// Basic prototypical entity that all other entities inherit from
export const prototypical_entity = {
	id: 0,
	kind: '', // Entity type identifier (e.g., 'culm', 'clump', 'coffee', 'coffeerow', 'plot')
	volume: {
		xyz: [ 0,0,0 ],  // position: x, y, z
		hwd: [ 0,0,0 ],  // dimensions: height, width, depth
		ypr: [ 0,0,0 ]   // rotation: yaw, pitch, roll
	},
	parent: 0,
	children: [],
	createdat: null,
	
	// Metadata for display/UI
	metadata: {
		title: '',
		description: '',
		unsplashImage: ''
	}
}
