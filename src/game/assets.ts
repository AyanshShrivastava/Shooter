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
  helmet: '/models/DamagedHelmet.glb',
  barrel: '/models/barrel/model.gltf',
  ammo_box: '/models/ammo_box/model.gltf',
  barrier: '/models/barrier/model.gltf',
  rock: '/models/rock/model.gltf',
  container: '/models/container/model.gltf',
  bench: '/models/bench/model.gltf',
  picnic_table: '/models/picnic_table/model.gltf',
  planter: '/models/planter/model.gltf',
  bookshelf: '/models/bookshelf/model.gltf',
  table: '/models/table/model.gltf',
} as const;

export type GlbAssetKey = keyof typeof ASSET_URLS;

class AssetRegistry {
  private loader = new GLTFLoader();
  private cache = new Map<GlbAssetKey, LoadedGlbAsset>();
  private inflight = new Map<GlbAssetKey, Promise<LoadedGlbAsset | null>>();

  public preloadAll(): Promise<void> {
    return Promise.all(
      (Object.keys(ASSET_URLS) as GlbAssetKey[]).map((key) => this.load(key)),
    ).then(() => undefined);
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

  public instantiateDynamicProp(kind: 'crate' | 'barrel', size: number): THREE.Group | null {
    const key: GlbAssetKey = kind === 'barrel' ? 'barrel' : 'container';
    const asset = this.cache.get(key);
    if (!asset) return null;

    const wrapper = new THREE.Group();
    const clone = asset.scene.clone(true);
    const box = new THREE.Box3().setFromObject(clone);
    const dims = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(dims);
    box.getCenter(center);

    const targetHeight = kind === 'barrel' ? size * 1.15 : size;
    const scale = targetHeight / Math.max(0.05, dims.y);
    clone.scale.setScalar(scale);
    // Center around (0, 0, 0) so it matches Cannon rigid-body center of mass
    clone.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
    clone.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
    wrapper.add(clone);
    return wrapper;
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
        cloned.rotation.y = 0; // Soldier already faces -Z forward
      }

      cloned.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          mesh.receiveShadow = true;
        }
      });

      root.add(cloned);

      const badgeMat = new THREE.MeshStandardMaterial({
        color: tintHex,
        emissive: tintHex,
        emissiveIntensity: 1.15,
        roughness: 0.2,
        metalness: 0.6,
      });
      const chestBeacon = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.032, 0.04), badgeMat);
      chestBeacon.position.set(0, 1.32, -0.14);
      root.add(chestBeacon);

      // Held 3rd-person multi-part tactical rifle (pointing -Z forward)
      const tpGun = new THREE.Group();
      tpGun.position.set(0.22, 1.12, -0.34);
      const gunBodyMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.34,
        metalness: 0.82,
        flatShading: true,
      });
      const gunGripMat = new THREE.MeshStandardMaterial({
        color: 0x09090b,
        roughness: 0.82,
        metalness: 0.15,
        flatShading: true,
      });
      const gunBody = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.56), gunBodyMat);
      const gunBarrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.36, 6),
        gunBodyMat,
      );
      gunBarrel.rotation.x = Math.PI / 2;
      gunBarrel.position.set(0, 0.02, -0.38);
      const gunMag = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.16, 0.07), gunGripMat);
      gunMag.position.set(0, -0.1, -0.08);
      gunMag.rotation.x = 0.2;
      const gunOptic = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.045, 0.14), gunGripMat);
      gunOptic.position.set(0, 0.082, -0.06);
      const gunGlow = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.02, 0.24), badgeMat);
      gunGlow.position.set(0, 0.03, -0.06);
      tpGun.add(gunBody, gunBarrel, gunMag, gunOptic, gunGlow);
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
    roughness: 0.5,
    metalness: 0.45,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.8,
    metalness: 0.15,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: accentHex,
    emissive: accentHex,
    emissiveIntensity: 1.1,
    roughness: 0.15,
    metalness: 0.8,
  });

  const legGeo = new THREE.BoxGeometry(0.18, 0.72, 0.22);
  const leftLeg = new THREE.Mesh(legGeo, darkMat);
  leftLeg.position.set(-0.14, 0.36, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, darkMat);
  rightLeg.position.set(0.14, 0.36, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.32), armorMat);
  torso.position.set(0, 1.05, 0);
  torso.castShadow = true;
  group.add(torso);

  const pauldronGeo = new THREE.BoxGeometry(0.18, 0.2, 0.28);
  const leftPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  leftPauldron.position.set(-0.34, 1.28, 0);
  group.add(leftPauldron);

  const rightPauldron = new THREE.Mesh(pauldronGeo, armorMat);
  rightPauldron.position.set(0.34, 1.28, 0);
  group.add(rightPauldron);

  const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.34), armorMat);
  helmet.position.set(0, 1.56, 0);
  helmet.castShadow = true;
  group.add(helmet);

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.06), visorMat);
  visor.position.set(0, 1.58, -0.16);
  group.add(visor);

  const rifle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.68), darkMat);
  rifle.position.set(0.26, 1.05, -0.35);
  group.add(rifle);

  return group;
}

/**
 * Builds composite 8-12 part beveled PBR first-person weapon viewmodels
 */
export function buildFirstPersonWeaponModel(weaponId: WeaponId): THREE.Group {
  const root = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.34,
    metalness: 0.78,
    flatShading: true,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.86,
    metalness: 0.12,
    flatShading: true,
  });
  const barrelMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.22,
    metalness: 0.9,
    flatShading: true,
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
    emissiveIntensity: 1.75,
    roughness: 0.18,
    metalness: 0.45,
    flatShading: true,
  });

  if (weaponId === 'pulse-carbine') {
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.12, 0.52), bodyMat);
    receiver.position.set(0, 0, -0.12);
    const topRail = new THREE.Mesh(new THREE.BoxGeometry(0.056, 0.018, 0.44), barrelMat);
    topRail.position.set(0, 0.066, -0.16);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.018, 0.38, 12), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, -0.47);
    const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.022, 0.075, 10), gripMat);
    muzzleBrake.rotation.x = Math.PI / 2;
    muzzleBrake.position.set(0, 0.02, -0.66);
    const shroud = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.082, 0.28), gripMat);
    shroud.position.set(0, 0.01, -0.35);
    const foregrip = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.11, 0.052), gripMat);
    foregrip.position.set(0, -0.082, -0.35);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.19, 0.075), gripMat);
    mag.position.set(0, -0.13, -0.11);
    mag.rotation.x = 0.22;
    const sightFrame = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.0055, 8, 18), gripMat);
    sightFrame.position.set(0, 0.106, -0.08);
    const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8), glowMat);
    sightDot.position.set(0, 0.106, -0.08);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.092, 0.015, 0.26), glowMat);
    strip.position.set(0, 0.025, -0.16);
    root.add(receiver, topRail, barrel, muzzleBrake, shroud, foregrip, mag, sightFrame, sightDot, strip);
  } else if (weaponId === 'rail-rifle') {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.084, 0.115, 0.66), bodyMat);
    chassis.position.set(0, 0, -0.18);
    const upperRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.48), barrelMat);
    upperRail.position.set(0, 0.058, -0.44);
    const lowerRail = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.026, 0.48), barrelMat);
    lowerRail.position.set(0, -0.025, -0.44);
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.032, 0.46), glowMat);
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
