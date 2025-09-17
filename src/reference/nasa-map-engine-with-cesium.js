import { GeoUtils, WGS84_ELLIPSOID, TilesRenderer } from '3d-tiles-renderer';
import { TilesFadePlugin, TileCompressionPlugin, GLTFExtensionsPlugin, CesiumIonAuthPlugin, ReorientationPlugin } from '3d-tiles-renderer/plugins';
import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  Raycaster,
  MathUtils,
  Sphere,
  Box3,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  BufferGeometry,
  Float32BufferAttribute,
  DoubleSide,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
  AmbientLight,
  DirectionalLight,
  Layers
} from 'three';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Get token from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const CESIUM_ION_TOKEN = urlParams.get('token') || '';

// Debug: Log the token to help identify issues
if (CESIUM_ION_TOKEN) {
    console.log('Cesium Ion Token received:', CESIUM_ION_TOKEN);
} else {
    console.warn('No Cesium Ion Token provided in URL parameters');
}
const lat = 7.6455
const lon = 122.4

const EARTH_RADIUS        =  6378160
const BOUNDING_RADIUS     = 13241895.61863527 // twice earth size?

const CAMERA_NEAR_CLIP    =      200
const CAMERA_FAR_CLIP     =  2600000
const CAMERA_MIN_DISTANCE =      500
const CAMERA_MAX_DISTANCE =  2000000


let camera, controls, scene, renderer, tiles;
let onLoadModel, onDisposeModel; // Store event handlers for cleanup
let boundaryMesh; // Store boundary mesh for render control

const raycaster = new Raycaster();
raycaster.firstHitOnly = true;

// Define render layers
const TILES_LAYER = 0;
const BOUNDARY_LAYER = 1;

// Store boundary points for shader
let boundaryPointsForShader = [];

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

function reinstantiateTiles() {

  if ( tiles ) {
    // Remove event listeners before disposing
    tiles.removeEventListener('load-model', onLoadModel);
    tiles.removeEventListener('dispose-model', onDisposeModel);

    scene.remove( tiles.group );
    tiles.dispose();
    tiles = null;
  }

  tiles = new TilesRenderer();
  tiles.registerPlugin( new CesiumIonAuthPlugin( { apiToken: CESIUM_ION_TOKEN, assetId: '2275207', autoRefreshToken: true } ) );
  tiles.registerPlugin( new TileCompressionPlugin() );
  tiles.registerPlugin( new TilesFadePlugin() );
  tiles.registerPlugin( new GLTFExtensionsPlugin( {
    dracoLoader: new DRACOLoader().setDecoderPath( 'https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/' )
  } ) );
  tiles.registerPlugin( new ReorientationPlugin( {
    lat: lat * MathUtils.DEG2RAD,
    lon: lon * MathUtils.DEG2RAD
  } ) );

  scene.add( tiles.group );

  tiles.setResolutionFromRenderer( camera, renderer );
  tiles.setCamera( camera );

  // Apply clipping shader to tiles
  applyClippingShader();
}

function applyClippingShader() {
  if (!tiles || boundaryPointsForShader.length === 0) return;

  // Update shader uniforms
  const uniformsArray = new Array(32).fill(null).map((_, i) => 
    i < boundaryPointsForShader.length ? boundaryPointsForShader[i] : new Vector2(0, 0)
  );

  // Define event handlers
  onLoadModel = function({ scene, tile }) {
    scene.traverse((child) => {
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
            numPoints: { value: boundaryPointsForShader.length },
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

  onDisposeModel = function({ scene }) {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // Dispose of our custom material
        child.material.dispose();

        // Don't dispose the original material as it might be shared
        child.userData.originalMaterial = null;
      }
    });
  };

  // Remove any existing listeners
  tiles.removeEventListener('load-model', onLoadModel);
  tiles.removeEventListener('dispose-model', onDisposeModel);

  // Add event listener for when models are loaded
  tiles.addEventListener('load-model', onLoadModel);
  tiles.addEventListener('dispose-model', onDisposeModel);
}

function createClip() {
  const geometry = new SphereGeometry(1000, 32, 16); 
  const material = new MeshBasicMaterial({ color: 0xffff00 }); // Yellow color
  const sphere = new Mesh(geometry, material);
  scene.add(sphere);	
}

