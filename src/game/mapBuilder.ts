import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { ArenaMapSpec, MapBox, MapRamp } from '../shared/maps';
import { MapId } from '../shared/types';
import { assetRegistry } from './assets';

export type PbrSetKey = 'foundry_floor' | 'metal_panel' | 'canyon_sand' | 'arctic_ice';

export interface PbrTextureSet {
  diff: THREE.Texture;
  nor: THREE.Texture;
  rough: THREE.Texture;
}

export interface BuiltArenaScene {
  root: THREE.Group;
  crateMeshes: Map<string, THREE.Object3D>;
  jumpPadRings: THREE.Mesh[];
  radarDishes: THREE.Object3D[];
  ambientMotes: THREE.Points | null;
  cloudLayer: THREE.Object3D | null;
  skyMesh: Sky | null;
  relicGroup: THREE.Object3D | null;
  collidableMeshes: THREE.Object3D[];
  /** Lightweight analytical colliders + GLB proxy boxes used for fast bullet/pellet raycasting */
  raycastColliders: THREE.Object3D[];
  dispose: () => void;
}

interface SkyBiomeConfig {
  elevationDeg: number;
  azimuthDeg: number;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  cloudCoverage: number;
  cloudDensity: number;
  cloudElevation: number;
}

const SKY_BIOME_PRESETS: Record<MapId, SkyBiomeConfig> = {
  'obsidian-foundry': {
    elevationDeg: 18,
    azimuthDeg: 145,
    turbidity: 6.5,
    rayleigh: 2.3,
    mieCoefficient: 0.0022,
    mieDirectionalG: 0.72,
    cloudCoverage: 0.42,
    cloudDensity: 0.48,
    cloudElevation: 0.52,
  },
  'helios-outpost': {
    elevationDeg: 30,
    azimuthDeg: 155,
    turbidity: 4.8,
    rayleigh: 1.8,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.7,
    cloudCoverage: 0.25,
    cloudDensity: 0.3,
    cloudElevation: 0.65,
  },
  'borealis-citadel': {
    elevationDeg: 22,
    azimuthDeg: 130,
    turbidity: 2.4,
    rayleigh: 1.5,
    mieCoefficient: 0.0018,
    mieDirectionalG: 0.72,
    cloudCoverage: 0.35,
    cloudDensity: 0.35,
    cloudElevation: 0.58,
  },
  'estate-garden': {
    elevationDeg: 32,
    azimuthDeg: 140,
    turbidity: 3.0,
    rayleigh: 1.65,
    mieCoefficient: 0.0018,
    mieDirectionalG: 0.68,
    cloudCoverage: 0.38,
    cloudDensity: 0.32,
    cloudElevation: 0.62,
  },
  'safehouse-manor': {
    elevationDeg: 14,
    azimuthDeg: 165,
    turbidity: 5.8,
    rayleigh: 2.5,
    mieCoefficient: 0.0024,
    mieDirectionalG: 0.72,
    cloudCoverage: 0.44,
    cloudDensity: 0.42,
    cloudElevation: 0.5,
  },
  'neon-rooftop': {
    elevationDeg: 2.2,
    azimuthDeg: 175,
    turbidity: 8.5,
    rayleigh: 3.1,
    mieCoefficient: 0.0035,
    mieDirectionalG: 0.76,
    cloudCoverage: 0.32,
    cloudDensity: 0.55,
    cloudElevation: 0.45,
  },
  'oasis-temple': {
    elevationDeg: 28,
    azimuthDeg: 160,
    turbidity: 4.8,
    rayleigh: 1.85,
    mieCoefficient: 0.0022,
    mieDirectionalG: 0.7,
    cloudCoverage: 0.2,
    cloudDensity: 0.25,
    cloudElevation: 0.7,
  },
  'cyber-harbor': {
    elevationDeg: 24,
    azimuthDeg: 135,
    turbidity: 3.6,
    rayleigh: 1.75,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.7,
    cloudCoverage: 0.45,
    cloudDensity: 0.38,
    cloudElevation: 0.6,
  },
  'zen-pagoda': {
    elevationDeg: 16,
    azimuthDeg: 150,
    turbidity: 5.2,
    rayleigh: 2.3,
    mieCoefficient: 0.0022,
    mieDirectionalG: 0.72,
    cloudCoverage: 0.36,
    cloudDensity: 0.34,
    cloudElevation: 0.56,
  },
};

const pbrTextureCache = new Map<PbrSetKey, PbrTextureSet>();
let pbrPreloadPromise: Promise<void> | null = null;
const textureLoader = new THREE.TextureLoader();

function loadSinglePbrTexture(
  url: string,
  colorSpace: THREE.ColorSpace,
  maxAniso: number,
): Promise<THREE.Texture> {
  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = colorSpace;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = Math.min(8, maxAniso);
        tex.needsUpdate = true;
        resolve(tex);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

/**
 * Preloads all 1K PBR texture sets (diff, nor, rough) from /public/textures/ into cache.
 */
export function preloadPbrTextures(renderer: THREE.WebGLRenderer): Promise<void> {
  if (pbrPreloadPromise) return pbrPreloadPromise;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const keys: PbrSetKey[] = ['foundry_floor', 'metal_panel', 'canyon_sand', 'arctic_ice'];

  pbrPreloadPromise = Promise.all(
    keys.map(async (key) => {
      try {
        const [diff, nor, rough] = await Promise.all([
          loadSinglePbrTexture(`/textures/${key}/diff.jpg`, THREE.SRGBColorSpace, maxAniso),
          loadSinglePbrTexture(`/textures/${key}/nor.jpg`, THREE.NoColorSpace, maxAniso),
          loadSinglePbrTexture(`/textures/${key}/rough.jpg`, THREE.NoColorSpace, maxAniso),
        ]);
        pbrTextureCache.set(key, { diff, nor, rough });
      } catch {
        // Fallback procedural materials remain active if offline/unavailable
      }
    }),
  ).then(() => undefined);

  return pbrPreloadPromise;
}

export function getCachedPbrSet(key: PbrSetKey): PbrTextureSet | null {
  return pbrTextureCache.get(key) ?? null;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Scales UVs of a PlaneGeometry in world meters so shared PBR textures tile crisply without stretching.
 */
function scalePlaneUVs(geo: THREE.BufferGeometry, width: number, depth: number, tileSize: number): void {
  const uv = geo.attributes.uv;
  if (!uv) return;
  const su = width / tileSize;
  const sv = depth / tileSize;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  }
  uv.needsUpdate = true;
}

/**
 * Scales non-indexed RoundedBoxGeometry face UVs by real world dimensions (w, h, d) / tileSize
 * so bricks, metal panels, ice, and sandstone tile consistently on every face.
 */
function scaleRoundedBoxUVs(
  geo: THREE.BufferGeometry,
  width: number,
  height: number,
  depth: number,
  tileSize: number,
): void {
  const uv = geo.attributes.uv;
  if (!uv) return;
  const vertsPerFace = Math.floor(uv.count / 6);
  if (vertsPerFace <= 0) return;

  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / vertsPerFace);
    let uScale = width / tileSize;
    let vScale = height / tileSize;
    if (face === 0 || face === 1) {
      // +X / -X faces
      uScale = depth / tileSize;
      vScale = height / tileSize;
    } else if (face === 2 || face === 3) {
      // +Y / -Y faces
      uScale = width / tileSize;
      vScale = depth / tileSize;
    }
    uv.setXY(i, uv.getX(i) * uScale, uv.getY(i) * vScale);
  }
  uv.needsUpdate = true;
}

function createBeveledBoxGeometry(
  w: number,
  h: number,
  d: number,
  radius = 0.09,
  tileSize = 3.2,
): RoundedBoxGeometry {
  const safeRadius = Math.min(w * 0.22, h * 0.22, d * 0.22, radius);
  const geo = new RoundedBoxGeometry(w, h, d, 2, safeRadius);
  scaleRoundedBoxUVs(geo, w, h, d, tileSize);
  return geo;
}

