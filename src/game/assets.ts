import * as THREE from 'three';
import { GLTFLoader, GLTF } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { CharacterId, WeaponId } from '../shared/types';

export interface LoadedGlbAsset {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
}

const ASSET_URLS = {
  soldier: '/models/Soldier.glb',
  robot: '/models/RobotExpressive.glb',
  truck: '/models/CesiumMilkTruck.glb',
  helmet: '/models/DamagedHelmet.glb',
} as const;

export type GlbAssetKey = keyof typeof ASSET_URLS;

class AssetRegistry {
  private loader = new GLTFLoader();
  private cache = new Map<GlbAssetKey, LoadedGlbAsset>();
  private inflight = new Map<GlbAssetKey, Promise<LoadedGlbAsset | null>>();

  public preloadAll(): Promise<void> {
    return Promise.all([
      this.load('robot'),
      this.load('soldier'),
      this.load('truck'),
      this.load('helmet'),
    ]).then(() => undefined);
  }

  public load(key: GlbAssetKey): Promise<LoadedGlbAsset | null> {
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = new Promise<LoadedGlbAsset | null>((resolve) => {
      this.loader.load(
        ASSET_URLS[key],
        (gltf: GLTF) => {
          gltf.scene.traverse((obj) => {
            const mesh = obj as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          const asset: LoadedGlbAsset = {
            scene: gltf.scene,
            animations: gltf.animations ?? [],
          };
          this.cache.set(key, asset);
          resolve(asset);
        },
        undefined,
        () => {
          resolve(null);
        },
      );
    });

    this.inflight.set(key, promise);
    return promise;
  }

  public getCached(key: GlbAssetKey): LoadedGlbAsset | null {
    return this.cache.get(key) ?? null;
  }

  public instantiateCharacter(
    characterId: CharacterId,
    tintHex: number,
  ): {
    root: THREE.Group;
    mixer: THREE.AnimationMixer | null;
    actions: { idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; run?: THREE.AnimationAction };
    isGlb: boolean;
  } {
    const key: GlbAssetKey = characterId === 'vanguard-soldier' ? 'soldier' : 'robot';
    const asset = this.cache.get(key);

    if (asset) {
      const cloned = SkeletonUtils.clone(asset.scene) as THREE.Group;
      const root = new THREE.Group();
      if (key === 'robot') {
        cloned.scale.setScalar(0.44);
        cloned.rotation.y = Math.PI; // Robot faces +Z in source; flip to -Z forward
      } else {
        cloned.scale.setScalar(1.0);
        // Soldier.glb already faces -Z forward in source
        cloned.rotation.y = 0;
      }

      cloned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      root.add(cloned);

      // Subtle faction visor/shoulder light ring grounded on actor
      const badgeMat = new THREE.MeshStandardMaterial({
        color: tintHex,
        emissive: tintHex,
        emissiveIntensity: 0.75,
        roughness: 0.25,
        metalness: 0.5,
      });
      const chestBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.08), badgeMat);
      chestBeacon.position.set(0, 1.38, -0.2);
      root.add(chestBeacon);

      // Held 3rd-person tactical weapon silhouette (pointing -Z forward)
      const tpGun = new THREE.Group();
      tpGun.position.set(0.22, 1.12, -0.32);
      const gunBodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.38,
        metalness: 0.78,
      });
      const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.54), gunBodyMat);
      const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.34, 8),
        gunBodyMat,
      );
      gunBarrel.rotation.x = Math.PI / 2;
      gunBarrel.position.set(0, 0.02, -0.36);
      const gunGlow = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.02, 0.22), badgeMat);
      gunGlow.position.set(0, 0.03, -0.05);
      tpGun.add(gunBody, gunBarrel, gunGlow);
      root.add(tpGun);

      const mixer = new THREE.AnimationMixer(cloned);
      const findClip = (names: string[]) => {
        for (const n of names) {
          const c = THREE.AnimationClip.findByName(asset.animations, n);
          if (c) return c;
        }
        return asset.animations[0];
      };

      const idleClip = findClip(['Idle']);
      const walkClip = findClip(['Walking', 'Walk']);
      const runClip = findClip(['Running', 'Run']);

      const idle = idleClip ? mixer.clipAction(idleClip) : undefined;
      const walk = walkClip ? mixer.clipAction(walkClip) : undefined;
      const run = runClip ? mixer.clipAction(runClip) : undefined;

      idle?.play();
      if (walk) {
        walk.play();
        walk.setEffectiveWeight(0);
      }
      if (run) {
        run.play();
        run.setEffectiveWeight(0);
      }

      return { root, mixer, actions: { idle, walk, run }, isGlb: true };
    }

    // High-craft 8-part composite procedural character fallback while GLB streams
    return {
      root: createProceduralOperative(tintHex),
      mixer: null,
      actions: {},
      isGlb: false,
    };
  }
}

export const assetRegistry = new AssetRegistry();

