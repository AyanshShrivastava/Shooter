import * as THREE from 'three';
import { ArenaMapSpec, MapBox, MapRamp } from '../shared/maps';
import { assetRegistry } from './assets';

export interface BuiltArenaScene {
  root: THREE.Group;
  crateMeshes: Map<string, THREE.Object3D>;
  jumpPadRings: THREE.Mesh[];
  radarDishes: THREE.Object3D[];
  ambientMotes: THREE.Points | null;
  cloudLayer: THREE.Object3D | null;
  relicGroup: THREE.Object3D | null;
  collidableMeshes: THREE.Object3D[];
  dispose: () => void;
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
 * Generates a crisp, low-noise architectural panel texture for the playable combat floor
 * so players, cover silhouettes, and enemy tracers read cleanly under ACES lighting.
 */
function createLowPolyFloorMaps(
  map: ArenaMapSpec,
  renderer: THREE.WebGLRenderer,
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 256;
  const cColor = document.createElement('canvas');
  cColor.width = size;
  cColor.height = size;
  const ctx = cColor.getContext('2d')!;

  const cRough = document.createElement('canvas');
  cRough.width = size;
  cRough.height = size;
  const rCtx = cRough.getContext('2d')!;

  const baseHex =
    map.id === 'helios-outpost'
      ? '#c89b6e'
      : map.id === 'borealis-citadel'
        ? '#cbd5e1'
        : map.id === 'estate-garden'
          ? '#3f6212'
          : map.id === 'safehouse-manor'
            ? '#78350f'
            : map.id === 'neon-rooftop'
              ? '#0f172a'
              : map.id === 'oasis-temple'
                ? '#d97706'
                : '#3c424d';
  const altHex =
    map.id === 'helios-outpost'
      ? '#be8e61'
      : map.id === 'borealis-citadel'
        ? '#b8c7d9'
        : map.id === 'estate-garden'
          ? '#4d7c0f'
          : map.id === 'safehouse-manor'
            ? '#92400e'
            : map.id === 'neon-rooftop'
              ? '#1e293b'
              : map.id === 'oasis-temple'
                ? '#b45309'
                : '#353b46';
  const seamHex =
    map.id === 'helios-outpost'
      ? '#9a6e46'
      : map.id === 'borealis-citadel'
        ? '#8da2bc'
        : map.id === 'estate-garden'
          ? '#84cc16'
          : map.id === 'safehouse-manor'
            ? '#451a03'
            : map.id === 'neon-rooftop'
              ? '#06b6d4'
              : map.id === 'oasis-temple'
                ? '#78350f'
                : '#242830';

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  rCtx.fillStyle = map.id === 'borealis-citadel' ? '#9a9a9a' : '#d2d2d2';
  rCtx.fillRect(0, 0, size, size);

  // Subtle checkerboard slab contrast (low-poly stylized floor)
  ctx.fillStyle = altHex;
  ctx.fillRect(0, 0, size / 2, size / 2);
  ctx.fillRect(size / 2, size / 2, size / 2, size / 2);

  rCtx.fillStyle = map.id === 'borealis-citadel' ? '#7a7a7a' : '#bdbdbd';
  rCtx.fillRect(0, 0, size / 2, size / 2);
  rCtx.fillRect(size / 2, size / 2, size / 2, size / 2);

  // Clean architectural slab seams & corner anchor dots
  ctx.strokeStyle = seamHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, size - 4, size - 4);
  ctx.beginPath();
  ctx.moveTo(size / 2, 0);
  ctx.lineTo(size / 2, size);
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  rCtx.strokeStyle = '#ececec';
  rCtx.lineWidth = 4;
  rCtx.strokeRect(2, 2, size - 4, size - 4);