function createStylizedBiomeFloorColor(
  map: ArenaMapSpec,
  renderer: THREE.WebGLRenderer,
): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;

  const palette =
    map.id === 'estate-garden'
      ? { base: '#2e4a12', alt: '#3b5d17', seam: '#4d7c0f' }
      : map.id === 'safehouse-manor'
        ? { base: '#5c2c0e', alt: '#6e3613', seam: '#361705' }
        : map.id === 'zen-pagoda'
          ? { base: '#6b7585', alt: '#5b6575', seam: '#414a59' }
          : { base: '#2c323d', alt: '#252b35', seam: '#191d24' };

  ctx.fillStyle = palette.base;
  ctx.fillRect(0, 0, size, size);

  if (map.id === 'safehouse-manor') {
    // Timber plank slats
    ctx.fillStyle = palette.alt;
    for (let y = 0; y < size; y += 32) {
      if ((y / 32) % 2 === 0) ctx.fillRect(0, y, size, 32);
    }
    ctx.strokeStyle = palette.seam;
    ctx.lineWidth = 3;
    for (let y = 0; y <= size; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
  } else if (map.id === 'zen-pagoda') {
    // Raked Zen courtyard sand/stone waves + stone flag borders
    ctx.fillStyle = palette.alt;
    for (let y = 0; y < size; y += 16) {
      ctx.fillRect(0, y, size, 6);
    }
    ctx.strokeStyle = palette.seam;
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  } else {
    ctx.fillStyle = palette.alt;
    ctx.fillRect(0, 0, size / 2, size / 2);
    ctx.fillRect(size / 2, size / 2, size / 2, size / 2);
    ctx.strokeStyle = palette.seam;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function createContactAoTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.14, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.56)');
  grad.addColorStop(0.62, 'rgba(0, 0, 0, 0.2)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftParticleTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
  grad.addColorStop(0.45, 'rgba(255, 255, 255, 0.55)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function computeSunDirection(cfg: SkyBiomeConfig): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - cfg.elevationDeg);
  const theta = THREE.MathUtils.degToRad(cfg.azimuthDeg);
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta).normalize();
}

function createConfiguredSky(mapId: MapId, showSunDisc: boolean): { sky: Sky; sunDir: THREE.Vector3 } {
  const cfg = SKY_BIOME_PRESETS[mapId] ?? SKY_BIOME_PRESETS['obsidian-foundry'];
  const sunDir = computeSunDirection(cfg);
  const sky = new Sky();
  sky.scale.setScalar(320);
  const u = sky.material.uniforms;
  u['turbidity'].value = cfg.turbidity;
  u['rayleigh'].value = cfg.rayleigh;
  u['mieCoefficient'].value = cfg.mieCoefficient;
  u['mieDirectionalG'].value = cfg.mieDirectionalG;
  u['sunPosition'].value.copy(sunDir).multiplyScalar(400000);
  u['cloudCoverage'].value = cfg.cloudCoverage;
  u['cloudDensity'].value = cfg.cloudDensity;
  u['cloudElevation'].value = cfg.cloudElevation;
  u['showSunDisc'].value = 0;
  return { sky, sunDir };
}

/**
 * Generates faceted low-poly terrain surrounding the combat arena with vertex-colored elevation bands
 * (valley floor -> mid slope -> sunlit crest) so natural ridges catch directional sun & sky fill.
 */
function createLowPolyOuterTerrain(map: ArenaMapSpec): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(460, 460, 56, 56);
  geo.rotateX(-Math.PI / 2);

  const nonIndexed = geo.toNonIndexed();
  geo.dispose();

  const pos = nonIndexed.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const randSeed =
    map.id === 'helios-outpost'
      ? 37
      : map.id === 'borealis-citadel'
        ? 73
        : map.id === 'estate-garden'
          ? 59
          : map.id === 'safehouse-manor'
            ? 89
            : map.id === 'cyber-harbor'
              ? 107
              : map.id === 'zen-pagoda'
                ? 131
                : 19;

  const palettes: Record<MapId, [string, string, string]> = {
    'obsidian-foundry': ['#222731', '#343c4a', '#4c5566'],
    'helios-outpost': ['#9b5c34', '#b87042', '#d69767'],
    'borealis-citadel': ['#5b728f', '#89a3bf', '#dce8f5'],
    'estate-garden': ['#2d5016', '#4d7c0f', '#a3e635'],
    'safehouse-manor': ['#292524', '#57534e', '#ea580c'],
    'neon-rooftop': ['#020617', '#0f172a', '#06b6d4'],
    'oasis-temple': ['#b45309', '#d97706', '#fde68a'],
    'cyber-harbor': ['#0c2d48', '#144266', '#38bdf8'],
    'zen-pagoda': ['#3f2720', '#7c2d12', '#fb923c'],
  };
  const [lowHex, midHex, peakHex] = palettes[map.id] ?? palettes['obsidian-foundry'];
  const lowCol = new THREE.Color(lowHex);
  const midCol = new THREE.Color(midHex);
  const peakCol = new THREE.Color(peakHex);
  const cTmp = new THREE.Color();

  const heightAt = (x: number, z: number) => {
    const edgeDist = Math.max(Math.abs(x), Math.abs(z)) - (map.halfExtent + 3.5);
    if (edgeDist <= 0) return -0.04;
    if (map.id === 'cyber-harbor') {
      // Water basin right outside dock, distant breakwaters further out
      if (edgeDist < 28) return -1.8;
      const farDist = edgeDist - 28;
      const wave = Math.sin(x * 0.04 + randSeed) * Math.cos(z * 0.04) * 3.5;
      return -1.2 + Math.min(1, farDist / 24) * Math.max(0, farDist * 0.1 + wave + 2.5);
    }
    const blend = Math.min(1, edgeDist / 26);
    const wave =
      Math.sin(x * 0.055 + randSeed) * Math.cos(z * 0.05 + randSeed * 0.5) * 6.5 +
      Math.sin((x + z) * 0.032) * 5.2 +
      Math.cos((x - z) * 0.09) * 2.1;
    const ridge = Math.max(0, edgeDist * 0.14 + wave + 3.2);
    return -0.04 + blend * ridge;
  };

  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vz = pos.getZ(i);
    const vy = heightAt(vx, vz);
    pos.setY(i, vy);

    const hNorm = Math.max(0, Math.min(1, (vy + 1.5) / 24));
    if (hNorm < 0.45) {
      cTmp.copy(lowCol).lerp(midCol, hNorm / 0.45);
    } else {
      cTmp.copy(midCol).lerp(peakCol, (hNorm - 0.45) / 0.55);
    }
    colors[i * 3] = cTmp.r;
    colors[i * 3 + 1] = cTmp.g;
    colors[i * 3 + 2] = cTmp.b;
  }

  nonIndexed.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  nonIndexed.computeVertexNormals();
  return nonIndexed;
}

function createDisplacedCliffGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.attributes.position;
  const rand = seededRand(seed);
  const phaseA = rand() * 6.28;
  const phaseB = rand() * 6.28;

  for (let i = 0; i < pos.count; i++) {
    let vx = pos.getX(i);
    let vy = pos.getY(i);
    let vz = pos.getZ(i);
    if (vy < -0.25) vy = -0.3;
    const n =
      Math.sin(vx * 3.1 + phaseA) * Math.cos(vz * 2.9 + phaseB) * 0.24 +
      Math.sin((vx + vy) * 5.2 + phaseB) * 0.11;
    const scaleXZ = 1.0 + n - Math.max(0, vy) * 0.28;
    vx *= scaleXZ;
    vz *= scaleXZ;
    vy = vy * 1.18 + Math.abs(n) * 0.35;
    pos.setXYZ(i, vx, vy, vz);
  }
  geo.computeVertexNormals();
  return geo;
}

function createRampMesh(ramp: MapRamp, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  const rise = ramp.yHigh - ramp.yLow;
  const run = ramp.riseDir === '+x' || ramp.riseDir === '-x' ? ramp.w : ramp.d;
  const depth = ramp.riseDir === '+x' || ramp.riseDir === '-x' ? ramp.d : ramp.w;

  shape.moveTo(-run * 0.5, 0);
  shape.lineTo(run * 0.5, 0);
  shape.lineTo(run * 0.5, rise);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
  });
  geo.translate(0, 0, -depth * 0.5);

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(ramp.x, ramp.yLow, ramp.z);
  if (ramp.riseDir === '-x') mesh.rotation.y = Math.PI;
  else if (ramp.riseDir === '+z') mesh.rotation.y = -Math.PI / 2;
  else if (ramp.riseDir === '-z') mesh.rotation.y = Math.PI / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Generates a physically-aligned PMREM environment cubemap from Sky.js + ground hemisphere
 * so beveled low-poly surfaces and metallic weapons reflect authentic horizon & sky gradients.
 */
