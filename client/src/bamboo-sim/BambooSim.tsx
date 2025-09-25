import { useEffect, useRef } from "react";
import * as THREE from "three";

//import { BambooSimApp } from './ui/app.js';

function setupThree(domElement) {

	if(domElement.renderer) return

	const renderer = new THREE.WebGLRenderer({ antialias: true });
	domElement.appendChild(renderer.domElement);
	domElement.renderer = renderer

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
	camera.position.set(0, 0, 3);

	const mesh = new THREE.Mesh(
		new THREE.BoxGeometry(1, 1, 1),
		new THREE.MeshStandardMaterial({ color: 0x6699ff })
	);
	scene.add(mesh);

	const light = new THREE.DirectionalLight(0xffffff, 1.2);
	light.position.set(1, 2, 3);
	scene.add(light);

	let raf = 0;
	const resize = () => {
		const { width, height } = domElement.getBoundingClientRect();
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setSize(width, height, false);
		camera.aspect = width / height || 1;
		camera.updateProjectionMatrix();
	};
	resize();
	window.addEventListener("resize", resize);

	let t0 = performance.now();
	const loop = (t: number) => {
		const dt = (t - t0) / 1000;
		t0 = t;
		mesh.rotation.y += dt;  // animate
		renderer.render(scene, camera);
		raf = requestAnimationFrame(loop);
	};
	raf = requestAnimationFrame(loop);

	// Cleanup
	return () => {
		cancelAnimationFrame(raf);
		window.removeEventListener("resize", resize);
		renderer.dispose();
		renderer.domElement.remove();
		scene.traverse(obj => {
			if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose?.();
			const mat = (obj as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
			if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
			else mat?.dispose?.();
		});
	};
}

export function BambooSim({ className = "h-64 w-full" }) {
  const ref = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		if (!ref.current) return;
		const cleanup = setupThree(ref.current);
		return cleanup;
	}, []);

	return (
		<div class="flex flex-col h-screen">
				<div class="bg-gray-800 border-b border-gray-700 px-4 py-3">
						<div class="container mx-auto flex items-center justify-between">

								<div class="flex items-center space-x-2">
										<button id="startBtn" class="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Start">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M8 5v14l11-7z"/>
												</svg>
										</button>
										<button id="pauseBtn" class="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Pause">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
												</svg>
										</button>
										<button id="stepBtn" class="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 day)">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M8 5v14l8-7-8-7zm8 0v14h2V5h-2z"/>
												</svg>
										</button>
										<button id="yearBtn" class="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Step (1 year)">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M4 5v14l8-7-8-7zm8 0v14l8-7-8-7z"/>
												</svg>
										</button>
										<button id="resetBtn" class="p-2 bg-white text-black hover:bg-gray-200 rounded transition" title="Reset">
												<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
														<path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
												</svg>
										</button>
										
										<div class="flex items-center space-x-2 ml-4 border-l border-gray-600 pl-4">
												<span class="text-sm text-gray-400">Speed:</span>
												<input id="speedControl" type="range" min="1" max="10" value="1" class="w-24"></input>
												<span id="speedValue" class="text-sm w-8 text-gray-300">1x</span>
										</div>
								</div>
								
								<div class="flex items-center space-x-6 text-sm">
										<div class="flex items-center space-x-2">
												<span class="text-gray-400">Bamboo:</span>
												<span id="bambooHeight" class="text-white">0m</span>
										</div>
										<div class="flex items-center space-x-2">
												<span class="text-gray-400">Coffee:</span>
												<span id="coffeeHeight" class="text-white">0m</span>
										</div>
										<div class="flex items-center space-x-2">
												<span class="text-gray-400">Harvested:</span>
												<span id="harvested" class="text-white">0</span>
										</div>
										<div class="flex items-center space-x-2">
												<span class="text-gray-400">Value:</span>
												<span id="value" class="text-white">$0</span>
										</div>
								</div>
						</div>
				</div>

				<div class="flex-1 flex flex-col">
						<main class="flex-1 flex flex-col">
								<div class="bg-gray-800 border-b border-gray-700">
										<div class="flex">
												<button data-tab="3d" class="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														3D View
												</button>
												<button data-tab="stats" class="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														Statistics
												</button>
												<button data-tab="config" class="px-6 py-3 hover:bg-gray-700 transition border-b-2 border-transparent">
														Configuration
												</button>
										</div>
								</div>

								<div class="flex-1 relative">
										<div ref={ref} data-content="3d" class="absolute inset-0">
												<div id="threejs-container" class="w-full h-full"></div>
										</div>
										<div data-content="stats" class="absolute inset-0 hidden p-4 overflow-y-auto">
												<canvas id="statsCanvas" class="w-full bg-gray-900 rounded"></canvas>
										</div>
										<div data-content="config" class="absolute inset-0 hidden p-4 overflow-y-auto">
												<div id="configPanel"></div>
										</div>
								</div>
						</main>
				</div>
		</div>
	)
}
