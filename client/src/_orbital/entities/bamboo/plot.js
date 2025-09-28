
import { deepClone } from '../../utils/deepClone.js';

import { sys } from '../../services-sys/sys.js';

import { prototypical_entity } from './entity.js';
import { prototypical_dendrocalamus_asper_clump } from './clump.js';
import { prototypical_coffee_row } from './coffeerow.js';

// A prototypical plot
export const prototypical_plot = {
	...prototypical_entity,

	id: "/plot-bamboo",

	kind: 'plot',
	
	metadata: {
		title: 'Bamboo Plot',
		description: 'A managed plot of land for growing bamboo',
		unsplashImage: 'https://images.unsplash.com/photo-1518756131217-31eb79b20e8f'
	},
	
	// Field configuration
	field: {
		width: 100,  // Default width in meters
		depth: 100,  // Default depth in meters
		USD_PER_MEGAJOULE: 0.0278, // Based on $0.10 per kWh (1 kWh = 3.6 MJ)
		ENABLE_INTERCROPPING: false,
		COFFEE_ROW_SPACING: 4,  // Place coffee rows every 4 meters
		
		// Schema-based properties with defaults
		speciesDensity: 'medium', // low, medium, high
		harvestYears: 5,
		harvestRate: 20, // percentage
		elevation: 0,
		slopeFacing: 0,
		steepness: 0,
		rainfall: 0,
		drainage: 5000,
		soilSalts: 50,
		soilNitrogen: 50,
		soilMicrobialMass: 50,
		soilEarthworms: 50,
		soilAcidity: 7.0,
		soilFertility: 50,
		pestBambooBorer: false,
		pestAphids: false,
		pestFungalPathogens: false,
		interventionWeeding: false,
		interventionMulching: false,
		interventionFertilization: false,
		interventionPestControl: false,
		intercroppingLegumes: false,
		intercroppingHerbs: false,
		intercroppingSpecialtyCrops: false,
		intercroppingAnimals: false,
	},
	
	// Statistics
	stats: {
		// Accumulated totals
		cumulativeHarvest: 0,
		cumulativeValue: 0,
		cumulativeCO2: 0,
		cumulativeCostJoules: 0,
		cumulativeCoffeeKg: 0,
		
		// Time series data
		days: [],
		totalGrowth: [],
		totalHarvest: [],
		economicYield: [],
		co2Sequestered: [],
		energyCostJoules: [],
		coffeeHeight: [],
		coffeeHarvested: [],
		
		// Yearly accumulated statistics
		yearly: [],
		yearlyAccumulator: {
			yearIndex: 0,
			bambooSum: 0,
			coffeeSum: 0,
			daysInYear: 0,
			harvestBase: 0,
			valueBase: 0,
			co2Base: 0
		}
	},
	
	// Rendering information
	xvolume: {
		xyz: [ 0,0,0 ],
		hwd: [ 0.1,100,100 ],  // height, width, depth - very flat box
		ypr: [ 0,0,0 ],
		shape: 'box',
		color: 0x8B7355,  // Saddle brown (soil)
		opacity: 1.0
	}
}

