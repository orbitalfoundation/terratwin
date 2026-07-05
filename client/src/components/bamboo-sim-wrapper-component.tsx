import { useEffect, useRef, useState } from "react";

import { createBus } from '@orbitalfoundation/bus';
import { volume_system } from '@orbitalfoundation/orbital-volume';

import { deepClone } from '@/_orbital/utils/deepClone.js';
import { prototypical_plot } from '@/_orbital/entities/bamboo/plot.js';
import type { Plot } from '@/shared/schema';

// default dem
const DEM_STATIC = {
	bounds: {
		north: 36.063,
		south: 36.053,
		east: -112.103,
		west: -112.113
	},
	position: [50, 0, 50],
	sceneSize: [100, 100],
	heightScale: 0.01,
	includeSatellite: true
}

// every volume entity binds to this render surface (the div id below)
const SURFACE = 'threejs-container'

///
/// The orbital simulation, wired to the official @orbitalfoundation/bus and
/// @orbitalfoundation/orbital-volume packages (no vendored fork):
///
/// - the scene/camera/terrain are declared volume entities
/// - every bamboo culm renders through one 'vegetation' volume (two instanced
///   draw calls for the whole plot - stalks + leaf crowns, GPU wind)
/// - the sim tree (plot -> clumps -> culms, coffee rows) is stepped directly
///   and mirrored into the vegetation component's plants array
///

class BambooSimWrapper {

	plot = null
	onTick = null
	plotData = null

	bus = null
	realtime = null
	terrainEntity = null
	vegetationEntity = null
	coffeeEntities = []
	demData = null
	booted = false

	isRunning = false
	currentDay = 0
	speed = 1
	animationId = null

	constructor(_domElement, _onTick = null, _plotData = null) {
		this.onTick = _onTick
		this.plotData = _plotData
		this.bus = createBus()
		this.boot()
	}

	async boot() {

		const bus = this.bus

		// volume renders 'volume' components; register it first
		await bus.resolve(volume_system)

		await bus.resolve({
			uuid: 'scene001',
			volume: {
				surface: SURFACE,
				geometry: 'scene',
				background: 0xbfd7e8,
				near: 0.1,
				far: 1000,
				aperture: 45,
				prettier: true,
				exposure: 1.15,
				sky: true,
				fog: { color: 0xe1ecf2, near: 130, far: 480 },
				hemisphere: { sky: 0xcfe4f4, ground: 0x8f7f5e, intensity: 1.25 },
				sun: {
					color: 0xfff1d8,
					intensity: 2.4,
					position: [90, 110, 10],
					target: [50, 0, 50],
					shadow: { extent: 90, near: 10, far: 350 }
				}
			}
		})

		await bus.resolve({
			uuid: 'camera001',
			volume: {
				surface: SURFACE,
				geometry: 'camera',
				cameraMin: 5,
				cameraMax: 600,
				pose: {
					position: [145, 75, 145],
					love: [50, 10, 50]
				}
			}
		})

		// terrain resolves fully (tiles fetched) before this returns
		this.terrainEntity = {
			uuid: 'terrain001',
			volume: {
				surface: SURFACE,
				geometry: 'terrain',
				terrain: {
					bounds: DEM_STATIC.bounds,
					zoom: 14,
					satellite: DEM_STATIC.includeSatellite,
					size: DEM_STATIC.sceneSize,
					heightScale: DEM_STATIC.heightScale
				},
				pose: { position: DEM_STATIC.position }
			}
		}
		await bus.resolve(this.terrainEntity)

		// adapter with the sampler shape the sim entities expect; terrain
		// local coords are centered so shift by the terrain position
		const terrain = this.terrainEntity.volume.terrain
		this.demData = {
			getElevationAtSceneCoords: (x, z) =>
				terrain.ready ? terrain.sample(x - DEM_STATIC.position[0], z - DEM_STATIC.position[2]) : 0
		}

		// all bamboo in the plot renders through this single entity
		this.vegetationEntity = {
			uuid: 'vegetation001',
			volume: {
				surface: SURFACE,
				geometry: 'vegetation',
				vegetation: {
					capacity: 4096,
					plants: [],
					dirty: false
				},
				pose: { position: [0, 0, 0] }
			}
		}
		await bus.resolve(this.vegetationEntity)

		// rendering + wind run on the bus realtime loop (rAF in the browser)
		this.realtime = await bus.resolve({ run: 'realtime', hz: 60, dt: 1 / 60 })

		this.booted = true
		await this.regeneratePlot(this.plotData)
	}

