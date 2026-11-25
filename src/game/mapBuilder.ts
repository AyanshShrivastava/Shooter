import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArenaMapSpec, MapBox, MapRamp } from '../shared/maps';
import { assetRegistry } from './assets';

export interface BuiltArenaScene {
  root: THREE.Group;
  crateMeshes: Map<string, THREE.Object3D>;
  jumpPadRings: THREE.Mesh[];
  relicGroup: THREE.Object3D | null;
  collidableMeshes: THREE.Object3D[];
  dispose: () => void;
}

interface PbrTextureSet {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

function seededRand(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function createGroundTextureSet(
  kind: 'foundry' | 'canyon' | 'arctic',
  baseHex: string,
  accentHex: string,
  renderer: THREE.WebGLRenderer,
): PbrTextureSet {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  const rand = seededRand(kind === 'foundry' ? 101 : kind === 'canyon' ? 202 : 303);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  if (kind === 'foundry') {
    // Concrete & steel industrial floor slabs with aggregate grit & expansion seams
    for (let i = 0; i < 4200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const w = 1 + rand() * 4;
      const h = 1 + rand() * 3;
      const bright = rand() > 0.5;
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.09)';
      ctx.fillRect(x, y, w, h);
      bctx.fillStyle = bright ? 'rgba(215,215,215,0.18)' : 'rgba(55,55,55,0.22)';
      bctx.fillRect(x, y, w, h);
    }
    // Slab seams
    for (let g = 0; g <= size; g += 128) {
      ctx.strokeStyle = 'rgba(0,0,0,0.34)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, size);
      ctx.moveTo(0, g);
      ctx.lineTo(size, g);
      ctx.stroke();

      bctx.strokeStyle = '#262626';
      bctx.lineWidth = 4;
      bctx.beginPath();
      bctx.moveTo(g, 0);
      bctx.lineTo(g, size);
      bctx.moveTo(0, g);
      bctx.lineTo(size, g);
      bctx.stroke();
    }
    // Subtle yellow safety trim lines
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, size - 20, size - 20);
  } else if (kind === 'canyon') {
    // Stratified desert rock, wind-rippled sand & gravel
    for (let y = 0; y < size; y += 4) {
      const wave = Math.sin(y * 0.08) * 0.04 + 0.05;
      ctx.fillStyle = y % 8 === 0 ? `rgba(255,235,205,${wave})` : `rgba(85,40,15,${wave})`;
      ctx.fillRect(0, y, size, 3);
      bctx.fillStyle = y % 8 === 0 ? 'rgba(175,175,175,0.25)' : 'rgba(85,85,85,0.25)';
      bctx.fillRect(0, y, size, 2);
    }
    for (let i = 0; i < 4800; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1 + rand() * 2.5;
      ctx.fillStyle = rand() > 0.45 ? 'rgba(65,30,12,0.12)' : 'rgba(255,230,190,0.08)';
      ctx.fillRect(x, y, r, r);
      bctx.fillStyle = rand() > 0.5 ? '#b4b4b4' : '#4a4a4a';
      bctx.fillRect(x, y, r, r);
    }
  } else {
    // Arctic snowpack & brushed cryo-concrete apron
    for (let i = 0; i < 3600; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const sz = 2 + rand() * 5;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(100,135,175,0.12)';
      ctx.fillRect(x, y, sz, sz * 0.7);
      bctx.fillStyle = rand() > 0.5 ? 'rgba(220,220,220,0.2)' : 'rgba(70,70,70,0.2)';
      bctx.fillRect(x, y, sz, sz * 0.7);
    }
    ctx.strokeStyle = 'rgba(14, 165, 233, 0.22)';
    ctx.lineWidth = 3;
    for (let g = 0; g <= size; g += 128) {
      ctx.strokeRect(g + 4, 4, 120, 120);
      bctx.strokeStyle = '#383838';
      bctx.lineWidth = 3;
      bctx.strokeRect(g + 2, 2, 124, 124);
    }
  }

  // Subtle ambient edge accent line
  void accentHex;

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { albedo, bump };
}