prototypical_plot.oninit = function() {
	const plot = this
	plot.children = []
	plot.createdat = plot.updatedat = performance.now()
	plot.volume.hwd = [0.1, plot.field.width, plot.field.depth]
	
	// Reset all statistics
	plot.stats = {
		// Accumulated totals
		cumulativeHarvest: 0,
		cumulativeValue: 0,
		cumulativeCO2: 0,
		cumulativeCostJoules: 0,
		cumulativeCoffeeKg: 0,
		
		// Time series data
		days: [],
		totalGrowth: [],
		totalHarvest: [],
		economicYield: [],
		co2Sequestered: [],
		energyCostJoules: [],
		coffeeHeight: [],
		coffeeHarvested: [],
		
		// Yearly accumulated statistics
		yearly: [],
		yearlyAccumulator: {
			yearIndex: 0,
			bambooSum: 0,
			coffeeSum: 0,
			daysInYear: 0,
			harvestBase: 0,
			valueBase: 0,
			co2Base: 0
		}
	}
	const ref = prototypical_dendrocalamus_asper_clump
	let counter = 1
	
	// Calculate spacing based on density setting
	const densitySpacingMap = {
		'low': 12,    // ~70 clumps per hectare
		'medium': 8,  // ~150 clumps per hectare (default)
		'high': 6     // ~280 clumps per hectare
	}
	
	const baseSpacing = densitySpacingMap[plot.field.speciesDensity] || densitySpacingMap['medium']
	
	// Ensure minimum spacing accounts for clump width
	const minSpacing = Math.max(baseSpacing, ref.clump.CLUMP_MAX_WIDTH)
	console.log(`Creating clumps with ${minSpacing}m spacing for ${plot.field.speciesDensity} density (clump width: ${ref.clump.CLUMP_MAX_WIDTH}m)...`)
	
	// Start with offset to center clumps in plot
	const startOffset = minSpacing / 2
	
	for(let x = startOffset; x < plot.field.width; x += minSpacing) {
		for(let z = startOffset; z < plot.field.depth; z += minSpacing) {
			const clump = deepClone(ref)
			clump.parent = plot.id
			clump.id = plot.id + "/clump-" + counter
			
			// Add small random offset to clump position (up to 1m in any direction)
			const xOffset = (Math.random() - 0.5) * 2; // -1 to 1 meter
			const zOffset = (Math.random() - 0.5) * 2; // -1 to 1 meter
			const finalX = x + xOffset;
			const finalZ = z + zOffset;
			
			// Get elevation from DEM if available
			let elevation = 0
			if (plot.demData && plot.demData.getElevationAtSceneCoords) {
				elevation = plot.demData.getElevationAtSceneCoords(finalX, finalZ)
			}
			
			clump.volume.xyz = [finalX, elevation, finalZ]
			plot.children.push(clump)
			clump.plot = plot // Pass plot reference for DEM access
			sys(clump)
			
			if (counter % 50 === 0) {
				console.log(`  Created ${counter} clumps...`)
			}
			
			counter++
		}
	}
	
	console.log(`  Total clumps created: ${plot.children.filter(c => c.clump).length}`)
	console.log(`  Actual density: ${(plot.children.filter(c => c.clump).length / (plot.field.width * plot.field.depth / 10000)).toFixed(2)} clumps per hectare`)
	
	// Add coffee rows if intercropping specialty crops is enabled
	if (plot.field.intercroppingSpecialtyCrops) {
		console.log(`\nAdding coffee rows for intercropping...`)
		let coffeeCounter = 1
		
		// Place coffee rows offset by half spacing from bamboo clumps
		// This puts them in the gaps between bamboo
		const coffeeOffsetX = startOffset + minSpacing / 2
		const coffeeOffsetZ = startOffset + minSpacing / 2
		
		for (let x = coffeeOffsetX; x < plot.field.width; x += minSpacing) {
			for (let z = coffeeOffsetZ; z < plot.field.depth; z += minSpacing) {
				// No need to check for bamboo overlap since we're offset by half spacing
				
				// Check if coffee row would extend beyond plot boundaries
				const rowLength = prototypical_coffee_row.coffeerow.PLANTS_PER_ROW * prototypical_coffee_row.coffeerow.PLANT_SPACING
				if (x + rowLength > plot.field.width) continue
				
				const coffeeRow = deepClone(prototypical_coffee_row)
				coffeeRow.parent = plot.id
				coffeeRow.id = plot.id + "/coffee/" + coffeeCounter
				
				// Add small random offset to coffee row position (up to 0.5m in any direction)
				const xOffset = (Math.random() - 0.5) * 1; // -0.5 to 0.5 meter
				const zOffset = (Math.random() - 0.5) * 1; // -0.5 to 0.5 meter
				const finalX = x + xOffset;
				const finalZ = z + zOffset;
				
				// Get elevation from DEM if available
				let elevation = 0
				if (plot.demData && plot.demData.getElevationAtSceneCoords) {
					elevation = plot.demData.getElevationAtSceneCoords(finalX, finalZ)
				}
				
				coffeeRow.volume.xyz = [finalX, elevation, finalZ]
				plot.children.push(coffeeRow)
				coffeeRow.plot = plot // Pass plot reference for DEM access
				sys(coffeeRow)
				coffeeCounter++
			}
		}
		
		console.log(`  Total coffee rows created: ${coffeeCounter - 1}`)
		console.log(`  Total coffee plants: ${(coffeeCounter - 1) * prototypical_coffee_row.coffeerow.PLANTS_PER_ROW}`)
	}
}

