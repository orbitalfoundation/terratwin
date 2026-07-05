import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

///
/// BambooBatch - renders every bamboo culm in the scene as two instanced draws:
///
///   1. culms   - one InstancedMesh of a tapered, node-ringed culm (unit height,
///                scaled per instance), per-instance color, GPU wind sway
///   2. foliage - one InstancedMesh of a leaf "crown" made of alpha-tested
///                crossed quads with a procedurally painted leaf texture
///
/// Growth is expressed by rewriting instance matrices (no geometry rebuilds).
///

const CULM_RADIAL_SEGMENTS = 8;
const CULM_INTERNODES = 9;
const FOLIAGE_MIN_HEIGHT = 1.5;   // meters before a crown appears
const CROWN_HEIGHT_FRACTION = 0.87; // crown sits at this fraction of culm height

// ---------------------------------------------------------------------------
// Culm geometry - a lathe profile with node rings, unit height (y: 0..1),
// unit base radius. Vertex colors darken the node bands so they read even
// though instance scaling flattens normal detail.
// ---------------------------------------------------------------------------

function buildCulmGeometry() {
	const points = [];
	const bandColors = []; // parallel to points: brightness per profile ring

	// radius taper from base (1.0) to tip (~0.45)
	const taper = (y) => 1.0 - 0.55 * Math.pow(y, 1.35);

	for (let i = 0; i < CULM_INTERNODES; i++) {
		const y0 = i / CULM_INTERNODES;
		const r = taper(y0);
		// node collar: slight bulge with a darker band
		points.push(new THREE.Vector2(r * 1.0, y0));
		bandColors.push(0.92);
		points.push(new THREE.Vector2(r * 1.14, y0 + 0.004));
		bandColors.push(0.58);
		points.push(new THREE.Vector2(r * 1.14, y0 + 0.014));
		bandColors.push(0.62);
		points.push(new THREE.Vector2(r * 1.0, y0 + 0.024));
		bandColors.push(1.05);
		// internode midpoint (keeps the silhouette smooth against the taper)
		const ym = y0 + 0.5 / CULM_INTERNODES;
		points.push(new THREE.Vector2(taper(ym), ym));
		bandColors.push(1.0);
	}
	// tip
	points.push(new THREE.Vector2(taper(1.0), 1.0));
	bandColors.push(0.95);
	points.push(new THREE.Vector2(0.001, 1.005));
	bandColors.push(0.9);

	const geometry = new THREE.LatheGeometry(points, CULM_RADIAL_SEGMENTS);

	// Instance scaling is wildly non-uniform (radius ~0.1m vs height ~30m),
	// which skews normals; flatten them to pure radial so lighting stays sane.
	const pos = geometry.attributes.position;
	const nrm = geometry.attributes.normal;
	const colors = new Float32Array(pos.count * 3);
	const profileLen = points.length;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i), z = pos.getZ(i);
		const len = Math.sqrt(x * x + z * z) || 1;
		nrm.setXYZ(i, x / len, 0, z / len);
		// lathe vertex order is segment-major: profile index = i % profileLen
		const band = bandColors[i % profileLen];
		// node bands drift slightly tan rather than pure dark
		const r = Math.min(1, band * 1.02);
		const g = Math.min(1, band);
		const b = Math.min(1, band * 0.82);
		colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
	}
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
	return geometry;
}

// ---------------------------------------------------------------------------
// Leaf texture - two painted frond-cluster variants side by side in an atlas.
// ---------------------------------------------------------------------------