function createBoundary(points, height = 200) {
  // points is an array of {x, z} coordinates
  if (points.length < 2) return;

  // Store points for shader (max 32 points)
  boundaryPointsForShader = points.slice(0, 32).map(p => new Vector2(p.x, p.z));

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

  // Create single mesh for entire boundary
  boundaryMesh = new Mesh(geometry, material);
  boundaryMesh.layers.set(BOUNDARY_LAYER); // Put boundary on its own layer
  scene.add(boundaryMesh);
}

function init() {

  scene = new Scene();

  // primary camera view
  renderer = new WebGLRenderer( { antialias: true } );
  renderer.setClearColor( 0x001a33 ); // Dark blue background

  // Add ambient light for overall brightness
  const ambientLight = new AmbientLight(0xffffff, 1.2); // Increased from 0.6
  ambientLight.layers.enableAll(); // Light affects all layers
  scene.add(ambientLight);

  // Add main directional light
  const directionalLight = new DirectionalLight(0xffffff, 1.5); // Increased from 0.8
  directionalLight.position.set(1000, 2000, 1000);
  directionalLight.target.position.set(0, 0, 0);
  directionalLight.layers.enableAll(); // Light affects all layers
  scene.add(directionalLight);
  scene.add(directionalLight.target);

  // Add a second directional light from opposite direction for better coverage
  const directionalLight2 = new DirectionalLight(0xffffff, 0.8);
  directionalLight2.position.set(-1000, 1500, -1000);
  directionalLight2.target.position.set(0, 0, 0);
  directionalLight2.layers.enableAll(); // Light affects all layers
  scene.add(directionalLight2);
  scene.add(directionalLight2.target);

  document.body.appendChild( renderer.domElement );

  camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, CAMERA_NEAR_CLIP, CAMERA_FAR_CLIP );

  // just set an angle - the position is overriden
  camera.position.set( 1, 1, 1 ).multiplyScalar( 0.5 );

  // controls
  controls = new OrbitControls( camera, renderer.domElement );
  controls.minDistance = CAMERA_MIN_DISTANCE;
  controls.maxDistance = CAMERA_MAX_DISTANCE;
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = 3 * Math.PI / 8;
  controls.enableDamping = true;
  controls.enablePan = true;

  reinstantiateTiles();

  onWindowResize();
  window.addEventListener( 'resize', onWindowResize, false );

  // createClip()

  // Example boundary - create a 10-point convex polygon
  const numPoints = 10;
  const radius = 600;
  const boundaryPoints = [];

  // Generate points in a circle, then offset them slightly for a more interesting convex shape
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const radiusVariation = radius + Math.sin(i * 1.5) * 100; // Vary radius slightly

    boundaryPoints.push({
      x: Math.cos(angle) * radiusVariation,
      z: Math.sin(angle) * radiusVariation
    });
  }

  // Store boundary points for shader without creating the visual walls
  boundaryPointsForShader = boundaryPoints.slice(0, 32).map(p => new Vector2(p.x, p.z));

  createBoundary(boundaryPoints);

  // Apply clipping shader after boundary points are defined
  if (tiles) {
    applyClippingShader();
  }
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  renderer.setSize( window.innerWidth, window.innerHeight );
  camera.updateProjectionMatrix();
  renderer.setPixelRatio( window.devicePixelRatio );
}

function animate() {
  requestAnimationFrame( animate );
  if (!tiles) return;
  controls.update();
  tiles.setResolutionFromRenderer( camera, renderer );
  tiles.setCamera( camera );
  camera.updateMatrixWorld();
  tiles.update();
  render();

  const box = new Box3();
  tiles.getBoundingBox( box )
  const sphere = new Sphere();
  tiles.getBoundingSphere( sphere )

}

function render() {
  // First pass: Render only the tiles with clipping
  camera.layers.set(TILES_LAYER);
  renderer.render( scene, camera );

  // Second pass: Render only the boundary walls with transparency
  // Don't clear the buffer, just render on top
  renderer.autoClear = false;
  camera.layers.set(BOUNDARY_LAYER);
  renderer.render( scene, camera );
  renderer.autoClear = true;

  // Reset camera layers to see everything
  camera.layers.enableAll();

  // get lat,lon of point we are looking at
  if (false && tiles) {
    const mat = tiles.group.matrixWorld.clone().invert();
    const vec = camera.position.clone().applyMatrix4( mat );
    const res = {};
    WGS84_ELLIPSOID.getPositionToCartographic( vec, res );
  }
}


init();
animate();