prototypical_plot.onstep = function(daysElapsed) {
	const plot = this

	// sanity check
	if(!plot.children || !plot.children.length) return
	
	// Calculate statistics from current state
	let totalBambooHeight = 0
	let culmCount = 0
	let totalCoffeeHeight = 0
	let coffeePlantCount = 0

	plot.children.forEach(entity => {
		if (entity.clump) {
			entity.children.forEach(culm => {
				totalBambooHeight += culm.volume.hwd[0]
				culmCount++
			})
		} else if (entity.coffeerow) {
			entity.children.forEach(plant => {
				totalCoffeeHeight += plant.volume.hwd[0]
				coffeePlantCount++
			})
		}
	})

	// Harvest phase - check bamboo and coffee
	let stepBambooHarvest = 0
	let stepCoffeeHarvest = 0
	let stepValue = 0
	let stepCO2 = 0
	let stepCostJoules = 0
	
	// Calculate day of year for coffee harvest timing
	const dayOfYear = (plot.stats.days[plot.stats.days.length - 1] || 0) % 365
	
	plot.children.forEach(entity => {
		if (entity.clump) {
			const beforeHarvest = entity.clump.totalHarvested
			const beforeCost = entity.clump.totalCostJoules
			
			entity.onharvest()
			
			stepBambooHarvest += entity.clump.totalHarvested - beforeHarvest
			stepCostJoules += entity.clump.totalCostJoules - beforeCost
		} else if (entity.coffeerow) {
			const beforeHarvest = entity.coffeerow.totalHarvested
			const beforeCost = entity.coffeerow.totalCostJoules
			
			entity.onharvest(dayOfYear)
			
			stepCoffeeHarvest += entity.coffeerow.totalHarvested - beforeHarvest
			stepCostJoules += entity.coffeerow.totalCostJoules - beforeCost
		}
	})
	
	// Update plot cumulative stats from clumps
	plot.stats.cumulativeHarvest = 0
	plot.stats.cumulativeValue = 0
	plot.stats.cumulativeCO2 = 0
	plot.stats.cumulativeCostJoules = 0
	plot.stats.cumulativeCoffeeKg = 0
	
	plot.children.forEach(entity => {
		if (entity.clump) {
			plot.stats.cumulativeHarvest += entity.clump.totalHarvested
			plot.stats.cumulativeValue += entity.clump.totalValue
			plot.stats.cumulativeCO2 += entity.clump.totalCO2
			plot.stats.cumulativeCostJoules += entity.clump.totalCostJoules
		} else if (entity.coffeerow) {
			plot.stats.cumulativeValue += entity.coffeerow.totalValue
			plot.stats.cumulativeCO2 += entity.coffeerow.totalCO2
			plot.stats.cumulativeCostJoules += entity.coffeerow.totalCostJoules
			plot.stats.cumulativeCoffeeKg += entity.coffeerow.totalHarvested
		}
	})
	
	// Record statistics
	const currentDay = plot.stats.days.length > 0 
		? plot.stats.days[plot.stats.days.length - 1] + daysElapsed 
		: daysElapsed
		
	plot.stats.days.push(currentDay)
	plot.stats.totalGrowth.push(totalBambooHeight / (culmCount || 1)) // average bamboo height
	plot.stats.totalHarvest.push(plot.stats.cumulativeHarvest)
	plot.stats.economicYield.push(plot.stats.cumulativeValue)
	plot.stats.co2Sequestered.push(plot.stats.cumulativeCO2)
	plot.stats.energyCostJoules.push(plot.stats.cumulativeCostJoules)
	plot.stats.coffeeHeight.push(totalCoffeeHeight / (coffeePlantCount || 1)) // average coffee height
	plot.stats.coffeeHarvested.push(plot.stats.cumulativeCoffeeKg)
	
	// Update yearly accumulator
	const avgBambooHeight = totalBambooHeight / (culmCount || 1)
	const avgCoffeeHeight = totalCoffeeHeight / (coffeePlantCount || 1)
	
	plot.stats.yearlyAccumulator.bambooSum += avgBambooHeight * daysElapsed
	plot.stats.yearlyAccumulator.coffeeSum += avgCoffeeHeight * daysElapsed
	plot.stats.yearlyAccumulator.daysInYear += daysElapsed
	
	// Check for year boundary (every 365 days)
	const currentYearFraction = currentDay / 365
	const newYearIndex = Math.floor(currentYearFraction)
	
	if (newYearIndex > plot.stats.yearlyAccumulator.yearIndex) {
		// Year boundary reached - calculate yearly stats
		const accumulator = plot.stats.yearlyAccumulator
		
		if (accumulator.daysInYear > 0) {
			const yearlyData = {
				year: accumulator.yearIndex + 1,
				avgBambooHeight: Number((accumulator.bambooSum / accumulator.daysInYear).toFixed(2)),
				avgCoffeeHeight: Number((accumulator.coffeeSum / accumulator.daysInYear).toFixed(2)),
				harvested: plot.stats.cumulativeHarvest - accumulator.harvestBase,
				value: Number((plot.stats.cumulativeValue - accumulator.valueBase).toFixed(2)),
				co2: Number((plot.stats.cumulativeCO2 - accumulator.co2Base).toFixed(2))
			}
			
			plot.stats.yearly.push(yearlyData)
		}
		
		// Reset accumulator for next year
		plot.stats.yearlyAccumulator = {
			yearIndex: newYearIndex,
			bambooSum: 0,
			coffeeSum: 0,
			daysInYear: 0,
			harvestBase: plot.stats.cumulativeHarvest,
			valueBase: plot.stats.cumulativeValue,
			co2Base: plot.stats.cumulativeCO2
		}
	}
	
	// Return step info for logging - @todo probably this is unused - remove
	return {
		currentDay,
		avgBambooHeight: avgBambooHeight,
		avgCoffeeHeight: avgCoffeeHeight,
		stepBambooHarvest,
		stepCoffeeHarvest,
		culmCount,
		coffeePlantCount
	}
}