function mulberry32(seed) {
	let a = seed >>> 0;
	return function () {
		a |= 0; a = (a + 0x6D2B79F5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function paintLeaf(ctx, x, y, angle, length, width, hue, sat, lit) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(angle);
	const grad = ctx.createLinearGradient(0, 0, length, 0);
	grad.addColorStop(0, `hsl(${hue}, ${sat}%, ${Math.max(12, lit - 8)}%)`);
	grad.addColorStop(0.6, `hsl(${hue}, ${sat}%, ${lit}%)`);
	grad.addColorStop(1, `hsl(${hue + 10}, ${sat - 8}%, ${lit + 9}%)`);
	ctx.fillStyle = grad;
	// lanceolate leaf: two quadratic arcs meeting at the tip
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.quadraticCurveTo(length * 0.42, -width, length, 0);
	ctx.quadraticCurveTo(length * 0.42, width, 0, 0);
	ctx.closePath();
	ctx.fill();
	// midrib
	ctx.strokeStyle = `hsla(${hue - 6}, ${sat}%, ${Math.max(10, lit - 12)}%, 0.5)`;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.lineTo(length * 0.96, 0);
	ctx.stroke();
	ctx.restore();
}

function paintFrondVariant(ctx, ox, oy, w, h, rand) {
	// several fronds radiating from a point low in the tile, leaves along each
	const fronds = 7;
	for (let f = 0; f < fronds; f++) {
		const baseAngle = -Math.PI / 2 + (f / (fronds - 1) - 0.5) * 2.4 + (rand() - 0.5) * 0.3;
		const frondLen = h * (0.52 + rand() * 0.3);
		const sx = ox + w * 0.5 + (rand() - 0.5) * w * 0.14;
		const sy = oy + h * 0.94;
		const ex = sx + Math.cos(baseAngle) * frondLen;
		const ey = sy + Math.sin(baseAngle) * frondLen * 0.9;
		// thin stem
		ctx.strokeStyle = `hsla(${70 + rand() * 20}, 30%, 32%, 0.85)`;
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(sx, sy);
		ctx.quadraticCurveTo(sx + Math.cos(baseAngle) * frondLen * 0.5,
			sy + Math.sin(baseAngle) * frondLen * 0.5 - 6, ex, ey);
		ctx.stroke();
		// leaves along the outer 60% of the stem, drooping; kept broad and
		// soft so they read as foliage rather than green slivers up close
		const leaves = 6 + Math.floor(rand() * 3);
		for (let l = 0; l < leaves; l++) {
			const t = 0.4 + 0.6 * (l / leaves) + rand() * 0.05;
			const lx = sx + Math.cos(baseAngle) * frondLen * t;
			const ly = sy + Math.sin(baseAngle) * frondLen * t - 6 * Math.sin(Math.PI * t);
			const side = (l % 2 === 0) ? 1 : -1;
			const droop = 0.45 + rand() * 0.5; // leaves hang downward-outward
			const leafAngle = baseAngle + side * (0.5 + rand() * 0.45) + droop * 0.4;
			const hue = 72 + rand() * 34;      // yellow-green .. green
			const sat = 30 + rand() * 26;
			const lit = 32 + rand() * 26;      // a few bright backlit leaves
			paintLeaf(ctx, lx, ly, leafAngle,
				h * (0.19 + rand() * 0.12), h * (0.022 + rand() * 0.014), hue, sat, lit);
		}
	}
}

function buildLeafTexture() {
	const W = 512, H = 256;
	const canvas = document.createElement('canvas');
	canvas.width = W; canvas.height = H;
	const ctx = canvas.getContext('2d');
	ctx.clearRect(0, 0, W, H);
	paintFrondVariant(ctx, 0, 0, W / 2, H, mulberry32(101));
	paintFrondVariant(ctx, W / 2, 0, W / 2, H, mulberry32(707));
	const texture = new THREE.CanvasTexture(canvas);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.anisotropy = 4;
	return texture;
}

// ---------------------------------------------------------------------------
// Crown geometry - a cluster of crossed quads around the origin, each mapped
// to one of the two texture variants. Inner quads carry darker vertex colors
// as fake ambient occlusion.
// ---------------------------------------------------------------------------

function buildCrownGeometry() {
	const rand = mulberry32(4242);
	const quads = [];
	const plumes = 6;
	for (let p = 0; p < plumes; p++) {
		const angle = (p / plumes) * Math.PI * 2 + rand() * 0.9;
		const radius = p === 0 ? 0 : 0.35 + rand() * 0.75;
		const px = Math.cos(angle) * radius;
		const pz = Math.sin(angle) * radius;
		// biased downward so foliage drapes below the culm tip rather than
		// leaving a bare pole sticking out the top
		const py = (rand() - 0.62) * 1.3;
		const scale = 1.15 + rand() * 0.7;
		const variant = rand() < 0.5 ? 0 : 1;
		const ao = Math.min(1, 0.72 + radius * 0.28);
		// two crossed planes per plume
		for (let c = 0; c < 2; c++) {
			const plane = new THREE.PlaneGeometry(1.7 * scale, 1.0 * scale);
			// remap uv.x into the atlas column for this variant
			const uv = plane.attributes.uv;
			for (let i = 0; i < uv.count; i++) {
				uv.setX(i, uv.getX(i) * 0.5 + variant * 0.5);
			}
			// vertex color AO
			const colors = new Float32Array(uv.count * 3);
			for (let i = 0; i < uv.count; i++) {
				colors[i * 3] = ao; colors[i * 3 + 1] = ao; colors[i * 3 + 2] = ao;
			}
			plane.setAttribute('color', new THREE.BufferAttribute(colors, 3));
			const m = new THREE.Matrix4()
				.makeRotationY(angle + c * Math.PI / 2 + rand() * 0.5)
				.premultiply(new THREE.Matrix4().makeRotationZ((rand() - 0.5) * 0.35))
				.setPosition(px, py, pz);
			plane.applyMatrix4(m);
			quads.push(plane);
		}
	}
	const merged = mergeGeometries(quads, false);
	quads.forEach(q => q.dispose());
	return merged;
}

// ---------------------------------------------------------------------------
// Wind - injected into the standard materials. Culms bend as height^2 with an
// amplitude derived from the instance's own height (instanceMatrix[1][1]);
// crowns get the matching offset via a per-instance amplitude attribute plus
// a high-frequency flutter.
// ---------------------------------------------------------------------------

function injectCulmWind(material, uniforms) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uniforms.uTime;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;')
			.replace('#include <project_vertex>', `
				vec4 _wpos = vec4( transformed, 1.0 );
				#ifdef USE_INSTANCING
					_wpos = instanceMatrix * _wpos;
					float _hf = clamp( position.y, 0.0, 1.0 );
					float _amp = instanceMatrix[1][1] * 0.02;
					_wpos.x += sin( uTime * 1.3 + aPhase ) * _amp * _hf * _hf;
					_wpos.z += cos( uTime * 1.05 + aPhase * 1.7 ) * _amp * _hf * _hf;
				#endif
				vec4 mvPosition = modelViewMatrix * _wpos;
				gl_Position = projectionMatrix * mvPosition;
			`);
	};
}

