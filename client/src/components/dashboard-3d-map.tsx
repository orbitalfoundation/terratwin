import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Plot } from "@shared/schema";

interface Dashboard3DMapProps {
  plots: Plot[];
}

export default function Dashboard3DMap({ plots }: Dashboard3DMapProps) {
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
  const plotSpheresRef = useRef<any[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lon: number} | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const ThreeRef = useRef<any>(null);
  const WGS84_EllipsoidRef = useRef<any>(null);

  // Constants
  const CAMERA_NEAR_CLIP = 1;
  const CAMERA_FAR_CLIP = 160000000;
  const EARTH_RADIUS = 6378160;

  // Helper function for better error logging
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
        console.info('Dashboard3DMap: Loading 3D engine...');
        
        // Dynamically load Three.js and 3d-tiles-renderer
        const [
          { Scene, WebGLRenderer, PerspectiveCamera, SphereGeometry, MeshBasicMaterial, Mesh, Raycaster, Vector2, Vector3 },
          { TilesRenderer, GlobeControls, WGS84_ELLIPSOID },
          { TileCompressionPlugin, UpdateOnChangePlugin, UnloadTilesPlugin, TilesFadePlugin, GLTFExtensionsPlugin, CesiumIonAuthPlugin },
          { DRACOLoader }
        ] = await Promise.all([
          import('three'),
          import('3d-tiles-renderer'),
          import('3d-tiles-renderer/plugins'),
          import('three/examples/jsm/loaders/DRACOLoader.js')
        ]);

        if (!isActive) return;

        console.info('Dashboard3DMap: 3D engine loaded, initializing scene...');

        // Create renderer with WebGL fallback handling
        let renderer;
        try {
          renderer = new WebGLRenderer({ antialias: true });
          // Test WebGL context
          const gl = renderer.getContext();
          if (!gl) {
            throw new Error('WebGL context creation failed');
          }
          console.info('Dashboard3DMap: WebGL context created successfully');
        } catch (error) {
          console.error('Dashboard3DMap: WebGL not available:', errorToString(error));
          showWebGLFallback();
          return;
        }
        
        renderer.setClearColor(0x151c1f);
        renderer.setSize(containerRef.current!.clientWidth, containerRef.current!.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current!.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Create scene
        const scene = new Scene();
        sceneRef.current = scene;

        // Create camera - positioned far out in space looking at origin (top-down view)
        const camera = new PerspectiveCamera(
          60, 
          containerRef.current!.clientWidth / containerRef.current!.clientHeight,
          CAMERA_NEAR_CLIP,
          CAMERA_FAR_CLIP
        );
        // Position camera at twice earth's radius on X axis, looking at origin
        camera.position.set(EARTH_RADIUS * 2, 0, 0);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Create globe controls (better for globe navigation than OrbitControls)
        const controls = new GlobeControls(scene, camera, renderer.domElement);
        controls.enableDamping = true;
        controlsRef.current = controls;

        // Create tiles renderer - NO reorientation plugin, earth stays at origin
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

        // Rotate tiles to proper orientation (reference file technique)
        tiles.group.rotation.x = -Math.PI / 2;
        scene.add(tiles.group);

        tiles.setResolutionFromRenderer(camera, renderer);
        tiles.setCamera(camera);
        if (tiles.ellipsoid) {
          controls.setEllipsoid(tiles.ellipsoid, tiles.group);
        }

        tilesRef.current = tiles;
        // Store references for coordinate conversion
        ThreeRef.current = { Scene, WebGLRenderer, PerspectiveCamera, SphereGeometry, MeshBasicMaterial, Mesh, Raycaster, Vector2, Vector3 };
        WGS84_EllipsoidRef.current = WGS84_ELLIPSOID;

        setEngineReady(true);
        console.info('Dashboard3DMap: 3D engine initialized successfully');

        // Start animation loop
        const animate = () => {
          if (!isActive) return;
          
          animationIdRef.current = requestAnimationFrame(animate);

          if (tiles && controls) {
            controls.update();
            tiles.setResolutionFromRenderer(camera, renderer);
            tiles.setCamera(camera);
            camera.updateMatrixWorld();
            tiles.update();

            // Update current location
            updateCurrentLocation();

            // Update plot sphere sizes based on camera distance
            updatePlotSphereSizes();
          }

          renderer.render(scene, camera);
        };

        animate();

      } catch (error) {
        console.error('Dashboard3DMap initialization error:', errorToString(error));
        showWebGLFallback();
      }
    };

    initializeEngine();

    return () => {
      isActive = false;
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      // Clean up resources
      clearPlotSpheres();
      if (rendererRef.current && containerRef.current?.contains(rendererRef.current.domElement)) {
        containerRef.current.removeChild(rendererRef.current.domElement);
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      if (tilesRef.current) {
        sceneRef.current?.remove(tilesRef.current.group);
        tilesRef.current.dispose();
      }
    };
  }, [cesiumToken]);

  // Show fallback UI when WebGL is not available
  const showWebGLFallback = () => {
    if (!containerRef.current) return;
    
    const totalArea = plots.reduce((sum, p) => sum + p.area, 0);
    
    containerRef.current.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-center; height: 100%; background: #1e293b; color: #64748b; font-family: Inter, sans-serif; text-align: center; padding: 2rem;">
        <div style="font-size: 3rem; margin-bottom: 1rem;">🌍</div>
        <h3 style="color: #f8fafc; font-size: 1.25rem; margin: 0 0 0.5rem 0;">3D Globe Unavailable</h3>
        <p style="margin: 0 0 1rem 0; opacity: 0.8;">WebGL support is required for the 3D satellite view</p>
        <div style="background: #334155; padding: 1rem; border-radius: 0.5rem; font-size: 0.875rem;">
          <strong style="color: #22c55e;">${plots.length}</strong> ${plots.length === 1 ? 'Plot' : 'Plots'} • 
          <strong style="color: #22c55e;">${totalArea.toLocaleString()}</strong> m²
        </div>
        <p style="font-size: 0.75rem; margin: 1rem 0 0 0; opacity: 0.6;">View individual plots for detailed satellite imagery</p>
      </div>
    `;
  };

  // Update current location display using the provided coordinate conversion
  const updateCurrentLocation = () => {
    if (!tilesRef.current || !cameraRef.current) return;

    try {
      const tiles = tilesRef.current;
      const camera = cameraRef.current;
      
      // Convert camera position to geographic coordinates (from reference)
      const mat = tiles.group.matrixWorld.clone().invert();
      const vec = camera.position.clone().applyMatrix4(mat);
      const res = {};
      
      // Use tiles.ellipsoid for proper coordinate conversion
      if (tiles.ellipsoid?.getPositionToCartographic) {
        tiles.ellipsoid.getPositionToCartographic(vec, res);
        const result = res as any;
        setCurrentLocation({
          lat: result.latitude * 180 / Math.PI,
          lon: result.longitude * 180 / Math.PI
        });
      } else {
        // Fallback coordinate calculation
        const radius = vec.length();
        const lat = Math.asin(vec.z / radius) * 180 / Math.PI;
        const lon = Math.atan2(vec.y, vec.x) * 180 / Math.PI;
        setCurrentLocation({ lat, lon });
      }
    } catch (error) {
      // Silent fail for location updates
    }
  };

  // Convert lat/lng to 3D position using reference file approach (direct ECEF calculation)
  const latLngTo3DPosition = (lat: number, lng: number, height: number = 5000) => {
    if (!ThreeRef.current) return null;
    
    const { Vector3 } = ThreeRef.current;
    const latRad = lat * Math.PI / 180;
    const lngRad = lng * Math.PI / 180;
    
    // Use WGS84 ellipsoid parameters (reference file approach)
    const a = 6378137.0; // WGS84 equatorial radius
    const b = 6356752.314245; // WGS84 polar radius
    const f = (a - b) / a; // flattening
    const e2 = 2 * f - f * f; // first eccentricity squared
    
    // Calculate radius of curvature in the prime vertical
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    
    // Convert to ECEF coordinates
    const x = (N + height) * Math.cos(latRad) * Math.cos(lngRad);
    const y = (N + height) * Math.cos(latRad) * Math.sin(lngRad);
    const z = (N * (1 - e2) + height) * Math.sin(latRad);
    
    return new Vector3(x, y, z);
  };

  // Clear all plot spheres
  const clearPlotSpheres = () => {
    plotSpheresRef.current.forEach(sphere => {
      if (tilesRef.current?.group) {
        tilesRef.current.group.remove(sphere);
      }
      sphere.geometry?.dispose();
      sphere.material?.dispose();
    });
    plotSpheresRef.current = [];
  };

  // Update plot sphere sizes based on camera distance
  const updatePlotSphereSizes = () => {
    if (!cameraRef.current || plotSpheresRef.current.length === 0) return;

    const cameraDistance = cameraRef.current.position.length();
    const scaleFactor = cameraDistance * 0.002; // Similar to reference file

    plotSpheresRef.current.forEach(sphere => {
      if (sphere.userData?.baseSize) {
        sphere.scale.setScalar(scaleFactor / sphere.userData.baseSize);
      }
    });
  };

  // Create plot markers when plots change
  useEffect(() => {
    if (!engineReady || !plots || !sceneRef.current || !cameraRef.current || !ThreeRef.current) return;

    console.info('Dashboard3DMap: Creating plot markers for', plots.length, 'plots');

    // Clear existing spheres
    clearPlotSpheres();

    plots.forEach((plot) => {
      // Validate coordinates
      const lat = Number(plot.latitude);
      const lng = Number(plot.longitude);
      
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || 
          lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        console.warn(`Invalid coordinates for plot ${plot.id}:`, lat, lng);
        return;
      }

      try {
        // Calculate 3D position using proper ellipsoid conversion
        const position = latLngTo3DPosition(lat, lng, 5000); // Already elevated
        if (!position) {
          console.warn(`Failed to calculate position for plot ${plot.id}`);
          return;
        }

        // Calculate sphere size based on camera distance and plot area
        const cameraDistance = cameraRef.current.position.length();
        const baseSize = Math.max(cameraDistance * 0.001, Math.sqrt(plot.area) * 10);
        
        // Create sphere geometry and material
        const { SphereGeometry, MeshBasicMaterial, Mesh } = ThreeRef.current;
        const sphereGeometry = new SphereGeometry(baseSize, 16, 16);
        const sphereMaterial = new MeshBasicMaterial({ 
          color: plot.status === 'active' ? 0x22c55e : plot.status === 'planning' ? 0xfbbf24 : 0x6b7280,
          opacity: 0.8,
          transparent: true
        });
        
        const sphere = new Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(position);
        
        // Store metadata
        sphere.userData = {
          plotId: plot.id,
          plotName: plot.name,
          latitude: lat,
          longitude: lng,
          area: plot.area,
          bambooType: plot.bambooType,
          status: plot.status,
          baseSize: baseSize
        };

        // Add to tiles.group for proper coordinate frame alignment (reference approach)
        tilesRef.current.group.add(sphere);
        plotSpheresRef.current.push(sphere);
      } catch (error) {
        console.warn(`Failed to create marker for plot ${plot.id}:`, errorToString(error));
      }
    });

  }, [plots, engineReady]);

  return (
    <div className="relative w-full h-full min-h-[400px] bg-card border border-border rounded-lg">
      <div 
        ref={containerRef} 
        className="w-full h-full"
        data-testid="dashboard-3d-map-container"
      />
      
      {/* Current Location Display */}
      {currentLocation && (
        <div className="absolute top-4 right-4 bg-black/70 text-white px-3 py-2 rounded text-sm font-mono">
          <div>Lat: {currentLocation.lat.toFixed(4)}°</div>
          <div>Lon: {currentLocation.lon.toFixed(4)}°</div>
        </div>
      )}
      
      {/* Loading indicator */}
      {!engineReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/90">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-muted-foreground">Loading 3D Globe...</p>
          </div>
        </div>
      )}

      {/* Plot count indicator */}
      {engineReady && (
        <div className="absolute bottom-4 left-4 bg-black/70 text-white px-3 py-2 rounded text-sm">
          {plots.length} {plots.length === 1 ? 'Plot' : 'Plots'} Displayed
        </div>
      )}
    </div>
  );
}