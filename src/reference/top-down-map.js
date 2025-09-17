/*

this is just a variation of the nasa-map-engine-with-cesium.js file that shows a top down view of the map instead - the benefit is that it makes some math operations easier

*/

import {
  WGS84_ELLIPSOID,
  CAMERA_FRAME,
  GeoUtils,
  GlobeControls,
  TilesRenderer,
} from '3d-tiles-renderer';

import {
  TilesFadePlugin,
  UpdateOnChangePlugin,
  TileCompressionPlugin,
  UnloadTilesPlugin,
  GLTFExtensionsPlugin,
  CesiumIonAuthPlugin,
} from '3d-tiles-renderer/plugins';

import {
  Scene,
  WebGLRenderer,
  PerspectiveCamera,
  MathUtils,
  OrthographicCamera,
  Raycaster,
  Vector2,
  Vector3,
  MeshBasicMaterial,
  Mesh,
  Shape,
  ShapeGeometry,
  DoubleSide,
  Matrix4,
  SphereGeometry,
} from 'three';

import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GUI } from 'three/examples/jsm/libs/lil-gui.module.min.js';

let controls, scene, renderer, tiles, camera;
let statsContainer, stats;
let raycaster, mouse;
let isDrawingPolygon = false;
let polygonPoints = [];
let polygonMesh = null;
let isPlacingSpheres = false;
let placedSpheres = [];

const urlParams = new URLSearchParams(window.location.search);
const CESIUM_ION_TOKEN = urlParams.get('token') || import.meta.env.VITE_CESIUM_KEY || '';

function reinstantiateTiles() {

  if ( tiles ) {

    scene.remove( tiles.group );
    tiles.dispose();
    tiles = null;

  }

  tiles = new TilesRenderer();
  tiles.registerPlugin( new CesiumIonAuthPlugin( { apiToken: CESIUM_ION_TOKEN, assetId: '2275207', autoRefreshToken: true } ) );
  tiles.registerPlugin( new TileCompressionPlugin() );
  tiles.registerPlugin( new UpdateOnChangePlugin() );
  tiles.registerPlugin( new UnloadTilesPlugin() );
  tiles.registerPlugin( new TilesFadePlugin() );
  tiles.registerPlugin( new GLTFExtensionsPlugin( {
    // Note the DRACO compression files need to be supplied via an explicit source.
    // We use unpkg here but in practice should be provided by the application.
    dracoLoader: new DRACOLoader().setDecoderPath( 'https://unpkg.com/three@0.153.0/examples/jsm/libs/draco/gltf/' )
  } ) );


  tiles.group.rotation.x = - Math.PI / 2;
  scene.add( tiles.group );

  tiles.setResolutionFromRenderer( camera, renderer );
  tiles.setCamera( camera );

  controls.setEllipsoid( tiles.ellipsoid, tiles.group );

}

function createPolygonControls() {
  const controlsDiv = document.createElement('div');
  controlsDiv.style.position = 'absolute';
  controlsDiv.style.top = '10px';
  controlsDiv.style.left = '50%';
  controlsDiv.style.transform = 'translateX(-50%)';
  controlsDiv.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  controlsDiv.style.padding = '10px';
  controlsDiv.style.borderRadius = '5px';
  controlsDiv.style.color = 'white';
  controlsDiv.style.fontFamily = 'Arial, sans-serif';
  controlsDiv.style.zIndex = '1000';

  const startBtn = document.createElement('button');
  startBtn.textContent = 'Start Polygon';
  startBtn.style.marginRight = '10px';
  startBtn.style.padding = '5px 10px';
  startBtn.style.cursor = 'pointer';
  startBtn.onclick = startPolygon;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close Polygon';
  closeBtn.style.marginRight = '10px';
  closeBtn.style.padding = '5px 10px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.disabled = true;
  closeBtn.onclick = closePolygon;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.marginRight = '10px';
  cancelBtn.style.padding = '5px 10px';
  cancelBtn.style.cursor = 'pointer';
  cancelBtn.disabled = true;
  cancelBtn.onclick = cancelPolygon;

  const sphereBtn = document.createElement('button');
  sphereBtn.textContent = 'Place Spheres';
  sphereBtn.style.marginRight = '10px';
  sphereBtn.style.padding = '5px 10px';
  sphereBtn.style.cursor = 'pointer';
  sphereBtn.onclick = toggleSphereMode;

  const clearSpheresBtn = document.createElement('button');
  clearSpheresBtn.textContent = 'Clear Spheres';
  clearSpheresBtn.style.padding = '5px 10px';
  clearSpheresBtn.style.cursor = 'pointer';
  clearSpheresBtn.onclick = clearAllSpheres;

  controlsDiv.appendChild(startBtn);
  controlsDiv.appendChild(closeBtn);
  controlsDiv.appendChild(cancelBtn);
  controlsDiv.appendChild(sphereBtn);
  controlsDiv.appendChild(clearSpheresBtn);
  document.body.appendChild(controlsDiv);

  return { startBtn, closeBtn, cancelBtn, sphereBtn, clearSpheresBtn };
}