	async regeneratePlot(plotData = null) {
		if (!this.booted) return

		// retire any coffee bushes from a previous generation
		for (const coffee of this.coffeeEntities) {
			coffee.obliterate = true
			await this.bus.resolve(coffee)
		}
		this.coffeeEntities = []

		// build the sim tree
		this.plot = deepClone(prototypical_plot);
		this.plot.id = plotData?.id || 1;
		this.plot.field.width = 100;
		this.plot.field.depth = 100;

		// Copy properties from schema if provided
		if (plotData) {
			// Basic properties
			this.plot.field.speciesDensity = plotData.speciesDensity || 'medium';
			this.plot.field.harvestYears = plotData.harvestYears || 5;
			this.plot.field.harvestRate = plotData.harvestRate || 20;

			// Environment properties
			this.plot.field.elevation = plotData.elevation || 0;
			this.plot.field.slopeFacing = plotData.slopeFacing || 0;
			this.plot.field.steepness = plotData.steepness || 0;
			this.plot.field.rainfall = plotData.rainfall || 0;
			this.plot.field.drainage = plotData.drainage || 5000;

			// Soil properties
			this.plot.field.soilSalts = plotData.soilSalts || 50;
			this.plot.field.soilNitrogen = plotData.soilNitrogen || 50;
			this.plot.field.soilMicrobialMass = plotData.soilMicrobialMass || 50;
			this.plot.field.soilEarthworms = plotData.soilEarthworms || 50;
			this.plot.field.soilAcidity = plotData.soilAcidity || 7.0;
			this.plot.field.soilFertility = plotData.soilFertility || 50;

			// Pest properties (convert from string to boolean)
			this.plot.field.pestBambooBorer = plotData.pestBambooBorer === 'true';
			this.plot.field.pestAphids = plotData.pestAphids === 'true';
			this.plot.field.pestFungalPathogens = plotData.pestFungalPathogens === 'true';

			// Intervention properties (convert from string to boolean)
			this.plot.field.interventionWeeding = plotData.interventionWeeding === 'true';
			this.plot.field.interventionMulching = plotData.interventionMulching === 'true';
			this.plot.field.interventionFertilization = plotData.interventionFertilization === 'true';
			this.plot.field.interventionPestControl = plotData.interventionPestControl === 'true';

			// Intercropping properties (convert from string to boolean)
			this.plot.field.intercroppingLegumes = plotData.intercroppingLegumes === 'true';
			this.plot.field.intercroppingHerbs = plotData.intercroppingHerbs === 'true';
			this.plot.field.intercroppingSpecialtyCrops = plotData.intercroppingSpecialtyCrops === 'true';
			this.plot.field.intercroppingAnimals = plotData.intercroppingAnimals === 'true';
		}

		this.plot.demData = this.demData
		this.plot.oninit()

		// publish coffee bushes (individual prims; only present when
		// intercropping is enabled, so counts stay small)
		for (const entity of this.plot.children) {
			if (!entity.coffeerow) continue
			for (const plant of entity.children) {
				const coffee = {
					uuid: `coffee-${plant.id}`,
					_plant: plant,
					volume: {
						surface: SURFACE,
						geometry: 'sphere',
						material: { color: 0x3a5f2a },
						pose: {
							position: [plant.volume.xyz[0], plant.volume.xyz[1], plant.volume.xyz[2]],
							scale: [0.01, 0.01, 0.01]
						}
					}
				}
				this.coffeeEntities.push(coffee)
				await this.bus.resolve(coffee)
			}
		}

		this.syncRender()
	}

