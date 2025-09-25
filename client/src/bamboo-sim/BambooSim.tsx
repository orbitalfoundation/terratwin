import { useEffect, useRef } from "react";

import { deepClone } from './utils/deepClone.js';
import { sys } from './utils/sys.js';
import { prototypical_plot } from './prototypes/plot.js';
import { volume_service } from './services/volume.js';
import { dem_service } from './services/dem.js';

let started = false
let demVolume = null

async function loadDEM() {

  console.log('BambooSimApp: Loading DEM data...');
  
  try {
      // Load DEM for the plot area (Grand Canyon for now)
      demVolume = await dem_service.getDemVolume({
          bounds: {
              north: 36.063,
              south: 36.053,
              east: -112.103,
              west: -112.113
          },
          position: [50, 0, 50],
          sceneSize: [100, 100],  // Match plot size
          heightScale: 0.01,
          includeSatellite: true  // Enable satellite imagery
      });
      
      if (demVolume) {
          console.log('BambooSimApp: Sending DEM volume to sys()');
          sys(demVolume);
          console.log('BambooSimApp: DEM loaded successfully');
          
          // Set camera to center on plot
          sys({
              id: 'camera-target',
              volume: {
                  shape: 'camera',
                  xyz: [50, 0, 50] // Center of the 100x100 plot
              }
          });
      } else {
          console.error('BambooSimApp: DEM volume was null');
      }
  } catch (error) {
      console.error('BambooSimApp: Failed to load DEM:', error);
  }

}

export function BambooSim() {
  const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!ref.current) return;
		if (started) return
		started = true

    console.log('BambooSimApp: Initializing volume service...');
    volume_service.domElement = ref.current
    sys(volume_service);

    loadDEM()

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
