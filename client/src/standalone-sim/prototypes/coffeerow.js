import { prototypical_entity } from './entity.js';
import { prototypical_coffee_plant } from './coffee.js';
import { deepClone } from '../utils/deepClone.js';
import { sys } from '../utils/sys.js';

// A coffee row prototype - organizes coffee plants in rows between bamboo
export const prototypical_coffee_row = {
	...prototypical_entity,
	
	kind: 'coffeerow',

	metadata: {
		title: 'Coffee Row',
		description: 'A row of coffee plants for intercropping between bamboo clumps',
		unsplashImage: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085'
	},

	coffeerow: {
		PLANTS_PER_ROW: 10,
		PLANT_SPACING: 2,  // 2 meters between plants
		ROW_WIDTH: 2,  // Width of the row
		
		// Accumulated statistics
		totalHarvested: 0,
		totalValue: 0,
		totalCO2: 0,
		totalCostJoules: 0
	}
}

prototypical_coffee_row.onstep = function(daysElapsed) {
	const self = this
	// Step all child plants
	self.children.forEach(plant => {
		if (plant.onstep) {
			plant.onstep(daysElapsed)
		}
	})
}

prototypical_coffee_row.onreset = function(plot) {
	const row = this
	row.children = []
	row.createdat = row.updatedat = performance.now()
	row.plot = plot // Store reference to plot for DEM access
	
	// Initialize statistics
	row.coffeerow.totalHarvested = 0
	row.coffeerow.totalValue = 0
	row.coffeerow.totalCO2 = 0
	row.coffeerow.totalCostJoules = 0
	
	// Create coffee plants along the row
	for (let i = 0; i < row.coffeerow.PLANTS_PER_ROW; i++) {
		const plant = deepClone(prototypical_coffee_plant)
		plant.parent = row.id
		plant.id = row.id + "/" + (i + 1)
		plant.createdat = performance.now()
		
		// Position plants along the row (assuming row runs along X axis)
		// Ensure plants don't extend beyond plot boundaries
		const plantX = row.volume.xyz[0] + (i * row.coffeerow.PLANT_SPACING)
		
		// Skip plants that would be outside the plot
		if (plantX >= 100) break  // Assuming 100m plot width
		
		// Add small random offset to plant position
		const xOffset = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2 meter
		const zOffset = (Math.random() - 0.5) * 0.4; // -0.2 to 0.2 meter
		const finalPlantX = plantX + xOffset;
		const finalPlantZ = row.volume.xyz[2] + zOffset;
		
		// Get elevation for this plant position if DEM data is available
		let plantY = row.volume.xyz[1] // Default to row's elevation
		if (row.plot && row.plot.demData && row.plot.demData.getElevationAtSceneCoords) {
			plantY = row.plot.demData.getElevationAtSceneCoords(finalPlantX, finalPlantZ)
		}
		
		plant.volume.xyz = [finalPlantX, plantY, finalPlantZ]
		
		plant.coffee.age = 0
		row.coffeerow.totalCostJoules += plant.coffee.JOULES_PER_PLANTING
		row.children.push(plant)
		sys(plant)
	}
}

prototypical_coffee_row.onharvest = function(dayOfYear) {
	const self = this
	let totalKg = 0
	let totalValue = 0
	let totalCO2 = 0
	
	self.children.forEach(plant => {
		const harvest = plant.onharvest(dayOfYear)
		totalKg += harvest.kg
		totalValue += harvest.value
		totalCO2 += harvest.co2
		
		if (harvest.kg > 0) {
			self.coffeerow.totalCostJoules += plant.coffee.JOULES_PER_HARVEST
		}
	})
	
	// Accumulate in row
	self.coffeerow.totalHarvested += totalKg
	self.coffeerow.totalValue += totalValue
	self.coffeerow.totalCO2 += totalCO2
	
	return { kg: totalKg, value: totalValue, co2: totalCO2 }
}