export function setupSceneEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  map?: ArenaMapSpec,
): () => void {
  const envScene = new THREE.Scene();
  const mapId: MapId = map?.id ?? 'obsidian-foundry';

  const { sky } = createConfiguredSky(mapId, false);
  envScene.add(sky);

  // Warm/cool ground bounce cap below horizon so undersides don't turn pitch-black in reflections
  const groundGeo = new THREE.SphereGeometry(200, 16, 8, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const groundMat = new THREE.MeshBasicMaterial({
    color: map?.hemiGroundColor ?? '#3b2e26',
    side: THREE.BackSide,
  });
  const groundBowl = new THREE.Mesh(groundGeo, groundMat);
  envScene.add(groundBowl);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.46;

  pmrem.dispose();
  sky.geometry.dispose();
  sky.material.dispose();
  groundGeo.dispose();
  groundMat.dispose();

  return () => {
    envTex.dispose();
  };
}

interface BatchTransform {
  px: number;
  py: number;
  pz: number;
  sx: number;
  sy: number;
  sz: number;
  ry?: number;
}

interface ArchBatchAccumulator {
  trimBoxes: BatchTransform[];
  darkBoxes: BatchTransform[];
  steelBoxes: BatchTransform[];
  stanchions: BatchTransform[];
  aoPlanes: BatchTransform[];
}

function flushBoxBatch(
  transforms: BatchTransform[],
  mat: THREE.Material,
  root: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  castShadow: boolean,
  receiveShadow: boolean,
): void {
  if (transforms.length === 0) return;
  const geo = createBeveledBoxGeometry(1, 1, 1, 0.06, 2.0);
  const inst = new THREE.InstancedMesh(geo, mat, transforms.length);
  inst.castShadow = castShadow;
  inst.receiveShadow = receiveShadow;
  const dummy = new THREE.Object3D();
  for (let i = 0; i < transforms.length; i++) {
    const t = transforms[i];
    dummy.position.set(t.px, t.py, t.pz);
    dummy.rotation.set(0, t.ry ?? 0, 0);
    dummy.scale.set(t.sx, t.sy, t.sz);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  }
  inst.computeBoundingSphere();
  root.add(inst);
  disposables.push(geo);
}

function addArchitecturalDetail(
  b: MapBox,
  root: THREE.Group,
  radarDishes: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
  batches: ArchBatchAccumulator,
  steelMat: THREE.Material,
  trimMat: THREE.Material,
  containerMat: THREE.Material,
  darkMat: THREE.Material,
  accentColor: string,
): void {
  if (b.y <= 0.05) {
    batches.aoPlanes.push({ px: b.x, py: 0.014, pz: b.z, sx: b.w + 2.8, sy: 1, sz: b.d + 2.8 });
  }

  if (b.kind === 'core' || b.kind === 'tower') {
    const plinthRadius = Math.max(b.w, b.d) * 0.72;
    const plinthGeo = new THREE.CylinderGeometry(plinthRadius * 0.92, plinthRadius, 0.44, 8);
    const plinth = new THREE.Mesh(plinthGeo, darkMat);
    plinth.position.set(b.x, b.y + 0.22, b.z);
    plinth.rotation.y = Math.PI / 8;
    plinth.receiveShadow = true;
    root.add(plinth);
    disposables.push(plinthGeo);
  }

  if (b.kind === 'core') {
    batches.trimBoxes.push({ px: b.x, py: b.y + b.h - 0.16, pz: b.z, sx: b.w + 0.22, sy: 0.18, sz: b.d + 0.22 });

    const corners: Array<[number, number]> = [
      [-b.w * 0.5, -b.d * 0.5],
      [b.w * 0.5, -b.d * 0.5],
      [-b.w * 0.5, b.d * 0.5],
      [b.w * 0.5, b.d * 0.5],
    ];
    for (const [ox, oz] of corners) {
      batches.stanchions.push({ px: b.x + ox, py: b.y + b.h * 0.5, pz: b.z + oz, sx: 0.34, sy: b.h, sz: 0.34 });
    }

    const beacon = new THREE.PointLight(accentColor, 2.4, 22, 1.6);
    beacon.position.set(b.x, b.y + b.h + 1.6, b.z);
    root.add(beacon);

    if (b.id === 'fountain-base' || b.id === 'sunken-pool-curb') {
      const waterGeo =
        b.id === 'fountain-base'
          ? new THREE.CylinderGeometry(b.w * 0.44, b.w * 0.44, 0.08, 16)
          : new THREE.PlaneGeometry(b.w * 0.9, b.d * 0.85);
      if (b.id !== 'fountain-base') waterGeo.rotateX(-Math.PI / 2);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.1,
        metalness: 0.58,
        flatShading: true,
      });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(b.x, b.y + b.h + 0.02, b.z);
      root.add(waterMesh);
      disposables.push(waterGeo, waterMat);
    }
  } else if (b.kind === 'bridge') {
    batches.steelBoxes.push({ px: b.x, py: b.y + b.h - 0.08, pz: b.z, sx: b.w + 0.3, sy: 0.22, sz: b.d + 0.3 });
    batches.trimBoxes.push({ px: b.x, py: b.y + b.h - 0.23, pz: b.z, sx: b.w + 0.34, sy: 0.08, sz: b.d + 0.34 });

    if (b.id === 'gazebo-platform') {
      const colGeo = new THREE.CylinderGeometry(0.24, 0.32, 4.4, 6);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const col = new THREE.Mesh(colGeo, steelMat);
        col.position.set(b.x + Math.cos(a) * 5.8, b.y + b.h + 2.2, b.z + Math.sin(a) * 5.8);
        col.castShadow = true;
        root.add(col);
      }
      const roofGeo = new THREE.ConeGeometry(b.w * 0.58, 3.4, 8);
      const roofMat = new THREE.MeshStandardMaterial({
        color: 0x0f766e,
        roughness: 0.62,
        metalness: 0.24,
        flatShading: true,
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(b.x, b.y + b.h + 4.4 + 1.7, b.z);
      roof.castShadow = true;
      root.add(roof);
      disposables.push(colGeo, roofGeo, roofMat);
    } else {
      const corners: Array<[number, number]> = [
        [-b.w * 0.5 + 0.22, -b.d * 0.5 + 0.22],
        [b.w * 0.5 - 0.22, -b.d * 0.5 + 0.22],
        [-b.w * 0.5 + 0.22, b.d * 0.5 - 0.22],
        [b.w * 0.5 - 0.22, b.d * 0.5 - 0.22],
      ];
      for (const [ox, oz] of corners) {
        batches.stanchions.push({ px: b.x + ox, py: b.y + (b.h + 0.9) * 0.5, pz: b.z + oz, sx: 0.22, sy: b.h + 0.9, sz: 0.22 });
      }
    }
  } else if (b.kind === 'tower') {
    if (b.id === 'chimney-stack') {
      const hearth = new THREE.PointLight(0xf97316, 2.4, 15, 1.5);
      hearth.position.set(b.x, b.y + 1.6, b.z + 2.4);
      root.add(hearth);
    }
    batches.darkBoxes.push({ px: b.x, py: b.y + b.h * 0.52, pz: b.z, sx: b.w + 0.18, sy: 0.28, sz: b.d + 0.18 });
    batches.trimBoxes.push({ px: b.x, py: b.y + b.h - 0.3, pz: b.z, sx: (b.w + 0.18) * 1.03, sy: 0.14, sz: (b.d + 0.18) * 1.03 });

    const roofGeo = new THREE.ConeGeometry(Math.max(b.w, b.d) * 0.72, 1.35, 4);
    const roof = new THREE.Mesh(roofGeo, steelMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(b.x, b.y + b.h + 0.67, b.z);
    roof.castShadow = true;

    const mastGeo = new THREE.CylinderGeometry(0.07, 0.13, 2.1, 6);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(b.x, b.y + b.h + 1.9, b.z);

    const dishPivot = new THREE.Group();
    dishPivot.position.set(b.x, b.y + b.h + 2.85, b.z);
    const dishBarGeo = new THREE.BoxGeometry(1.55, 0.24, 0.14);
    const dishBar = new THREE.Mesh(dishBarGeo, steelMat);
    const dishTipGeo = new THREE.OctahedronGeometry(0.18, 0);
    const dishTip = new THREE.Mesh(dishTipGeo, trimMat);
    dishTip.position.y = 0.26;
    dishPivot.add(dishBar, dishTip);
    radarDishes.push(dishPivot);

    root.add(roof, mast, dishPivot);
    disposables.push(roofGeo, mastGeo, dishBarGeo, dishTipGeo);
  } else if (b.kind === 'cover') {
    const shellGeo = createBeveledBoxGeometry(b.w + 0.06, b.h - 0.22, b.d + 0.06, 0.08, 2.6);
    const shell = new THREE.Mesh(shellGeo, containerMat);
    shell.position.set(b.x, b.y + b.h * 0.5, b.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    root.add(shell);
    disposables.push(shellGeo);

    batches.darkBoxes.push({ px: b.x, py: b.y + b.h - 0.06, pz: b.z, sx: b.w + 0.16, sy: 0.18, sz: b.d + 0.16 });
    batches.trimBoxes.push({ px: b.x, py: b.y + 0.34, pz: b.z, sx: b.w + 0.1, sy: 0.08, sz: b.d + 0.1 });
  }
}

function addBiomeLowPolyScenery(
  map: ArenaMapSpec,
  root: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  accentColor: string,
): void {
  const rand = seededRand(map.id.length * 409 + 17);
  const dummy = new THREE.Object3D();

  if (map.id === 'borealis-citadel') {
    const count = 34;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9, flatShading: true });
    const foliageGeo = new THREE.ConeGeometry(2.1, 4.6, 6);
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x1e4d45, roughness: 0.84, flatShading: true });
    const snowCapGeo = new THREE.ConeGeometry(1.45, 2.2, 6);
    const snowMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55, flatShading: true });

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const leaves = new THREE.InstancedMesh(foliageGeo, foliageMat, count);
    const snows = new THREE.InstancedMesh(snowCapGeo, snowMat, count);
    const tint = new THREE.Color();

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const dist = map.halfExtent + 9 + rand() * 24;
      const px = Math.cos(angle) * dist;
      const pz = Math.sin(angle) * dist;
      const s = 0.85 + rand() * 0.7;

      dummy.position.set(px, 1.2 * s, pz);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(px, 4.1 * s, pz);
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
      tint.setHex(0x1f554c).offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.08);
      leaves.setColorAt(i, tint);

      dummy.position.set(px, 5.7 * s, pz);
      dummy.updateMatrix();
      snows.setMatrixAt(i, dummy.matrix);
    }
    trunks.computeBoundingSphere();
    leaves.computeBoundingSphere();
    snows.computeBoundingSphere();
    root.add(trunks, leaves, snows);
    disposables.push(trunkGeo, trunkMat, foliageGeo, foliageMat, snowCapGeo, snowMat);
  } else if (map.id === 'helios-outpost') {
    const count = 28;
    const mesaGeo = new THREE.CylinderGeometry(1.8, 3.6, 7.5, 6);
    const mesaMat = new THREE.MeshStandardMaterial({ color: 0xb9683a, roughness: 0.9, flatShading: true });
    const mesas = new THREE.InstancedMesh(mesaGeo, mesaMat, count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.18;
      const dist = map.halfExtent + 10 + rand() * 26;
      const sx = 0.9 + rand() * 1.4;
      const sy = 0.7 + rand() * 1.8;
      dummy.position.set(Math.cos(angle) * dist, 3.2 * sy, Math.sin(angle) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(sx, sy, sx * (0.8 + rand() * 0.4));
      dummy.updateMatrix();
      mesas.setMatrixAt(i, dummy.matrix);
      tint.setHex(0xb9683a).offsetHSL(0, 0, (rand() - 0.5) * 0.12);
      mesas.setColorAt(i, tint);
    }
    mesas.computeBoundingSphere();
    root.add(mesas);
    disposables.push(mesaGeo, mesaMat);
  } else if (map.id === 'estate-garden') {
    const treeCount = 30;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, flatShading: true });
    const cypressGeo = new THREE.ConeGeometry(1.35, 6.2, 6);
    const cypressMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.82, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const foliage = new THREE.InstancedMesh(cypressGeo, cypressMat, treeCount);
    const tint = new THREE.Color();
    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + (rand() - 0.5) * 0.16;
      const dist = map.halfExtent + 8 + rand() * 22;
      const s = 0.85 + rand() * 0.65;
      dummy.position.set(Math.cos(angle) * dist, 1.1 * s, Math.sin(angle) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * dist, 4.2 * s, Math.sin(angle) * dist);
      dummy.updateMatrix();
      foliage.setMatrixAt(i, dummy.matrix);
      tint.setHex(0x14532d).offsetHSL((rand() - 0.5) * 0.05, 0, (rand() - 0.5) * 0.08);
      foliage.setColorAt(i, tint);
    }
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
    root.add(trunks, foliage);
    disposables.push(trunkGeo, trunkMat, cypressGeo, cypressMat);

    const bushCount = 36;
    const bushGeo = new THREE.DodecahedronGeometry(0.95, 0);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true });
    const bushes = new THREE.InstancedMesh(bushGeo, bushMat, bushCount);
    const bushColors = [0xdb2777, 0xf43f5e, 0xf59e0b, 0x10b981, 0x38bdf8, 0xf8fafc];
    for (let i = 0; i < bushCount; i++) {
      const angle = (i / bushCount) * Math.PI * 2;
      const dist = map.halfExtent + 4 + rand() * 12;
      const bs = 0.75 + rand() * 0.65;
      dummy.position.set(Math.cos(angle) * dist, 0.75 * bs, Math.sin(angle) * dist);
      dummy.rotation.set(rand() * Math.PI, rand() * Math.PI, 0);
      dummy.scale.set(bs * (0.9 + rand() * 0.3), bs, bs * (0.9 + rand() * 0.3));
      dummy.updateMatrix();
      bushes.setMatrixAt(i, dummy.matrix);
      bushes.setColorAt(i, tint.setHex(bushColors[i % bushColors.length]));
    }
    bushes.computeBoundingSphere();
    root.add(bushes);
    disposables.push(bushGeo, bushMat);
  } else if (map.id === 'safehouse-manor') {
    const count = 32;
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.9, flatShading: true });
    const spruceGeo = new THREE.ConeGeometry(2.3, 4.4, 6);
    const spruceMat = new THREE.MeshStandardMaterial({ color: 0x1e3a2f, roughness: 0.85, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const spruces = new THREE.InstancedMesh(spruceGeo, spruceMat, count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.15;
      const dist = map.halfExtent + 8 + rand() * 24;
      const s = 0.9 + rand() * 0.7;
      dummy.position.set(Math.cos(angle) * dist, 1.2 * s, Math.sin(angle) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * dist, 3.8 * s, Math.sin(angle) * dist);
      dummy.updateMatrix();
      spruces.setMatrixAt(i, dummy.matrix);
      tint.setHex(0x1e3a2f).offsetHSL(0, 0, (rand() - 0.5) * 0.1);
      spruces.setColorAt(i, tint);
    }
    trunks.computeBoundingSphere();
    spruces.computeBoundingSphere();
    root.add(trunks, spruces);
    disposables.push(trunkGeo, trunkMat, spruceGeo, spruceMat);

    const cabinCount = 10;
    const cabinGeo = createBeveledBoxGeometry(4.2, 2.8, 5.2, 0.15, 2.5);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8, flatShading: true });
    const cabins = new THREE.InstancedMesh(cabinGeo, cabinMat, cabinCount);
    for (let i = 0; i < cabinCount; i++) {
      const angle = (i / cabinCount) * Math.PI * 2 + 0.3;
      const dist = map.halfExtent + 28 + (i % 3) * 12;
      dummy.position.set(Math.cos(angle) * dist, 3.5 + (i % 4) * 2, Math.sin(angle) * dist);
      dummy.rotation.set(0, angle + Math.PI / 2, 0);
      dummy.scale.setScalar(1.2 + rand() * 0.5);
      dummy.updateMatrix();
      cabins.setMatrixAt(i, dummy.matrix);
    }
    cabins.computeBoundingSphere();
    root.add(cabins);
    disposables.push(cabinGeo, cabinMat);
  } else if (map.id === 'neon-rooftop') {
    const towerCount = 32;
    const towerGeo = createBeveledBoxGeometry(12, 60, 12, 0.35, 6);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.72,
      metalness: 0.45,
      flatShading: true,
    });
    const antennaGeo = new THREE.CylinderGeometry(0.15, 0.3, 14, 4);
    const antennaMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x06b6d4,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0.5,
      flatShading: true,
    });
    const towers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    const antennas = new THREE.InstancedMesh(antennaGeo, antennaMat, towerCount);
    const tint = new THREE.Color();
    for (let i = 0; i < towerCount; i++) {
      const angle = (i / towerCount) * Math.PI * 2 + (rand() - 0.5) * 0.12;
      const dist = map.halfExtent + 18 + (i % 4) * 16;
      const sy = 0.55 + rand() * 1.1;
      const h = 60 * sy;
      dummy.position.set(Math.cos(angle) * dist, h * 0.5 - 28, Math.sin(angle) * dist);
      dummy.rotation.set(0, i * 0.45, 0);
      dummy.scale.set(1.1 + rand() * 0.7, sy, 1.1 + rand() * 0.7);
      dummy.updateMatrix();
      towers.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * dist, h - 28 + 7, Math.sin(angle) * dist);
      dummy.updateMatrix();
      antennas.setMatrixAt(i, dummy.matrix);

      tint.setHex(0x0f172a).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
      towers.setColorAt(i, tint);
    }
    towers.computeBoundingSphere();
    antennas.computeBoundingSphere();
    root.add(towers, antennas);
    disposables.push(towerGeo, towerMat, antennaGeo, antennaMat);
  } else if (map.id === 'oasis-temple') {
    const count = 28;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.44, 7.0, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9, flatShading: true });
    const canopyGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75, flatShading: true });
    const palms = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const tint = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (rand() - 0.5) * 0.15;
      const dist = map.halfExtent + 8 + rand() * 24;
      const s = 0.85 + rand() * 0.6;
      dummy.position.set(Math.cos(angle) * dist, 3.5 * s, Math.sin(angle) * dist);
      dummy.rotation.set((rand() - 0.5) * 0.16, rand() * Math.PI, (rand() - 0.5) * 0.16);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      palms.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(angle) * dist, 7.0 * s, Math.sin(angle) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.set(s * 1.3, s * 0.95, s * 1.3);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);

      tint.setHex(0x15803d).offsetHSL((rand() - 0.5) * 0.06, 0, (rand() - 0.5) * 0.1);
      canopies.setColorAt(i, tint);
    }
    palms.computeBoundingSphere();
    canopies.computeBoundingSphere();
    root.add(palms, canopies);
    disposables.push(trunkGeo, trunkMat, canopyGeo, canopyMat);
  } else if (map.id === 'cyber-harbor') {
    // Deep harbor water ring + off-pier stacked shipping containers & gantry crane booms
    const waterGeo = new THREE.RingGeometry(map.halfExtent + 2.5, map.halfExtent + 45, 24);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.62,
      flatShading: true,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.position.y = -0.55;
    root.add(water);
    disposables.push(waterGeo, waterMat);

    const craneCount = 8;
    const legGeo = createBeveledBoxGeometry(1.4, 22, 1.4, 0.12, 3);
    const beamGeo = createBeveledBoxGeometry(14, 1.8, 2.2, 0.14, 3);
    const craneMat = new THREE.MeshStandardMaterial({
      color: 0xea580c,
      roughness: 0.45,
      metalness: 0.55,
      flatShading: true,
    });
    const craneLegs = new THREE.InstancedMesh(legGeo, craneMat, craneCount);
    const craneBeams = new THREE.InstancedMesh(beamGeo, craneMat, craneCount);
    for (let i = 0; i < craneCount; i++) {
      const a = (i / craneCount) * Math.PI * 2 + 0.4;
      const dist = map.halfExtent + 14 + (i % 2) * 8;
      dummy.position.set(Math.cos(a) * dist, 10, Math.sin(a) * dist);
      dummy.rotation.set(0, a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      craneLegs.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(a) * (dist - 3), 21, Math.sin(a) * (dist - 3));
      dummy.updateMatrix();
      craneBeams.setMatrixAt(i, dummy.matrix);
    }
    craneLegs.computeBoundingSphere();
    craneBeams.computeBoundingSphere();
    root.add(craneLegs, craneBeams);
    disposables.push(legGeo, beamGeo, craneMat);
  } else if (map.id === 'zen-pagoda') {
    // Autumn Maple & Sakura trees + Crimson Torii Perimeter Pillars
    const treeCount = 32;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.42, 3.0, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3f2316, roughness: 0.9, flatShading: true });
    const crownGeo = new THREE.DodecahedronGeometry(2.2, 0);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, flatShading: true });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCount);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treeCount);
    const tint = new THREE.Color();
    const autumnPalette = [0xf43f5e, 0xea580c, 0xfb7185, 0xd97706];
    for (let i = 0; i < treeCount; i++) {
      const a = (i / treeCount) * Math.PI * 2 + (rand() - 0.5) * 0.14;
      const dist = map.halfExtent + 8 + rand() * 22;
      const s = 0.9 + rand() * 0.65;
      dummy.position.set(Math.cos(a) * dist, 1.4 * s, Math.sin(a) * dist);
      dummy.rotation.set(0, rand() * Math.PI, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.set(Math.cos(a) * dist, 3.8 * s, Math.sin(a) * dist);
      dummy.scale.set(s * 1.15, s * 0.85, s * 1.15);
      dummy.updateMatrix();
      crowns.setMatrixAt(i, dummy.matrix);
      crowns.setColorAt(i, tint.setHex(autumnPalette[i % autumnPalette.length]));
    }
    trunks.computeBoundingSphere();
    crowns.computeBoundingSphere();
    root.add(trunks, crowns);
    disposables.push(trunkGeo, trunkMat, crownGeo, crownMat);

    // 4 Monumental Perimeter Torii Gates at cardinal directions
    const toriiPostGeo = createBeveledBoxGeometry(0.55, 6.2, 0.55, 0.08, 2);
    const toriiBeamGeo = createBeveledBoxGeometry(6.8, 0.65, 0.75, 0.1, 2);
    const toriiMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.45,
      metalness: 0.25,
      flatShading: true,
    });
    const posts = new THREE.InstancedMesh(toriiPostGeo, toriiMat, 8);
    const beams = new THREE.InstancedMesh(toriiBeamGeo, toriiMat, 4);
    const dirs: Array<[number, number, number]> = [
      [0, -(map.halfExtent + 4.5), 0],
      [0, map.halfExtent + 4.5, 0],
      [-(map.halfExtent + 4.5), 0, Math.PI / 2],
      [map.halfExtent + 4.5, 0, Math.PI / 2],
    ];
    for (let i = 0; i < dirs.length; i++) {
      const [tx, tz, rot] = dirs[i];
      const dx = Math.cos(rot) * 2.1;
      const dz = -Math.sin(rot) * 2.1;
      dummy.position.set(tx - dx, 3.1, tz - dz);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      posts.setMatrixAt(i * 2, dummy.matrix);

      dummy.position.set(tx + dx, 3.1, tz + dz);
      dummy.updateMatrix();
      posts.setMatrixAt(i * 2 + 1, dummy.matrix);

      dummy.position.set(tx, 5.9, tz);
      dummy.updateMatrix();
      beams.setMatrixAt(i, dummy.matrix);
    }
    posts.computeBoundingSphere();
    beams.computeBoundingSphere();
    root.add(posts, beams);
    disposables.push(toriiPostGeo, toriiBeamGeo, toriiMat);
  } else {
    const count = 26;
    const shardGeo = new THREE.OctahedronGeometry(1.4, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: accentColor,
      emissive: accentColor,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0.4,
      flatShading: true,
    });
    const shards = new THREE.InstancedMesh(shardGeo, shardMat, count);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = map.halfExtent + 8 + rand() * 18;
      const sy = 1.1 + rand() * 1.9;
      dummy.position.set(Math.cos(angle) * dist, sy * 0.85, Math.sin(angle) * dist);
      dummy.rotation.set((rand() - 0.5) * 0.4, rand() * Math.PI, (rand() - 0.5) * 0.4);
      dummy.scale.set(0.8 + rand() * 0.5, sy, 0.8 + rand() * 0.5);
      dummy.updateMatrix();
      shards.setMatrixAt(i, dummy.matrix);
    }
    shards.computeBoundingSphere();
    root.add(shards);
    disposables.push(shardGeo, shardMat);
  }
}