const polygonControls = createPolygonControls();

function startPolygon() {
  // Disable sphere mode if active
  if (isPlacingSpheres) {
    toggleSphereMode();
  }

  isDrawingPolygon = true;
  polygonPoints = [];
  clearPolygonVisuals();

  polygonControls.startBtn.disabled = true;
  polygonControls.closeBtn.disabled = false;
  polygonControls.cancelBtn.disabled = false;
  polygonControls.sphereBtn.disabled = true;

  controls.enabled = false; // Disable camera controls while drawing
}

function closePolygon() {
  if (polygonPoints.length >= 3) {
    // Polygon is already visible, just log the final result
    console.log('Polygon created with points:', polygonPoints);
  }

  isDrawingPolygon = false;
  polygonControls.startBtn.disabled = false;
  polygonControls.closeBtn.disabled = true;
  polygonControls.cancelBtn.disabled = true;
  polygonControls.sphereBtn.disabled = false;

  controls.enabled = true; // Re-enable camera controls
}

function cancelPolygon() {
  isDrawingPolygon = false;
  clearPolygonVisuals();
  polygonPoints = [];

  polygonControls.startBtn.disabled = false;
  polygonControls.closeBtn.disabled = true;
  polygonControls.cancelBtn.disabled = true;
  polygonControls.sphereBtn.disabled = false;

  controls.enabled = true; // Re-enable camera controls
}

function clearPolygonVisuals() {
  if (polygonMesh) {
    scene.remove(polygonMesh);
    polygonMesh.geometry.dispose();
    polygonMesh.material.dispose();
    polygonMesh = null;
  }
}

