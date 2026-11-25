import * as THREE from 'three';
import { ArenaMapSpec, MapBox, MapRamp } from '../shared/maps';
import { assetRegistry } from './assets';

export interface BuiltArenaScene {
  root: THREE.Group;
  crateMeshes: Map<string, THREE.Object3D>;
  jumpPadRings: THREE.Mesh[];
  radarDishes: THREE.Object3D[];
  ambientMotes: THREE.Points | null;
  relicGroup: THREE.Object3D | null;
  collidableMeshes: THREE.Object3D[];
  dispose: () => void;
}

interface LoadedPbrMaps {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const texLoader = new THREE.TextureLoader();
const pbrCache = new Map<string, LoadedPbrMaps>();

function getOrLoadPbrMaps(
  folder: 'foundry_floor' | 'metal_panel' | 'canyon_sand' | 'arctic_ice',
  repeatX: number,
  repeatY: number,
  renderer: THREE.WebGLRenderer,
): LoadedPbrMaps {
  const cacheKey = `${folder}:${repeatX}:${repeatY}`;
  const existing = pbrCache.get(cacheKey);
  if (existing) return existing;

  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const configure = (tex: THREE.Texture, isColor: boolean) => {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
    tex.anisotropy = maxAniso;
    tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    return tex;
  };

  const map = configure(texLoader.load(`/textures/${folder}/diff.jpg`), true);
  const normalMap = configure(texLoader.load(`/textures/${folder}/nor.jpg`), false);
  const roughnessMap = configure(texLoader.load(`/textures/${folder}/rough.jpg`), false);

  const bundle = { map, normalMap, roughnessMap };
  pbrCache.set(cacheKey, bundle);
  return bundle;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createContactAoTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.14, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.62)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.24)');
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

function createSkyDome(
  topColor: string,
  horizonColor: string,
  sunColor: string,
  sunPos: THREE.Vector3,
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(260, 32, 20);
  const sunDir = sunPos.clone().normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color(topColor) },
      uHorizon: { value: new THREE.Color(horizonColor) },
      uSun: { value: new THREE.Color(sunColor) },
      uSunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vDir = normalize(wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform vec3 uSunDir;
      varying vec3 vDir;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        float t = smoothstep(-0.02, 0.5, h);
        vec3 col = mix(uHorizon, uTop, t);

        if (d.y > 0.03) {
          vec2 uv = d.xz / (d.y + 0.2) * 1.45;
          float n = noise(uv) * 0.6 + noise(uv * 2.4 + 3.7) * 0.4;
          float cloudMask = smoothstep(0.54, 0.86, n) * smoothstep(0.03, 0.26, d.y) * 0.38;
          col = mix(col, mix(uHorizon, vec3(1.0), 0.55), cloudMask);
        }

        float sunAmt = max(dot(d, uSunDir), 0.0);
        col += uSun * pow(sunAmt, 12.0) * 0.42;
        col += uSun * smoothstep(0.997, 0.9994, sunAmt) * 1.65;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

function createDisplacedCliffGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2);
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
    const scaleXZ = 1.0 + n - Math.max(0, vy) * 0.25;
    vx *= scaleXZ;
    vz *= scaleXZ;
    vy = vy * 1.15 + Math.abs(n) * 0.35;
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
 * Generates a biome-matched PMREM environment cubemap from the arena's sky, sun & ground colors
 * so metallic weapons, armor, helmets, and ice reflect real sky & horizon light rather than flat grey.
 */