function createPanelTextureSet(
  mode: 'panel' | 'corrugated' | 'crate' | 'barrel',
  baseHex: string,
  accentHex: string,
  renderer: THREE.WebGLRenderer,
): PbrTextureSet {
  const size = 256;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const ctx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bctx = bumpCanvas.getContext('2d')!;

  const rand = seededRand(mode.length * 91 + 17);

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);

  if (mode === 'corrugated') {
    // Shipping container vertical steel ribs
    for (let x = 0; x < size; x += 16) {
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, 0, 7, size);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(x + 8, 0, 7, size);

      bctx.fillStyle = '#d4d4d4';
      bctx.fillRect(x, 0, 7, size);
      bctx.fillStyle = '#363636';
      bctx.fillRect(x + 8, 0, 7, size);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, size - 10, size - 10);
    bctx.strokeStyle = '#ececec';
    bctx.lineWidth = 10;
    bctx.strokeRect(5, 5, size - 10, size - 10);
  } else if (mode === 'crate') {
    // Tactical reinforced armor supply crate
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, size - 16, size - 16);
    ctx.strokeStyle = accentHex;
    ctx.lineWidth = 5;
    ctx.strokeRect(20, 20, size - 40, size - 40);
    ctx.beginPath();
    ctx.moveTo(24, 24);
    ctx.lineTo(size - 24, size - 24);
    ctx.moveTo(size - 24, 24);
    ctx.lineTo(24, size - 24);
    ctx.strokeStyle = 'rgba(0,0,0,0.38)';
    ctx.lineWidth = 10;
    ctx.stroke();

    bctx.strokeStyle = '#e5e5e5';
    bctx.lineWidth = 16;
    bctx.strokeRect(8, 8, size - 16, size - 16);
    bctx.strokeStyle = '#303030';
    bctx.lineWidth = 8;
    bctx.beginPath();
    bctx.moveTo(24, 24);
    bctx.lineTo(size - 24, size - 24);
    bctx.stroke();
  } else if (mode === 'barrel') {
    // Industrial hazard drum with horizontal reinforcement ribs + warning band
    ctx.fillStyle = '#c2410c';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, size * 0.36, size, size * 0.28);
    // Hazard diagonal stripes
    ctx.fillStyle = 'rgba(9,9,11,0.72)';
    for (let x = -size; x < size * 2; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, size * 0.36);
      ctx.lineTo(x + 14, size * 0.36);
      ctx.lineTo(x + 2, size * 0.64);
      ctx.lineTo(x - 12, size * 0.64);
      ctx.closePath();
      ctx.fill();
    }
    bctx.fillStyle = '#ececec';
    bctx.fillRect(0, size * 0.22, size, 12);
    bctx.fillRect(0, size * 0.74, size, 12);
  } else {
    // Architectural panel seams & rivets
    for (let i = 0; i < 900; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.06)';
      ctx.fillRect(x, y, 4, 2);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.32)';
    ctx.lineWidth = 3;
    bctx.strokeStyle = '#3a3a3a';
    bctx.lineWidth = 3;
    for (let p = 0; p <= size; p += 64) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();

      bctx.beginPath();
      bctx.moveTo(p, 0);
      bctx.lineTo(p, size);
      bctx.moveTo(0, p);
      bctx.lineTo(size, p);
      bctx.stroke();
    }
    // Rivet dots
    bctx.fillStyle = '#dcdcdc';
    for (let x = 8; x < size; x += 64) {
      for (let y = 8; y < size; y += 64) {
        bctx.fillRect(x, y, 3, 3);
        bctx.fillRect(x + 48, y, 3, 3);
      }
    }
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.wrapS = THREE.RepeatWrapping;
  albedo.wrapT = THREE.RepeatWrapping;
  albedo.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = THREE.RepeatWrapping;
  bump.wrapT = THREE.RepeatWrapping;
  bump.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { albedo, bump };
}

function createContactAoTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.16, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.65, 'rgba(0, 0, 0, 0.25)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
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
        float h = clamp(d.y, -0.1, 1.0);
        float t = smoothstep(-0.02, 0.48, h);
        vec3 col = mix(uHorizon, uTop, t);

        // Soft cloud wisps in upper sky
        if (d.y > 0.04) {
          vec2 uv = d.xz / (d.y + 0.18) * 1.35;
          float n = noise(uv) * 0.65 + noise(uv * 2.3 + 4.1) * 0.35;
          float cloudMask = smoothstep(0.55, 0.85, n) * smoothstep(0.04, 0.28, d.y) * 0.32;
          col = mix(col, mix(uHorizon, vec3(1.0), 0.45), cloudMask);
        }

        // Atmospheric sun disc & Rayleigh glow halo
        float sunAmt = max(dot(d, uSunDir), 0.0);
        col += uSun * pow(sunAmt, 14.0) * 0.35;
        col += uSun * smoothstep(0.9975, 0.9993, sunAmt) * 1.4;

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
    // Flatten base & taper top ridge organically
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
  if (ramp.riseDir === '-x') {
    mesh.rotation.y = Math.PI;
  } else if (ramp.riseDir === '+z') {
    mesh.rotation.y = -Math.PI / 2;
  } else if (ramp.riseDir === '-z') {
    mesh.rotation.y = Math.PI / 2;
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function setupSceneEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
): () => void {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return () => {
    envTex.dispose();
  };
}

