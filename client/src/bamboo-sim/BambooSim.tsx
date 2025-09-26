import { useEffect, useRef, useState } from "react";

import { deepClone } from './utils/deepClone.js';
import { sys } from './utils/sys.js';
import { prototypical_plot } from './prototypes/plot.js';
import { volume_service } from './services/volume.js';
import { dem_service } from './services/dem.js';

/// just stuffed sim into a class for now

class BambooSimWrapper {

        demVolume = null
        plot = null
        onTick = null

        constructor(domElement, onTick = null) {
                this.onTick = onTick
                this.build(domElement)
        }

        async build(domElement) {

                // register service
                // @todo domelement should not be set on shared thing
    volume_service.domElement = domElement
    sys(volume_service)

          console.log('BambooSimApp: Loading DEM data...');

          try {

                        // @todo loading by hand should go away - it should be declarative
                                // @todo use a dynamic area for dem not hardcoded geography
                                // @todo don't call the method directly; use sys()

              // Load DEM
              this.demVolume = await dem_service.getDemVolume({
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
          // Register all children with sys
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

            // @todo does reset even work?
            // Send reset command to volume service through sys
            sys({ volume: { command: 'reset' } });
            
            if (this.onTick) {
                this.onTick();
            }
        }

        // stats

}

export function BambooSim() {
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
                                <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
                                                <div className="container mx-auto flex items-center justify-between">

                                                                <div className="flex items-center space-x-2">
                                                                                <button onClick={handleStart} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Start">
                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                                                                <path d="M8 5v14l11-7z"/>
                                                                                                </svg>
                                                                                </button>
                                                                                <button onClick={handlePause} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Pause">
                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                                                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                                                                                                </svg>
                                                                                </button>
                                                                                <button onClick={handleStep} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 day)">
                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                                                                <path d="M8 5v14l8-7-8-7zm8 0v14h2V5h-2z"/>
                                                                                                </svg>
                                                                                </button>
                                                                                <button onClick={handleYear} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 year)">
                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                                                                <path d="M4 5v14l8-7-8-7zm8 0v14l8-7-8-7z"/>
                                                                                                </svg>
                                                                                </button>
                                                                                <button onClick={handleReset} className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Reset">
                                                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                                                                                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                                                                                                </svg>
                                                                                </button>
                                                                                
                                                                                <div className="flex items-center space-x-2 ml-4 border-l border-gray-600 pl-4">
                                                                                                <span className="text-sm text-gray-400">Speed:</span>
                                                                                                <input type="range" min="1" max="10" value={speed} onChange={handleSpeedChange} className="w-24" />
                                                                                                <span className="text-sm w-8 text-gray-300">{speed}x</span>
                                                                                </div>
                                                                </div>
                                                                
                                                                <div className="flex items-center space-x-6 text-sm">
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Day:</span>
                                                                                                <span className="text-white">{currentDay}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Year:</span>
                                                                                                <span className="text-white">{currentYear}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Bamboo:</span>
                                                                                                <span className="text-white">{stats.bambooHeight}m</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Coffee:</span>
                                                                                                <span className="text-white">{stats.coffeeHeight}m</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Harvested:</span>
                                                                                                <span className="text-white">{stats.harvested}</span>
                                                                                </div>
                                                                                <div className="flex items-center space-x-2">
                                                                                                <span className="text-gray-400">Value:</span>
                                                                                                <span className="text-white">${stats.value}</span>
                                                                                </div>
                                                                </div>
                                                </div>
                                </div>

                                <div className="flex-1 flex flex-col">
                                                <main className="flex-1 flex flex-col">
                                                                <div className="bg-gray-800 border-b border-gray-700">
                                                                                <div className="flex">
                                                                                                <button 
                                                                                                        onClick={() => handleTabChange('3d')} 
                                                                                                        className={`px-6 py-3 hover:bg-gray-700 transition border-b-2 ${activeTab === '3d' ? 'border-blue-500' : 'border-transparent'}`}
                                                                                                >
                                                                                                                3D View
                                                                                                </button>
                                                                                                <button 
                                                                                                        onClick={() => handleTabChange('stats')} 
                                                                                                        className={`px-6 py-3 hover:bg-gray-700 transition border-b-2 ${activeTab === 'stats' ? 'border-blue-500' : 'border-transparent'}`}
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
                                                                                                <div className="bg-gray-900 rounded p-6">
                                                                                                                <h3 className="text-xl font-bold text-white mb-4">Simulation Statistics</h3>
                                                                                                                {simRef.current?.plot?.stats ? (
                                                                                                                                <div className="overflow-x-auto">
                                                                                                                                                <table className="w-full text-sm text-gray-300">
                                                                                                                                                                <thead>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <th className="text-left py-2 px-4">Metric</th>
                                                                                                                                                                                                <th className="text-right py-2 px-4">Current Value</th>
                                                                                                                                                                                                <th className="text-right py-2 px-4">Unit</th>
                                                                                                                                                                                </tr>
                                                                                                                                                                </thead>
                                                                                                                                                                <tbody>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Current Day</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4">{currentDay}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">days</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Current Year</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4">{currentYear.toFixed(1)}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">years</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Average Bamboo Height</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-green-400">{stats.bambooHeight}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">m</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Average Coffee Height</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-purple-400">{stats.coffeeHeight}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">m</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Total Harvested</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-yellow-400">{stats.harvested}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">units</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                <td className="py-2 px-4">Total Economic Value</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-blue-400">${stats.value.toLocaleString()}</td>
                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">USD</td>
                                                                                                                                                                                </tr>
                                                                                                                                                                                {simRef.current?.plot?.stats?.cumulativeCO2 && (
                                                                                                                                                                                                <tr className="border-b border-gray-700">
                                                                                                                                                                                                                <td className="py-2 px-4">CO2 Sequestered</td>
                                                                                                                                                                                                                <td className="text-right py-2 px-4 text-indigo-400">{simRef.current.plot.stats.cumulativeCO2.toFixed(1)}</td>
                                                                                                                                                                                                                <td className="text-right py-2 px-4 text-gray-500">kg</td>
                                                                                                                                                                                                </tr>
                                                                                                                                                                                )}
                                                                                                                                                                </tbody>
                                                                                                                                                                </table>
                                                                                                                                                </div>
                                                                                                                ) : (
                                                                                                                                <div className="text-center py-8 text-gray-400">
                                                                                                                                                <p>No simulation data yet. Start the simulation to see statistics.</p>
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
