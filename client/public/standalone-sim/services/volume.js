import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export const volume_service = {
	id: 'volume-service',
	kind: 'service',
	
	// Three.js components
	scene: null,
	camera: null,
	renderer: null,
	controls: null,
	meshes: new Map(), // Map entity IDs to their meshes
	entities: new Map(), // Map entity IDs to entities with volume
	
	onreset: function() {
		console.log("Volume service initializing 3D scene...")
		
		// Create scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
		
		// Create camera with wider field of view
		this.camera = new THREE.PerspectiveCamera(
			45,  // Wider FOV (was 75)
			window.innerWidth / window.innerHeight, 
			0.1, 
			1000
		);
		this.camera.position.set(100, 50, 100);
		this.camera.lookAt(50, 0, 50);
		
		// Create renderer
		this.renderer = new THREE.WebGLRenderer({ antialias: true });
		this.renderer.shadowMap.enabled = true;
		
		// Get container
		const container = document.getElementById('threejs-container');
		if (container) {
			const rect = container.getBoundingClientRect();
			this.renderer.setSize(rect.width, rect.height);
			container.appendChild(this.renderer.domElement);
		} else {
			// Fallback to body
			this.renderer.setSize(window.innerWidth, window.innerHeight);
			document.body.appendChild(this.renderer.domElement);
		}
		
		// Add controls
		this.controls = new OrbitControls(this.camera, this.renderer.domElement);
		this.controls.enableDamping = true;
		this.controls.dampingFactor = 0.05;
		this.controls.target.set(50, 0, 50); // Default center on plot center
		
		// Add lights
		const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
		this.scene.add(ambientLight);
		
		const directionalLight = new THREE.DirectionalLight(0xffffff, 0.4);
		directionalLight.position.set(50, 100, 50);
		directionalLight.castShadow = true;
		directionalLight.shadow.camera.left = -100;
		directionalLight.shadow.camera.right = 100;
		directionalLight.shadow.camera.top = 100;
		directionalLight.shadow.camera.bottom = -100;
		this.scene.add(directionalLight);
		
		// Add axes helper (red = X, green = Y, blue = Z)
		const axesHelper = new THREE.AxesHelper(50); // 50 units long
		this.scene.add(axesHelper);
		
		// Handle window resize
		window.addEventListener('resize', () => {
			const container = document.getElementById('threejs-container');
			if (container) {
				const rect = container.getBoundingClientRect();
				this.camera.aspect = rect.width / rect.height;
				this.camera.updateProjectionMatrix();
				this.renderer.setSize(rect.width, rect.height);
			} else {
				this.camera.aspect = window.innerWidth / window.innerHeight;
				this.camera.updateProjectionMatrix();
				this.renderer.setSize(window.innerWidth, window.innerHeight);
			}
		});
		
		// Start render loop
		this.animate();
	},
	
	onentity: function(entity) {
		// Handle volume commands
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
				console.log('Volume service: Reset complete');
			}
			return;
		}
		
		// Only process entities with volume information
		if (!entity.volume) return;
		
		// Handle camera volume shape
		if (entity.volume.shape === 'camera') {
			console.log('Volume service: Updating camera target to', entity.volume.xyz);
			this.controls.target.set(
				entity.volume.xyz[0],
				entity.volume.xyz[1],
				entity.volume.xyz[2]
			);
			this.controls.update();
			return; // Don't create a mesh for camera
		}
		
		// Skip entities without a shape
		if (!entity.volume.shape) {
			console.log('Volume service: Skipping entity', entity.id, 'with no shape defined');
			return;
		}
		
		console.log('Volume service: Processing entity', entity.id, 'kind:', entity.kind, 'shape:', entity.volume.shape, 'color:', entity.volume.color?.toString(16));
		
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
				// Glass-like material for semi-transparent objects
				material = new THREE.MeshPhysicalMaterial({
					color: vol.color || 0x00ff00,
					opacity: vol.opacity || 0.3,
					transparent: true,
					roughness: 0.1,
					metalness: 0.1,
					transmission: 0.9,
					thickness: 0.5,
					envMapIntensity: 1,
					clearcoat: 1,
					clearcoatRoughness: 0
				});
          } else if (vol.shape === 'dem' && vol.demData && vol.demData.satelliteData) {                                                                                                         
                // DEM with satellite texture                                                                                                                                                     
                const texture = new THREE.CanvasTexture(vol.demData.satelliteData.canvas);                                                                                                        
                texture.needsUpdate = true;                                                                                                                                                       
                material = new THREE.MeshPhongMaterial({                                                                                                                                          
                    map: texture,                                                                                                                                                                 
                    side: THREE.DoubleSide                                                                                                                                                        
                });                                                                                                                                                                               
            } else {      				// Standard material
				material = new THREE.MeshPhongMaterial({
					color: vol.color || 0x00ff00,
					opacity: vol.opacity || 1.0,
					transparent: vol.opacity < 1.0
				});
			}
			
			mesh = new THREE.Mesh(geometry, material);
			mesh.castShadow = true;
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
		});
	},
	
	animate: function() {
		requestAnimationFrame(() => this.animate());
		
		// Update controls
		this.controls.update();
		
		// Render scene
		this.renderer.render(this.scene, this.camera);
	}
};