export function buildArenaMapScene(
  scene: THREE.Scene,
  map: ArenaMapSpec,
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
): BuiltArenaScene {
  const root = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];
  const collidableMeshes: THREE.Object3D[] = [];
  const raycastColliders: THREE.Object3D[] = [];
  const crateMeshes = new Map<string, THREE.Object3D>();
  const jumpPadRings: THREE.Mesh[] = [];
  const radarDishes: THREE.Object3D[] = [];
  let relicGroup: THREE.Object3D | null = null;

  scene.background = new THREE.Color(map.fogColor);
  scene.fog = new THREE.FogExp2(map.fogColor, map.fogDensity);

  // Pillar 4: Atmospheric Sky dome matched to horizon FogExp2 (glare-free)
  const { sky: skyMesh, sunDir } = createConfiguredSky(map.id, false);
  root.add(skyMesh);
  disposables.push(skyMesh.geometry, skyMesh.material);

  const sunPosition = sunDir.clone().multiplyScalar(84);

  // Stylized Low-Poly Floating Sky Clouds (InstancedMesh)
  const cloudCount = 32;
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.96,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 0.65,
  });
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
  const cloudDummy = new THREE.Object3D();
  const cloudRand = seededRand(503);
  for (let i = 0; i < cloudCount; i++) {
    const clusterAngle = (Math.floor(i / 3) / 11) * Math.PI * 2 + (cloudRand() - 0.5) * 0.2;
    const clusterDist = 90 + (i % 4) * 28;
    cloudDummy.position.set(
      Math.cos(clusterAngle) * clusterDist + (cloudRand() - 0.5) * 14,
      56 + cloudRand() * 18,
      Math.sin(clusterAngle) * clusterDist + (cloudRand() - 0.5) * 14,
    );
    const sx = 6 + cloudRand() * 9;
    const sy = 2.4 + cloudRand() * 2.5;
    cloudDummy.scale.set(sx, sy, sx * (0.7 + cloudRand() * 0.4));
    cloudDummy.rotation.set(0, cloudRand() * Math.PI, 0);
    cloudDummy.updateMatrix();
    cloudInst.setMatrixAt(i, cloudDummy.matrix);
  }
  cloudInst.computeBoundingSphere();
  root.add(cloudInst);
  disposables.push(cloudGeo, cloudMat);

  // Pillar 3: Balanced 3-Point Lighting with tightened Shadow Camera Bounds (2048x2048)
  const hemi = new THREE.HemisphereLight(map.hemiSkyColor, map.hemiGroundColor, 0.46);
  root.add(hemi);

  const keyLight = new THREE.DirectionalLight(map.sunColor, Math.min(1.55, map.sunIntensity * 0.56));
  keyLight.position.copy(sunPosition);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  const shadowBounds = map.halfExtent + 4;
  keyLight.shadow.camera.left = -shadowBounds;
  keyLight.shadow.camera.right = shadowBounds;
  keyLight.shadow.camera.top = shadowBounds;
  keyLight.shadow.camera.bottom = -shadowBounds;
  keyLight.shadow.camera.near = 8;
  keyLight.shadow.camera.far = 185;
  keyLight.shadow.bias = -0.0003;
  keyLight.shadow.normalBias = 0.018;
  keyLight.shadow.radius = 2.1;
  root.add(keyLight);

  const rimLight = new THREE.DirectionalLight(map.hemiSkyColor, 0.34);
  rimLight.position.set(-sunPosition.x * 0.8, 28, -sunPosition.z * 0.8);
  root.add(rimLight);

  // Pillar 1: Real 1K PBR Texture Sets from /public/textures/
  const foundryPbr = getCachedPbrSet('foundry_floor');
  const metalPbr = getCachedPbrSet('metal_panel');
  const canyonPbr = getCachedPbrSet('canyon_sand');
  const icePbr = getCachedPbrSet('arctic_ice');

  const floorSize = (map.halfExtent + 3.5) * 2;
  const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
  floorGeo.rotateX(-Math.PI / 2);
  scalePlaneUVs(floorGeo, floorSize, floorSize, 4.2);

  let floorMat: THREE.MeshStandardMaterial;
  let customFloorColorTex: THREE.Texture | null = null;

  if (map.id === 'obsidian-foundry' && foundryPbr) {
    floorMat = new THREE.MeshStandardMaterial({
      map: foundryPbr.diff,
      normalMap: foundryPbr.nor,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: foundryPbr.rough,
      color: 0x6b7485,
      roughness: 0.86,
      metalness: 0.16,
    });
  } else if ((map.id === 'neon-rooftop' || map.id === 'cyber-harbor') && metalPbr) {
    floorMat = new THREE.MeshStandardMaterial({
      map: metalPbr.diff,
      normalMap: metalPbr.nor,
      normalScale: new THREE.Vector2(0.95, 0.95),
      roughnessMap: metalPbr.rough,
      color: map.id === 'neon-rooftop' ? 0x3b4759 : 0x5c6b7e,
      roughness: 0.76,
      metalness: 0.24,
    });
  } else if ((map.id === 'helios-outpost' || map.id === 'oasis-temple') && canyonPbr) {
    floorMat = new THREE.MeshStandardMaterial({
      map: canyonPbr.diff,
      normalMap: canyonPbr.nor,
      normalScale: new THREE.Vector2(1.05, 1.05),
      roughnessMap: canyonPbr.rough,
      color: map.id === 'oasis-temple' ? 0xc29361 : 0xb07c56,
      roughness: 0.92,
      metalness: 0.03,
    });
  } else if (map.id === 'borealis-citadel' && icePbr) {
    floorMat = new THREE.MeshStandardMaterial({
      map: icePbr.diff,
      normalMap: icePbr.nor,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughnessMap: icePbr.rough,
      color: 0x7b98b8,
      roughness: 0.62,
      metalness: 0.12,
    });
  } else {
    customFloorColorTex = createStylizedBiomeFloorColor(map, renderer);
    customFloorColorTex.repeat.set(floorSize / 4.2, floorSize / 4.2);
    const reliefPbr = map.id === 'estate-garden' ? canyonPbr : metalPbr ?? canyonPbr;
    floorMat = new THREE.MeshStandardMaterial({
      map: customFloorColorTex,
      normalMap: reliefPbr?.nor ?? null,
      normalScale: new THREE.Vector2(0.65, 0.65),
      roughnessMap: reliefPbr?.rough ?? null,
      color: 0xe2e8f0,
      roughness: map.id === 'estate-garden' ? 0.9 : 0.8,
      metalness: 0.06,
    });
  }

  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  root.add(floorMesh);
  collidableMeshes.push(floorMesh);
  raycastColliders.push(floorMesh);
  disposables.push(floorGeo, floorMat);
  if (customFloorColorTex) disposables.push(customFloorColorTex);

  // Outer sculpted low-poly basin terrain
  const outerTerrainGeo = createLowPolyOuterTerrain(map);
  const outerTerrainMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
  });
  const outerTerrainMesh = new THREE.Mesh(outerTerrainGeo, outerTerrainMat);
  outerTerrainMesh.receiveShadow = true;
  root.add(outerTerrainMesh);
  disposables.push(outerTerrainGeo, outerTerrainMat);

  // Center tactical arena court ring
  const courtRingGeo = new THREE.RingGeometry(11.65, 12.1, 8);
  courtRingGeo.rotateX(-Math.PI / 2);
  const courtRingMat = new THREE.MeshBasicMaterial({
    color: map.accentColor,
    transparent: true,
    opacity: 0.48,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const courtRing = new THREE.Mesh(courtRingGeo, courtRingMat);
  courtRing.position.y = 0.02;
  courtRing.rotation.y = Math.PI / 8;
  root.add(courtRing);
  disposables.push(courtRingGeo, courtRingMat);

  // Contact AO & ambient particle textures
  const aoTex = createContactAoTexture();
  const moteTex = createSoftParticleTexture();
  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.68,
  });
  disposables.push(aoTex, moteTex, aoMat);

  // Shared PBR architectural materials (Pillar 1 + Pillar 2 crisp rim highlights)
  const structurePbr =
    map.id === 'helios-outpost' || map.id === 'oasis-temple'
      ? canyonPbr
      : map.id === 'borealis-citadel'
        ? icePbr
        : metalPbr ?? foundryPbr;

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    normalMap: metalPbr?.nor ?? null,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: metalPbr?.rough ?? null,
    roughness: 0.44,
    metalness: 0.62,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x161b24,
    normalMap: metalPbr?.nor ?? null,
    normalScale: new THREE.Vector2(0.45, 0.45),
    roughness: 0.72,
    metalness: 0.24,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: map.accentColor,
    emissive: map.accentColor,
    emissiveIntensity: 0.85,
    roughness: 0.24,
    metalness: 0.45,
  });
  const containerColor =
    map.id === 'helios-outpost'
      ? '#a86135'
      : map.id === 'borealis-citadel'
        ? '#0284c7'
        : map.id === 'oasis-temple'
          ? '#ca8a04'
          : map.id === 'zen-pagoda'
            ? '#b91c1c'
            : map.id === 'estate-garden'
              ? '#166534'
              : '#475569';
  const containerMat = new THREE.MeshStandardMaterial({
    color: containerColor,
    normalMap: structurePbr?.nor ?? null,
    normalScale: new THREE.Vector2(0.65, 0.65),
    roughnessMap: structurePbr?.rough ?? null,
    roughness: 0.76,
    metalness: 0.2,
  });
  disposables.push(steelMat, darkMat, trimMat, containerMat);

  // Perimeter Jersey Barrier Curbs (RoundedBoxGeometry + Instanced trim strips)
  const borderSize = map.halfExtent * 2;
  const curbHeight = 1.2;
  const curbThickness = 1.1;
  const ext = map.halfExtent + curbThickness * 0.5;
  const curbs: Array<[number, number, number, number]> = [
    [0, -ext, borderSize + 2.2, curbThickness],
    [0, ext, borderSize + 2.2, curbThickness],
    [-ext, 0, curbThickness, borderSize + 2.2],
    [ext, 0, curbThickness, borderSize + 2.2],
  ];

  const batches: ArchBatchAccumulator = {
    trimBoxes: [],
    darkBoxes: [],
    steelBoxes: [],
    stanchions: [],
    aoPlanes: [],
  };

  for (const [cx, cz, cw, cd] of curbs) {
    const cg = createBeveledBoxGeometry(cw, curbHeight, cd, 0.14, 3.6);
    const cm = new THREE.Mesh(cg, darkMat);
    cm.position.set(cx, curbHeight * 0.5, cz);
    cm.castShadow = true;
    cm.receiveShadow = true;
    root.add(cm);
    collidableMeshes.push(cm);
    raycastColliders.push(cm);
    disposables.push(cg);

    batches.trimBoxes.push({
      px: cx,
      py: curbHeight + 0.04,
      pz: cz,
      sx: cw > cd ? cw * 0.96 : 0.18,
      sy: 0.12,
      sz: cd > cw ? cd * 0.96 : 0.18,
    });
  }

  // Faceted Low-Poly Perimeter Cliffs & Mountain Silhouettes
  const cliffColors: Record<MapId, number> = {
    'obsidian-foundry': 0x2c3340,
    'helios-outpost': 0xa35832,
    'borealis-citadel': 0x52657d,
    'estate-garden': 0x2e5a36,
    'safehouse-manor': 0x3d352e,
    'neon-rooftop': 0x0f172a,
    'oasis-temple': 0xc27834,
    'cyber-harbor': 0x1e3a5f,
    'zen-pagoda': 0x573b30,
  };
  const cliffColor = cliffColors[map.id] ?? 0x2c3340;
  const cliffMat = new THREE.MeshStandardMaterial({
    color: cliffColor,
    roughness: 0.92,
    metalness: 0.05,
    flatShading: true,
  });
  disposables.push(cliffMat);

  const cliffGeos = [
    createDisplacedCliffGeometry(11),
    createDisplacedCliffGeometry(29),
    createDisplacedCliffGeometry(47),
  ];
  cliffGeos.forEach((g) => disposables.push(g));

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  for (let gIdx = 0; gIdx < cliffGeos.length; gIdx++) {
    const count = 16;
    const inst = new THREE.InstancedMesh(cliffGeos[gIdx], cliffMat, count);
    for (let i = 0; i < count; i++) {
      const idx = i * 3 + gIdx;
      const angle = (idx / 48) * Math.PI * 2;
      const dist = map.halfExtent + 28 + (idx % 4) * 14;
      const sx = 10 + ((idx * 7) % 8);
      const sy = 8 + ((idx * 11) % 13);
      const sz = 10 + ((idx * 5) % 8);
      dummy.position.set(Math.cos(angle) * dist, sy * 0.42, Math.sin(angle) * dist);
      dummy.rotation.set(0, angle * 1.3 + gIdx, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      cColor.set(cliffColor).offsetHSL(0, 0, ((idx % 5) - 2) * 0.04);
      inst.setColorAt(i, cColor);
    }
    inst.computeBoundingSphere();
    root.add(inst);
  }

  addBiomeLowPolyScenery(map, root, disposables, map.accentColor);

  // Pillar 2 + Pillar 1: Structural Map Boxes with RoundedBoxGeometry + World-Scaled PBR
  const defaultBoxMat = new THREE.MeshStandardMaterial({
    map: structurePbr?.diff ?? null,
    normalMap: structurePbr?.nor ?? null,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: structurePbr?.rough ?? null,
    color: structurePbr?.diff ? 0x7c8799 : map.structureTint,
    roughness: 0.78,
    metalness: 0.22,
  });
  disposables.push(defaultBoxMat);

  for (const b of map.boxes) {
    const useColorMap = !b.color && Boolean(structurePbr?.diff);
    const mat = b.color
      ? new THREE.MeshStandardMaterial({
          normalMap: structurePbr?.nor ?? null,
          normalScale: new THREE.Vector2(0.65, 0.65),
          roughnessMap: structurePbr?.rough ?? null,
          color: new THREE.Color(b.color).multiplyScalar(0.66),
          roughness: b.kind === 'tower' ? 0.62 : 0.82,
          metalness: b.kind === 'tower' ? 0.24 : 0.12,
        })
      : defaultBoxMat;
    if (b.color) disposables.push(mat);

    const geo = createBeveledBoxGeometry(b.w, b.h, b.d, 0.1, useColorMap ? 3.2 : 2.8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.y + b.h * 0.5, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    collidableMeshes.push(mesh);
    raycastColliders.push(mesh);
    disposables.push(geo);

    addArchitecturalDetail(
      b,
      root,
      radarDishes,
      disposables,
      batches,
      steelMat,
      trimMat,
      containerMat,
      darkMat,
      map.accentColor,
    );
  }

  // Pillar 5: Flush all repeated architectural boxes, stanchions, and AO decals into InstancedMeshes!
  flushBoxBatch(batches.trimBoxes, trimMat, root, disposables, false, false);
  flushBoxBatch(batches.darkBoxes, darkMat, root, disposables, true, true);
  flushBoxBatch(batches.steelBoxes, steelMat, root, disposables, true, true);

  if (batches.stanchions.length > 0) {
    const stanchionGeo = new THREE.CylinderGeometry(0.18, 0.24, 1, 6);
    const stanchionInst = new THREE.InstancedMesh(stanchionGeo, darkMat, batches.stanchions.length);
    stanchionInst.castShadow = true;
    for (let i = 0; i < batches.stanchions.length; i++) {
      const s = batches.stanchions[i];
      dummy.position.set(s.px, s.py, s.pz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(s.sx / 0.22, s.sy, s.sz / 0.22);
      dummy.updateMatrix();
      stanchionInst.setMatrixAt(i, dummy.matrix);
    }
    stanchionInst.computeBoundingSphere();
    root.add(stanchionInst);
    disposables.push(stanchionGeo);
  }

  // Faceted Ramps
  const rampMat = new THREE.MeshStandardMaterial({
    normalMap: structurePbr?.nor ?? null,
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: structurePbr?.rough ?? null,
    color: new THREE.Color(map.structureTint).multiplyScalar(0.66),
    roughness: 0.78,
    metalness: 0.16,
    flatShading: true,
  });
  disposables.push(rampMat);
  for (const r of map.ramps) {
    const rampMesh = createRampMesh(r, rampMat);
    root.add(rampMesh);
    collidableMeshes.push(rampMesh);
    raycastColliders.push(rampMesh);
    disposables.push(rampMesh.geometry);
  }

  // Jump Pads
  const padBaseGeo = new THREE.CylinderGeometry(1.55, 1.88, 0.26, 8);
  const padRingGeo = new THREE.TorusGeometry(1.18, 0.11, 6, 16);
  const padCoreGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 8);
  const padGlowMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.9,
    roughness: 0.18,
    metalness: 0.5,
    flatShading: true,
  });
  disposables.push(padBaseGeo, padRingGeo, padCoreGeo, padGlowMat);

  for (const pad of map.jumpPads) {
    const padGroup = new THREE.Group();
    padGroup.position.set(pad.x, pad.y, pad.z);

    const base = new THREE.Mesh(padBaseGeo, darkMat);
    base.position.y = 0.13;
    base.receiveShadow = true;

    const core = new THREE.Mesh(padCoreGeo, padGlowMat);
    core.position.y = 0.27;

    const ring = new THREE.Mesh(padRingGeo, padGlowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.46;
    jumpPadRings.push(ring);

    padGroup.add(base, core, ring);
    root.add(padGroup);
  }

  // Dynamic Rigid-Body Crates & Explosive Barrels (lightweight proxy collider box for fast raycasts)
  const fallbackCrateMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.55,
    metalness: 0.35,
    flatShading: true,
  });
  const fallbackBarrelMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    roughness: 0.45,
    metalness: 0.52,
    flatShading: true,
  });
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
  disposables.push(fallbackCrateMat, fallbackBarrelMat, proxyMat);

  for (const c of map.crates) {
    const kind = c.kind ?? 'crate';
    const gltfProp = assetRegistry.instantiateDynamicProp(kind, c.size);
    const proxyGeo = new THREE.BoxGeometry(c.size, kind === 'barrel' ? c.size * 1.15 : c.size, c.size);
    const proxy = new THREE.Mesh(proxyGeo, proxyMat);
    proxy.userData.crateId = c.id;
    disposables.push(proxyGeo);

    if (gltfProp) {
      gltfProp.position.set(c.x, c.y, c.z);
      gltfProp.userData.crateId = c.id;
      gltfProp.add(proxy);
      gltfProp.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh && m !== proxy) {
          collidableMeshes.push(m);
        }
      });
      root.add(gltfProp);
      crateMeshes.set(c.id, gltfProp);
      raycastColliders.push(proxy);
    } else {
      const geo =
        kind === 'barrel'
          ? new THREE.CylinderGeometry(c.size * 0.36, c.size * 0.36, c.size * 1.15, 8)
          : createBeveledBoxGeometry(c.size, c.size, c.size, 0.08, 1.5);
      const mesh = new THREE.Mesh(geo, kind === 'barrel' ? fallbackBarrelMat : fallbackCrateMat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.crateId = c.id;
      root.add(mesh);
      crateMeshes.set(c.id, mesh);
      collidableMeshes.push(mesh);
      raycastColliders.push(mesh);
      disposables.push(geo);
    }
  }

  // Web-sourced GLTF Environment Props with Auto-Grounding, AO Batching, and Proxy Raycast Colliders
  for (const prop of map.glbProps) {
    const asset = assetRegistry.getCached(prop.model);
    if (asset) {
      const wrapper = new THREE.Group();
      const clone = asset.scene.clone(true);
      clone.scale.setScalar(prop.scale);

      clone.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(clone);
      if (prop.model !== 'helmet') {
        clone.position.y -= bbox.min.y;
      }

      wrapper.position.set(prop.x, prop.y, prop.z);
      wrapper.rotation.y = prop.rotY;
      wrapper.add(clone);

      wrapper.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          collidableMeshes.push(m);
        }
      });
      root.add(wrapper);

      // Lightweight proxy box for fast bullet raycasts instead of high-poly GLB triangle tests
      if (prop.colliderHalf) {
        const [hx, hy, hz] = prop.colliderHalf;
        const pGeo = new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2);
        const pMesh = new THREE.Mesh(pGeo, proxyMat);
        pMesh.position.set(prop.x, prop.y + hy, prop.z);
        pMesh.rotation.y = prop.rotY;
        root.add(pMesh);
        raycastColliders.push(pMesh);
        disposables.push(pGeo);
      }

      if (prop.model === 'helmet') {
        relicGroup = wrapper;
      } else if (
        prop.model === 'barrier' ||
        prop.model === 'container' ||
        prop.model === 'rock' ||
        prop.model === 'bench' ||
        prop.model === 'picnic_table' ||
        prop.model === 'planter' ||
        prop.model === 'bookshelf' ||
        prop.model === 'table'
      ) {
        let aoW = 3.2;
        let aoD = 2.0;
        if (prop.model === 'rock') {
          aoW = 4.2;
          aoD = 2.8;
        } else if (prop.model === 'picnic_table') {
          aoW = 2.8;
          aoD = 3.4;
        } else if (prop.model === 'bench') {
          aoW = 2.4;
          aoD = 1.6;
        } else if (prop.model === 'planter') {
          aoW = 1.8;
          aoD = 1.4;
        } else if (prop.model === 'bookshelf') {
          aoW = 2.4;
          aoD = 1.6;
        } else if (prop.model === 'table') {
          aoW = 2.2;
          aoD = 1.8;
        }
        batches.aoPlanes.push({
          px: prop.x,
          py: prop.y + 0.015,
          pz: prop.z,
          sx: aoW,
          sy: 1,
          sz: aoD,
          ry: prop.rotY,
        });
      }
    } else if (prop.model === 'helmet') {
      const fallback = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), trimMat);
      fallback.position.set(prop.x, prop.y, prop.z);
      root.add(fallback);
      relicGroup = fallback;
      disposables.push(fallback.geometry);
    }
  }

  // Batch all ground contact AO decals into 1 InstancedMesh draw call
  if (batches.aoPlanes.length > 0) {
    const aoBaseGeo = new THREE.PlaneGeometry(1, 1);
    aoBaseGeo.rotateX(-Math.PI / 2);
    const aoInst = new THREE.InstancedMesh(aoBaseGeo, aoMat, batches.aoPlanes.length);
    for (let i = 0; i < batches.aoPlanes.length; i++) {
      const t = batches.aoPlanes[i];
      dummy.position.set(t.px, t.py, t.pz);
      dummy.rotation.set(0, t.ry ?? 0, 0);
      dummy.scale.set(t.sx, 1, t.sz);
      dummy.updateMatrix();
      aoInst.setMatrixAt(i, dummy.matrix);
    }
    aoInst.computeBoundingSphere();
    root.add(aoInst);
    disposables.push(aoBaseGeo);
  }

  // Atmospheric Biome Motes
  const moteCount = 150;
  const motePos = new Float32Array(moteCount * 3);
  const randMote = seededRand(909);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (randMote() - 0.5) * map.halfExtent * 2.1;
    motePos[i * 3 + 1] = 0.5 + randMote() * 14;
    motePos[i * 3 + 2] = (randMote() - 0.5) * map.halfExtent * 2.1;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteColors: Record<MapId, number> = {
    'obsidian-foundry': 0xfdba74,
    'helios-outpost': 0xfde68a,
    'borealis-citadel': 0xe0f2fe,
    'estate-garden': 0xa7f3d0,
    'safehouse-manor': 0xfed7aa,
    'neon-rooftop': 0x38bdf8,
    'oasis-temple': 0xfef08a,
    'cyber-harbor': 0xbae6fd,
    'zen-pagoda': 0xfda4af,
  };
  const moteMat = new THREE.PointsMaterial({
    map: moteTex,
    color: moteColors[map.id] ?? 0xfdba74,
    size: map.id === 'borealis-citadel' ? 0.34 : 0.26,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const ambientMotes = new THREE.Points(moteGeo, moteMat);
  root.add(ambientMotes);
  disposables.push(moteGeo, moteMat);

  scene.add(root);

  return {
    root,
    crateMeshes,
    jumpPadRings,
    radarDishes,
    ambientMotes,
    cloudLayer: cloudInst,
    skyMesh,
    relicGroup,
    collidableMeshes,
    raycastColliders,
    dispose: () => {
      scene.remove(root);
      for (const dItem of disposables) {
        dItem.dispose();
      }
    },
  };
}
