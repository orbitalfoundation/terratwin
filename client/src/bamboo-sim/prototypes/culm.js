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
		WIDTH_TO_HEIGHT_RATIO: 0.005, // Roughly 15cm diameter at full height
		
		// Position-based growth modifiers
		distanceFromCenter: 0,        // Distance from clump center (meters)
		growthSpeedModifier: 1.0,     // Multiplier for growth speed based on position
		initialTiltAngle: 0,          // Initial tilt angle (radians)
		initialTiltDirection: 0       // Initial tilt direction (radians)
	},
	
	// Rendering information
	volume: {
		xyz: [ 0,0,0 ],
		hwd: [ 0,0,0 ],
		ypr: [ 0,0,0 ],
		shape: 'cylinder',
		color: 0x228B22,  // Forest green (will be varied per culm)
		opacity: 1.0
	}
}

prototypical_dendrocalamus_asper_culm.onstep = function(daysElapsed) {
	const self = this
	self.culm.age += daysElapsed
	
	// Apply growth speed modifier based on distance from center
	const effectiveAge = self.culm.age * self.culm.growthSpeedModifier
	
	// S-curve growth: rapid at first, slowing with age
	// Using logistic growth function with modified age
	const currentHeight = self.culm.MAX_HEIGHT_METERS / (1 + Math.exp(-self.culm.GROWTH_RATE * (effectiveAge - self.culm.GROWTH_MIDPOINT_DAYS)))
	self.volume.hwd[0] = currentHeight
	
	// Width grows proportionally but slower
	self.volume.hwd[1] = self.volume.hwd[0] * self.culm.WIDTH_TO_HEIGHT_RATIO
	self.volume.hwd[2] = self.volume.hwd[1] // depth same as width (circular)
	
	// Adjust tilt angle - becomes straighter as it grows
	// Start with initial tilt, reduce to 20% of initial when fully grown
	const growthProgress = currentHeight / self.culm.MAX_HEIGHT_METERS
	const currentTiltAngle = self.culm.initialTiltAngle * (1 - 0.8 * growthProgress)
	
	// Update rotation
	self.volume.ypr = [
		self.culm.initialTiltDirection, // Yaw: direction of tilt (unchanged)
		currentTiltAngle,               // Pitch: amount of tilt (reduces with growth)
		0                               // Roll: no roll
	]
	
	// Update color based on age - younger culms are brighter green, older ones darker
	// Age factor: 0 to 1 over first 2 years
	const ageFactor = Math.min(self.culm.age / 730, 1.0)
	
	// Base color components (forest green: 0x228B22 = rgb(34, 139, 34))
	const baseR = 34
	const baseG = 139
	const baseB = 34
	
	// Vary the color:
	// Young: brighter/yellower green
	// Old: darker/bluer green
	const r = Math.floor(baseR + (1 - ageFactor) * 30) // More red when young
	const g = Math.floor(baseG + (1 - ageFactor) * 20) // More green when young
	const b = Math.floor(baseB - (1 - ageFactor) * 10) // Less blue when young
	
	// Convert to hex color
	self.volume.color = (r << 16) | (g << 8) | b
}
