import { useEffect, useRef, useState } from "react";

import { deepClone } from '@/_orbital/utils/deepClone.js';
import { sys } from '@/_orbital/services-sys/sys.js';
import { volume_service } from '@/_orbital/services-volume/volume.js';
import { prototypical_dem } from '@/_orbital/entities/dem/dem.js';
import { prototypical_plot } from '@/_orbital/entities/bamboo/plot.js';

///
/// For our convenience the orbital simulation is wrapped by a little helper class
///

class BambooSimWrapper {

        demVolume = null
        plot = null
        onTick = null

        constructor(domElement, onTick = null) {
                this.onTick = onTick
                this.build(domElement)
        }

        async build(domElement) {

                // register volume service and DEM right away at startup
                // @todo domelement should not be set on a shared service!
                // @todo loading dem by hand should go away - it should be declarative
                // @todo use a dynamic area for dem not hardcoded geography
                // @todo don't call the method directly for dem; use sys()

                volume_service.domElement = domElement
                sys(volume_service)

                console.log('BambooSimApp: Loading DEM data...');

                try {

                        this.demVolume = await prototypical_dem.getDemVolume({
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
                        });

                        if(!this.demVolume) {
                                console.error("Cannot load dem")
                                return
                        }

                        sys(this.demVolume);

                        sys({
                                id: 'camera-target',
                                volume: {
                                        shape: 'camera',
                                        xyz: [50, 0, 50]
                                }
                        });

                } catch (error) {
                                console.error('BambooSimApp: Failed to load DEM:', error);
                }

        }

        initializeplotOnce() {

                if(this.plot) return

                console.log('BambooSimApp: Initializing this.plot...');
                
                // Create plot
                this.plot = deepClone(prototypical_plot);
                this.plot.id = 1;
                this.plot.field.width = 100;
                this.plot.field.depth = 100;
                this.plot.field.ENABLE_INTERCROPPING = false;
                
                // Pass DEM data to this.plot.if available
                if (this.demVolume && this.demVolume.volume.demData) {
                                this.plot.demData = this.demVolume.volume.demData;
                }
                
                // Register
                sys(this.plot);
                
                // @todo remove
                // Register all children with sys automatically please
                this.plot.children.forEach(entity => {
                                sys(entity);
                                if (entity.children) {
                                                entity.children.forEach(child => sys(child));
                                }
                });
        }

        isRunning = false
        currentDay = 0
        speed = 1
        rate = 100
        animationId = null
        days = 1

        simulationStep() {
                for (let i = 0; i < this.days; i++) {
                        sys({step: 1});
                        this.currentDay++;
                }
                if (this.onTick) {
                        this.onTick();
                }
        }

        animate() {
                if (!this.isRunning) return
                this.simulationStep(this.speed)
                this.animationId = setTimeout(() => this.animate(), this.rate)
        }

        start() {
                this.initializeplotOnce()
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
                if (!this.plot) {
                                this.initializeplotOnce()
                }
                this.days = days;
                this.simulationStep();
                this.days = 1; // Reset to default
        }

        reset() {
                this.pause();
                this.currentDay = 0;

                // Explicitly reset the plot to clear yearly statistics
                if (this.plot && this.plot.onreset) {
                        this.plot.onreset();
                }

                // Send reset command to volume service through sys
                sys({ volume: { command: 'reset' } });
                
                if (this.onTick) {
                        this.onTick();
                }
        }
}

///
/// HTML Presentation of Sim
///

export function BambooSimWrapperComponent() {
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
                        simRef.current = new BambooSimWrapper(ref.current, updateStats);
                }
                
                // Cleanup function
                return () => {
                        if (simRef.current) {
                                simRef.current.pause(); // Stop any running animations
                        }
                };
        }, []);

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
                        } else if (entity.coffee) {
                                totalCoffeeHeight += entity.volume.hwd[0];
                                coffeePlantCount++;
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
<div className="bg-secondary border-b border-border px-4 py-3">
<div className="container mx-auto flex items-center justify-between">

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
<input type="range" min="1" max="10" value={speed} onChange={handleSpeedChange} className="w-24" />
<span className="text-sm w-8 text-foreground">{speed}x</span>
</div>
</div>

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