function injectFoliageWind(material, uniforms) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uniforms.uTime;
		shader.vertexShader = shader.vertexShader
			.replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aPhase;\nattribute float aAmp;')
			.replace('#include <project_vertex>', `
				vec4 _wpos = vec4( transformed, 1.0 );
				#ifdef USE_INSTANCING
					_wpos = instanceMatrix * _wpos;
					_wpos.x += sin( uTime * 1.3 + aPhase ) * aAmp;
					_wpos.z += cos( uTime * 1.05 + aPhase * 1.7 ) * aAmp;
					_wpos.y += sin( uTime * 3.9 + aPhase * 3.1 + position.x * 2.0 ) * ( 0.05 + aAmp * 0.12 );
				#endif
				vec4 mvPosition = modelViewMatrix * _wpos;
				gl_Position = projectionMatrix * mvPosition;
			`);
	};
}

// ---------------------------------------------------------------------------

const _matrix = new THREE.Matrix4();
const _position = new THREE.Vector3();
const _quaternion = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _crownOffset = new THREE.Vector3();
const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);

export class BambooBatch {

	constructor(scene, capacity = 4096) {
		this.scene = scene;
		this.capacity = capacity;
		this.culms = new Map();  // entity id -> { entity, index }
		this.freeIndices = [];
		this.highWater = 0;
		this.dirty = false;

		this.uniforms = { uTime: { value: 0 } };

		this.culmGeometry = buildCulmGeometry();
		this.crownGeometry = buildCrownGeometry();
		this.leafTexture = buildLeafTexture();

		this._buildMeshes();
	}

