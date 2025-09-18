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
  
  // Polygon editing refs (no React state to avoid re-renders)
  const isDrawingRef = useRef(false);
  const polygonPointsRef = useRef<any[]>([]);
  const currentPolygonMeshRef = useRef<any>(null);
  const polygonDotsRef = useRef<any[]>([]); // Track visual dots for polygon points

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

  // Coordinate conversion helpers using proper ellipsoid transforms
  const lngLatElevationToXYZ = (lng: number, lat: number, elevation: number) => {
    if (!tilesRef.current?.ellipsoid) return { x: 0, y: 0, z: 0 };
    
    // Convert degrees to radians
    const lonRad = lng * Math.PI / 180;
    const latRad = lat * Math.PI / 180;
    
    // Use ellipsoid to get accurate surface position
    const ellipsoid = tilesRef.current.ellipsoid;
    const cosLat = Math.cos(latRad);
    const sinLat = Math.sin(latRad);
    const cosLon = Math.cos(lonRad);
    const sinLon = Math.sin(lonRad);
    
    // Calculate position on ellipsoid surface + elevation
    const N = ellipsoid.radiiSquared.x / Math.sqrt(
      ellipsoid.radiiSquared.x * cosLat * cosLat + 
      ellipsoid.radiiSquared.z * sinLat * sinLat
    );
    
    const h = elevation || 0;
    const x = (N + h) * cosLat * cosLon;
    const y = (N + h) * cosLat * sinLon;
    const z = (N * (ellipsoid.radiiSquared.z / ellipsoid.radiiSquared.x) + h) * sinLat;
    
    return { x, y, z };
  };

  const xyzToLngLatElevation = (x: number, y: number, z: number) => {
    if (!tilesRef.current?.ellipsoid) return [0, 0, 0] as [number, number, number];
    
    // Convert XYZ to longitude/latitude/elevation using ellipsoid
    const ellipsoid = tilesRef.current.ellipsoid;
    const p = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(z * ellipsoid.radiiSquared.x, p * ellipsoid.radiiSquared.z);
    
    const longitude = Math.atan2(y, x) * (180 / Math.PI);
    const latitude = Math.atan2(
      z + ellipsoid.eccentricitySquared * ellipsoid.radiiSquared.z * Math.pow(Math.sin(theta), 3),
      p - ellipsoid.eccentricitySquared * ellipsoid.radiiSquared.x * Math.pow(Math.cos(theta), 3)
    ) * (180 / Math.PI);
    
    const N = ellipsoid.radiiSquared.x / Math.sqrt(
      ellipsoid.radiiSquared.x * Math.pow(Math.cos(latitude * Math.PI / 180), 2) + 
      ellipsoid.radiiSquared.z * Math.pow(Math.sin(latitude * Math.PI / 180), 2)
    );
    
    const elevation = p / Math.cos(latitude * Math.PI / 180) - N;
    
    return [longitude, latitude, elevation] as [number, number, number];
  };

  // Render existing polygon when not editing
  useEffect(() => {
    if (!engineReady || !tilesRef.current || !existingPolygon?.length || editingBoundary) return;

    // Clear any existing polygon visuals
    clearPolygonVisuals();

    // Convert stored lng/lat/elevation coordinates to XYZ for rendering
    const xyzPoints = existingPolygon.map(([lng, lat, elevation]) => {
      const { x, y, z } = lngLatElevationToXYZ(lng, lat, elevation);
      return { x, y: y, z: z + 1000 }; // Add 1000m visual offset for rendering only
    });

    // Add visual dots for each point
    xyzPoints.forEach(point => {
      addPolygonDot(point);
    });

    // Store the rendered polygon points for potential editing
    if (polygonPointsRef.current) {
      polygonPointsRef.current.length = 0; // Clear array
      xyzPoints.forEach(point => {
        polygonPointsRef.current.push(point);
      });
    }

    console.log(`DEBUG: Rendered existing polygon with ${xyzPoints.length} points`);
  }, [engineReady, existingPolygon, editingBoundary]);

  // Clear polygon visuals when entering edit mode
  useEffect(() => {
    if (editingBoundary) {
      // Don't clear here - let the editing effect handle initialization
      console.log('DEBUG: Entering edit mode');
    }
  }, [editingBoundary]);

  // Helper functions for polygon editing (like in reference implementation)
  const addPolygonDot = (point: any) => {
    if (!ThreeRef.current || !sceneRef.current) return;
    
    const { SphereGeometry, MeshBasicMaterial, Mesh } = ThreeRef.current;
    
    // Create small red sphere to mark the point
    const geometry = new SphereGeometry(1000, 8, 8); // 1km radius sphere
    const material = new MeshBasicMaterial({ color: 0xff0000 }); // Red color
    const dot = new Mesh(geometry, material);
    
    // Position the dot at the intersection point
    dot.position.copy(point);
    
    // Add to scene and track it
    sceneRef.current.add(dot);
    polygonDotsRef.current.push(dot);
    
    console.log('DEBUG: Added visual dot at', point, 'Total dots:', polygonDotsRef.current.length);
    debugLog('visual_dot_added', {
      position: point,
      sphereRadius: 1000,
      totalDotsInScene: polygonDotsRef.current.length,
      sceneChildrenCount: sceneRef.current.children.length
    });
  };

  const clearPolygonVisuals = () => {
    // Clear polygon mesh
    if (currentPolygonMeshRef.current) {
      // CRITICAL: Add/remove from tiles.group to maintain proper coordinate frame
      if (tilesRef.current?.group) {
        tilesRef.current.group.remove(currentPolygonMeshRef.current);
      }
      currentPolygonMeshRef.current.geometry?.dispose();
      currentPolygonMeshRef.current.material?.dispose();
      currentPolygonMeshRef.current = null;
    }
    
    // Clear polygon dots
    polygonDotsRef.current.forEach(dot => {
      if (sceneRef.current) {
        sceneRef.current.remove(dot);
      }
      dot.geometry?.dispose();
      dot.material?.dispose();
    });
    polygonDotsRef.current = [];
    
    console.log('DEBUG: Cleared all polygon visuals');
  };

  const updatePolygonVisual = () => {
    clearPolygonVisuals();
    
    if (!ThreeRef.current || polygonPointsRef.current.length < 3) return;
    
    const { Vector3, MeshBasicMaterial, Mesh, BufferGeometry, Float32BufferAttribute } = ThreeRef.current;
    
    // Convert the ECEF points to vertices for rendering
    const vertices: number[] = [];
    polygonPointsRef.current.forEach((point: any) => {
      vertices.push(point.x, point.y, point.z);
    });

    // Create triangulated faces for the polygon (fan triangulation from first vertex)
    const indices: number[] = [];
    for (let i = 1; i < polygonPointsRef.current.length - 1; i++) {
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

    // Create mesh and add to tiles group (CRITICAL: proper coordinate frame)
    const mesh = new Mesh(geometry, material);
    mesh.layers.set(BOUNDARY_LAYER);
    if (tilesRef.current?.group) {
      tilesRef.current.group.add(mesh);
      currentPolygonMeshRef.current = mesh;
    }
  };

  // Simple polygon editing effect (like reference implementation)
  useEffect(() => {
    console.log('DEBUG: Polygon editing effect triggered:', { 
      editingBoundary, 
      engineReady,
      hasRenderer: !!rendererRef.current,
      hasCanvas: !!rendererRef.current?.domElement,
      hasControls: !!controlsRef.current
    });

    // Handle polygon completion FIRST, before ANY other checks
    if (!editingBoundary && isDrawingRef.current && polygonPointsRef.current.length >= 3 && onPolygonComplete) {
      // Convert XYZ coordinates back to lng/lat/elevation for storage
      const coords: [number, number, number][] = polygonPointsRef.current.map((point: any) => {
        // Remove the visual +1000m offset before converting
        const adjustedPoint = { x: point.x, y: point.y, z: point.z - 1000 };
        return xyzToLngLatElevation(adjustedPoint.x, adjustedPoint.y, adjustedPoint.z);
      });
      console.log('DEBUG: Completing polygon with lng/lat/elevation coords:', coords);
      
      debugLog('polygon_completed', {
        totalPoints: coords.length,
        coordinates: coords,
        timestamp: Date.now()
      });
      
      onPolygonComplete(coords);
      isDrawingRef.current = false;
      clearPolygonVisuals();
      return; // Exit early after handling completion
    }
    
    const canvas = rendererRef.current?.domElement;
    const controls = controlsRef.current;
    
    if (!canvas || !controls) {
      console.log('DEBUG: Missing canvas or controls, waiting...', { 
        canvas: !!canvas, 
        controls: !!controls,
        editingBoundary,
        engineReady 
      });
      return;
    }

    console.log('DEBUG: Canvas and controls ready!');

    const handleInteraction = async (event: MouseEvent | TouchEvent) => {
      console.log('DEBUG: Interaction detected!', { 
        isDrawing: isDrawingRef.current, 
        currentPoints: polygonPointsRef.current.length,
        eventType: event.type 
      });
      
      await debugLog('interaction_triggered', {
        eventType: event.type,
        isDrawing: isDrawingRef.current,
        pointCount: polygonPointsRef.current.length,
        timestamp: Date.now()
      });
      
      if (!tilesRef.current) {
        console.log('DEBUG: No tiles ref available');
        await debugLog('no_tiles_ref', { tilesRefExists: !!tilesRef.current });
        return;
      }

      // Get client coordinates from mouse or touch event
      let clientX: number, clientY: number;
      if (event.type.startsWith('touch')) {
        const touchEvent = event as TouchEvent;
        const touch = touchEvent.touches[0] || touchEvent.changedTouches[0];
        clientX = touch.clientX;
        clientY = touch.clientY;
      } else {
        const mouseEvent = event as MouseEvent;
        clientX = mouseEvent.clientX;
        clientY = mouseEvent.clientY;
      }

      // Calculate position in normalized device coordinates (matching reference)
      const mouse = {
        x: (clientX / window.innerWidth) * 2 - 1,
        y: -(clientY / window.innerHeight) * 2 + 1
      };

      console.log('DEBUG: Input position:', mouse);

      // Update the raycaster
      const { Raycaster, Vector2 } = ThreeRef.current;
      const raycaster = new Raycaster();
      raycaster.setFromCamera(new Vector2(mouse.x, mouse.y), cameraRef.current);

      // Check for intersections with the tiles group (matching reference)
      const intersects = raycaster.intersectObject(tilesRef.current.group, true);

      console.log('DEBUG: Ray intersections found:', intersects.length);
      debugLog('ray_intersections', {
        intersectionCount: intersects.length,
        firstIntersection: intersects[0] ? {
          point: intersects[0].point,
          distance: intersects[0].distance
        } : null
      });

      if (intersects.length > 0) {
        const intersectionPoint = intersects[0].point.clone();
        console.log('DEBUG: Intersection point (world):', intersectionPoint);
        
        // Only add to polygon if we're drawing
        if (isDrawingRef.current) {
          // Elevate the point 1000 units above ground to avoid intersection
          const elevatedPoint = intersectionPoint.clone();
          elevatedPoint.z += 1000;
          polygonPointsRef.current.push(elevatedPoint);
          console.log('DEBUG: Added point to polygon. Total points:', polygonPointsRef.current.length);
          
          debugLog('polygon_point_added', {
            pointIndex: polygonPointsRef.current.length - 1,
            totalPoints: polygonPointsRef.current.length,
            coordinates: [elevatedPoint.x, elevatedPoint.y, elevatedPoint.z],
            timestamp: Date.now()
          });
          
          // Add visual dot for this elevated point
          addPolygonDot(elevatedPoint);
          updatePolygonVisual();
        }
      } else {
        console.log('DEBUG: No intersections found with tiles');
      }
    };

    if (editingBoundary) {
      // Start polygon editing
      isDrawingRef.current = true;
      clearPolygonVisuals();
      
      // Initialize with existing polygon data if available
      if (existingPolygon?.length) {
        // Convert existing lng/lat/elevation to XYZ for editing
        polygonPointsRef.current = existingPolygon.map(([lng, lat, elevation]) => {
          const { x, y, z } = lngLatElevationToXYZ(lng, lat, elevation);
          return { x, y, z: z + 1000 }; // Add visual offset for editing
        });
        
        // Add visual dots for existing points
        polygonPointsRef.current.forEach(point => {
          addPolygonDot(point);
        });
        
        console.log(`DEBUG: Initialized editing with ${polygonPointsRef.current.length} existing points`);
      } else {
        // Start fresh polygon
        polygonPointsRef.current = [];
        console.log('DEBUG: Starting fresh polygon editing');
      }
      // Keep controls enabled, just check drawing state in handler (like reference)
      
      // Add both mouse and touch event listeners for cross-device support
      canvas.addEventListener('mousedown', handleInteraction);
      canvas.addEventListener('touchstart', handleInteraction);
      canvas.style.cursor = 'crosshair';
      canvas.style.touchAction = 'none'; // Prevent default touch behaviors
      
      console.log('DEBUG: Added click and touch event listeners');
      console.log('DEBUG: Started polygon editing');
      
      debugLog('polygon_editing_started', {
        isDrawing: true,
        initialPointCount: 0,
        timestamp: Date.now()
      });
      
      debugLog('event_listeners_added', {
        canvasElement: canvas.tagName,
        canvasClass: canvas.className,
        boundingRect: canvas.getBoundingClientRect(),
        hasEventListeners: true
      });
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleInteraction);
        canvas.removeEventListener('touchstart', handleInteraction);
        canvas.style.cursor = 'default';
        canvas.style.touchAction = '';
      }
      // Controls stay enabled throughout (like reference)
    };
  }, [editingBoundary, engineReady, onPolygonComplete]);

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