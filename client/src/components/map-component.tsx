import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Plot } from "@shared/schema";

interface BoundaryPoint {
  x: number;
  z: number;
}

interface MapComponentProps {
  // Common props
  latitude?: number;
  longitude?: number;
  height?: number;
  width?: string;
  className?: string;
  onError?: (error: Error) => void;
  
  // NASA map specific props
  enableBoundary?: boolean;
  boundaryPoints?: BoundaryPoint[];
  
  // Dashboard specific props
  plots?: Plot[];
  viewMode?: "orbit" | "globe"; // Default to orbit for NASA map compatibility
  
  // Polygon editing props
  editingBoundary?: boolean;
  onPolygonComplete?: (points: [number, number, number][]) => void;
  existingPolygon?: [number, number, number][];
}

export default function MapComponent({ 
  latitude = 7.6455,
  longitude = 122.4,
  height = 400,
  width = "100%",
  className = "",
  enableBoundary = false,
  boundaryPoints = [],
  plots = [],
  viewMode = "orbit",
  editingBoundary = false,
  onPolygonComplete,
  existingPolygon = [],
  onError
}: MapComponentProps) {
  const { data: cesiumData } = useQuery<{cesiumKey: string | null}>({
    queryKey: ["/api/cesium-key"],
  });
  
  const cesiumToken = cesiumData?.cesiumKey || "";
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const tilesRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number>();
  const boundaryMeshRef = useRef<any>(null);
  const plotSpheresRef = useRef<any[]>([]);
  const onLoadModelRef = useRef<any>(null);
  const onDisposeModelRef = useRef<any>(null);
  const boundaryPointsForShaderRef = useRef<any[]>([]);
  const [engineReady, setEngineReady] = useState(false);
  const ThreeRef = useRef<any>(null);
  
  // Polygon editing state
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<[number, number, number][]>([]);
  const currentPolygonMeshRef = useRef<any>(null);

  // Constants - adjusted based on view mode
  const CAMERA_NEAR_CLIP = viewMode === "globe" ? 1 : 200;
  const CAMERA_FAR_CLIP = viewMode === "globe" ? 160000000 : 2600000;
  const CAMERA_MIN_DISTANCE = viewMode === "globe" ? 500 : 500;
  const CAMERA_MAX_DISTANCE = viewMode === "globe" ? 160000000 : 2000000;
  const EARTH_RADIUS = 6378160;

  // Define render layers
  const TILES_LAYER = 0;
  const BOUNDARY_LAYER = 1;
  const PLOTS_LAYER = 2;

  // Shared shader code for clipping (from reference material)
  const CLIPPING_VERTEX_SHADER = `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  const CLIPPING_FRAGMENT_SHADER = `
    uniform vec2 boundaryPoints[32];
    uniform int numPoints;
    uniform sampler2D map;
    uniform bool hasTexture;
    uniform vec3 diffuse;
    uniform float opacity;
    varying vec3 vWorldPosition;
    varying vec2 vUv;

    bool isPointInPolygon(vec2 p) {
      bool inside = false;
      for (int i = 0, j = numPoints - 1; i < numPoints; j = i++) {
        vec2 pi = boundaryPoints[i];
        vec2 pj = boundaryPoints[j];

        if ((pi.y > p.y) != (pj.y > p.y) &&
          p.x < (pj.x - pi.x) * (p.y - pi.y) / (pj.y - pi.y) + pi.x) {
          inside = !inside;
        }
      }
      return inside;
    }

    void main() {
      vec2 worldXZ = vec2(vWorldPosition.x, vWorldPosition.z);

      if (numPoints > 0 && !isPointInPolygon(worldXZ)) {
        discard;
      }

      vec3 brightnessFactor = vec3(3.5);

      if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        vec3 brightened = min(texColor.rgb * brightnessFactor, vec3(1.0));
        gl_FragColor = vec4(brightened, texColor.a * opacity);
      } else {
        vec3 brightened = min(diffuse * brightnessFactor, vec3(1.0));
        gl_FragColor = vec4(brightened, opacity);
      }
    }
  `;

  // Helper function for error logging
  const errorToString = (error: any): string => {
    if (!error) return 'Unknown error';
    return `${error.name || 'Error'}: ${error.message || 'No message'}\n${error.stack || 'No stack'}`;
  };

  // Initialize the 3D engine
  useEffect(() => {
    if (!containerRef.current || !cesiumToken) return;

    let isActive = true;

    const initializeEngine = async () => {
      try {
        console.info('MapComponent: Loading 3D engine...');
        
        // Dynamically load Three.js and 3d-tiles-renderer
        const [
          Three,
          TilesRenderer3D,
          Plugins,
          { DRACOLoader }
        ] = await Promise.all([
          import('three'),
          import('3d-tiles-renderer'),
          import('3d-tiles-renderer/plugins'),
          import('three/examples/jsm/loaders/DRACOLoader.js')
        ]);

        if (!isActive) return;

        ThreeRef.current = Three;
        const {
          Scene,
          WebGLRenderer,
          PerspectiveCamera,
          MathUtils,
          Vector2,
          Vector3,
          SphereGeometry,
          MeshBasicMaterial,
          Mesh,
          BufferGeometry,
          Float32BufferAttribute,
          DoubleSide,
          ShaderMaterial,
          AmbientLight,
          DirectionalLight
        } = Three;

        const { TilesRenderer, GlobeControls } = TilesRenderer3D;
        const { 
          TileCompressionPlugin,
          UpdateOnChangePlugin,
          UnloadTilesPlugin,
          TilesFadePlugin,
          GLTFExtensionsPlugin,
          CesiumIonAuthPlugin,
          ReorientationPlugin
        } = Plugins;

        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        console.info('MapComponent: 3D engine loaded, initializing scene...');

        // Create scene
        const scene = new Scene();
        sceneRef.current = scene;

        // Check WebGL support and create renderer with fallback
        let renderer;
        try {
          // Test WebGL support
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          if (!gl) {
            throw new Error('WebGL not supported');
          }
          
          renderer = new WebGLRenderer({ antialias: true });
          console.info('MapComponent: WebGL renderer created successfully');
        } catch (error) {
          console.warn('MapComponent: WebGL unavailable, creating fallback display:', (error as Error).message);
          // Create a fallback display for environments without WebGL
          const fallbackDiv = document.createElement('div');
          fallbackDiv.style.width = '100%';
          fallbackDiv.style.height = '100%';
          fallbackDiv.style.backgroundColor = '#001a33';
          fallbackDiv.style.display = 'flex';
          fallbackDiv.style.alignItems = 'center';
          fallbackDiv.style.justifyContent = 'center';
          fallbackDiv.style.color = '#ffffff';
          fallbackDiv.style.fontFamily = 'Arial, sans-serif';
          fallbackDiv.innerHTML = `
            <div style="text-align: center;">
              <div style="font-size: 18px; margin-bottom: 8px;">🌍 3D Map View</div>
              <div style="font-size: 14px; opacity: 0.7;">WebGL not available in this environment</div>
              <div style="font-size: 12px; opacity: 0.5; margin-top: 8px;">
                ${viewMode === 'globe' ? 'Globe view with plot markers' : 'Satellite imagery view'}
              </div>
            </div>
          `;
          
          const container = containerRef.current;
          if (!container) return;
          container.appendChild(fallbackDiv);
          
          setEngineReady(true);
          return; // Exit early for non-WebGL environments
        }
        renderer.setClearColor(0x001a33); // Dark blue background
        const container = containerRef.current;
        if (!container) return;
        renderer.setSize(
          container.clientWidth,
          container.clientHeight
        );
        renderer.setPixelRatio(window.devicePixelRatio);
        
        // Ensure canvas can receive mouse events with aggressive event capturing
        renderer.domElement.style.pointerEvents = 'auto';
        renderer.domElement.style.touchAction = 'none';
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.zIndex = '9999';
        
        // Set container to relative positioning to contain the absolute canvas
        if (containerRef.current) {
          containerRef.current.style.position = 'relative';
          containerRef.current.style.cursor = 'grab';
          // Add event forwarding from container to canvas
          const forwardMouseEvent = (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            // Create and dispatch the same event on canvas
            const canvasEvent = new MouseEvent(e.type, e);
            renderer.domElement.dispatchEvent(canvasEvent);
          };
          
          containerRef.current.addEventListener('mousedown', forwardMouseEvent, { capture: true });
          containerRef.current.addEventListener('mousemove', forwardMouseEvent, { capture: true });
          containerRef.current.addEventListener('mouseup', forwardMouseEvent, { capture: true });
        }
        
        
        container.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Add lighting
        const ambientLight = new AmbientLight(0xffffff, 1.2);
        ambientLight.layers.enableAll();
        scene.add(ambientLight);

        const directionalLight = new DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(1000, 2000, 1000);
        directionalLight.target.position.set(0, 0, 0);
        directionalLight.layers.enableAll();
        scene.add(directionalLight);
        scene.add(directionalLight.target);

        const directionalLight2 = new DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(-1000, 1500, -1000);
        directionalLight2.target.position.set(0, 0, 0);
        directionalLight2.layers.enableAll();
        scene.add(directionalLight2);
        scene.add(directionalLight2.target);

        // Create camera
        const camera = new PerspectiveCamera(
          60,
          container.clientWidth / container.clientHeight,
          CAMERA_NEAR_CLIP,
          CAMERA_FAR_CLIP
        );
        
        if (viewMode === "globe") {
          camera.position.set(EARTH_RADIUS * 2, 0, 0);
          camera.lookAt(0, 0, 0);
        } else {
          camera.position.set(1, 1, 1).multiplyScalar(5000);
        }
        
        // CRITICAL: Enable camera to see all layers including PLOTS_LAYER
        camera.layers.enableAll();
        
        cameraRef.current = camera;

        // Create controls based on view mode
        let controls;
        if (viewMode === "globe") {
          controls = new GlobeControls(scene, camera, renderer.domElement);
          controls.enableDamping = true;
        } else {
          controls = new OrbitControls(camera, renderer.domElement);
          controls.minDistance = CAMERA_MIN_DISTANCE;
          controls.maxDistance = CAMERA_MAX_DISTANCE;
          controls.minPolarAngle = 0;
          controls.maxPolarAngle = 3 * Math.PI / 8;
          controls.enableDamping = true;
          controls.enablePan = true;
        }
        controlsRef.current = controls;

        // Create tiles renderer
        const tiles = new TilesRenderer();
        tiles.registerPlugin(new CesiumIonAuthPlugin({ 
          apiToken: cesiumToken, 
          assetId: '2275207', 
          autoRefreshToken: true 
        }));
        tiles.registerPlugin(new TileCompressionPlugin());
        tiles.registerPlugin(new UpdateOnChangePlugin());
        tiles.registerPlugin(new UnloadTilesPlugin());
        tiles.registerPlugin(new TilesFadePlugin());
        tiles.registerPlugin(new GLTFExtensionsPlugin({
          dracoLoader: new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/')
        }));

        if (viewMode === "orbit") {
          tiles.registerPlugin(new ReorientationPlugin({
            lat: latitude * MathUtils.DEG2RAD,
            lon: longitude * MathUtils.DEG2RAD
          }));
        } else {
          // For globe view, rotate tiles group
          tiles.group.rotation.x = -Math.PI / 2;
        }

        scene.add(tiles.group);
        tiles.setResolutionFromRenderer(camera, renderer);
        tiles.setCamera(camera);
        
        if (viewMode === "globe" && 'setEllipsoid' in controls) {
          (controls as any).setEllipsoid(tiles.ellipsoid, tiles.group);
        }
        
        tilesRef.current = tiles;

        setEngineReady(true);
        console.info('MapComponent: Engine initialization complete');

      } catch (error) {
        console.error('MapComponent: Error initializing engine:', errorToString(error));
        if (onError) onError(error as Error);
      }
    };

    initializeEngine();

    return () => {
      isActive = false;
      // Cleanup will be handled by other effects
    };
  }, [cesiumToken, viewMode, latitude, longitude, onError]);

  // Handle boundary clipping
  useEffect(() => {
    if (!engineReady || !tilesRef.current || !ThreeRef.current) return;
    if (!enableBoundary || boundaryPoints.length === 0) return;

    const updateBoundaryClipping = () => {
      const { Vector2, ShaderMaterial, DoubleSide } = ThreeRef.current;
      
      // Store points for shader (max 32 points)
      boundaryPointsForShaderRef.current = boundaryPoints.slice(0, 32).map(p => new Vector2(p.x, p.z));

      // Update shader uniforms
      const uniformsArray = new Array(32).fill(null).map((_, i) => 
        i < boundaryPointsForShaderRef.current.length ? 
        boundaryPointsForShaderRef.current[i] : 
        new Vector2(0, 0)
      );

      // Define event handlers for shader application
      onLoadModelRef.current = function({ scene }: { scene: any }) {
        scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            try {
              const originalMaterial = child.material;
              child.userData.originalMaterial = originalMaterial;

              // Extract color safely
              const { Vector3 } = ThreeRef.current;
              let diffuseColor = new Vector3(1, 1, 1);
              if (originalMaterial.color) {
                diffuseColor = new Vector3(
                  originalMaterial.color.r || 1,
                  originalMaterial.color.g || 1,
                  originalMaterial.color.b || 1
                );
              }

              // Create custom shader material
              const customMaterial = new ShaderMaterial({
                uniforms: {
                  boundaryPoints: { value: uniformsArray },
                  numPoints: { value: boundaryPointsForShaderRef.current.length },
                  map: { value: originalMaterial.map || null },
                  hasTexture: { value: !!originalMaterial.map },
                  diffuse: { value: diffuseColor },
                  opacity: { value: originalMaterial.opacity || 1.0 }
                },
                vertexShader: CLIPPING_VERTEX_SHADER,
                fragmentShader: CLIPPING_FRAGMENT_SHADER,
                side: originalMaterial.side || DoubleSide,
                transparent: true,
                depthWrite: true
              });

              child.material = customMaterial;
              child.layers.set(TILES_LAYER);
            } catch (error) {
              console.error('Error applying clipping shader:', error);
            }
          }
        });
      };

      onDisposeModelRef.current = function({ scene }: { scene: any }) {
        scene.traverse((child: any) => {
          if (child.isMesh && child.material) {
            child.material.dispose();
            child.userData.originalMaterial = null;
          }
        });
      };

      // Remove existing listeners and add new ones
      tilesRef.current.removeEventListener('load-model', onLoadModelRef.current);
      tilesRef.current.removeEventListener('dispose-model', onDisposeModelRef.current);
      tilesRef.current.addEventListener('load-model', onLoadModelRef.current);
      tilesRef.current.addEventListener('dispose-model', onDisposeModelRef.current);
    };

    updateBoundaryClipping();
  }, [enableBoundary, boundaryPoints, engineReady]);

  // Handle plot visualization
  useEffect(() => {
    if (!engineReady || !sceneRef.current || !ThreeRef.current || plots.length === 0) return;

    const updatePlots = () => {
      const { SphereGeometry, MeshBasicMaterial, Mesh, Vector3 } = ThreeRef.current;
      
      // Clear existing plot spheres
      plotSpheresRef.current.forEach(sphere => {
        if (tilesRef.current?.group) {
          tilesRef.current.group.remove(sphere); // Remove from tiles group where they were added
        }
        sphere.geometry.dispose();
        sphere.material.dispose();
      });
      plotSpheresRef.current = [];

      // Create spheres for each plot
      plots.forEach(plot => {
        // Small sphere size for better visibility
        const sphereSize = viewMode === "globe" ? EARTH_RADIUS * 0.01 : 1000;
        
        // Create sphere geometry
        const sphereGeometry = new SphereGeometry(sphereSize, 16, 16);
        
        // All spheres are green
        const sphereMaterial = new MeshBasicMaterial({ 
          color: 0x00ff00, // Green
          opacity: 0.8,
          transparent: true
        });
        
        const sphere = new Mesh(sphereGeometry, sphereMaterial);
        
        if (viewMode === "globe") {
          // For globe view, position on the surface
          const lat = plot.latitude * Math.PI / 180;
          const lon = plot.longitude * Math.PI / 180;
          const radius = EARTH_RADIUS * 1.01; // Slightly above surface
          
          sphere.position.set(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.cos(lat) * Math.sin(lon),
            radius * Math.sin(lat)
          );
        } else {
          // For orbit view, use local coordinates around the center
          const offsetDistance = 2000;
          sphere.position.set(
            (plot.longitude - longitude) * 100,
            offsetDistance,
            (plot.latitude - latitude) * 100
          );
        }
        
        sphere.layers.set(PLOTS_LAYER);
        sphere.userData = { plot };
        
        if (tilesRef.current?.group) {
          tilesRef.current.group.add(sphere); // Add to tiles group for proper coordinate frame
          plotSpheresRef.current.push(sphere);
        }
      });
    };

    updatePlots();
  }, [plots, engineReady, viewMode, latitude, longitude]);

  // Animation loop
  useEffect(() => {
    if (!engineReady) return;

    let isActive = true;

    const animate = () => {
      if (!isActive) return;
      
      animationIdRef.current = requestAnimationFrame(animate);
      
      if (!tilesRef.current || !cameraRef.current || !rendererRef.current || !controlsRef.current) return;

      controlsRef.current.update();
      tilesRef.current.setResolutionFromRenderer(cameraRef.current, rendererRef.current);
      tilesRef.current.setCamera(cameraRef.current);
      cameraRef.current.updateMatrixWorld();
      tilesRef.current.update();

      // Render scene
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    };

    animate();

    return () => {
      isActive = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [engineReady]);

  // Handle window resize
  useEffect(() => {
    if (!engineReady) return;

    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
      rendererRef.current.setPixelRatio(window.devicePixelRatio);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [engineReady]);

  // Handle polygon editing clicks
  useEffect(() => {
    if (!engineReady || !rendererRef.current || !cameraRef.current || !editingBoundary) return;

    const handleClick = (event: MouseEvent) => {
      if (!rendererRef.current || !cameraRef.current) return;

      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const mouse = {
        x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((event.clientY - rect.top) / rect.height) * 2 + 1
      };

      // Create a raycaster to find intersection with Earth surface
      const { Raycaster, Vector3 } = ThreeRef.current;
      const raycaster = new Raycaster();
      raycaster.setFromCamera(mouse, cameraRef.current);

      // Intersect with Earth surface (sphere at origin with Earth radius)
      const { Sphere } = ThreeRef.current;
      const earthCenter = new Vector3(0, 0, 0);
      const earthSphere = new Sphere(earthCenter, EARTH_RADIUS);
      const intersections = raycaster.ray.intersectSphere(earthSphere, new Vector3());

      if (intersections) {
        // Convert ECEF coordinates back to lat/lon/elevation
        // Using proper coordinate mapping: lon = atan2(z, x), lat = asin(y/R)
        const { x, y, z } = intersections;
        const longitude = Math.atan2(z, x) * 180 / Math.PI;
        const latitude = Math.asin(y / EARTH_RADIUS) * 180 / Math.PI;
        const elevation = 0; // Default elevation at sea level

        // Add point to current polygon
        setCurrentPolygonPoints(prev => [...prev, [longitude, latitude, elevation]]);
      }
    };

    const canvas = rendererRef.current.domElement;
    canvas.addEventListener('click', handleClick);
    canvas.style.cursor = 'crosshair';
    
    // Disable orbit controls during polygon editing to prevent accidental camera movement
    if (controlsRef.current) {
      controlsRef.current.enabled = false;
    }

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.style.cursor = 'default';
      
      // Re-enable orbit controls when exiting polygon editing
      if (controlsRef.current) {
        controlsRef.current.enabled = true;
      }
    };
  }, [editingBoundary, engineReady]);

  // Initialize polygon from existing data when entering edit mode
  useEffect(() => {
    if (editingBoundary && existingPolygon.length > 0) {
      setCurrentPolygonPoints(existingPolygon);
    } else if (!editingBoundary) {
      // Only reset if we have a callback to save, otherwise preserve points
      // Use a ref to get current polygon points to avoid dependency issues
      setCurrentPolygonPoints(currentPoints => {
        if (onPolygonComplete && currentPoints.length >= 3) {
          onPolygonComplete(currentPoints);
        }
        return [];
      });
    }
  }, [editingBoundary, existingPolygon, onPolygonComplete]);

  // Render current polygon being edited
  useEffect(() => {
    if (!engineReady || !sceneRef.current || !ThreeRef.current) return;

    // Clean up existing polygon mesh
    if (currentPolygonMeshRef.current) {
      if (tilesRef.current?.group) {
        tilesRef.current.group.remove(currentPolygonMeshRef.current);
      }
      currentPolygonMeshRef.current.geometry?.dispose();
      currentPolygonMeshRef.current.material?.dispose();
      currentPolygonMeshRef.current = null;
    }

    // Only create mesh if we have at least 3 points for a valid polygon
    if (currentPolygonPoints.length >= 3) {
      const { Vector3, MeshBasicMaterial, Mesh, BufferGeometry, Float32BufferAttribute } = ThreeRef.current;
      
      // Convert lat/lon points to ECEF coordinates
      const vertices: number[] = [];
      currentPolygonPoints.forEach(([longitude, latitude, elevation]) => {
        const lat = latitude * Math.PI / 180;
        const lon = longitude * Math.PI / 180;
        const radius = EARTH_RADIUS * 1.005; // Slightly above Earth surface
        
        vertices.push(
          radius * Math.cos(lat) * Math.cos(lon), // x
          radius * Math.cos(lat) * Math.sin(lon), // y
          radius * Math.sin(lat)                  // z
        );
      });

      // Create triangulated faces for the polygon (fan triangulation from first vertex)
      const indices: number[] = [];
      for (let i = 1; i < currentPolygonPoints.length - 1; i++) {
        indices.push(0, i, i + 1);
      }

      // Create BufferGeometry
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometry.setIndex(indices);
      geometry.computeVertexNormals();

      // Create semi-transparent green material
      const material = new MeshBasicMaterial({
        color: 0x00ff00,
        opacity: 0.3,
        transparent: true,
        side: ThreeRef.current.DoubleSide
      });

      // Create mesh and add to scene
      const mesh = new Mesh(geometry, material);
      mesh.layers.set(BOUNDARY_LAYER);
      if (tilesRef.current?.group) {
        tilesRef.current.group.add(mesh);
        currentPolygonMeshRef.current = mesh;
      }
    }
  }, [currentPolygonPoints, engineReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up animation frame
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }

      // Clean up plot spheres
      plotSpheresRef.current.forEach(sphere => {
        if (sceneRef.current) {
          sceneRef.current.remove(sphere);
        }
        sphere.geometry?.dispose();
        sphere.material?.dispose();
      });

      // Clean up tiles
      if (tilesRef.current) {
        if (onLoadModelRef.current) {
          tilesRef.current.removeEventListener('load-model', onLoadModelRef.current);
        }
        if (onDisposeModelRef.current) {
          tilesRef.current.removeEventListener('dispose-model', onDisposeModelRef.current);
        }
        if (sceneRef.current) {
          sceneRef.current.remove(tilesRef.current.group);
        }
        tilesRef.current.dispose();
      }

      // Clean up boundary mesh
      if (boundaryMeshRef.current && sceneRef.current) {
        sceneRef.current.remove(boundaryMeshRef.current);
        boundaryMeshRef.current.geometry?.dispose();
        boundaryMeshRef.current.material?.dispose();
      }

      // Clean up current polygon mesh
      if (currentPolygonMeshRef.current && tilesRef.current?.group) {
        tilesRef.current.group.remove(currentPolygonMeshRef.current);
        currentPolygonMeshRef.current.geometry?.dispose();
        currentPolygonMeshRef.current.material?.dispose();
      }

      // Clean up renderer
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`bg-slate-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height: `${height}px` }}
      data-testid="map-component"
    />
  );
}