	_buildMeshes() {
		const culmMaterial = new THREE.MeshPhongMaterial({
			vertexColors: true,
			color: 0xffffff,
			shininess: 24,
			specular: 0x233420
		});
		injectCulmWind(culmMaterial, this.uniforms);

		this.culmMesh = new THREE.InstancedMesh(this.culmGeometry, culmMaterial, this.capacity);
		this.culmMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		this.culmMesh.castShadow = true;
		this.culmMesh.receiveShadow = true;
		this.culmMesh.frustumCulled = false;
		this.culmMesh.count = 0;

		// emissive uses the leaf texture too - a cheap stand-in for the light
		// that scatters through a real canopy, so shaded leaves stay green
		// instead of collapsing to black
		const foliageMaterial = new THREE.MeshLambertMaterial({
			map: this.leafTexture,
			vertexColors: true,
			alphaTest: 0.45,
			side: THREE.DoubleSide,
			emissive: 0x51682e,
			emissiveMap: this.leafTexture,
			emissiveIntensity: 0.55
		});
		injectFoliageWind(foliageMaterial, this.uniforms);

		this.foliageMesh = new THREE.InstancedMesh(this.crownGeometry, foliageMaterial, this.capacity);
		this.foliageMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
		this.foliageMesh.castShadow = true;
		this.foliageMesh.frustumCulled = false;
		this.foliageMesh.count = 0;

		// alpha-tested shadows for the leaves
		this.foliageMesh.customDepthMaterial = new THREE.MeshDepthMaterial({
			depthPacking: THREE.RGBADepthPacking,
			map: this.leafTexture,
			alphaTest: 0.4
		});

		// per-instance wind attributes
		this.phases = new Float32Array(this.capacity);
		this.amps = new Float32Array(this.capacity);
		const phaseAttr = new THREE.InstancedBufferAttribute(this.phases, 1);
		phaseAttr.setUsage(THREE.DynamicDrawUsage);
		const ampAttr = new THREE.InstancedBufferAttribute(this.amps, 1);
		ampAttr.setUsage(THREE.DynamicDrawUsage);
		this.culmGeometry.setAttribute('aPhase', phaseAttr);
		this.crownGeometry.setAttribute('aPhase', phaseAttr);
		this.crownGeometry.setAttribute('aAmp', ampAttr);

		// prime color buffers so instanceColor exists before first render
		for (let i = 0; i < this.capacity; i++) {
			this.culmMesh.setMatrixAt(i, ZERO_MATRIX);
			this.foliageMesh.setMatrixAt(i, ZERO_MATRIX);
		}
		this.culmMesh.setColorAt(0, _color.setHex(0xffffff));
		this.foliageMesh.setColorAt(0, _color.setHex(0xffffff));

		this.scene.add(this.culmMesh);
		this.scene.add(this.foliageMesh);
	}

	upsert(entity) {
		let record = this.culms.get(entity.id);
		if (!record) {
			const index = this.freeIndices.length ? this.freeIndices.pop() : this.highWater++;
			if (index >= this.capacity) {
				console.warn('BambooBatch: capacity exceeded, culm dropped', entity.id);
				this.highWater = this.capacity;
				return;
			}
			record = { entity, index };
			this.culms.set(entity.id, record);
			this.phases[index] = (index * 2.399963) % (Math.PI * 2); // golden-angle spread
		} else {
			record.entity = entity;
		}
		this.dirty = true;
	}

	remove(id) {
		const record = this.culms.get(id);
		if (!record) return false;
		this.culms.delete(id);
		this.freeIndices.push(record.index);
		this.culmMesh.setMatrixAt(record.index, ZERO_MATRIX);
		this.foliageMesh.setMatrixAt(record.index, ZERO_MATRIX);
		this.dirty = true;
		return true;
	}

	has(id) {
		return this.culms.has(id);
	}

