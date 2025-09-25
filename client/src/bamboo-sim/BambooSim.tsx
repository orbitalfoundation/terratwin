import { useEffect, useRef } from "react";

import { deepClone } from './utils/deepClone.js';
import { sys } from './utils/sys.js';
import { prototypical_plot } from './prototypes/plot.js';
import { volume_service } from './services/volume.js';
import { dem_service } from './services/dem.js';

/// just stuffed sim into a class for now

class BambooSimWrapper {

	demVolume = null
	plot = null

	constructor(domElement) {
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
	    
	}

	// stats

}

let sim = null

export function BambooSim() {
  const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!ref.current) return;
		if(!sim) {
			sim = new BambooSimWrapper(ref.current)
		}

		// Add event listeners for control buttons
		const startBtn = document.getElementById('startBtn');
		const pauseBtn = document.getElementById('pauseBtn');
		const stepBtn = document.getElementById('stepBtn');
		const yearBtn = document.getElementById('yearBtn');
		const resetBtn = document.getElementById('resetBtn');
		const speedControl = document.getElementById('speedControl') as HTMLInputElement;
		const speedValue = document.getElementById('speedValue');

		const handleStart = () => sim?.start();
		const handlePause = () => sim?.pause();
		const handleStep = () => sim?.step(1);
		const handleYear = () => sim?.step(365);
		const handleReset = () => sim?.reset();
		const handleSpeed = (e: Event) => {
			const target = e.target as HTMLInputElement;
			const speed = parseInt(target.value);
			if (sim) {
				sim.speed = speed;
				if (speedValue) speedValue.textContent = `${speed}x`;
			}
		};

		startBtn?.addEventListener('click', handleStart);
		pauseBtn?.addEventListener('click', handlePause);
		stepBtn?.addEventListener('click', handleStep);
		yearBtn?.addEventListener('click', handleYear);
		resetBtn?.addEventListener('click', handleReset);
		speedControl?.addEventListener('input', handleSpeed);

		// Cleanup event listeners on unmount
		return () => {
			startBtn?.removeEventListener('click', handleStart);
			pauseBtn?.removeEventListener('click', handlePause);
			stepBtn?.removeEventListener('click', handleStep);
			yearBtn?.removeEventListener('click', handleYear);
			resetBtn?.removeEventListener('click', handleReset);
			speedControl?.removeEventListener('input', handleSpeed);
		};
	}, []);

	return (
		<div className="flex flex-col h-screen">
				<div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
						<div className="container mx-auto flex items-center justify-between">

								<div className="flex items-center space-x-2">
										<button id="startBtn" className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Start">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M8 5v14l11-7z"/>
												</svg>
										</button>
										<button id="pauseBtn" className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Pause">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
												</svg>
										</button>
										<button id="stepBtn" className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 day)">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M8 5v14l8-7-8-7zm8 0v14h2V5h-2z"/>
												</svg>
										</button>
										<button id="yearBtn" className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 year)">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M4 5v14l8-7-8-7zm8 0v14l8-7-8-7z"/>
												</svg>
										</button>
										<button id="resetBtn" className="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Reset">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
												</svg>
										</button>
										
										<div className="flex items-center space-x-2 ml-4 border-l border-gray-600 pl-4">
												<span className="text-sm text-gray-400">Speed:</span>
												<input id="speedControl" type="range" min="1" max="10" defaultValue="1" className="w-24" />
												<span id="speedValue" className="text-sm w-8 text-gray-300">1x</span>
										</div>
								</div>
								
								<div className="flex items-center space-x-6 text-sm">
										<div className="flex items-center space-x-2">
												<span className="text-gray-400">Bamboo:</span>
												<span id="bambooHeight" className="text-white">0m</span>
										</div>
										<div className="flex items-center space-x-2">
												<span className="text-gray-400">Coffee:</span>
												<span id="coffeeHeight" className="text-white">0m</span>
										</div>
										<div className="flex items-center space-x-2">
												<span className="text-gray-400">Harvested:</span>
												<span id="harvested" className="text-white">0</span>
										</div>
										<div className="flex items-center space-x-2">
												<span className="text-gray-400">Value:</span>
												<span id="value" className="text-white">$0</span>
										</div>
								</div>
						</div>
				</div>

				<div className="flex-1 flex flex-col">
						<main className="flex-1 flex flex-col">
								<div className="bg-gray-800 border-b border-gray-700">
										<div className="flex">
												<button data-tab="3d" className="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														3D View
												</button>
												<button data-tab="stats" className="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														Statistics
												</button>
												<button data-tab="config" className="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														Configuration
												</button>
										</div>
								</div>

								<div className="flex-1 relative">
										<div ref={ref} data-content="3d" className="absolute inset-0"
 style={{
    position: 'relative',
    width: "100%",
    height: "100%",
    overflow: 'hidden'
  }}

										>
												<div id="threejs-container" className="w-full h-full"></div>
										</div>
										<div data-content="stats" className="absolute inset-0 hidden p-4 overflow-y-auto">
												<canvas id="statsCanvas" className="w-full bg-gray-900 rounded"></canvas>
										</div>
										<div data-content="config" className="absolute inset-0 hidden p-4 overflow-y-auto">
												<div id="configPanel"></div>
										</div>
								</div>
						</main>
				</div>
		</div>
	)
}
