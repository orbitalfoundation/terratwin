import { prototypical_entity } from './entity.js';
import { prototypical_dendrocalamus_asper_culm } from './culm.js';
import { deepClone } from '../utils/deepClone.js';

// A dendrocalamus asper clump prototype - clone to use
export const prototypical_dendrocalamus_asper_clump = {
	...prototypical_entity,
	
	kind: 'clump',

	metadata: {
		title: 'Bamboo Clump',
		description: 'A clump of giant bamboo containing up to 40 individual culms',
		unsplashImage: 'https://images.unsplash.com/photo-1571575173700-afb9492e6a50'
	},
	
	// Rendering information
	volume: {
		xyz: [ 0,0,0 ],
		hwd: [ 0,0,0 ],
		ypr: [ 0,0,0 ],
		shape: 'sphere',
		color: 0x228B22,  // Forest green
		opacity: 0.3,     // Semi-transparent
		material: 'glass' // Special material type
	},

	clump: {
		CULM_MAX: 40,
		CLUMP_PER_HECTARE: 150,
		CLUMP_GAP_PER_AXIS: 8,
		CLUMP_MAX_WIDTH: 12,  // Maximum width of a clump in meters
		HARVEST_FIRST_DAY: 1825,
		HARVEST_PERCENT: 20.0,
		JOULES_PER_CLUMP_PLANTING: 72000000, // 20 kWh = 72 MJ (energy to plant a clump - includes land prep, planting, initial care)
		
		// Accumulated statistics
		totalHarvested: 0,
		totalValue: 0,
		totalCO2: 0,
		totalCostJoules: 0
	}
}

prototypical_dendrocalamus_asper_clump.onreset = function(plot) {
	const clump = this
	clump.children = []
	clump.createdat = this.updatedat = performance.now()
	clump.plot = plot // Store reference to plot for DEM access
	
	// Initialize statistics
	clump.clump.totalHarvested = 0
	clump.clump.totalValue = 0
	clump.clump.totalCO2 = 0
	clump.clump.totalCostJoules = clump.clump.JOULES_PER_CLUMP_PLANTING // Initial planting cost
	
	// Set clump sphere size smaller than the actual clump area
	const clumpRadius = this.clump.CLUMP_MAX_WIDTH / 4  // Make it half the size
	clump.volume.hwd = [clumpRadius, clumpRadius, clumpRadius] // sphere uses radius for all dimensions
	
	const max = this.clump.CULM_MAX
	let counter = 1
	
	// Distribute culms within the clump area (up to 12m diameter)
	// Using a circular distribution pattern
	const culmDistributionRadius = this.clump.CLUMP_MAX_WIDTH / 2  // Full clump radius for culm distribution
	
	for(let i = 0; i < max; i++) {
		const culm = deepClone(prototypical_dendrocalamus_asper_culm)
		culm.parent = clump.id
		culm.id = clump.id + "/" + counter
		culm.createdat = performance.now()
		
		// Position culms randomly within the clump area
		// Use polar coordinates for natural circular distribution
		const angle = Math.random() * 2 * Math.PI
		const distance = Math.random() * culmDistributionRadius * 0.8 // Keep within 80% of full clump radius
		
		// Calculate culm position
		const culmX = clump.volume.xyz[0] + Math.cos(angle) * distance
		const culmZ = clump.volume.xyz[2] + Math.sin(angle) * distance
		
		// Get elevation for this culm position if DEM data is available
		let culmY = clump.volume.xyz[1] // Default to clump's elevation
		if (clump.plot && clump.plot.demData && clump.plot.demData.getElevationAtSceneCoords) {
			culmY = clump.plot.demData.getElevationAtSceneCoords(culmX, culmZ)
		}
		
		culm.volume.xyz = [culmX, culmY, culmZ]
		
		// Calculate outward tilt from clump center
		// Tilt increases with distance from center, up to about 10 degrees
		const tiltAngle = (distance / culmDistributionRadius) * 0.174533; // 10 degrees in radians
		const tiltDirection = angle; // Same as position angle
		
		// Set rotation (yaw, pitch, roll)
		// Pitch tilts the culm outward in the direction it's positioned
		culm.volume.ypr = [
			tiltDirection, // Yaw: direction of tilt
			tiltAngle,     // Pitch: amount of tilt
			0              // Roll: no roll
		];
		
		culm.volume.hwd = [0, 0, 0] // height, width, depth - will grow over time
		culm.culm.age = 0 // age in days
		counter++
		clump.children.push(culm)
	}
}

// Harvesting system
prototypical_dendrocalamus_asper_clump.onharvest = function() {
	const self = this
	const harvestableAge = this.clump.HARVEST_FIRST_DAY
	const harvestPercent = this.clump.HARVEST_PERCENT / 100
	
	// Find mature culms
	const matureCulms = self.children.filter(culm => culm.culm.age >= harvestableAge)
	const harvestCount = Math.floor(matureCulms.length * harvestPercent)
	
	if (harvestCount === 0) return { count: 0, value: 0, co2: 0 }
	
	// Sort by age and harvest oldest first
	matureCulms.sort((a, b) => b.culm.age - a.culm.age)
	
	let totalValue = 0
	let totalCO2 = 0
	
	for (let i = 0; i < harvestCount; i++) {
		const harvestedCulm = matureCulms[i]
		totalValue += harvestedCulm.culm.USD_PER_CULM
		totalCO2 += harvestedCulm.culm.CO2_KG_PER_CULM
		
		// Add harvesting energy cost
		self.clump.totalCostJoules += harvestedCulm.culm.JOULES_PER_HARVEST
		
		// Reset harvested culm to newborn state
		harvestedCulm.culm.age = 0
		harvestedCulm.volume.hwd = [0, 0, 0]
		harvestedCulm.createdat = performance.now()
	}
	
	// Accumulate in clump
	self.clump.totalHarvested += harvestCount
	self.clump.totalValue += totalValue
	self.clump.totalCO2 += totalCO2
	
	return { count: harvestCount, value: totalValue, co2: totalCO2 }
}