	// mirror the sim tree into the render components
	syncRender() {
		if (!this.vegetationEntity || !this.plot) return
		const veg = this.vegetationEntity.volume.vegetation
		const plants = veg.plants = []

		this.plot.children.forEach(entity => {
			if (!entity.clump) return
			entity.children.forEach(culm => {
				plants.push({
					xyz: culm.volume.xyz,
					height: culm.volume.hwd[0],
					radius: culm.volume.hwd[1],
					color: culm.volume.color,
					tilt: [culm.volume.ypr[0], culm.volume.ypr[1]]
				})
			})
		})
		veg.dirty = true

		// coffee bushes: pose is live-bound to the scene node after first render
		for (const coffee of this.coffeeEntities) {
			const plant = coffee._plant
			const pose = coffee.volume.pose
			const h = Math.max(plant.volume.hwd[0], 0.02)
			const r = Math.max(plant.volume.hwd[1], 0.02)
			if (pose.position.set) {
				pose.position.set(plant.volume.xyz[0], plant.volume.xyz[1] + h / 2, plant.volume.xyz[2])
				pose.scale.set(r, h / 2, r)
			}
		}
	}

	simulationStep() {
		if (!this.plot) return
		// Run simulation for 'speed' number of days
		for (let i = 0; i < this.speed; i++) {
			this.plot.children.forEach(entity => {
				if (entity.clump) {
					entity.children.forEach(culm => culm.onstep(1))
				} else if (entity.coffeerow) {
					entity.onstep(1)
				}
			})
			this.plot.onstep(1)
			this.currentDay++;
		}
		this.syncRender()
		if (this.onTick) {
			this.onTick();
		}
	}

	animate() {
		if (!this.isRunning) return
		this.simulationStep()
		this.animationId = setTimeout(() => this.animate(), 100) // Fixed 100ms interval
	}

	start() {
		this.isRunning = true
		this.animate()
	}

	pause() {
		this.isRunning = false
		if (this.animationId) {
			clearTimeout(this.animationId)
			this.animationId = null
		}
	}

	step(days = 1) {
		// Temporarily store current speed
		const originalSpeed = this.speed;
		this.speed = days;
		this.simulationStep();
		this.speed = originalSpeed; // Restore original speed
	}

	reset() {
		this.pause();
		this.currentDay = 0;
		this.regeneratePlot(this.plotData);
		if (this.onTick) {
			this.onTick();
		}
	}

	updatePlotData(newPlotData) {
		this.plotData = newPlotData;
		this.regeneratePlot(this.plotData);
	}

	dispose() {
		this.pause()
		if (this.realtime && this.realtime.stop) {
			this.realtime.stop()
		}
	}
}



///
/// HTML Presentation of Sim
///

interface BambooSimWrapperComponentProps {
	plotData?: Plot | null;
}