export function createProceduralOperative(accentHex: number): THREE.Group {
  const group = new THREE.Group();
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.55,
    metalness: 0.35,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.15,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 0.85,
    roughness: 0.15,
    metalness: 0.8,
  });

  // Boots + legs (pivot at y=0 bottom-center)
  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.22);
  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.14, 0.36, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.14, 0.36, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  // Torso chestplate
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.32), armorMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = true;
  group.add(torso);

  // Pauldrons
  const pauldronGeo = new THREE.BoxGeometry(0.18, 0.2, 0.28);
  const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  leftPauldron.position.set(-0.34, 1.28, 0);
  group.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  rightPauldron.position.set(0.34, 1.28, 0);
  group.add(rightPauldron);

  // Helmet + emissive tactical visor facing -Z
  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.34), armorMat);
  helmet.position.set(0, 1.56, 0);
  helmet.castShadow = true;
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), visorMat);
  visor.position.set(0, 1.58, -0.16);
  group.add(visor);

  // Tactical rifle silhouette held forward
  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.68), darkMat);
  rifle.position.set(0.26, 1.05, -0.35);
  group.add(rifle);

  return group;
}

/**
 * Builds composite 5-8 part first-person tactical weapon viewmodels
 */
export function buildFirstPersonWeaponModel(weaponId: WeaponId): THREE.Group {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.42,
    metalness: 0.72,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.85,
    metalness: 0.12,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.22,
    metalness: 0.9,
  });

  const accentColor =
    weaponId === 'rail-rifle'
      ? 0x06b6d4
      : weaponId === 'scatter-gun'
        ? 0xf97316
        : weaponId === 'frag-launcher'
          ? 0xef4444
          : 0xf59e0b;

  const glowMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.5,
  });

  if (weaponId === 'pulse-carbine') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.12, 0.5), bodyMat);
    receiver.position.set(0, 0, -0.12);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.38, 12), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.47);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.022, 0.07, 10), gripMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, -0.66);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.08, 0.26), gripMat);
    shroud.position.set(0, 0.01, -0.35);
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.05), gripMat);
    foregrip.position.set(0, -0.08, -0.35);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.19, 0.075), gripMat);
    mag.position.set(0, -0.13, -0.11);
    mag.rotation.x = 0.22;
    const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.024, 0.14), barrelMat);
    sightBase.position.set(0, 0.072, -0.08);
    const sightFrame = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.005, 6, 16), gripMat);
    sightFrame.position.set(0, 0.105, -0.08);
    const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), glowMat);
    sightDot.position.set(0, 0.105, -0.08);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.015, 0.26), glowMat);
    strip.position.set(0, 0.025, -0.16);
    root.add(receiver, barrel, muzzleBrake, shroud, foregrip, mag, sightBase, sightFrame, sightDot, strip);
  } else if (weaponId === 'rail-rifle') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.115, 0.64), bodyMat);
    chassis.position.set(0, 0, -0.18);
    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.48), barrelMat);
    upperRail.position.set(0, 0.058, -0.44);
    const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.48), barrelMat);
    lowerRail.position.set(0, -0.025, -0.44);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.032, 0.44), glowMat);
    core.position.set(0, 0.016, -0.43);
    const scopeTube = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.024, 0.24, 14), gripMat);
    scopeTube.rotation.x = Math.PI / 2;
    scopeTube.position.set(0, 0.098, -0.13);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.021, 14), glowMat);
    lens.position.set(0, 0.098, -0.008);
    lens.rotation.y = Math.PI;
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.18), gripMat);
    stock.position.set(0, -0.01, 0.16);
    root.add(chassis, upperRail, lowerRail, core, scopeTube, lens, stock);
  } else if (weaponId === 'scatter-gun') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.46), bodyMat);
    body.position.set(0, -0.01, -0.12);
    const twinBarrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 12), barrelMat);
    twinBarrelL.rotation.x = Math.PI / 2;
    twinBarrelL.position.set(-0.026, 0.025, -0.43);
    const twinBarrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.38, 12), barrelMat);
    twinBarrelR.rotation.x = Math.PI / 2;
    twinBarrelR.position.set(0.026, 0.025, -0.43);
    const pump = new THREE.Mesh(new THREE.BoxGeometry(0.098, 0.068, 0.2), gripMat);
    pump.position.set(0, -0.03, -0.37);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.116, 0.022, 0.18), glowMat);
    vent.position.set(0, 0.03, -0.14);
    const ironSight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 0.03), glowMat);
    ironSight.position.set(0, 0.065, -0.58);
    root.add(body, twinBarrelL, twinBarrelR, pump, vent, ironSight);
  } else {
    // Frag Launcher
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.42), bodyMat);
    frame.position.set(0, -0.02, -0.1);
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.18, 14), gripMat);
    drum.rotation.x = Math.PI / 2;
    drum.position.set(0, -0.04, -0.14);
    const muzzleTube = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.34, 16), barrelMat);
    muzzleTube.rotation.x = Math.PI / 2;
    muzzleTube.position.set(0, 0.02, -0.37);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.011, 8, 16), glowMat);
    ring.position.set(0, 0.02, -0.52);
    const sightPost = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.04, 0.08), barrelMat);
    sightPost.position.set(0, 0.08, -0.08);
    root.add(frame, drum, muzzleTube, ring, sightPost);
  }

  return root;
}
