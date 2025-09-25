import { prototypical_entity } from './entity.js';

// A dendrocalamus asper culm prototype - clone to use
export const prototypical_dendrocalamus_asper_culm = {
	...prototypical_entity,
	
	kind: 'culm',

	metadata: {
		title: 'Giant Bamboo Culm',
		description: 'A single pole of Dendrocalamus asper, one of the largest bamboo species',
		unsplashImage: 'https://images.unsplash.com/photo-1567450489212-d37b5ba1b639'
	},

	culm: {
		age: 0,
		USD_PER_CULM: 12.0,
		CO2_KG_PER_CULM: 2.21,
		JOULES_PER_HARVEST: 3600000, // 1 kWh = 3.6 MJ (rough estimate for harvesting energy)
		
		// Growth parameters
		MAX_HEIGHT_METERS: 30,        // Giant bamboo can reach 30m
		GROWTH_RATE: 0.02,           // Controls steepness of S-curve (reaches ~95% height by 2 years)
		GROWTH_MIDPOINT_DAYS: 180,   // Days when growth is fastest (6 months)
		WIDTH_TO_HEIGHT_RATIO: 0.005 // Roughly 15cm diameter at full height
	},
	
	// Rendering information
	volume: {
		xyz: [ 0,0,0 ],
		hwd: [ 0,0,0 ],
		ypr: [ 0,0,0 ],
		shape: 'cylinder',
		color: 0x228B22,  // Forest green
		opacity: 1.0
	}
}

prototypical_dendrocalamus_asper_culm.onstep = function(daysElapsed) {
	const self = this
	self.culm.age += daysElapsed
	
	// S-curve growth: rapid at first, slowing with age
	// Using logistic growth function
	// Logistic S-curve formula
	self.volume.hwd[0] = self.culm.MAX_HEIGHT_METERS / (1 + Math.exp(-self.culm.GROWTH_RATE * (self.culm.age - self.culm.GROWTH_MIDPOINT_DAYS)))
	
	// Width grows proportionally but slower
	self.volume.hwd[1] = self.volume.hwd[0] * self.culm.WIDTH_TO_HEIGHT_RATIO
	self.volume.hwd[2] = self.volume.hwd[1] // depth same as width (circular)
}
