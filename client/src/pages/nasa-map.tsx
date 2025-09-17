import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NasaMap() {
  const [, setLocation] = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const tilesRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const animationIdRef = useRef<number>();
  
  const [cesiumToken, setCesiumToken] = useState("");
  const [lat, setLat] = useState(7.6455);
  const [lon, setLon] = useState(122.4);
  const [isInitialized, setIsInitialized] = useState(false);

  // Constants from the original code
  const EARTH_RADIUS = 6378160;
  const CAMERA_NEAR_CLIP = 200;
  const CAMERA_FAR_CLIP = 2600000;
  const CAMERA_MIN_DISTANCE = 500;
  const CAMERA_MAX_DISTANCE = 2000000;

  useEffect(() => {
    let mounted = true;

    const loadAndInit = async () => {
      if (!containerRef.current) return;

      try {
        // Dynamic imports using the import map
        const [
          { Scene, WebGLRenderer, PerspectiveCamera, MathUtils, Box3, Sphere, AmbientLight, DirectionalLight },
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

        // Setup tiles if token is provided
        if (cesiumToken) {
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
            lat: lat * MathUtils.DEG2RAD,
            lon: lon * MathUtils.DEG2RAD
          }));

          scene.add(tiles.group);
          tiles.setResolutionFromRenderer(camera, renderer);
          tiles.setCamera(camera);
          tilesRef.current = tiles;
        }

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
        setIsInitialized(true);

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
        console.error('Error initializing NASA map:', error);
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
  }, [cesiumToken, lat, lon]);

  const handleInitialize = () => {
    // Trigger re-initialization with new parameters
    setIsInitialized(false);
    // The useEffect will handle re-initialization
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setLocation("/")}
            className="text-muted-foreground hover:text-primary"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-light tracking-tight text-primary" data-testid="text-nasa-map-title">
              NASA Map Engine
            </h1>
            <p className="text-muted-foreground">3D satellite tile visualization using Cesium Ion</p>
          </div>
        </div>

        {/* Configuration */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-4 text-primary">Configuration</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="cesium-token" className="block text-sm font-medium mb-2">
                  Cesium Ion Token
                </Label>
                <Input
                  id="cesium-token"
                  value={cesiumToken}
                  onChange={(e) => setCesiumToken(e.target.value)}
                  placeholder="Enter your Cesium Ion token"
                  className="w-full"
                  data-testid="input-cesium-token"
                />
              </div>
              <div>
                <Label htmlFor="latitude" className="block text-sm font-medium mb-2">
                  Latitude
                </Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value) || 0)}
                  className="w-full"
                  data-testid="input-latitude"
                />
              </div>
              <div>
                <Label htmlFor="longitude" className="block text-sm font-medium mb-2">
                  Longitude
                </Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={lon}
                  onChange={(e) => setLon(parseFloat(e.target.value) || 0)}
                  className="w-full"
                  data-testid="input-longitude"
                />
              </div>
            </div>
            <div className="mt-4">
              <Button 
                onClick={handleInitialize}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                data-testid="button-initialize"
              >
                {isInitialized ? "Re-initialize" : "Initialize"} Map
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Map Container */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">
            <h2 className="text-lg font-medium mb-4 text-primary">3D Map View</h2>
            <div 
              ref={containerRef} 
              className="w-full h-[600px] bg-slate-900 rounded-lg overflow-hidden"
              data-testid="nasa-map-container"
            />
            {!cesiumToken && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-muted-foreground text-sm">
                  <strong>Note:</strong> You need a Cesium Ion token to load satellite tiles. 
                  Get one free at <a href="https://cesium.com/ion/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">cesium.com/ion</a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}