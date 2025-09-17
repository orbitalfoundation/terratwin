import { useEffect, useRef } from "react";

interface NasaMapComponentProps {
  cesiumToken: string;
  latitude: number;
  longitude: number;
  height?: number;
  width?: string;
  className?: string;
  onError?: (error: Error) => void;
}

export default function NasaMapComponent({ 
  cesiumToken, 
  latitude, 
  longitude, 
  height = 400,
  width = "100%",
  className = "",
  onError
}: NasaMapComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const tilesRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number>();

  // Constants
  const CAMERA_NEAR_CLIP = 200;
  const CAMERA_FAR_CLIP = 2600000;
  const CAMERA_MIN_DISTANCE = 500;
  const CAMERA_MAX_DISTANCE = 2000000;

  useEffect(() => {
    let mounted = true;

    const loadAndInit = async () => {
      if (!containerRef.current || !cesiumToken) return;

      try {
        // Dynamic imports using the import map
        const [
          { Scene, WebGLRenderer, PerspectiveCamera, MathUtils, AmbientLight, DirectionalLight },
          { OrbitControls },
          { TilesRenderer },
          { TileCompressionPlugin, GLTFExtensionsPlugin, CesiumIonAuthPlugin, ReorientationPlugin },
          { DRACOLoader }
        ] = await Promise.all([
          import('three'),
          import('three/examples/jsm/controls/OrbitControls.js'),
          import('3d-tiles-renderer'),
          import('3d-tiles-renderer/plugins'),
          import('three/examples/jsm/loaders/DRACOLoader.js')
        ]);

        if (!mounted) return;

        // Initialize scene
        const scene = new Scene();
        sceneRef.current = scene;

        // Setup renderer
        const renderer = new WebGLRenderer({ antialias: true });
        renderer.setClearColor(0x001a33); // Dark blue background
        renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        containerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Add lighting
        const ambientLight = new AmbientLight(0xffffff, 1.2);
        scene.add(ambientLight);

        const directionalLight = new DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(1000, 2000, 1000);
        directionalLight.target.position.set(0, 0, 0);
        scene.add(directionalLight);
        scene.add(directionalLight.target);

        const directionalLight2 = new DirectionalLight(0xffffff, 0.8);
        directionalLight2.position.set(-1000, 1500, -1000);
        directionalLight2.target.position.set(0, 0, 0);
        scene.add(directionalLight2);
        scene.add(directionalLight2.target);

        // Setup camera
        const camera = new PerspectiveCamera(
          60,
          containerRef.current.clientWidth / containerRef.current.clientHeight,
          CAMERA_NEAR_CLIP,
          CAMERA_FAR_CLIP
        );
        camera.position.set(1, 1, 1).multiplyScalar(0.5);
        cameraRef.current = camera;

        // Setup controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.minDistance = CAMERA_MIN_DISTANCE;
        controls.maxDistance = CAMERA_MAX_DISTANCE;
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = 3 * Math.PI / 8;
        controls.enableDamping = true;
        controls.enablePan = true;
        controlsRef.current = controls;

        // Setup tiles
        const tiles = new TilesRenderer();
        tiles.registerPlugin(new CesiumIonAuthPlugin({ 
          apiToken: cesiumToken, 
          assetId: '2275207', 
          autoRefreshToken: true 
        }));
        tiles.registerPlugin(new TileCompressionPlugin());
        tiles.registerPlugin(new GLTFExtensionsPlugin({
          dracoLoader: new DRACOLoader().setDecoderPath('https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/')
        }));
        tiles.registerPlugin(new ReorientationPlugin({
          lat: latitude * MathUtils.DEG2RAD,
          lon: longitude * MathUtils.DEG2RAD
        }));

        scene.add(tiles.group);
        tiles.setResolutionFromRenderer(camera, renderer);
        tiles.setCamera(camera);
        tilesRef.current = tiles;

        // Animation loop
        const animate = () => {
          if (!mounted) return;
          
          animationIdRef.current = requestAnimationFrame(animate);
          
          if (controlsRef.current) {
            controlsRef.current.update();
          }
          
          if (tilesRef.current && cameraRef.current) {
            tilesRef.current.setResolutionFromRenderer(cameraRef.current, rendererRef.current);
            tilesRef.current.setCamera(cameraRef.current);
            cameraRef.current.updateMatrixWorld();
            tilesRef.current.update();
          }
          
          if (rendererRef.current && sceneRef.current && cameraRef.current) {
            rendererRef.current.render(sceneRef.current, cameraRef.current);
          }
        };

        animate();

        // Handle resize
        const handleResize = () => {
          if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
          
          cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
          rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setPixelRatio(window.devicePixelRatio);
        };

        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);
        };

      } catch (error) {
        console.error('Error initializing NASA map component:', error);
        onError?.(error as Error);
      }
    };

    loadAndInit();

    return () => {
      mounted = false;
      
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      if (tilesRef.current) {
        if (sceneRef.current) {
          sceneRef.current.remove(tilesRef.current.group);
        }
        tilesRef.current.dispose();
      }
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [cesiumToken, latitude, longitude, onError]);

  return (
    <div 
      ref={containerRef} 
      className={`bg-slate-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height: `${height}px` }}
      data-testid="nasa-map-component"
    />
  );
}