function updatePolygonVisual() {
  // Remove existing mesh
  if (polygonMesh) {
    scene.remove(polygonMesh);
    polygonMesh.geometry.dispose();
    polygonMesh.material.dispose();
    polygonMesh = null;
  }

  // Only create polygon if we have at least 3 points
  if (polygonPoints.length >= 3) {
    // Project points to 2D for shape creation
    const shape = new Shape();

    // Find a plane to project onto (using first 3 points)
    const v1 = polygonPoints[1].clone().sub(polygonPoints[0]);
    const v2 = polygonPoints[2].clone().sub(polygonPoints[0]);
    const normal = v1.cross(v2).normalize();

    // Create basis vectors for 2D projection
    const up = Math.abs(normal.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
    const right = up.clone().cross(normal).normalize();
    const forward = normal.clone().cross(right).normalize();

    // Project points to 2D
    const points2D = polygonPoints.map((p, i) => {
      const relative = p.clone().sub(polygonPoints[0]);
      const x = relative.dot(right);
      const y = relative.dot(forward);
      if (i === 0) {
        shape.moveTo(x, y);
      } else {
        shape.lineTo(x, y);
      }
      return new Vector2(x, y);
    });
    shape.closePath();

    // Create mesh
    const shapeGeometry = new ShapeGeometry(shape);
    const meshMaterial = new MeshBasicMaterial({ 
      color: 0x00ff00, 
      opacity: 0.3, 
      transparent: true,
      side: DoubleSide
    });

    polygonMesh = new Mesh(shapeGeometry, meshMaterial);

    // Transform back to 3D
    const matrix = new Matrix4();
    matrix.makeBasis(right, forward, normal);
    matrix.setPosition(polygonPoints[0]);
    polygonMesh.applyMatrix4(matrix);

    scene.add(polygonMesh);
  }
}

function addPolygonPoint(point) {
  polygonPoints.push(point.clone());

  // Update polygon visual
  updatePolygonVisual();
}

function toggleSphereMode() {
  isPlacingSpheres = !isPlacingSpheres;

  if (isPlacingSpheres) {
    // Disable polygon mode if active
    if (isDrawingPolygon) {
      cancelPolygon();
    }
    polygonControls.sphereBtn.textContent = 'Stop Placing';
    polygonControls.sphereBtn.style.backgroundColor = '#ff4444';
    polygonControls.startBtn.disabled = true;
  } else {
    polygonControls.sphereBtn.textContent = 'Place Spheres';
    polygonControls.sphereBtn.style.backgroundColor = '';
    polygonControls.startBtn.disabled = false;
  }
}

function clearAllSpheres() {
  placedSpheres.forEach(sphere => {
    scene.remove(sphere);
    sphere.geometry.dispose();
    sphere.material.dispose();
  });
  placedSpheres = [];
  console.log('All spheres cleared');
}

function placeSphere(point, lat, lon) {
  // Calculate sphere size based on camera distance
  const cameraDistance = camera.position.length();
  const sphereSize = cameraDistance * 0.002; // Adjust multiplier as needed

  // Create sphere
  const sphereGeometry = new SphereGeometry(sphereSize, 16, 16);
  const sphereMaterial = new MeshBasicMaterial({ 
    color: 0xff0000, // Red color for spheres
    opacity: 0.8,
    transparent: true
  });
  const sphere = new Mesh(sphereGeometry, sphereMaterial);
  sphere.position.copy(point);

  // Store geographic data
  sphere.userData = {
    latitude: lat,
    longitude: lon,
    baseSize: sphereSize
  };

  scene.add(sphere);
  placedSpheres.push(sphere);

  console.log(`Sphere placed at: lat ${lat.toFixed(4)}°, lon ${lon.toFixed(4)}°`);
}

function updateSphereSizes() {
  const cameraDistance = camera.position.length();
  const scaleFactor = cameraDistance * 0.002;

  placedSpheres.forEach(sphere => {
    sphere.scale.setScalar(scaleFactor / sphere.userData.baseSize);
  });
}

function onMouseClick(event) {
  if (!tiles) return;

  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);

  // Check for intersections with the tiles group
  const intersects = raycaster.intersectObject(tiles.group, true);

  if (intersects.length > 0) {
    const intersectionPoint = intersects[0].point.clone();

    // Convert the world space point to the tiles coordinate frame
    // First, we need to transform from world space to tiles.group local space
    const tilesInverseMatrix = tiles.group.matrixWorld.clone().invert();
    const localPoint = intersectionPoint.clone().applyMatrix4(tilesInverseMatrix);

    // Convert ECEF coordinates to lat/lon
    // In ECEF coordinate system:
    // X axis points to 0° longitude at equator
    // Y axis points to 90° E longitude at equator  
    // Z axis points to North Pole

    // Calculate spherical coordinates
    const radius = localPoint.length();
    const lat = Math.asin(localPoint.z / radius) * 180 / Math.PI;
    const lon = Math.atan2(localPoint.y, localPoint.x) * 180 / Math.PI;

    // Calculate height above WGS84 ellipsoid (approximate)
    const equatorialRadius = 6378137; // WGS84 equatorial radius in meters
    const height = radius - equatorialRadius;

    console.log('Click location:', {
      worldSpace: {
        x: intersectionPoint.x,
        y: intersectionPoint.y,
        z: intersectionPoint.z
      },
      localSpace: {
        x: localPoint.x,
        y: localPoint.y,
        z: localPoint.z
      },
      geographic: {
        latitude: lat,
        longitude: lon,
        height: height
      }
    });

    // Only add to polygon if we're drawing
    if (isDrawingPolygon) {
      // Move the point 5000 units along the ray direction (outward from the globe center)
      const direction = intersectionPoint.clone().normalize();
      const elevatedPoint = intersectionPoint.add(direction.multiplyScalar(5000));

      addPolygonPoint(elevatedPoint);
    } else if (isPlacingSpheres) {
      // Place a sphere at the clicked location
      const direction = intersectionPoint.clone().normalize();
      const elevatedPoint = intersectionPoint.add(direction.multiplyScalar(1000));

      placeSphere(elevatedPoint, lat, lon);
    }
  }
}

function init() {

  // renderer
  renderer = new WebGLRenderer( { antialias: true } );
  renderer.setClearColor( 0x151c1f );
  document.body.appendChild( renderer.domElement );

  // scene
  scene = new Scene();

  camera = new PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 160000000 )
  camera.position.set( 6378160*2, 0, 0 );
  camera.lookAt( 0, 0, 0 );

  // controls
  controls = new GlobeControls( scene, camera, renderer.domElement, null );
  controls.enableDamping = true;

  // initialize raycaster and mouse
  raycaster = new Raycaster();
  mouse = new Vector2();

  // Add mouse click event listener
  renderer.domElement.addEventListener('click', onMouseClick);

  // initialize tiles
  reinstantiateTiles();

  onWindowResize();

}

function onWindowResize() {
  const aspect = window.innerWidth / window.innerHeight;
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  renderer.setSize( window.innerWidth, window.innerHeight );
  renderer.setPixelRatio( window.devicePixelRatio );
}

window.addEventListener('resize', onWindowResize);

function animate() {

  requestAnimationFrame( animate );

  if ( ! tiles ) return;

  controls.update();

  tiles.setResolutionFromRenderer( camera, renderer );
  tiles.setCamera( camera );

  camera.updateMatrixWorld();
  tiles.update();

  // Update sphere sizes based on camera distance
  if (placedSpheres.length > 0) {
    updateSphereSizes();
  }

  renderer.render( scene, camera );
}

init();
animate();

