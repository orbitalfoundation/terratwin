import { useEffect, useRef, useState } from "react";

interface Simulation3DViewProps {
  plotData?: any;
  className?: string;
}

export default function Simulation3DView({ plotData, className = "" }: Simulation3DViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const rendererRef = useRef<any>(null);
  const animationIdRef = useRef<number>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initThreeJS = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Dynamically import Three.js
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (!mounted) return;

        // Create scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        sceneRef.current = scene;

        // Create camera
        const camera = new THREE.PerspectiveCamera(
          45,
          1, // Will be updated in resize
          0.1,
          1000
        );
        camera.position.set(100, 50, 100);
        camera.lookAt(50, 0, 50);

        // Create renderer with fallback handling
        const renderer = new THREE.WebGLRenderer({ 
          antialias: true,
          preserveDrawingBuffer: true // Help with some environments
        });
        
        // Check if WebGL context was created successfully
        const gl = renderer.getContext();
        if (!gl) {
          throw new Error('WebGL context could not be created');
        }
        
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        rendererRef.current = renderer;

        // Add to container
        if (containerRef.current) {
          containerRef.current.appendChild(renderer.domElement);
        }

        // Add controls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.target.set(50, 0, 50);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(100, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        scene.add(directionalLight);

        // Add ground plane
        const groundGeometry = new THREE.PlaneGeometry(100, 100);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x8B7355 });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        scene.add(ground);

        // Resize handler
        const handleResize = () => {
          if (!containerRef.current || !mounted) return;
          
          const rect = containerRef.current.getBoundingClientRect();
          camera.aspect = rect.width / rect.height;
          camera.updateProjectionMatrix();
          renderer.setSize(rect.width, rect.height);
        };

        // Initial resize
        handleResize();

        // Add resize listener
        const resizeObserver = new ResizeObserver(handleResize);
        if (containerRef.current) {
          resizeObserver.observe(containerRef.current);
        }

        // Animation loop
        const animate = () => {
          if (!mounted) return;
          
          animationIdRef.current = requestAnimationFrame(animate);
          controls.update();
          renderer.render(scene, camera);
        };

        animate();
        setIsLoading(false);

        // Cleanup function
        return () => {
          mounted = false;
          if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
          }
          resizeObserver.disconnect();
          if (containerRef.current && renderer.domElement) {
            containerRef.current.removeChild(renderer.domElement);
          }
          renderer.dispose();
        };

      } catch (err) {
        console.error('Failed to initialize Three.js:', err);
        
        // Check if it's a WebGL-related error
        const errorMessage = err instanceof Error ? err.message : String(err);
        if (errorMessage.includes('WebGL') || errorMessage.includes('context')) {
          setError('WebGL is not available in this browser environment. The 3D view requires WebGL support to display the bamboo simulation.');
        } else {
          setError('Failed to load 3D view. Please try refreshing the page.');
        }
        setIsLoading(false);
      }
    };

    initThreeJS();

    return () => {
      mounted = false;
    };
  }, []);

  // Update scene when plot data changes
  useEffect(() => {
    if (!sceneRef.current || !plotData) return;

    // TODO: Add bamboo and coffee plant meshes based on plotData
    // This would integrate with the existing volume service logic
    console.log('Plot data updated:', plotData);

  }, [plotData]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center max-w-md p-4">
          <div className="text-destructive mb-2 text-lg">⚠️ 3D View Unavailable</div>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          {error.includes('WebGL') && (
            <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
              <p className="mb-2"><strong>Tip:</strong> To use the 3D view:</p>
              <ul className="text-left space-y-1">
                <li>• Try a different browser (Chrome, Firefox, Safari)</li>
                <li>• Enable hardware acceleration in browser settings</li>
                <li>• Update your graphics drivers</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-sm text-muted-foreground">Loading 3D View...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full ${className}`}
      data-testid="simulation-3d-view"
    />
  );
}