  // Subtle surface micro-speckle (non-noisy)
  const rand = seededRand(map.id.length * 131);
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const w = 4 + rand() * 8;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(x, y, w, w);
  }

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const repeat = Math.round(map.halfExtent * 0.65);

  const colorTex = new THREE.CanvasTexture(cColor);
  colorTex.colorSpace = THREE.SRGBColorSpace;
  colorTex.wrapS = THREE.RepeatWrapping;
  colorTex.wrapT = THREE.RepeatWrapping;
  colorTex.repeat.set(repeat, repeat);
  colorTex.anisotropy = maxAniso;

  const roughTex = new THREE.CanvasTexture(cRough);
  roughTex.colorSpace = THREE.NoColorSpace;
  roughTex.wrapS = THREE.RepeatWrapping;
  roughTex.wrapT = THREE.RepeatWrapping;
  roughTex.repeat.set(repeat, repeat);
  roughTex.anisotropy = maxAniso;

  return { map: colorTex, roughnessMap: roughTex };
}

function createLowPolyArmorBump(renderer: THREE.WebGLRenderer): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = '#929292';
  ctx.fillRect(14, 14, size - 28, 10);
  ctx.fillRect(14, size - 24, size - 28, 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function createContactAoTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, size * 0.14, size / 2, size / 2, size * 0.5);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.58)');
  grad.addColorStop(0.62, 'rgba(0, 0, 0, 0.22)');
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
  const geo = new THREE.SphereGeometry(280, 24, 14);
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

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.15, 1.0);
        // Smooth atmospheric Rayleigh-style vertical transition
        float t = pow(smoothstep(-0.02, 0.65, h), 0.78);
        vec3 col = mix(uHorizon, uTop, t);

        // Warm Mie scatter halo around the sun azimuth
        float sunAmt = max(dot(d, uSunDir), 0.0);
        col += uSun * pow(sunAmt, 6.0) * 0.24 * (1.0 - smoothstep(0.2, 0.85, h) * 0.5);
        col += uSun * pow(sunAmt, 24.0) * 0.45;
        col += uSun * smoothstep(0.9965, 0.9992, sunAmt) * 1.85;

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Generates faceted low-poly terrain surrounding the combat arena with vertex-colored elevation bands
 * (valley floor -> mid slope -> sunlit crest) so natural ridges catch directional sun & sky fill.
 */