	reset() {
		this.culms.clear();
		this.freeIndices.length = 0;
		this.highWater = 0;
		for (let i = 0; i < this.capacity; i++) {
			this.culmMesh.setMatrixAt(i, ZERO_MATRIX);
			this.foliageMesh.setMatrixAt(i, ZERO_MATRIX);
		}
		this.culmMesh.count = 0;
		this.foliageMesh.count = 0;
		this.culmMesh.instanceMatrix.needsUpdate = true;
		this.foliageMesh.instanceMatrix.needsUpdate = true;
		this.dirty = false;
	}

	// Rewrite matrices/colors for all live culms. Called from the render loop
	// only when the simulation has stepped (wind itself is GPU-side).
	commit() {
		if (!this.dirty) return;
		this.dirty = false;

		this.culms.forEach((record) => {
			const vol = record.entity.volume;
			const i = record.index;
			const height = Math.max(vol.hwd[0], 0.001);
			const radius = Math.max(vol.hwd[1], 0.008);

			_euler.set(vol.ypr[1], vol.ypr[0], vol.ypr[2], 'YXZ');
			_quaternion.setFromEuler(_euler);
			_position.set(vol.xyz[0], vol.xyz[1], vol.xyz[2]);
			_scale.set(radius, height, radius);
			_matrix.compose(_position, _quaternion, _scale);
			this.culmMesh.setMatrixAt(i, _matrix);
			this.culmMesh.setColorAt(i, _color.setHex(vol.color || 0x7a8f4a));

			// crown: appears once the culm is tall enough, rides the culm top
			if (height > FOLIAGE_MIN_HEIGHT) {
				const crownScale = Math.min(0.55 + height * 0.1, 2.9);
				_crownOffset.set(0, height * CROWN_HEIGHT_FRACTION, 0).applyQuaternion(_quaternion);
				_position.set(
					vol.xyz[0] + _crownOffset.x,
					vol.xyz[1] + _crownOffset.y,
					vol.xyz[2] + _crownOffset.z
				);
				_scale.setScalar(crownScale);
				_matrix.compose(_position, _quaternion, _scale);
				this.foliageMesh.setMatrixAt(i, _matrix);
				// leaves: culm color pulled strongly toward a bright leaf green
				// (the texture carries most of the darkness already), with a
				// deterministic per-crown hue/lightness wobble so the canopy
				// doesn't read as one flat green
				_color.setHex(vol.color || 0x7a8f4a).lerp(_leafGreen, 0.75);
				const w = Math.sin(i * 78.233) * 43758.5453;
				const wobble = w - Math.floor(w);
				_color.offsetHSL((wobble - 0.5) * 0.045, (wobble - 0.5) * 0.12, (wobble - 0.5) * 0.10);
				this.foliageMesh.setColorAt(i, _color);
				this.amps[i] = 0.013 * height;
			} else {
				this.foliageMesh.setMatrixAt(i, ZERO_MATRIX);
				this.amps[i] = 0;
			}
		});

		this.culmMesh.count = this.highWater;
		this.foliageMesh.count = this.highWater;
		this.culmMesh.instanceMatrix.needsUpdate = true;
		this.foliageMesh.instanceMatrix.needsUpdate = true;
		if (this.culmMesh.instanceColor) this.culmMesh.instanceColor.needsUpdate = true;
		if (this.foliageMesh.instanceColor) this.foliageMesh.instanceColor.needsUpdate = true;
		this.culmGeometry.attributes.aPhase.needsUpdate = true;
		this.crownGeometry.attributes.aAmp.needsUpdate = true;
	}

	setTime(seconds) {
		this.uniforms.uTime.value = seconds;
	}

	dispose() {
		this.scene.remove(this.culmMesh);
		this.scene.remove(this.foliageMesh);
		this.culmMesh.dispose();
		this.foliageMesh.dispose();
		this.culmGeometry.dispose();
		this.crownGeometry.dispose();
		this.leafTexture.dispose();
	}
}

const _leafGreen = new THREE.Color(0x9cbd60);
