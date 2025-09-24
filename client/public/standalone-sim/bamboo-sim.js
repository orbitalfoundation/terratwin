import { deepClone } from './utils/deepClone.js';
import { sys } from './utils/sys.js';
import { prototypical_plot } from './prototypes/plot.js';
import { prototypical_dendrocalamus_asper_clump } from './prototypes/clump.js';


// Main simulation function
function runSimulation(plot, years = 10) {
	const totalDays = years * 365
	
	// Print table header
	console.log("\n┌──────┬────────────┬────────────┬──────────────┬──────────────┬──────────────┬────────────┬──────────────┬──────────────┐")
	console.log("│ Year │ Bamboo Ht. │ Coffee Ht. │ Bamboo Harv. │ Coffee (kg)  │ Economic ($) │ CO2 (kg)   │ Energy(MJ)   │ Cost ($)     │")
	console.log("├──────┼────────────┼────────────┼──────────────┼──────────────┼──────────────┼────────────┼──────────────┼──────────────┤")
	
	let lastYearHarvest = 0
	let lastStepInfo = null
	
	// Run simulation day by day
	for (let day = 1; day <= totalDays; day++) {
		// Step forward one day using sys
		sys({step: 1})
		
		// Get current statistics from plot
		lastStepInfo = {
			avgBambooHeight: 0,
			avgCoffeeHeight: 0,
			culmCount: 0,
			coffeePlantCount: 0
		}
		
		// Calculate current statistics
		plot.children.forEach(entity => {
			if (entity.clump) {
				entity.children.forEach(culm => {
					lastStepInfo.avgBambooHeight += culm.volume.hwd[0]
					lastStepInfo.culmCount++
				})
			} else if (entity.coffeerow) {
				entity.children.forEach(plant => {
					lastStepInfo.avgCoffeeHeight += plant.volume.hwd[0]
					lastStepInfo.coffeePlantCount++
				})
			}
		})
		
		if (lastStepInfo.culmCount > 0) {
			lastStepInfo.avgBambooHeight /= lastStepInfo.culmCount
		}
		if (lastStepInfo.coffeePlantCount > 0) {
			lastStepInfo.avgCoffeeHeight /= lastStepInfo.coffeePlantCount
		}
		
		// Check if we've completed a year
		if (day % 365 === 0) {
			const year = day / 365
			const yearlyBambooHarvest = plot.stats.cumulativeHarvest - lastYearHarvest
			lastYearHarvest = plot.stats.cumulativeHarvest
			
			// Get coffee harvest data
			let coffeeKg = 0
			plot.children.forEach(entity => {
				if (entity.coffeerow) {
					coffeeKg += entity.coffeerow.totalHarvested
				}
			})
			
			console.log(`│ ${year.toString().padStart(4)} │ ${lastStepInfo.avgBambooHeight.toFixed(2).padStart(9)}m │ ${lastStepInfo.avgCoffeeHeight.toFixed(2).padStart(9)}m │ ${Math.round(yearlyBambooHarvest).toString().padStart(12)} │ ${coffeeKg.toFixed(1).padStart(12)} │ ${plot.stats.cumulativeValue.toFixed(0).padStart(12)} │ ${plot.stats.cumulativeCO2.toFixed(0).padStart(10)} │ ${(plot.stats.cumulativeCostJoules / 1000000).toFixed(0).padStart(12)} │ ${(plot.stats.cumulativeCostJoules / 1000000 * plot.field.USD_PER_MEGAJOULE).toFixed(0).padStart(12)} │`)
		}
	}
	
	console.log("└──────┴────────────┴────────────┴──────────────┴──────────────┴──────────────┴────────────┴──────────────┴──────────────┘")
	
	return plot.stats
}

// Run a simulation exercise

function main() {

	// starting
	console.log("=== Bamboo Simulation Starting ===")
	console.log("Creating bamboo plot (100m x 100m)...")
	const startTime = performance.now()

	// create a test plot
	const plot = deepClone(prototypical_plot)
	plot.id = 1
	plot.field.width = 100  // Set plot dimensions
	plot.field.depth = 100
	plot.field.ENABLE_INTERCROPPING = true  // Enable coffee intercropping
	
	// Use sys() to register the plot; which will initialize it as well
	sys(plot)

	// log a few details
	const clumpCount = plot.children.filter(c => c.clump).length
	const coffeeRowCount = plot.children.filter(c => c.coffeerow).length
	const totalCulms = clumpCount * prototypical_dendrocalamus_asper_clump.clump.CULM_MAX
	const totalCoffeePlants = coffeeRowCount * (plot.children.find(c => c.coffeerow)?.coffeerow.PLANTS_PER_ROW || 0)
	
	console.log(`\nPlot initialized in ${((performance.now() - startTime) / 1000).toFixed(2)} seconds`)
	console.log(`  - ${clumpCount} bamboo clumps`)
	console.log(`  - ${totalCulms} total culms`)
	console.log(`  - ${coffeeRowCount} coffee rows`)
	console.log(`  - ${totalCoffeePlants} total coffee plants`)
	console.log(`  - Bamboo density: ${(clumpCount / (100 * 100 / 10000)).toFixed(2)} clumps per hectare`)
	
	console.log("\nRunning 20-year simulation...")
	console.log("(daily time steps, logging annually)")
	
	// run simulation
	const simStartTime = performance.now()
	const stats = runSimulation(plot, 20)

	// log final stats
	console.log(`\nSimulation completed in ${((performance.now() - simStartTime) / 1000).toFixed(2)} seconds`)
	console.log("\nFinal statistics:")
	console.log(`  Total culms harvested: ${Math.round(plot.stats.cumulativeHarvest)}`)
	
	// Calculate coffee totals
	let totalCoffeeKg = 0
	let totalCoffeeValue = 0
	plot.children.forEach(entity => {
		if (entity.coffeerow) {
			totalCoffeeKg += entity.coffeerow.totalHarvested
			totalCoffeeValue += entity.coffeerow.totalValue
		}
	})
	
	console.log(`  Total coffee harvested: ${totalCoffeeKg.toFixed(2)}kg`)
	console.log(`  Total economic yield: $${plot.stats.cumulativeValue.toFixed(2)}`)
	console.log(`    - Bamboo: $${(plot.stats.cumulativeValue - totalCoffeeValue).toFixed(2)}`)
	console.log(`    - Coffee: $${totalCoffeeValue.toFixed(2)}`)
	console.log(`  Total CO2 sequestered: ${plot.stats.cumulativeCO2.toFixed(2)}kg`)
	console.log(`  Total energy invested: ${(plot.stats.cumulativeCostJoules / 1000000).toFixed(2)} MJ`)
	console.log(`  Total cost invested: $${(plot.stats.cumulativeCostJoules / 1000000 * plot.field.USD_PER_MEGAJOULE).toFixed(2)}`)
	console.log(`  Average yield per hectare: $${(plot.stats.cumulativeValue / (100 * 100 / 10000)).toFixed(2)}`)
	console.log(`  Net profit: $${(plot.stats.cumulativeValue - (plot.stats.cumulativeCostJoules / 1000000 * plot.field.USD_PER_MEGAJOULE)).toFixed(2)}`)
}

// Run the simulation when the file is loaded
main()