function createLowPolyOuterTerrain(map: ArenaMapSpec): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(460, 460, 56, 56);
  geo.rotateX(-Math.PI / 2);

  // Convert to non-indexed so every triangle gets crisp faceted low-poly normals & vertex colors
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
            : 19;

  const lowCol = new THREE.Color(
    map.id === 'helios-outpost'
      ? '#9b5c34'
      : map.id === 'borealis-citadel'
        ? '#5b728f'
        : map.id === 'estate-garden'
          ? '#2d5016'
          : map.id === 'safehouse-manor'
            ? '#292524'
            : map.id === 'neon-rooftop'
              ? '#020617'
              : map.id === 'oasis-temple'
                ? '#b45309'
                : '#222731',
  );
  const midCol = new THREE.Color(
    map.id === 'helios-outpost'
      ? '#b87042'
      : map.id === 'borealis-citadel'
        ? '#89a3bf'
        : map.id === 'estate-garden'
          ? '#4d7c0f'
          : map.id === 'safehouse-manor'
            ? '#57534e'
            : map.id === 'neon-rooftop'
              ? '#0f172a'
              : map.id === 'oasis-temple'
                ? '#d97706'
                : '#343c4a',
  );
  const peakCol = new THREE.Color(
    map.id === 'helios-outpost'
      ? '#d69767'
      : map.id === 'borealis-citadel'
        ? '#dce8f5'
        : map.id === 'estate-garden'
          ? '#a3e635'
          : map.id === 'safehouse-manor'
            ? '#ea580c'
            : map.id === 'neon-rooftop'
              ? '#06b6d4'
              : map.id === 'oasis-temple'
                ? '#fde68a'
                : '#4c5566',
  );
  const cTmp = new THREE.Color();

  const heightAt = (x: number, z: number) => {
    const edgeDist = Math.max(Math.abs(x), Math.abs(z)) - (map.halfExtent + 3.5);
    if (edgeDist <= 0) return -0.04;
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

    const hNorm = Math.max(0, Math.min(1, vy / 24));
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
 * Generates a biome-matched PMREM environment cubemap from the arena's sky, sun & ground colors
 * so metallic weapons, armor, helmets, and low-poly facets reflect authentic outdoor light.
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
          ? mix(uHor * 1.15, uTop * 1.25, smoothstep(0.0, 0.72, y))
          : mix(uHor * 0.72, uGround * 0.85, smoothstep(0.0, -0.58, y));
        vec3 sunDir = normalize(vec3(0.65, 0.72, 0.38));
        float sunDot = max(dot(vPos, sunDir), 0.0);
        col += uSun * pow(sunDot, 18.0) * 6.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  envScene.add(dome);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(envScene, 0.035).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 1.25;

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
    const aoGeo = new THREE.PlaneGeometry(b.w + 2.8, b.d + 2.8);
    aoGeo.rotateX(-Math.PI / 2);
    const aoMesh = new THREE.Mesh(aoGeo, aoMat);
    aoMesh.position.set(b.x, 0.014, b.z);
    root.add(aoMesh);
    disposables.push(aoGeo);
  }

  if (b.kind === 'core' || b.kind === 'tower') {
    // Low-poly beveled octagonal plinth
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
    const collarGeo = new THREE.BoxGeometry(b.w + 0.22, 0.18, b.d + 0.22);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.16, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    // Tapered low-poly corner buttresses
    const buttressGeo = new THREE.CylinderGeometry(0.24, 0.42, b.h, 6);
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

    const beacon = new THREE.PointLight(accentColor, 5.2, 26, 1.5);
    beacon.position.set(b.x, b.y + b.h + 1.6, b.z);
    root.add(beacon);

    // Decorative Fountain Water Pool for Estate Gardens
    if (b.id === 'fountain-base') {
      const waterGeo = new THREE.CylinderGeometry(b.w * 0.44, b.w * 0.44, 0.08, 16);
      const waterMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.12,
        metalness: 0.55,
        flatShading: true,
      });
      const waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.set(b.x, b.y + b.h - 0.04, b.z);
      root.add(waterMesh);
      disposables.push(waterGeo, waterMat);
    }
  } else if (b.kind === 'bridge') {
    const capGeo = new THREE.BoxGeometry(b.w + 0.3, 0.22, b.d + 0.3);
    const cap = new THREE.Mesh(capGeo, steelMat);
    cap.position.set(b.x, b.y + b.h - 0.11, b.z);
    cap.receiveShadow = true;
    root.add(cap);
    disposables.push(capGeo);

    const collarGeo = new THREE.BoxGeometry(b.w + 0.34, 0.08, b.d + 0.34);
    const collar = new THREE.Mesh(collarGeo, trimMat);
    collar.position.set(b.x, b.y + b.h - 0.25, b.z);
    root.add(collar);
    disposables.push(collarGeo);

    // Classical Pavilion Gazebo Columns & Conical Dome Roof
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
        roughness: 0.65,
        metalness: 0.22,
        flatShading: true,
      });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(b.x, b.y + b.h + 4.4 + 1.7, b.z);
      roof.castShadow = true;
      root.add(roof);
      disposables.push(colGeo, roofGeo, roofMat);
    } else {
      // Low-poly corner stanchion posts with glowing tips
      const pilGeo = new THREE.CylinderGeometry(0.18, 0.24, b.h + 0.9, 6);
      const corners: Array<[number, number]> = [
        [-b.w * 0.5 + 0.22, -b.d * 0.5 + 0.22],
        [b.w * 0.5 - 0.22, -b.d * 0.5 + 0.22],
        [-b.w * 0.5 + 0.22, b.d * 0.5 - 0.22],
        [b.w * 0.5 - 0.22, b.d * 0.5 - 0.22],
      ];
      for (const [ox, oz] of corners) {
        const p = new THREE.Mesh(pilGeo, darkMat);
        p.position.set(b.x + ox, b.y + (b.h + 0.9) * 0.5, b.z + oz);
        p.castShadow = true;
        root.add(p);
      }
      disposables.push(pilGeo);
    }
  } else if (b.kind === 'tower') {
    // Hearth Fireplace Point Light for Safehouse Manor
    if (b.id === 'chimney-stack') {
      const hearth = new THREE.PointLight(0xf97316, 4.4, 16, 1.4);
      hearth.position.set(b.x, b.y + 1.6, b.z + 2.4);
      root.add(hearth);
    }
    const bandGeo = new THREE.BoxGeometry(b.w + 0.18, 0.28, b.d + 0.18);
    const band1 = new THREE.Mesh(bandGeo, darkMat);
    band1.position.set(b.x, b.y + b.h * 0.52, b.z);
    const band2 = new THREE.Mesh(bandGeo, trimMat);
    band2.position.set(b.x, b.y + b.h - 0.3, b.z);
    band2.scale.set(1.03, 0.45, 1.03);

    // Tapered low-poly roof pyramid cap
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

    root.add(band1, band2, roof, mast, dishPivot);
    disposables.push(bandGeo, roofGeo, mastGeo, dishBarGeo, dishTipGeo);
  } else if (b.kind === 'cover') {
    const shellGeo = new THREE.BoxGeometry(b.w + 0.06, b.h - 0.22, b.d + 0.06);
    const shell = new THREE.Mesh(shellGeo, containerMat);
    shell.position.set(b.x, b.y + b.h * 0.5, b.z);
    shell.castShadow = true;
    shell.receiveShadow = true;
    const capGeo = new THREE.BoxGeometry(b.w + 0.16, 0.18, b.d + 0.16);
    const cap = new THREE.Mesh(capGeo, darkMat);
    cap.position.set(b.x, b.y + b.h - 0.09, b.z);
    const stripeGeo = new THREE.BoxGeometry(b.w + 0.1, 0.08, b.d + 0.1);
    const stripe = new THREE.Mesh(stripeGeo, trimMat);
    stripe.position.set(b.x, b.y + 0.34, b.z);
    root.add(shell, cap, stripe);
    disposables.push(shellGeo, capGeo, stripeGeo);
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
    // Low-poly snow-dusted pine trees outside perimeter
    const count = 34;
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.45, 2.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x4a3525,
      roughness: 0.9,
      flatShading: true,
    });
    const foliageGeo = new THREE.ConeGeometry(2.1, 4.6, 6);
    const foliageMat = new THREE.MeshStandardMaterial({
      color: 0x1e4d45,
      roughness: 0.84,
      flatShading: true,
    });
    const snowCapGeo = new THREE.ConeGeometry(1.45, 2.2, 6);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.55,
      flatShading: true,
    });

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
    // Low-poly stepped canyon rock spires & desert boulders
    const count = 28;
    const mesaGeo = new THREE.CylinderGeometry(1.8, 3.6, 7.5, 6);
    const mesaMat = new THREE.MeshStandardMaterial({
      color: 0xb9683a,
      roughness: 0.9,
      flatShading: true,
    });
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
    // Low-poly Italian Cypress trees + blooming flowering hydrangea / rose bushes
    const treeCount = 30;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4033,
      roughness: 0.9,
      flatShading: true,
    });
    const cypressGeo = new THREE.ConeGeometry(1.35, 6.2, 6);
    const cypressMat = new THREE.MeshStandardMaterial({
      color: 0x14532d,
      roughness: 0.82,
      flatShading: true,
    });
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

    // Blooming floral shrubs along outer lawn
    const bushCount = 36;
    const bushGeo = new THREE.DodecahedronGeometry(0.95, 0);
    const bushMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.85,
      flatShading: true,
    });
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
    // Scandinavian mountain spruce pines + low-poly A-frame cabins in distant hills
    const count = 32;
    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.45, 2.5, 6);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x451a03,
      roughness: 0.9,
      flatShading: true,
    });
    const spruceGeo = new THREE.ConeGeometry(2.3, 4.4, 6);
    const spruceMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a2f,
      roughness: 0.85,
      flatShading: true,
    });
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

    // Distant low-poly A-frame cabins
    const cabinCount = 10;
    const cabinGeo = new THREE.BoxGeometry(4.2, 2.8, 5.2);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.8,
      flatShading: true,
    });
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
    // Low-poly futuristic skyscraper towers in surrounding cityscape
    const towerCount = 32;
    const towerGeo = new THREE.BoxGeometry(12, 60, 12);
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.85,
      metalness: 0.35,
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
    // Low-poly oasis palm trees & ancient stone colonnades
    const count = 28;
    const trunkGeo = new THREE.CylinderGeometry(0.24, 0.44, 7.0, 5);
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
      flatShading: true,
    });
    const canopyGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: 0x15803d,
      roughness: 0.75,
      flatShading: true,
    });
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
  } else {
    // Low-poly volcanic slag crystal clusters around Obsidian Foundry
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
  const crateMeshes = new Map<string, THREE.Object3D>();
  const jumpPadRings: THREE.Mesh[] = [];
  const radarDishes: THREE.Object3D[] = [];
  let relicGroup: THREE.Object3D | null = null;

  scene.background = new THREE.Color(map.fogColor);
  scene.fog = new THREE.FogExp2(map.fogColor, map.fogDensity);

  const sunPosition = new THREE.Vector3(48, 56, 30);

  // Atmospheric Sky Dome with Sun Disc & Rayleigh/Mie scattering
  const skyDome = createSkyDome(map.skyTopColor, map.skyHorizonColor, map.sunColor, sunPosition);
  root.add(skyDome);
  disposables.push(skyDome.geometry, skyDome.material as THREE.Material);

  // Stylized Low-Poly Floating Sky Clouds (InstancedMesh)
  const cloudCount = 36;
  const cloudGeo = new THREE.IcosahedronGeometry(1, 0);
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.95,
    metalness: 0.0,
    flatShading: true,
    transparent: true,
    opacity: 0.88,
  });
  const cloudInst = new THREE.InstancedMesh(cloudGeo, cloudMat, cloudCount);
  const cloudDummy = new THREE.Object3D();
  const cloudRand = seededRand(503);
  for (let i = 0; i < cloudCount; i++) {
    const clusterAngle = (Math.floor(i / 3) / 12) * Math.PI * 2 + (cloudRand() - 0.5) * 0.2;
    const clusterDist = 85 + (i % 4) * 28;
    cloudDummy.position.set(
      Math.cos(clusterAngle) * clusterDist + (cloudRand() - 0.5) * 14,
      54 + cloudRand() * 18,
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

  // Realistic Three-Point Outdoor Lighting Rig (Warm Sun Key + Cool Sky Hemisphere + Rim)
  const hemi = new THREE.HemisphereLight(map.hemiSkyColor, map.hemiGroundColor, 1.25);
  root.add(hemi);

  const keyLight = new THREE.DirectionalLight(map.sunColor, map.sunIntensity * 1.08);
  keyLight.position.copy(sunPosition);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  const d = map.halfExtent + 12;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.camera.near = 6;
  keyLight.shadow.camera.far = 175;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.022;
  keyLight.shadow.radius = 2.4;
  root.add(keyLight);

  const rimLight = new THREE.DirectionalLight(map.hemiSkyColor, 0.85);
  rimLight.position.set(-42, 26, -38);
  root.add(rimLight);

  // Playable Arena Low-Poly Architectural Floor + Sculpted Faceted Valley Surround
  const floorMaps = createLowPolyFloorMaps(map, renderer);
  const armorBump = createLowPolyArmorBump(renderer);
  const aoTex = createContactAoTexture();
  const moteTex = createSoftParticleTexture();
  disposables.push(floorMaps.map, floorMaps.roughnessMap, armorBump, aoTex, moteTex);

  const aoMat = new THREE.MeshBasicMaterial({
    map: aoTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.72,
  });
  disposables.push(aoMat);

  const floorSize = (map.halfExtent + 3.5) * 2;
  const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorMaps.map,
    roughnessMap: floorMaps.roughnessMap,
    color: 0xffffff,
    roughness: map.id === 'borealis-citadel' ? 0.52 : 0.86,
    metalness: map.id === 'obsidian-foundry' ? 0.16 : 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = true;
  root.add(floorMesh);
  collidableMeshes.push(floorMesh);
  disposables.push(floorGeo, floorMat);

  // Outer sculpted low-poly basin terrain (faceted vertex-colored hills/dunes/glaciers)
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

  // Center tactical arena court ring & inner octagon line
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

  // Low-Poly Stylized PBR Materials (strong matte-vs-metallic roughness separation + flatShading)
  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    bumpMap: armorBump,
    bumpScale: 0.015,
    roughness: 0.34,
    metalness: 0.78,
    flatShading: true,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x181c24,
    roughness: 0.72,
    metalness: 0.25,
    flatShading: true,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: map.accentColor,
    emissive: map.accentColor,
    emissiveIntensity: 1.5,
    roughness: 0.2,
    metalness: 0.45,
    flatShading: true,
  });
  const containerMat = new THREE.MeshStandardMaterial({
    color: map.id === 'helios-outpost' ? '#b8683c' : map.id === 'borealis-citadel' ? '#0284c7' : '#64748b',
    bumpMap: armorBump,
    bumpScale: 0.02,
    roughness: 0.74,
    metalness: 0.18,
    flatShading: true,
  });
  disposables.push(steelMat, darkMat, trimMat, containerMat);

  // Perimeter Jersey Barrier Curbs with Illuminated Trim
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

  // Faceted Low-Poly Perimeter Cliffs & Mountain Silhouettes
  const cliffColor =
    map.id === 'helios-outpost'
      ? 0xa35832
      : map.id === 'borealis-citadel'
        ? 0x52657d
        : map.id === 'estate-garden'
          ? 0x2e5a36
          : map.id === 'safehouse-manor'
            ? 0x3d352e
            : 0x2c3340;
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

  // Structural Map Boxes + Low-Poly Architectural Dressing
  const defaultBoxMat = new THREE.MeshStandardMaterial({
    bumpMap: armorBump,
    bumpScale: 0.015,
    color: map.structureTint,
    roughness: 0.72,
    metalness: 0.24,
    flatShading: true,
  });
  disposables.push(defaultBoxMat);

  for (const b of map.boxes) {
    const mat = b.color
      ? new THREE.MeshStandardMaterial({
          bumpMap: armorBump,
          bumpScale: 0.015,
          color: b.color,
          roughness: b.kind === 'tower' ? 0.52 : 0.78,
          metalness: b.kind === 'tower' ? 0.42 : 0.16,
          flatShading: true,
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

  // Faceted Ramps with Low-Poly Side Trim
  const rampMat = new THREE.MeshStandardMaterial({
    bumpMap: armorBump,
    bumpScale: 0.014,
    color: map.structureTint,
    roughness: 0.62,
    metalness: 0.34,
    flatShading: true,
  });
  disposables.push(rampMat);
  for (const r of map.ramps) {
    const rampMesh = createRampMesh(r, rampMat);
    root.add(rampMesh);
    collidableMeshes.push(rampMesh);
    disposables.push(rampMesh.geometry);
  }

  // Jump Pads (Low-Poly Hexagonal Emitter + Glowing Torus)
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

  // Dynamic Rigid-Body Crates & Explosive Barrels
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
          ? new THREE.CylinderGeometry(c.size * 0.36, c.size * 0.36, c.size * 1.15, 8)
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

  // Web-sourced GLTF Environment Props with Auto-Grounding & Contact AO
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
        const aoGeo = new THREE.PlaneGeometry(aoW, aoD);
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

  // Atmospheric Biome Motes (Embers / Desert Dust / Arctic Snow Flurries / Pollen Motes)
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
        : map.id === 'estate-garden'
          ? 0xa7f3d0
          : map.id === 'safehouse-manor'
            ? 0xfed7aa
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
    cloudLayer: cloudInst,
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
