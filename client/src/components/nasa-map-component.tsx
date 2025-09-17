import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

interface BoundaryPoint {
  x: number;
  z: number;
}

interface NasaMapComponentProps {
  latitude: number;
  longitude: number;
  height?: number;
  width?: string;
  className?: string;
  enableBoundary?: boolean;
  boundaryPoints?: BoundaryPoint[];
  onError?: (error: Error) => void;
}

export default function NasaMapComponent({ 
  latitude, 
  longitude, 
  height = 400,
  width = "100%",
  className = "",
  enableBoundary = false,
  boundaryPoints = [],
  onError
}: NasaMapComponentProps) {
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
  const onLoadModelRef = useRef<any>(null);
  const onDisposeModelRef = useRef<any>(null);
  const boundaryPointsForShaderRef = useRef<any[]>([]);

  // Constants
  const CAMERA_NEAR_CLIP = 200;
  const CAMERA_FAR_CLIP = 2600000;
  const CAMERA_MIN_DISTANCE = 500;
  const CAMERA_MAX_DISTANCE = 2000000;
  const INITIAL_CAMERA_DISTANCE = 5000;

  // Define render layers
  const TILES_LAYER = 0;
  const BOUNDARY_LAYER = 1;

  // Shared shader code for clipping
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

      if (!isPointInPolygon(worldXZ)) {
        discard;
      }

      vec3 brightnessFactor = vec3(3.5); // Brighten by 250%

      if (hasTexture) {
        vec4 texColor = texture2D(map, vUv);
        // Apply brightness boost and ensure we don't exceed 1.0
        vec3 brightened = min(texColor.rgb * brightnessFactor, vec3(1.0));
        gl_FragColor = vec4(brightened, texColor.a * opacity);
      } else {
        // Apply brightness to diffuse color
        vec3 brightened = min(diffuse * brightnessFactor, vec3(1.0));
        gl_FragColor = vec4(brightened, opacity);
      }
    }
  `;

  // Helper functions for boundary and shader management
  const createBoundary = async (points: BoundaryPoint[], height = 200) => {
    if (!points || points.length < 2 || !sceneRef.current) return;

    const { BufferGeometry, Float32BufferAttribute, MeshBasicMaterial, Mesh, DoubleSide } = await import('three');

    // Store points for shader (max 32 points)
    const { Vector2 } = await import('three');
    boundaryPointsForShaderRef.current = points.slice(0, 32).map(p => new Vector2(p.x, p.z));

    // Create arrays for vertices and indices
    const vertices = [];
    const indices = [];

    // Create vertices for each wall segment
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length]; // Connect last point to first

      // Add vertices for this wall segment (4 vertices per wall)
      const baseIndex = i * 4;

      // Bottom vertices
      vertices.push(p1.x, 0, p1.z);           // vertex 0 of this segment
      vertices.push(p2.x, 0, p2.z);           // vertex 1 of this segment

      // Top vertices  
      vertices.push(p2.x, height, p2.z);      // vertex 2 of this segment
      vertices.push(p1.x, height, p1.z);      // vertex 3 of this segment

      // Create two triangles for this wall segment
      indices.push(
        baseIndex, baseIndex + 1, baseIndex + 2,     // first triangle
        baseIndex, baseIndex + 2, baseIndex + 3      // second triangle
      );
    }

    // Create geometry
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Create material for semi-transparent walls
    const material = new MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.1,
      side: DoubleSide
    });

    // Remove existing boundary mesh
    if (boundaryMeshRef.current) {
      sceneRef.current.remove(boundaryMeshRef.current);
      boundaryMeshRef.current.geometry.dispose();
      boundaryMeshRef.current.material.dispose();
    }

    // Create single mesh for entire boundary
    boundaryMeshRef.current = new Mesh(geometry, material);
    boundaryMeshRef.current.layers.set(BOUNDARY_LAYER); // Put boundary on its own layer
    sceneRef.current.add(boundaryMeshRef.current);
  };

  const applyClippingShader = async () => {
    if (!tilesRef.current || boundaryPointsForShaderRef.current.length === 0) return;

    const { Vector2, Vector3, ShaderMaterial, DoubleSide } = await import('three');

    // Update shader uniforms
    const uniformsArray = new Array(32).fill(null).map((_, i) => 
      i < boundaryPointsForShaderRef.current.length ? boundaryPointsForShaderRef.current[i] : new Vector2(0, 0)
    );

    // Define event handlers
    onLoadModelRef.current = function({ scene, tile }: any) {
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          try {
            // Store original material for disposal
            const originalMaterial = child.material;
            child.userData.originalMaterial = originalMaterial;

            // Extract color safely
            let diffuseColor = new Vector3(1, 1, 1);
            if (originalMaterial.color) {
              diffuseColor = new Vector3(
                originalMaterial.color.r || 1,
                originalMaterial.color.g || 1,
                originalMaterial.color.b || 1
              );
            }

            // Create a custom shader material that includes clipping
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
              transparent: true, // Always transparent to allow discard
              depthWrite: true
            });

            child.material = customMaterial;
            // Ensure tiles stay on layer 0
            child.layers.set(TILES_LAYER);
          } catch (error) {
            console.error('Error applying clipping shader:', error);
            // Keep original material if shader fails
          }
        }
      });
    };

    onDisposeModelRef.current = function({ scene }: any) {
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          // Dispose of our custom material
          child.material.dispose();
          // Don't dispose the original material as it might be shared
          child.userData.originalMaterial = null;
        }
      });
    };

    // Remove any existing listeners
    tilesRef.current.removeEventListener('load-model', onLoadModelRef.current);
    tilesRef.current.removeEventListener('dispose-model', onDisposeModelRef.current);

    // Add event listener for when models are loaded
    tilesRef.current.addEventListener('load-model', onLoadModelRef.current);
    tilesRef.current.addEventListener('dispose-model', onDisposeModelRef.current);
  };

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
        camera.position.set(1, 1, 1).setLength(INITIAL_CAMERA_DISTANCE);
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

        // Create boundary if enabled
        if (enableBoundary && boundaryPoints.length > 0) {
          await createBoundary(boundaryPoints);
          await applyClippingShader();
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
            if (enableBoundary && boundaryMeshRef.current) {
              // First pass: Render only the tiles with clipping
              cameraRef.current.layers.set(TILES_LAYER);
              rendererRef.current.render(sceneRef.current, cameraRef.current);

              // Second pass: Render only the boundary walls with transparency
              // Don't clear the buffer, just render on top
              rendererRef.current.autoClear = false;
              cameraRef.current.layers.set(BOUNDARY_LAYER);
              rendererRef.current.render(sceneRef.current, cameraRef.current);
              rendererRef.current.autoClear = true;

              // Reset camera layers to see everything
              cameraRef.current.layers.enableAll();
            } else {
              // Standard single-pass rendering
              rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
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
      
      // Clean up boundary
      if (boundaryMeshRef.current && sceneRef.current) {
        sceneRef.current.remove(boundaryMeshRef.current);
        boundaryMeshRef.current.geometry.dispose();
        boundaryMeshRef.current.material.dispose();
        boundaryMeshRef.current = null;
      }
      
      // Clean up tiles event listeners
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
      
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [cesiumToken, latitude, longitude, onError]);

  // Handle boundary changes
  useEffect(() => {
    if (!tilesRef.current || !sceneRef.current) return;

    const updateBoundary = async () => {
      if (enableBoundary && boundaryPoints.length > 0) {
        await createBoundary(boundaryPoints);
        await applyClippingShader();
      } else {
        // Remove boundary if disabled
        if (boundaryMeshRef.current) {
          sceneRef.current.remove(boundaryMeshRef.current);
          boundaryMeshRef.current.geometry.dispose();
          boundaryMeshRef.current.material.dispose();
          boundaryMeshRef.current = null;
        }
        
        // Clear boundary points for shader
        boundaryPointsForShaderRef.current = [];
        
        // Remove event listeners
        if (onLoadModelRef.current) {
          tilesRef.current.removeEventListener('load-model', onLoadModelRef.current);
        }
        if (onDisposeModelRef.current) {
          tilesRef.current.removeEventListener('dispose-model', onDisposeModelRef.current);
        }
      }
    };

    updateBoundary();
  }, [enableBoundary, boundaryPoints]);

  return (
    <div 
      ref={containerRef} 
      className={`bg-slate-900 rounded-lg overflow-hidden ${className}`}
      style={{ width, height: `${height}px` }}
      data-testid="nasa-map-component"
    />
  );
}