export function setupSceneEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  map?: ArenaMapSpec,
): () => void {
  const envScene = new THREE.Scene();

  const topCol = map?.skyTopColor ?? '#244b7a';
  const horizonCol = map?.skyHorizonColor ?? '#c47247';
  const sunCol = map?.sunColor ?? '#ffd4a3';
  const groundCol = map?.hemiGroundColor ?? '#3b2e26';

  // Upper sky & lower ground bounce sphere inside PMREM bake scene
  const domeGeo = new THREE.SphereGeometry(20, 24, 16);
  const domeMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      uTop: { value: new THREE.Color(topCol) },
      uHor: { value: new THREE.Color(horizonCol) },
      uGround: { value: new THREE.Color(groundCol) },
      uSun: { value: new THREE.Color(sunCol) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHor;
      uniform vec3 uGround;
      uniform vec3 uSun;
      varying vec3 vPos;
      void main() {
        float y = vPos.y;
        vec3 col = y >= 0.0
          ? mix(uHor * 1.15, uTop * 1.2, smoothstep(0.0, 0.75, y))
          : mix(uHor * 0.7, uGround * 0.85, smoothstep(0.0, -0.6, y));
        vec3 sunDir = normalize(vec3(0.65, 0.72, 0.38));
        float sunDot = max(dot(vPos, sunDir), 0.0);
        col += uSun * pow(sunDot, 20.0) * 5.5;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  envScene.add(dome);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.035).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 1.15;

  pmrem.dispose();
  domeGeo.dispose();
  domeMat.dispose();

  return () => {
    envTex.dispose();
  };
}

function addArchitecturalDetail(
  b: MapBox,
  root: THREE.Group,
  radarDishes: THREE.Object3D[],
  disposables: Array<{ dispose: () => void }>,
  steelMat: THREE.Material,
  trimMat: THREE.Material,
  containerMat: THREE.Material,
  darkMat: THREE.Material,
  aoMat: THREE.Material,
  accentColor: string,
): void {
  if (b.y <= 0.05) {
    const aoGeo = new THREE.PlaneGeometry(b.w + 2.6, b.d + 2.6);
    aoGeo.rotateX(-Math.PI / 2);
    const aoMesh = new THREE.Mesh(aoGeo, aoMat);
    aoMesh.position.set(b.x, 0.015, b.z);
    root.add(aoMesh);
    disposables.push(aoGeo);
  }

  if (b.kind === 'core' || b.kind === 'tower') {
    const plinthGeo = new THREE.BoxGeometry(b.w + 0.55, 0.38, b.d + 0.55);
    const plinth = new THREE.Mesh(plinthGeo, darkMat);
    plinth.position.set(b.x, b.y + 0.19, b.z);
    plinth.receiveShadow = true;
    root.add(plinth);
    disposables.push(plinthGeo);
  }

  if (b.kind === 'core') {
    const collarGeo = new THREE.BoxGeometry(b.w + 0.16, 0.16, b.d + 0.16);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.14, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    const buttressGeo = new THREE.BoxGeometry(0.45, b.h, 0.45);
    const corners: Array<[number, number]> = [
      [-b.w * 0.5, -b.d * 0.5],
      [b.w * 0.5, -b.d * 0.5],
      [-b.w * 0.5, b.d * 0.5],
      [b.w * 0.5, b.d * 0.5],
    ];
    for (const [ox, oz] of corners) {
      const bm = new THREE.Mesh(buttressGeo, steelMat);
      bm.position.set(b.x + ox, b.y + b.h * 0.5, b.z + oz);
      bm.castShadow = true;
      root.add(bm);
    }
    disposables.push(buttressGeo);

    const beacon = new THREE.PointLight(accentColor, 4.2, 22, 1.5);
    beacon.position.set(b.x, b.y + b.h + 1.5, b.z);
    root.add(beacon);
  } else if (b.kind === 'bridge') {
    const capGeo = new THREE.BoxGeometry(b.w + 0.26, 0.22, b.d + 0.26);
    const cap = new THREE.Mesh(capGeo, steelMat);
    cap.position.set(b.x, b.y + b.h - 0.11, b.z);
    cap.receiveShadow = true;
    root.add(cap);
    disposables.push(capGeo);

    const collarGeo = new THREE.BoxGeometry(b.w + 0.3, 0.08, b.d + 0.3);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.24, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    const pilGeo = new THREE.BoxGeometry(0.36, b.h + 0.95, 0.36);
    const corners: Array<[number, number]> = [
      [-b.w * 0.5 + 0.18, -b.d * 0.5 + 0.18],
      [b.w * 0.5 - 0.18, -b.d * 0.5 + 0.18],
      [-b.w * 0.5 + 0.18, b.d * 0.5 - 0.18],
      [b.w * 0.5 - 0.18, b.d * 0.5 - 0.18],
    ];
    for (const [ox, oz] of corners) {
      const p = new THREE.Mesh(pilGeo, darkMat);
      p.position.set(b.x + ox, b.y + (b.h + 0.95) * 0.5, b.z + oz);
      root.add(p);
    }
    disposables.push(pilGeo);
  } else if (b.kind === 'tower') {
    const bandGeo = new THREE.BoxGeometry(b.w + 0.14, 0.28, b.d + 0.14);
    const band1 = new THREE.Mesh(bandGeo, darkMat);
    band1.position.set(b.x, b.y + b.h * 0.55, b.z);
    const band2 = new THREE.Mesh(bandGeo, trimMat);
    band2.position.set(b.x, b.y + b.h - 0.32, b.z);
    band2.scale.set(1.02, 0.48, 1.02);

    const mastGeo = new THREE.CylinderGeometry(0.07, 0.14, 2.3, 10);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(b.x + b.w * 0.22, b.y + b.h + 1.15, b.z - b.d * 0.22);

    // Animated tactical rotating radar array on central/corner towers
    const dishPivot = new THREE.Group();
    dishPivot.position.set(b.x + b.w * 0.22, b.y + b.h + 2.25, b.z - b.d * 0.22);
    const dishBarGeo = new THREE.BoxGeometry(1.5, 0.22, 0.14);
    const dishBar = new THREE.Mesh(dishBarGeo, steelMat);
    const dishTipGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const dishTip = new THREE.Mesh(dishTipGeo, trimMat);
    dishTip.position.y = 0.22;
    dishPivot.add(dishBar, dishTip);
    radarDishes.push(dishPivot);

    root.add(band1, band2, mast, dishPivot);
    disposables.push(bandGeo, mastGeo, dishBarGeo, dishTipGeo);
  } else if (b.kind === 'cover') {
    const shellGeo = new THREE.BoxGeometry(b.w + 0.05, b.h - 0.18, b.d + 0.05);
    const shell = new THREE.Mesh(shellGeo, containerMat);
    shell.position.set(b.x, b.y + b.h * 0.5, b.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    const capGeo = new THREE.BoxGeometry(b.w + 0.14, 0.16, b.d + 0.14);
    const cap = new THREE.Mesh(capGeo, darkMat);
    cap.position.set(b.x, b.y + b.h - 0.08, b.z);
    root.add(shell, cap);
    disposables.push(shellGeo, capGeo);
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
  const crateMeshes = new Map<string, THREE.Object3D>();
  const jumpPadRings: THREE.Mesh[] = [];
  const radarDishes: THREE.Object3D[] = [];
  let relicGroup: THREE.Object3D | null = null;

  scene.background = new THREE.Color(map.fogColor);
  scene.fog = new THREE.FogExp2(map.fogColor, map.fogDensity);

  const sunPosition = new THREE.Vector3(44, 52, 26);

  // Atmospheric Sky Dome with Sun Disc + Cloud Wisps
  const skyDome = createSkyDome(map.skyTopColor, map.skyHorizonColor, map.sunColor, sunPosition);
  root.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material as THREE.Material);

  // Three-Point Outdoor Lighting Rig (Warm Sun + Cool Sky Hemisphere + Rim)
  const hemi = new THREE.HemisphereLight(map.hemiSkyColor, map.hemiGroundColor, 1.05);
  root.add(hemi);

  const keyLight = new THREE.DirectionalLight(map.sunColor, map.sunIntensity);
  keyLight.position.copy(sunPosition);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  const d = map.halfExtent + 10;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.camera.near = 5;
  keyLight.shadow.camera.far = 160;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.025;
  root.add(keyLight);

  const rimLight = new THREE.DirectionalLight(map.accentColor, 0.72);
  rimLight.position.set(-38, 24, -34);
  root.add(rimLight);

  // Real 1K PBR Web Textures (Albedo + NormalGL + Roughness)
  const groundFolder =
    map.id === 'helios-outpost'
      ? 'canyon_sand'
      : map.id === 'borealis-citadel'
        ? 'arctic_ice'
        : 'foundry_floor';

  const groundRepeat =
    map.id === 'helios-outpost' ? 78 : map.id === 'borealis-citadel' ? 72 : 115;
  const groundPbr = getOrLoadPbrMaps(groundFolder, groundRepeat, groundRepeat, renderer);
  const metalPbr = getOrLoadPbrMaps('metal_panel', 2, 1, renderer);
  const metalDetailPbr = getOrLoadPbrMaps('metal_panel', 3, 2, renderer);

  const aoTex = createContactAoTexture();
  const moteTex = createSoftParticleTexture();
  disposables.push(aoTex, moteTex);

  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.78,
  });
  disposables.push(aoMat);

  // Extended terrain beyond playable bounds with real PBR normal + roughness maps
  const terrainGeo = new THREE.PlaneGeometry(420, 420);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundPbr.map,
    normalMap: groundPbr.normalMap,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: groundPbr.roughnessMap,
    color: 0xffffff,
    roughness: map.id === 'borealis-citadel' ? 0.55 : 0.9,
    metalness: map.id === 'obsidian-foundry' ? 0.22 : 0.08,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.position.y = 0;
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);
  collidableMeshes.push(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // Center tactical arena court ring & outer perimeter track on floor
  const courtRingGeo = new THREE.RingGeometry(11.6, 12.15, 56);
  courtRingGeo.rotateX(-Math.PI / 2);
  const courtRingMat = new THREE.MeshBasicMaterial({
    color: map.accentColor,
    transparent: true,
    opacity: 0.44,
  });
  const courtRing = new THREE.Mesh(courtRingGeo, courtRingMat);
  courtRing.position.y = 0.022;
  root.add(courtRing);
  disposables.push(courtRingGeo, courtRingMat);

  // Shared Architectural PBR Materials using real metal normal/roughness maps
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    normalMap: metalDetailPbr.normalMap,
    roughnessMap: metalDetailPbr.roughnessMap,
    roughness: 0.55,
    metalness: 0.72,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.6,
    metalness: 0.5,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: map.accentColor,
    emissive: map.accentColor,
    emissiveIntensity: 1.35,
    roughness: 0.22,
    metalness: 0.45,
  });
  const containerMat = new THREE.MeshStandardMaterial({
    map: metalPbr.map,
    normalMap: metalPbr.normalMap,
    roughnessMap: metalPbr.roughnessMap,
    color: map.id === 'helios-outpost' ? '#b46b3e' : map.id === 'borealis-citadel' ? '#0ea5e9' : '#94a3b8',
    roughness: 0.68,
    metalness: 0.42,
  });
  disposables.push(steelMat, darkMat, trimMat, containerMat);

  // Perimeter Jersey Barrier Curbs with Illuminated Trim
  const borderSize = map.halfExtent * 2;
  const curbHeight = 1.25;
  const curbThickness = 1.1;
  const ext = map.halfExtent + curbThickness * 0.5;
  const curbs: Array<[number, number, number, number]> = [
    [0, -ext, borderSize + 2.2, curbThickness],
    [0, ext, borderSize + 2.2, curbThickness],
    [-ext, 0, curbThickness, borderSize + 2.2],
    [ext, 0, curbThickness, borderSize + 2.2],
  ];
  for (const [cx, cz, cw, cd] of curbs) {
    const cg = new THREE.BoxGeometry(cw, curbHeight, cd);
    const cm = new THREE.Mesh(cg, darkMat);
    cm.position.set(cx, curbHeight * 0.5, cz);
    cm.castShadow = true;
    cm.receiveShadow = true;
    root.add(cm);
    collidableMeshes.push(cm);
    disposables.push(cg);

    const tg = new THREE.BoxGeometry(
      cw > cd ? cw * 0.96 : 0.18,
      0.12,
      cd > cw ? cd * 0.96 : 0.18,
    );
    const tm = new THREE.Mesh(tg, trimMat);
    tm.position.set(cx, curbHeight + 0.06, cz);
    root.add(tm);
    disposables.push(tg);
  }

  // Organic Displaced Cliff / Mountain Ridge Ring
  const cliffColor =
    map.id === 'helios-outpost' ? 0x9f5630 : map.id === 'borealis-citadel' ? 0x475569 : 0x2f3747;
  const cliffMat = new THREE.MeshStandardMaterial({
    color: cliffColor,
    normalMap: groundPbr.normalMap,
    roughness: 0.92,
    metalness: 0.06,
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
      const dist = map.halfExtent + 24 + (idx % 4) * 14;
      const sx = 9 + ((idx * 7) % 8);
      const sy = 7 + ((idx * 11) % 13);
      const sz = 9 + ((idx * 5) % 8);
      dummy.position.set(Math.cos(angle) * dist, sy * 0.38, Math.sin(angle) * dist);
      dummy.rotation.set(0, angle * 1.3 + gIdx, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      cColor.set(cliffColor).offsetHSL(0, 0, ((idx % 5) - 2) * 0.035);
      inst.setColorAt(i, cColor);
    }
    inst.computeBoundingSphere();
    root.add(inst);
  }

  // Structural Map Boxes + Rich Architectural Dressing
  const defaultBoxMat = new THREE.MeshStandardMaterial({
    map: metalDetailPbr.map,
    normalMap: metalDetailPbr.normalMap,
    roughnessMap: metalDetailPbr.roughnessMap,
    color: map.structureTint,
    roughness: 0.65,
    metalness: 0.38,
  });
  disposables.push(defaultBoxMat);

  for (const b of map.boxes) {
    const mat = b.color
      ? new THREE.MeshStandardMaterial({
          map: metalDetailPbr.map,
          normalMap: metalDetailPbr.normalMap,
          roughnessMap: metalDetailPbr.roughnessMap,
          color: b.color,
          roughness: b.kind === 'tower' ? 0.55 : 0.72,
          metalness: b.kind === 'tower' ? 0.45 : 0.25,
        })
      : defaultBoxMat;
    if (b.color) disposables.push(mat);

    const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(b.x, b.y + b.h * 0.5, b.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
    collidableMeshes.push(mesh);
    disposables.push(geo);

    addArchitecturalDetail(
      b,
      root,
      radarDishes,
      disposables,
      steelMat,
      trimMat,
      containerMat,
      darkMat,
      aoMat,
      map.accentColor,
    );
  }

  // Ramps with Tread Surface
  const rampMat = new THREE.MeshStandardMaterial({
    map: metalDetailPbr.map,
    normalMap: metalDetailPbr.normalMap,
    roughnessMap: metalDetailPbr.roughnessMap,
    color: map.structureTint,
    roughness: 0.58,
    metalness: 0.44,
  });
  disposables.push(rampMat);
  for (const r of map.ramps) {
    const rampMesh = createRampMesh(r, rampMat);
    root.add(rampMesh);
    collidableMeshes.push(rampMesh);
    disposables.push(rampMesh.geometry);
  }

  // Jump Pads (3-part composite grounded emitter + glowing torus)
  const padBaseGeo = new THREE.CylinderGeometry(1.55, 1.85, 0.24, 24);
  const padRingGeo = new THREE.TorusGeometry(1.18, 0.11, 10, 28);
  const padCoreGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24);
  const padGlowMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.9,
    roughness: 0.18,
    metalness: 0.5,
  });
  disposables.push(padBaseGeo, padRingGeo, padCoreGeo, padGlowMat);

  for (const pad of map.jumpPads) {
    const padGroup = new THREE.Group();
    padGroup.position.set(pad.x, pad.y, pad.z);

    const base = new THREE.Mesh(padBaseGeo, darkMat);
    base.position.y = 0.12;
    base.receiveShadow = true;

    const core = new THREE.Mesh(padCoreGeo, padGlowMat);
    core.position.y = 0.25;

    const ring = new THREE.Mesh(padRingGeo, padGlowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.46;
    jumpPadRings.push(ring);

    padGroup.add(base, core, ring);
    root.add(padGroup);
  }

  // Dynamic Rigid-Body Crates & Explosive Barrels (Real Poly Haven GLTF meshes when loaded)
  const fallbackCrateMat = new THREE.MeshStandardMaterial({
    map: metalPbr.map,
    normalMap: metalPbr.normalMap,
    color: 0x94a3b8,
    roughness: 0.5,
    metalness: 0.45,
  });
  const fallbackBarrelMat = new THREE.MeshStandardMaterial({
    color: 0xc2410c,
    roughness: 0.42,
    metalness: 0.58,
  });
  disposables.push(fallbackCrateMat, fallbackBarrelMat);

  for (const c of map.crates) {
    const kind = c.kind ?? 'crate';
    const gltfProp = assetRegistry.instantiateDynamicProp(kind, c.size);
    if (gltfProp) {
      gltfProp.position.set(c.x, c.y, c.z);
      gltfProp.userData.crateId = c.id;
      gltfProp.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) {
          m.userData.crateId = c.id;
          collidableMeshes.push(m);
        }
      });
      root.add(gltfProp);
      crateMeshes.set(c.id, gltfProp);
    } else {
      const geo =
        kind === 'barrel'
          ? new THREE.CylinderGeometry(c.size * 0.36, c.size * 0.36, c.size * 1.15, 16)
          : new THREE.BoxGeometry(c.size, c.size, c.size);
      const mesh = new THREE.Mesh(geo, kind === 'barrel' ? fallbackBarrelMat : fallbackCrateMat);
      mesh.position.set(c.x, c.y, c.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.crateId = c.id;
      root.add(mesh);
      crateMeshes.set(c.id, mesh);
      collidableMeshes.push(mesh);
      disposables.push(geo);
    }
  }

  // Web-sourced Poly Haven + Khronos GLTF Environment Props with Auto-Grounding & Contact AO
  for (const prop of map.glbProps) {
    const asset = assetRegistry.getCached(prop.model);
    if (asset) {
      const wrapper = new THREE.Group();
      const clone = asset.scene.clone(true);
      clone.scale.setScalar(prop.scale);

      // Measure bounding box so bottom sits flush on prop.y
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

      if (prop.model === 'helmet') {
        relicGroup = wrapper;
      } else if (prop.model === 'barrier' || prop.model === 'container' || prop.model === 'rock') {
        const aoSize = prop.model === 'rock' ? 4.2 : 3.2;
        const aoGeo = new THREE.PlaneGeometry(aoSize, aoSize * 0.65);
        aoGeo.rotateX(-Math.PI / 2);
        const aoMesh = new THREE.Mesh(aoGeo, aoMat);
        aoMesh.position.set(prop.x, prop.y + 0.015, prop.z);
        aoMesh.rotation.y = prop.rotY;
        root.add(aoMesh);
        disposables.push(aoGeo);
      }
    } else if (prop.model === 'helmet') {
      const fallback = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), trimMat);
      fallback.position.set(prop.x, prop.y, prop.z);
      root.add(fallback);
      relicGroup = fallback;
      disposables.push(fallback.geometry);
    }
  }

  // Atmospheric Biome Motes (Embers / Desert Dust / Arctic Snow Flurries)
  const moteCount = 160;
  const motePos = new Float32Array(moteCount * 3);
  const randMote = seededRand(909);
  for (let i = 0; i < moteCount; i++) {
    motePos[i * 3] = (randMote() - 0.5) * map.halfExtent * 2.1;
    motePos[i * 3 + 1] = 0.5 + randMote() * 14;
    motePos[i * 3 + 2] = (randMote() - 0.5) * map.halfExtent * 2.1;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const moteColor =
    map.id === 'borealis-citadel'
      ? 0xe0f2fe
      : map.id === 'helios-outpost'
        ? 0xfde68a
        : 0xfdba74;
  const moteMat = new THREE.PointsMaterial({
    map: moteTex,
    color: moteColor,
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
    relicGroup,
    collidableMeshes,
    dispose: () => {
      scene.remove(root);
      for (const dItem of disposables) {
        dItem.dispose();
      }
    },
  };
}