function addArchitecturalDetail(
  b: MapBox,
  root: THREE.Group,
  disposables: Array<{ dispose: () => void }>,
  steelMat: THREE.Material,
  trimMat: THREE.Material,
  containerMat: THREE.Material,
  darkMat: THREE.Material,
  aoMat: THREE.Material,
  accentColor: string,
): void {
  // Grounded AO shadow pad under structures touching y=0
  if (b.y <= 0.05) {
    const aoGeo = new THREE.PlaneGeometry(b.w + 2.4, b.d + 2.4);
    aoGeo.rotateX(-Math.PI / 2);
    const aoMesh = new THREE.Mesh(aoGeo, aoMat);
    aoMesh.position.set(b.x, 0.015, b.z);
    root.add(aoMesh);
    disposables.push(aoGeo);
  }

  // Chamfered concrete/steel footing base
  if (b.kind === 'core' || b.kind === 'tower') {
    const plinthGeo = new THREE.BoxGeometry(b.w + 0.5, 0.36, b.d + 0.5);
    const plinth = new THREE.Mesh(plinthGeo, darkMat);
    plinth.position.set(b.x, b.y + 0.18, b.z);
    plinth.receiveShadow = true;
    root.add(plinth);
    disposables.push(plinthGeo);
  }

  if (b.kind === 'core') {
    // Emissive reactor trim ring + corner structural buttresses + point light bounce
    const collarGeo = new THREE.BoxGeometry(b.w + 0.14, 0.16, b.d + 0.14);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.14, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    const buttressGeo = new THREE.BoxGeometry(0.42, b.h, 0.42);
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

    const beacon = new THREE.PointLight(accentColor, 3.2, 18, 1.6);
    beacon.position.set(b.x, b.y + b.h + 1.4, b.z);
    root.add(beacon);
  } else if (b.kind === 'bridge') {
    // Overhang deck cap + glowing edge trim + corner steel support columns + tactical guardrails
    const capGeo = new THREE.BoxGeometry(b.w + 0.24, 0.22, b.d + 0.24);
    const cap = new THREE.Mesh(capGeo, steelMat);
    cap.position.set(b.x, b.y + b.h - 0.11, b.z);
    cap.receiveShadow = true;
    root.add(cap);
    disposables.push(capGeo);

    const collarGeo = new THREE.BoxGeometry(b.w + 0.28, 0.08, b.d + 0.28);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.24, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    // Corner pilasters
    const pilGeo = new THREE.BoxGeometry(0.35, b.h + 0.9, 0.35);
    const corners: Array<[number, number]> = [
      [-b.w * 0.5 + 0.18, -b.d * 0.5 + 0.18],
      [b.w * 0.5 - 0.18, -b.d * 0.5 + 0.18],
      [-b.w * 0.5 + 0.18, b.d * 0.5 - 0.18],
      [b.w * 0.5 - 0.18, b.d * 0.5 - 0.18],
    ];
    for (const [ox, oz] of corners) {
      const p = new THREE.Mesh(pilGeo, darkMat);
      p.position.set(b.x + ox, b.y + (b.h + 0.9) * 0.5, b.z + oz);
      root.add(p);
    }
    disposables.push(pilGeo);
  } else if (b.kind === 'tower') {
    // Recessed cooling louver bands + rooftop communications antenna
    const bandGeo = new THREE.BoxGeometry(b.w + 0.12, 0.28, b.d + 0.12);
    const band1 = new THREE.Mesh(bandGeo, darkMat);
    band1.position.set(b.x, b.y + b.h * 0.55, b.z);
    const band2 = new THREE.Mesh(bandGeo, trimMat);
    band2.position.set(b.x, b.y + b.h - 0.32, b.z);
    band2.scale.set(1.01, 0.45, 1.01);
    const mastGeo = new THREE.CylinderGeometry(0.06, 0.12, 2.2, 8);
    const mast = new THREE.Mesh(mastGeo, steelMat);
    mast.position.set(b.x + b.w * 0.25, b.y + b.h + 1.1, b.z - b.d * 0.25);
    const tipGeo = new THREE.SphereGeometry(0.14, 8, 8);
    const tip = new THREE.Mesh(tipGeo, trimMat);
    tip.position.set(b.x + b.w * 0.25, b.y + b.h + 2.25, b.z - b.d * 0.25);
    root.add(band1, band2, mast, tip);
    disposables.push(bandGeo, mastGeo, tipGeo);
  } else if (b.kind === 'cover') {
    // Corrugated steel cladding overlay + heavy top/bottom steel frame rails
    const shellGeo = new THREE.BoxGeometry(b.w + 0.04, b.h - 0.18, b.d + 0.04);
    const shell = new THREE.Mesh(shellGeo, containerMat);
    shell.position.set(b.x, b.y + b.h * 0.5, b.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    const capGeo = new THREE.BoxGeometry(b.w + 0.12, 0.16, b.d + 0.12);
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
  let relicGroup: THREE.Object3D | null = null;

  scene.background = new THREE.Color(map.fogColor);
  scene.fog = new THREE.FogExp2(map.fogColor, map.fogDensity);

  const sunPosition = new THREE.Vector3(44, 52, 26);

  // Atmospheric Sky Dome with Sun Disc + Cloud Wisps
  const skyDome = createSkyDome(map.skyTopColor, map.skyHorizonColor, map.sunColor, sunPosition);
  root.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material as THREE.Material);

  // Three-Point Outdoor Lighting Rig (Warm Sun + Cool Sky Hemisphere + Rim)
  const hemi = new THREE.HemisphereLight(map.hemiSkyColor, map.hemiGroundColor, 0.95);
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

  const rimLight = new THREE.DirectionalLight(map.accentColor, 0.65);
  rimLight.position.set(-38, 24, -34);
  root.add(rimLight);

  // Procedural PBR Texture Sets (Albedo + Bump)
  const texKind =
    map.id === 'helios-outpost' ? 'canyon' : map.id === 'borealis-citadel' ? 'arctic' : 'foundry';

  const groundTex = createGroundTextureSet(texKind, map.groundTint, map.accentColor, renderer);
  groundTex.albedo.repeat.set(20, 20);
  groundTex.bump.repeat.set(20, 20);
  disposables.push(groundTex.albedo, groundTex.bump);

  const panelTex = createPanelTextureSet('panel', map.structureTint, map.accentColor, renderer);
  panelTex.albedo.repeat.set(3, 2);
  panelTex.bump.repeat.set(3, 2);
  disposables.push(panelTex.albedo, panelTex.bump);

  const corrTex = createPanelTextureSet('corrugated', '#475569', map.accentColor, renderer);
  corrTex.albedo.repeat.set(2, 1);
  corrTex.bump.repeat.set(2, 1);
  disposables.push(corrTex.albedo, corrTex.bump);

  const crateTex = createPanelTextureSet('crate', '#334155', map.accentColor, renderer);
  disposables.push(crateTex.albedo, crateTex.bump);

  const barrelTex = createPanelTextureSet('barrel', '#9a3412', map.accentColor, renderer);
  disposables.push(barrelTex.albedo, barrelTex.bump);

  const aoTex = createContactAoTexture();
  disposables.push(aoTex);

  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.78,
  });
  disposables.push(aoMat);

  // Extended terrain beyond playable bounds
  const terrainGeo = new THREE.PlaneGeometry(420, 420);
  terrainGeo.rotateX(-Math.PI / 2);
  const terrainMat = new THREE.MeshStandardMaterial({
    map: groundTex.albedo,
    bumpMap: groundTex.bump,
    bumpScale: 0.045,
    color: 0xffffff,
    roughness: texKind === 'arctic' ? 0.65 : 0.85,
    metalness: 0.1,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.position.y = 0;
  terrainMesh.receiveShadow = true;
  root.add(terrainMesh);
  collidableMeshes.push(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // Center tactical arena court ring & lane markings on floor
  const courtRingGeo = new THREE.RingGeometry(11.6, 12.1, 48);
  courtRingGeo.rotateX(-Math.PI / 2);
  const courtRingMat = new THREE.MeshBasicMaterial({
    color: map.accentColor,
    transparent: true,
    opacity: 0.38,
  });
  const courtRing = new THREE.Mesh(courtRingGeo, courtRingMat);
  courtRing.position.y = 0.02;
  root.add(courtRing);
  disposables.push(courtRingGeo, courtRingMat);

  // Shared Architectural Materials
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.72,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.62,
    metalness: 0.48,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: map.accentColor,
    emissive: map.accentColor,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.45,
  });
  const containerMat = new THREE.MeshStandardMaterial({
    map: corrTex.albedo,
    bumpMap: corrTex.bump,
    bumpScale: 0.09,
    color: map.id === 'helios-outpost' ? '#9a5b32' : map.id === 'borealis-citadel' ? '#0284c7' : '#64748b',
    roughness: 0.56,
    metalness: 0.35,
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
      cw > cd ? cw * 0.96 : 0.16,
      0.12,
      cd > cw ? cd * 0.96 : 0.16,
    );
    const tm = new THREE.Mesh(tg, trimMat);
    tm.position.set(cx, curbHeight + 0.06, cz);
    root.add(tm);
    disposables.push(tg);
  }

  // Organic Displaced Cliff / Mountain Ridge Ring (3 variations instanced for realism)
  const cliffColor =
    map.id === 'helios-outpost' ? 0x9f5630 : map.id === 'borealis-citadel' ? 0x475569 : 0x2f3747;
  const cliffMat = new THREE.MeshStandardMaterial({
    color: cliffColor,
    bumpMap: groundTex.bump,
    bumpScale: 0.06,
    roughness: 0.9,
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
    map: panelTex.albedo,
    bumpMap: panelTex.bump,
    bumpScale: 0.055,
    color: 0xffffff,
    roughness: 0.58,
    metalness: 0.34,
  });
  disposables.push(defaultBoxMat);

  for (const b of map.boxes) {
    const mat = b.color
      ? new THREE.MeshStandardMaterial({
          map: panelTex.albedo,
          bumpMap: panelTex.bump,
          bumpScale: 0.05,
          color: b.color,
          roughness: b.kind === 'tower' ? 0.48 : 0.65,
          metalness: b.kind === 'tower' ? 0.45 : 0.28,
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
      disposables,
      steelMat,
      trimMat,
      containerMat,
      darkMat,
      aoMat,
      map.accentColor,
    );
  }

  // Ramps with Tread Surface & Yellow Guide Curbs
  const rampMat = new THREE.MeshStandardMaterial({
    map: panelTex.albedo,
    bumpMap: panelTex.bump,
    bumpScale: 0.05,
    color: map.structureTint,
    roughness: 0.52,
    metalness: 0.42,
  });
  disposables.push(rampMat);
  for (const r of map.ramps) {
    const rampMesh = createRampMesh(r, rampMat);
    root.add(rampMesh);
    collidableMeshes.push(rampMesh);
    disposables.push(rampMesh.geometry);
  }

  // Jump Pads (3-part composite grounded emitter + soft point light)
  const padBaseGeo = new THREE.CylinderGeometry(1.55, 1.8, 0.24, 24);
  const padRingGeo = new THREE.TorusGeometry(1.18, 0.11, 10, 28);
  const padCoreGeo = new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24);
  const padGlowMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.6,
    roughness: 0.2,
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

  // Dynamic Rigid-Body Crates & Rolling Hazard Barrels
  const crateMat = new THREE.MeshStandardMaterial({
    map: crateTex.albedo,
    bumpMap: crateTex.bump,
    bumpScale: 0.08,
    color: 0xffffff,
    roughness: 0.48,
    metalness: 0.44,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    map: barrelTex.albedo,
    bumpMap: barrelTex.bump,
    bumpScale: 0.08,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.58,
  });
  disposables.push(crateMat, barrelMat);

  for (const c of map.crates) {
    const kind = c.kind ?? 'crate';
    const geo =
      kind === 'barrel'
        ? new THREE.CylinderGeometry(c.size * 0.36, c.size * 0.36, c.size * 1.15, 16)
        : new THREE.BoxGeometry(c.size, c.size, c.size);
    const mesh = new THREE.Mesh(geo, kind === 'barrel' ? barrelMat : crateMat);
    mesh.position.set(c.x, c.y, c.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.crateId = c.id;
    root.add(mesh);
    crateMeshes.set(c.id, mesh);
    collidableMeshes.push(mesh);
    disposables.push(geo);
  }

  // Web-sourced GLB Props (CesiumMilkTruck.glb + DamagedHelmet.glb) + Grounded Contact Shadow
  for (const prop of map.glbProps) {
    if (prop.model === 'truck') {
      const aoGeo = new THREE.PlaneGeometry(5.6, 3.2);
      aoGeo.rotateX(-Math.PI / 2);
      const aoMesh = new THREE.Mesh(aoGeo, aoMat);
      aoMesh.position.set(prop.x, prop.y + 0.015, prop.z);
      aoMesh.rotation.y = prop.rotY;
      root.add(aoMesh);
      disposables.push(aoGeo);
    }

    const asset = assetRegistry.getCached(prop.model);
    if (asset) {
      const clone = asset.scene.clone(true);
      clone.position.set(prop.x, prop.y, prop.z);
      clone.rotation.y = prop.rotY;
      clone.scale.setScalar(prop.scale);
      clone.traverse((child) => {
        const m = child as THREE.Mesh;
        if (m.isMesh) {
          m.castShadow = true;
          m.receiveShadow = true;
          collidableMeshes.push(m);
        }
      });
      root.add(clone);
      if (prop.model === 'helmet') {
        relicGroup = clone;
      }
    } else if (prop.model === 'helmet') {
      const fallback = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), trimMat);
      fallback.position.set(prop.x, prop.y, prop.z);
      root.add(fallback);
      relicGroup = fallback;
      disposables.push(fallback.geometry);
    } else if (prop.model === 'truck') {
      const g = new THREE.Group();
      g.position.set(prop.x, prop.y, prop.z);
      g.rotation.y = prop.rotY;
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.2, 2.3), darkMat);
      hull.position.y = 1.3;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.5, 2.1), trimMat);
      cab.position.set(2.0, 0.95, 0);
      g.add(hull, cab);
      root.add(g);
      collidableMeshes.push(hull, cab);
      disposables.push(hull.geometry, cab.geometry);
    }
  }

  scene.add(root);

  return {
    root,
    crateMeshes,
    jumpPadRings,
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