export function BambooSimWrapperComponent({ plotData }: BambooSimWrapperComponentProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const simRef = useRef<BambooSimWrapper | null>(null);
	const [speed, setSpeed] = useState(1);
	const [activeTab, setActiveTab] = useState('3d');
	const [stats, setStats] = useState({
		bambooHeight: 0,
		coffeeHeight: 0,
		harvested: 0,
		value: 0
	});
	const [currentDay, setCurrentDay] = useState(0);
	const [currentYear, setCurrentYear] = useState(0);

	useEffect(() => {
		if (!ref.current) return;
		if (!simRef.current) {
			simRef.current = new BambooSimWrapper(ref.current, updateStats, plotData);
		}

		// Cleanup function
		return () => {
			if (simRef.current) {
				simRef.current.pause(); // Stop any running animations
			}
		};
	}, []);

	// Update plot data when it changes
	useEffect(() => {
		if (simRef.current && plotData) {
			simRef.current.updatePlotData(plotData);
		}
	}, [plotData]);

	const handleStart = () => simRef.current?.start();
	const handlePause = () => simRef.current?.pause();
	const handleStep = () => simRef.current?.step(1);
	const handleYear = () => simRef.current?.step(365);
	const handleReset = () => simRef.current?.reset();

	const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const newSpeed = parseInt(e.target.value);
		setSpeed(newSpeed);
		if (simRef.current) {
			simRef.current.speed = newSpeed;
		}
	};

	const handleTabChange = (tab: string) => {
		setActiveTab(tab);
	};

	const updateStats = () => {
		if (!simRef.current?.plot) return;

		let totalBambooHeight = 0;
		let culmCount = 0;
		let totalCoffeeHeight = 0;
		let coffeePlantCount = 0;

		simRef.current.plot.children.forEach((entity: any) => {
			if (entity.clump) {
				entity.children.forEach((culm: any) => {
					totalBambooHeight += culm.volume.hwd[0];
					culmCount++;
				});
			} else if (entity.coffeerow) {
				entity.children.forEach((plant: any) => {
					totalCoffeeHeight += plant.volume.hwd[0];
					coffeePlantCount++;
				});
			}
		});

		const avgBambooHeight = culmCount > 0 ? totalBambooHeight / culmCount : 0;
		const avgCoffeeHeight = coffeePlantCount > 0 ? totalCoffeeHeight / coffeePlantCount : 0;

		// Update current day and year
		const newCurrentDay = simRef.current.currentDay;
		const newCurrentYear = Math.floor(newCurrentDay / 365);
		setCurrentDay(newCurrentDay);
		setCurrentYear(newCurrentYear);

		// Update React state
		setStats({
			bambooHeight: parseFloat(avgBambooHeight.toFixed(1)),
			coffeeHeight: parseFloat(avgCoffeeHeight.toFixed(1)),
			harvested: simRef.current.plot.stats.cumulativeHarvest || 0,
			value: simRef.current.plot.stats.cumulativeValue || 0
		});

	};

return (
<div className="flex flex-col h-screen">
<div className="bg-secondary border-b border-border px-4 py-2">
<div className="container mx-auto">
{/* First row: Controls and Speed */}
<div className="flex items-center justify-between mb-2">
<div className="flex items-center space-x-2">
<button onClick={handleStart} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Start" data-testid="button-start-simulation">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
<path d="M8 5v14l11-7z"/>
</svg>
</button>
<button onClick={handlePause} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Pause" data-testid="button-pause-simulation">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
</svg>
</button>
<button onClick={handleStep} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 day)" data-testid="button-step-simulation">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
<path d="M8 5v14l8-7-8-7zm8 0v14h2V5h-2z"/>
</svg>
</button>
<button onClick={handleYear} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 year)" data-testid="button-year-simulation">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
<path d="M4 5v14l8-7-8-7zm8 0v14l8-7-8-7z"/>
</svg>
</button>
<button onClick={handleReset} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Reset" data-testid="button-reset-simulation">
<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
</svg>
</button>

<div className="flex items-center space-x-2 ml-4 border-l border-border pl-4">
<span className="text-sm text-muted-foreground">Speed:</span>
<input type="range" min="1" max="60" value={speed} onChange={handleSpeedChange} className="w-32" />
<span className="text-sm w-12 text-foreground">{speed}x</span>
</div>
</div>
</div>

