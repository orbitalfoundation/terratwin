import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BambooBatch } from './bamboo-batch.js';

// screen-space vertical sky gradient used as the scene background
function buildSkyTexture() {
	const canvas = document.createElement('canvas');
	canvas.width = 2;
	canvas.height = 512;
	const ctx = canvas.getContext('2d');
	const grad = ctx.createLinearGradient(0, 0, 0, 512);
	grad.addColorStop(0.0, '#7ab3dd');   // zenith
	grad.addColorStop(0.55, '#b8d8ea');
	grad.addColorStop(0.8, '#e6eff2');   // horizon haze
	grad.addColorStop(1.0, '#f2ede2');
	ctx.fillStyle = grad;
	ctx.fillRect(0, 0, 2, 512);
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	return texture;
}

export const volume_service = {
	id: 'volume-service',
	kind: 'service',

	domElement: null,
	builtScene: false,
	scene: null,
	camera: null,
	renderer: null,
	controls: null,
	bamboo: null, // instanced culm + foliage batch renderer
	meshes: new Map(), // Map entity IDs to their meshes
	entities: new Map(), // Map entity IDs to entities with volume

	oninit: function() {

		console.log("Volume service initializing 3D scene... status:",this.builtScene)
		if(this.builtScene) return
		this.builtScene = true

		if(!this.domElement) {
			console.error("Volume: for now a dom element must be supplied")
			return
		}

		// Create renderer with WebGL fallback
		let renderer;
		try {
			renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
			renderer.shadowMap.enabled = true;
			renderer.shadowMap.type = THREE.PCFSoftShadowMap;
			renderer.toneMapping = THREE.ACESFilmicToneMapping;
			renderer.toneMappingExposure = 1.15;
			renderer.outputColorSpace = THREE.SRGBColorSpace;
		} catch (error) {
			if (this.domElement) {
				this.domElement.innerHTML = "Your browser may be a replit internal debug panel without webgl support. It's not critical to render this view, just appreciate that there is no webgl in your mode."
			}
			return;
		}

		// attach to parent in a useful way
		const host = this.domElement
	  host.appendChild(renderer.domElement);
	  Object.assign(renderer.domElement.style, {
	    position: 'absolute',
	    inset: '0',
	    width: '100%',
	    height: '100%',
	  });
	  Object.assign(host.style, {
	    position: 'relative',
	    overflow: 'hidden',
	  });

	  const resize = () => {
	    const { width, height } = host.getBoundingClientRect();
	    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	    renderer.setSize(width, height, false);
	    if (this.camera) {
	      this.camera.aspect = width / Math.max(height, 1);
	      this.camera.updateProjectionMatrix();
	    }
	  };

	  // scene
		this.scene = new THREE.Scene();
		this.scene.background = buildSkyTexture();
		this.scene.fog = new THREE.Fog(0xe1ecf2, 180, 700);

		// camera
		this.camera = new THREE.PerspectiveCamera(
			45,
			window.innerWidth / window.innerHeight,
			0.1,
			1000
		);
		this.camera.position.set(145, 75, 145);
		this.camera.lookAt(50, 10, 50);

		resize();
		window.addEventListener('resize', resize);

		// controls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.maxPolarAngle = Math.PI * 0.495; // keep the camera above ground
		this.controls.target.set(50, 0, 50); // Default center on plot center

		// lights - sky/ground hemisphere plus one warm shadow-casting sun
		const hemiLight = new THREE.HemisphereLight(0xcfe4f4, 0x8f7f5e, 1.25);
		this.scene.add(hemiLight);

		const sun = new THREE.DirectionalLight(0xfff1d8, 2.4);
		sun.position.set(90, 110, 10);
		sun.target.position.set(50, 0, 50);
		sun.castShadow = true;
		sun.shadow.mapSize.set(2048, 2048);
		sun.shadow.camera.left = -90;
		sun.shadow.camera.right = 90;
		sun.shadow.camera.top = 90;
		sun.shadow.camera.bottom = -90;
		sun.shadow.camera.near = 10;
		sun.shadow.camera.far = 350;
		sun.shadow.bias = -0.0004;
		sun.shadow.normalBias = 0.03;
		this.scene.add(sun);
		this.scene.add(sun.target);

		// batched bamboo renderer (all culms + foliage in two draw calls)
		this.bamboo = new BambooBatch(this.scene);

		// Start render loop
		this.animate();
	},

	onentity: function(entity) {

		// Check if 3D system is properly initialized
		if (!this.scene || !this.renderer) {
			console.warn('Volume service: 3D system not initialized, skipping entity processing');
			return;
		}

		// Handle special global volume command
		if (entity.volume && entity.volume.command) {
			console.log('Volume service: Received command:', entity.volume.command);

			if (entity.volume.command === 'reset') {
				// Clear all meshes
				this.meshes.forEach(mesh => {
					this.scene.remove(mesh);
					mesh.geometry.dispose();
					mesh.material.dispose();
				});
				this.meshes.clear();
				this.entities.clear();
				if (this.bamboo) this.bamboo.reset();
				console.log('Volume service: Reset complete');
			}
			return;
		}

		// Entity removal
		if (entity.obliterate && entity.id) {
			if (this.bamboo && this.bamboo.remove(entity.id)) return;
			const mesh = this.meshes.get(entity.id);
			if (mesh) {
				this.scene.remove(mesh);
				mesh.geometry.dispose();
				mesh.material.dispose();
				this.meshes.delete(entity.id);
			}
			this.entities.delete(entity.id);
			return;
		}

		// Only process entities with volume information
		if (!entity.volume) return;

		// Handle camera volume shape
		if (entity.volume.shape === 'camera') {
			console.log('Volume service: Updating camera target to', entity.volume.xyz);
			if (this.controls && this.controls.target) {
				this.controls.target.set(
					entity.volume.xyz[0],
					entity.volume.xyz[1],
					entity.volume.xyz[2]
				);
				this.controls.update();
			} else {
				console.warn('Volume service: Cannot update camera target - controls not initialized');
			}
			return;
		}

		// Skip entities without a shape
		if (!entity.volume.shape) {
			console.log('Volume service: Skipping entity', entity.id, 'with no shape defined');
			return;
		}

		// Hidden volumes participate in the sim but are not rendered
		if (entity.volume.hidden) return;

		// Bamboo culms render through the instanced batch, not as meshes
		if (entity.kind === 'culm') {
			this.bamboo.upsert(entity);
			return;
		}

		// Store reference to entity
		this.entities.set(entity.id, entity);

		// Create or update mesh for this entity
		let mesh = this.meshes.get(entity.id);

		if (!mesh) {
			// Create new mesh based on shape
			let geometry;
			const vol = entity.volume;

			switch (vol.shape) {
				case 'cylinder':
					geometry = new THREE.CylinderGeometry(
						vol.hwd[1] || 0.1,  // top radius
						vol.hwd[1] || 0.1,  // bottom radius
						vol.hwd[0] || 1,    // height
						16                   // segments
					);
					break;
				case 'sphere':
					geometry = new THREE.SphereGeometry(
						vol.hwd[1] || 0.5,  // radius
						16, 16              // segments
					);
					break;
	       case 'dem':

			    // Create terrain geometry from DEM data
			    if (vol.demData) {

						const dem = vol.demData;
						geometry = new THREE.PlaneGeometry(
						    vol.hwd[1], // width
						    vol.hwd[2], // depth
						    dem.width - 1, // width segments
						    dem.height - 1  // height segments
						);

						// Modify vertices based on elevation data
						const vertices = geometry.attributes.position.array;
						for (let i = 0; i < dem.elevations.length; i++) {
						    const elev = dem.elevations[i];
						    const normalizedElev = (elev - dem.minElev) / (dem.maxElev - dem.minElev);
						    vertices[i * 3 + 2] = normalizedElev * vol.hwd[0]; // Set Z (height)
						}

						// Update normals for proper lighting
						geometry.computeVertexNormals();

						// Rotate to be horizontal (PlaneGeometry starts vertical)
						geometry.rotateX(-Math.PI / 2);
					    } else {
						// Fallback if no DEM data
						geometry = new THREE.BoxGeometry(vol.hwd[1], 0.1, vol.hwd[2]);
					    }
			    break;

				case 'box':
					geometry = new THREE.BoxGeometry(
						vol.hwd[1] || 1,    // width (x)
						vol.hwd[0] || 1,    // height (y)
						vol.hwd[2] || 1     // depth (z)
					);
					break;

				default:
					// No default geometry - skip unknown shapes
					console.warn('Volume service: Unknown shape type:', vol.shape);
					return;
			}

			// Skip if geometry creation failed
			if (!geometry) {
				console.warn('Volume service: Failed to create geometry for entity', entity.id);
				return;
			}

			// Create material based on type
			let material;
			if (vol.material === 'glass') {
				// Cheap translucent shell (true transmission materials force an
				// extra scene render per frame and looked worse anyway)
				material = new THREE.MeshPhongMaterial({
					color: vol.color || 0x00ff00,
					opacity: vol.opacity !== undefined ? vol.opacity : 0.15,
					transparent: true,
					depthWrite: false,
					shininess: 60
				});

		  } else if (vol.shape === 'dem' && vol.demData && vol.demData.satelliteData) {
				// DEM with satellite texture
				const texture = new THREE.CanvasTexture(vol.demData.satelliteData.canvas);
				texture.colorSpace = THREE.SRGBColorSpace;
				texture.anisotropy = 8;
				texture.needsUpdate = true;
				material = new THREE.MeshPhongMaterial({
				    map: texture,
				    shininess: 4,
				    specular: 0x111111,
				    side: THREE.DoubleSide
				});

	    } else {                                    // Standard material
				material = new THREE.MeshPhongMaterial({
					color: vol.color || 0x00ff00,
					opacity: vol.opacity || 1.0,
					transparent: vol.opacity < 1.0
				});
			}

			mesh = new THREE.Mesh(geometry, material);
			mesh.castShadow = vol.shape !== 'dem';
			mesh.receiveShadow = true;

			// Apply rotation if specified
			if (vol.ypr) {
				mesh.rotation.y = vol.ypr[0]; // Yaw
				mesh.rotation.x = vol.ypr[1]; // Pitch
				mesh.rotation.z = vol.ypr[2]; // Roll
			}

			this.meshes.set(entity.id, mesh);
			this.scene.add(mesh);
		}

		// Update mesh position and scale
		const vol = entity.volume;
		// For boxes (like the plot), center at ground level
		if (vol.shape === 'box' && entity.kind === 'plot') {
			mesh.position.set(vol.hwd[1]/2, vol.xyz[1], vol.hwd[2]/2);
		} else if (vol.shape === 'dem') {
			// DEM terrain is already positioned correctly
			mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
		} else {
			// For cylinders, position at ground level + half height
			if (vol.shape === 'cylinder') {
				mesh.position.set(vol.xyz[0], vol.xyz[1] + vol.hwd[0]/2, vol.xyz[2]);
			} else if (vol.shape === 'sphere' && entity.kind === 'clump') {
				// For clump spheres, position directly at ground level (half buried)
				mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
			} else if (vol.shape === 'sphere') {
				// For other spheres (coffee), position at ground level + radius
				mesh.position.set(vol.xyz[0], vol.xyz[1] + vol.hwd[0]/2, vol.xyz[2]);
			} else {
				mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
			}
		}

		// For cylinders, update the geometry if height changed
		if (vol.shape === 'cylinder' && mesh.geometry.parameters.height !== vol.hwd[0]) {
			mesh.geometry.dispose();
			mesh.geometry = new THREE.CylinderGeometry(
				vol.hwd[1] || 0.1,
				vol.hwd[1] || 0.1,
				vol.hwd[0] || 1,
				16
			);
		}
	},

	onstep: function(daysElapsed) {

		// Check if 3D system is properly initialized
		if (!this.scene || !this.renderer || !this.entities) {
			console.warn('Volume service: 3D system not initialized, skipping step update');
			return;
		}

		// Culm growth is applied lazily in the render loop
		if (this.bamboo) this.bamboo.dirty = true;

		// Update all meshes based on current entity states
		this.entities.forEach((entity, id) => {
			const mesh = this.meshes.get(id);
			if (!mesh) return;

			const vol = entity.volume;

			// Update position
			if (vol.shape === 'box' && entity.kind === 'plot') {
				mesh.position.set(vol.hwd[1]/2, vol.xyz[1], vol.hwd[2]/2);
			} else if (vol.shape === 'dem') {
				// DEM terrain is already positioned correctly
				mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
			} else {
				// For cylinders, position at ground level + half height
				if (vol.shape === 'cylinder') {
					mesh.position.set(vol.xyz[0], vol.xyz[1] + vol.hwd[0]/2, vol.xyz[2]);
				} else if (vol.shape === 'sphere' && entity.kind === 'clump') {
					// For clump spheres, position directly at ground level (half buried)
					mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
				} else if (vol.shape === 'sphere') {
					// For other spheres (coffee), position at ground level + radius
					mesh.position.set(vol.xyz[0], vol.xyz[1] + vol.hwd[0]/2, vol.xyz[2]);
				} else {
					mesh.position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
				}
			}

			// For cylinders, update geometry if height changed
			if (vol.shape === 'cylinder' && mesh.geometry.parameters.height !== vol.hwd[0]) {
				mesh.geometry.dispose();
				mesh.geometry = new THREE.CylinderGeometry(
					vol.hwd[1] || 0.1,
					vol.hwd[1] || 0.1,
					vol.hwd[0] || 1,
					16
				);
			}

			// For spheres (coffee plants), update size
			if (vol.shape === 'sphere' && mesh.geometry.parameters.radius !== vol.hwd[1]) {
				mesh.geometry.dispose();
				mesh.geometry = new THREE.SphereGeometry(
					vol.hwd[1] || 0.5,
					16, 16
				);
			}

			// Update rotation if specified
			if (vol.ypr) {
				mesh.rotation.y = vol.ypr[0]; // Yaw
				mesh.rotation.x = vol.ypr[1]; // Pitch
				mesh.rotation.z = vol.ypr[2]; // Roll
			}

			// Update material color if it has changed
			if (vol.color !== undefined && mesh.material && !mesh.material.map) {
				// Only update color for materials without textures
				const currentColor = mesh.material.color.getHex();
				if (currentColor !== vol.color) {
					mesh.material.color.setHex(vol.color);
				}
			}
		});
	},

	animate: function() {
		// Check if 3D system is properly initialized
		if (!this.renderer || !this.scene || !this.camera || !this.controls) {
			console.warn('Volume service: 3D system not initialized, stopping animation loop');
			return;
		}

		requestAnimationFrame(() => this.animate());

		// Update controls
		this.controls.update();

		// Bamboo: apply any pending growth updates, advance the wind clock
		if (this.bamboo) {
			this.bamboo.setTime(performance.now() / 1000);
			this.bamboo.commit();
		}

		// Render scene
		this.renderer.render(this.scene, this.camera);
	}
};
