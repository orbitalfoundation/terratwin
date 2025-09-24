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
  
  // Camera focus props
  focusLatitude?: number;
  focusLongitude?: number;
  focusTrigger?: number; // Increment this to trigger a focus animation
}

// Debug logging utility
const debugLog = async (event: string, data?: any) => {
  try {
    await fetch('/api/debug-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data })
    });
  } catch (e) {
    console.warn('Debug log failed:', e);
  }
};

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
  focusLatitude,
  focusLongitude,
  focusTrigger = 0,
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
  const citySpheresRef = useRef<any[]>([]);
  const onLoadModelRef = useRef<any>(null);
  const onDisposeModelRef = useRef<any>(null);
  const boundaryPointsForShaderRef = useRef<any[]>([]);
  const focusAnimationIdRef = useRef<number>();
  const [engineReady, setEngineReady] = useState(false);
  const ThreeRef = useRef<any>(null);
  
  // Major cities with different colors and sizes
  const MAJOR_CITIES = [
    { name: "Origin (0,0)", lat: 0, lng: 0, color: 0xffffff, size: 1.5 }, // White - Starting point
    { name: "New York", lat: 40.7128, lng: -74.0060, color: 0xff0000, size: 1.2 }, // Red
    { name: "London", lat: 51.5074, lng: -0.1278, color: 0x0000ff, size: 1.1 }, // Blue
    { name: "Tokyo", lat: 35.6762, lng: 139.6503, color: 0xff00ff, size: 1.3 }, // Magenta
    { name: "Paris", lat: 48.8566, lng: 2.3522, color: 0xffff00, size: 1.0 }, // Yellow
    { name: "Sydney", lat: -33.8688, lng: 151.2093, color: 0x00ffff, size: 0.9 }, // Cyan
    { name: "Dubai", lat: 25.2048, lng: 55.2708, color: 0xffa500, size: 1.1 }, // Orange
    { name: "São Paulo", lat: -23.5505, lng: -46.6333, color: 0x00ff00, size: 1.2 }, // Green
    { name: "Mumbai", lat: 19.0760, lng: 72.8777, color: 0x800080, size: 1.3 }, // Purple
    { name: "Singapore", lat: 1.3521, lng: 103.8198, color: 0xffc0cb, size: 0.8 }, // Pink
    { name: "Los Angeles", lat: 34.0522, lng: -118.2437, color: 0xff4500, size: 1.1 }, // OrangeRed
    { name: "Beijing", lat: 39.9042, lng: 116.4074, color: 0x8b0000, size: 1.2 }, // DarkRed
    { name: "Moscow", lat: 55.7558, lng: 37.6173, color: 0x4b0082, size: 1.0 }, // Indigo
    { name: "Cairo", lat: 30.0444, lng: 31.2357, color: 0xdaa520, size: 0.9 }, // GoldenRod
    { name: "Cape Town", lat: -33.9249, lng: 18.4241, color: 0x228b22, size: 0.8 }, // ForestGreen
    { name: "Mexico City", lat: 19.4326, lng: -99.1332, color: 0xdc143c, size: 1.1 }, // Crimson
    { name: "Istanbul", lat: 41.0082, lng: 28.9784, color: 0x9932cc, size: 1.0 }, // DarkOrchid
    { name: "Bangkok", lat: 13.7563, lng: 100.5018, color: 0x20b2aa, size: 0.9 }, // LightSeaGreen
    { name: "Seoul", lat: 37.5665, lng: 126.9780, color: 0x6495ed, size: 1.1 }, // CornflowerBlue
    { name: "Buenos Aires", lat: -34.6118, lng: -58.3960, color: 0xb22222, size: 1.0 }, // FireBrick
    { name: "Toronto", lat: 43.6511, lng: -79.3470, color: 0x2e8b57, size: 0.9 }, // SeaGreen
    { name: "Lagos", lat: 6.5244, lng: 3.3792, color: 0xff1493, size: 1.2 }, // DeepPink
    { name: "Jakarta", lat: -6.2088, lng: 106.8456, color: 0x00ced1, size: 1.1 } // DarkTurquoise
  ];

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
  const CITIES_LAYER = 3;

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
        
        // CRITICAL: Clean up any existing renderer/canvas to prevent stacking
        if (rendererRef.current) {
          console.info('MapComponent: Cleaning up previous renderer...');
          const container = containerRef.current;
          if (container && rendererRef.current.domElement.parentNode === container) {
            container.removeChild(rendererRef.current.domElement);
          }
          rendererRef.current.dispose();
          rendererRef.current = null;
        }
        
        // Clean up controls
        if (controlsRef.current) {
          controlsRef.current.dispose?.();
          controlsRef.current = null;
        }
        
        // Clean up tiles
        if (tilesRef.current) {
          tilesRef.current.dispose();
          tilesRef.current = null;
        }
        
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
          // No event forwarding - attach handlers directly to renderer.domElement to avoid infinite loops
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
  }, [cesiumToken]); // Only rebuild engine when token changes

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
              const { DoubleSide } = ThreeRef.current;
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
          // For orbit view, use the same meter-based calculations as focus system
          const SCENE_UNITS_PER_METER = 0.01; // Same scale as focus system
          
          // Calculate meters per degree at current latitude
          const METERS_PER_DEGREE_LAT = 111320; // Approximately constant
          const latRad = latitude * Math.PI / 180;
          const METERS_PER_DEGREE_LON = 111320 * Math.cos(latRad);
          
          // Convert coordinate deltas to meters, then to scene units
          const deltaLonMeters = (plot.longitude - longitude) * METERS_PER_DEGREE_LON;
          const deltaLatMeters = (plot.latitude - latitude) * METERS_PER_DEGREE_LAT;
          
          const plotX = deltaLonMeters * SCENE_UNITS_PER_METER;
          const plotZ = deltaLatMeters * SCENE_UNITS_PER_METER;
          const plotY = 10 * SCENE_UNITS_PER_METER; // Small height above surface (10 meters)
          
          sphere.position.set(plotX, plotY, plotZ);
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

  // Handle city visualization
  useEffect(() => {
    if (!engineReady || !sceneRef.current || !ThreeRef.current) return;

    const updateCities = () => {
      const { SphereGeometry, MeshBasicMaterial, Mesh } = ThreeRef.current;
      
      // Clear existing city spheres
      citySpheresRef.current.forEach(sphere => {
        // Remove from tiles group or scene
        if (tilesRef.current?.group) {
          tilesRef.current.group.remove(sphere);
        } else if (sceneRef.current) {
          sceneRef.current.remove(sphere);
        }
        sphere.geometry.dispose();
        sphere.material.dispose();
      });
      citySpheresRef.current = [];

      // Create spheres for each major city
      MAJOR_CITIES.forEach(city => {
        // Variable sphere size based on city size multiplier
        const baseSphereSize = viewMode === "globe" ? EARTH_RADIUS * 0.008 : 800;
        const sphereSize = baseSphereSize * city.size;
        
        // Create sphere geometry
        const sphereGeometry = new SphereGeometry(sphereSize, 12, 12);
        
        // Create material with city's specific color
        const sphereMaterial = new MeshBasicMaterial({ 
          color: city.color,
          opacity: 0.9,
          transparent: true
        });
        
        const sphere = new Mesh(sphereGeometry, sphereMaterial);
        
        if (viewMode === "globe") {
          // For globe view, position on the surface
          const lat = city.lat * Math.PI / 180;
          const lon = city.lng * Math.PI / 180;
          const radius = EARTH_RADIUS * 1.005; // Slightly above surface
          
          sphere.position.set(
            radius * Math.cos(lat) * Math.cos(lon),
            radius * Math.cos(lat) * Math.sin(lon),
            radius * Math.sin(lat)
          );
        } else {
          // For orbit view, use the same meter-based calculations as plot system
          const SCENE_UNITS_PER_METER = 0.01; // Same scale as focus system
          
          // Calculate meters per degree at current latitude
          const METERS_PER_DEGREE_LAT = 111320; // Approximately constant
          const latRad = latitude * Math.PI / 180;
          const METERS_PER_DEGREE_LON = 111320 * Math.cos(latRad);
          
          // Convert coordinate deltas to meters, then to scene units
          const deltaLonMeters = (city.lng - longitude) * METERS_PER_DEGREE_LON;
          const deltaLatMeters = (city.lat - latitude) * METERS_PER_DEGREE_LAT;
          
          const cityX = deltaLonMeters * SCENE_UNITS_PER_METER;
          const cityZ = deltaLatMeters * SCENE_UNITS_PER_METER;
          const cityY = 15 * SCENE_UNITS_PER_METER; // Slightly higher than plots (15 meters)
          
          sphere.position.set(cityX, cityY, cityZ);
        }
        
        sphere.layers.set(CITIES_LAYER);
        sphere.userData = { city };
        
        // Try to add to tiles group first, fallback to scene if not available
        if (tilesRef.current?.group) {
          tilesRef.current.group.add(sphere);
          citySpheresRef.current.push(sphere);
        } else if (sceneRef.current) {
          sceneRef.current.add(sphere);
          citySpheresRef.current.push(sphere);
        }
      });
    };

    updateCities();
  }, [engineReady, viewMode, latitude, longitude]);

  // Camera focus functionality - DIRECT CAMERA POSITIONING (bypassing GlobeControls)
  useEffect(() => {
    if (!engineReady || !cameraRef.current || focusTrigger === 0) return;
    if (focusLatitude === undefined || focusLongitude === undefined) return;

    const camera = cameraRef.current!;
    const controls = controlsRef.current;
    
    console.log(`🎯 Direct camera positioning to (${focusLatitude}, ${focusLongitude})`);
    
    if (viewMode === "globe") {
      // USE EXACT SAME POSITIONING AS CITY DOTS - just at higher altitude
      const lat = focusLatitude * Math.PI / 180;
      const lon = focusLongitude * Math.PI / 180;
      const radius = EARTH_RADIUS * 2.5; // Much higher than city dots (2.5x earth radius = ~16,000km from center)
      
      // SAME MATH AS CITY DOTS - proven to work correctly
      const x = radius * Math.cos(lat) * Math.cos(lon);
      const y = radius * Math.cos(lat) * Math.sin(lon);
      const z = radius * Math.sin(lat);
      
      // Set camera position directly
      camera.position.set(x, y, z);
      
      // Point camera at earth center (where the dots are)
      camera.lookAt(0, 0, 0);
      
      // Update controls target if available (but don't rely on it)
      if (controls && controls.target) {
        controls.target.set(0, 0, 0);
        controls.update();
      }
      
      console.log(`🎯 Camera positioned using dot math at (${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)}) looking at origin`);
    } else {
      // For orbit mode, use local coordinate system (unchanged)
      const SCENE_UNITS_PER_METER = 0.01;
      const METERS_PER_DEGREE_LAT = 111320;
      const latRad = latitude * Math.PI / 180;
      const METERS_PER_DEGREE_LON = 111320 * Math.cos(latRad);
      
      const deltaLonMeters = (focusLongitude - longitude) * METERS_PER_DEGREE_LON;
      const deltaLatMeters = (focusLatitude - latitude) * METERS_PER_DEGREE_LAT;
      
      const x = deltaLonMeters * SCENE_UNITS_PER_METER;
      const z = deltaLatMeters * SCENE_UNITS_PER_METER;
      const y = 100000 * SCENE_UNITS_PER_METER;
      
      camera.position.set(x, y, z);
      if (controls && controls.target) {
        controls.target.set(x, 0, z);
        controls.update();
      }
      
      console.log(`🎯 Orbit camera positioned at (${x.toFixed(0)}, ${y.toFixed(0)}, ${z.toFixed(0)})`);
    }
    
  }, [focusTrigger, focusLatitude, focusLongitude, engineReady, viewMode, latitude, longitude]);

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

  // Working directly with XYZ coordinates - no conversion needed!






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