{/* Second row: Stats */}
<div className="flex items-center space-x-6 text-sm">
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Day:</span>
<span className="text-foreground">{currentDay}</span>
</div>
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Year:</span>
<span className="text-foreground">{currentYear}</span>
</div>
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Bamboo:</span>
<span className="text-foreground">{stats.bambooHeight}m</span>
</div>
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Coffee:</span>
<span className="text-foreground">{stats.coffeeHeight}m</span>
</div>
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Harvested:</span>
<span className="text-foreground">{stats.harvested}</span>
</div>
<div className="flex items-center space-x-2">
<span className="text-muted-foreground">Value:</span>
<span className="text-foreground">${stats.value}</span>
</div>
</div>
</div>
</div>

<div className="flex-1 flex flex-col">
<main className="flex-1 flex flex-col">
<div className="bg-secondary border-b border-border">
<div className="flex">
<button
onClick={() => handleTabChange('3d')}
className={`px-6 py-3 hover:bg-accent hover:text-accent-foreground transition border-b-2 ${activeTab === '3d' ? 'border-primary' : 'border-transparent'}`}
>
3D View
</button>
<button
onClick={() => handleTabChange('stats')}
className={`px-6 py-3 hover:bg-accent hover:text-accent-foreground transition border-b-2 ${activeTab === 'stats' ? 'border-primary' : 'border-transparent'}`}
>
Statistics
</button>
</div>
</div>

<div className="flex-1 relative">
<div className={`absolute inset-0 ${activeTab === '3d' ? '' : 'hidden'}`}>
<div
ref={ref}
id="threejs-container"
className="w-full h-full"
style={{
position: 'relative',
width: "100%",
height: "100%",
overflow: 'hidden'
}}
/>
</div>
<div className={`absolute inset-0 p-4 overflow-y-auto ${activeTab === 'stats' ? '' : 'hidden'}`} data-content="stats">
<div className="bg-card border border-border rounded p-6">
<h3 className="text-xl font-bold text-card-foreground mb-4">Yearly Accumulated Statistics</h3>
{simRef.current?.plot?.stats?.yearly && simRef.current.plot.stats.yearly.length > 0 ? (
<div className="overflow-x-auto">
<table className="w-full text-sm text-card-foreground">
<thead>
<tr className="border-b border-border">
<th className="text-left py-2 px-4">Year</th>
<th className="text-right py-2 px-4">Avg Bamboo Height (m)</th>
<th className="text-right py-2 px-4">Avg Coffee Height (m)</th>
<th className="text-right py-2 px-4">Harvested (units)</th>
<th className="text-right py-2 px-4">Economic Value (USD)</th>
<th className="text-right py-2 px-4">CO2 (kg)</th>
</tr>
</thead>
<tbody>
{simRef.current.plot.stats.yearly.map((yearData: any, index: number) => (
<tr key={yearData.year} className="border-b border-border" data-testid={`row-year-${yearData.year}`}>
<td className="py-2 px-4 font-medium">Year {yearData.year}</td>
<td className="text-right py-2 px-4 text-green-400" data-testid={`text-bambooHeight-${yearData.year}`}>
{yearData.avgBambooHeight}
</td>
<td className="text-right py-2 px-4 text-purple-400" data-testid={`text-coffeeHeight-${yearData.year}`}>
{yearData.avgCoffeeHeight}
</td>
<td className="text-right py-2 px-4 text-yellow-400" data-testid={`text-harvested-${yearData.year}`}>
{yearData.harvested}
</td>
<td className="text-right py-2 px-4 text-blue-400" data-testid={`text-value-${yearData.year}`}>
${yearData.value.toLocaleString()}
</td>
<td className="text-right py-2 px-4 text-indigo-400" data-testid={`text-co2-${yearData.year}`}>
{yearData.co2}
</td>
</tr>
))}
</tbody>
</table>
</div>
) : (
<div className="text-center py-8 text-muted-foreground">
<p>No yearly data yet. Run the simulation for a full year to see accumulated statistics.</p>
<p className="text-xs mt-2">Current simulation: Day {currentDay}, Year {currentYear.toFixed(1)}</p>
</div>
)}
</div>
</div>
</div>
</main>
</div>
</div>
)
}
