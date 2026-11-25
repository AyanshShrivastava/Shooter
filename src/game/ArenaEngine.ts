import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ARENA_MAPS, ArenaMapSpec } from '../shared/maps';
import {
  AppScreenState,
  CameraPerspective,
  CharacterId,
  NetPlayerState,
  WeaponId,
} from '../shared/types';
import { WEAPON_ORDER, WEAPONS } from '../shared/weapons';
import { assetRegistry, buildFirstPersonWeaponModel } from './assets';
import { tacticalAudio } from './audio';
import { buildArenaMapScene, BuiltArenaScene, setupSceneEnvironment } from './mapBuilder';
import {
  ArenaPhysicsWorld,
  CharacterMoveInput,
  CharacterMoveState,
  applyCrateImpulse,
  applyRadialExplosionImpulse,
  createArenaPhysicsWorld,
  createInitialMoveState,
  spawnPhysicsProjectile,
  stepArenaPhysicsWorld,
  stepCharacterMovement,
} from './physicsMovement';

export interface HudTelemetrySnapshot {
  hp: number;
  maxHp: number;
  ammo: number;
  magSize: number;
  reloading: boolean;
  reloadProgress: number;
  weaponId: WeaponId;
  dashReadyRatio: number;
  speedMs: number;
  sliding: boolean;
  crouching: boolean;
  grounded: boolean;
  alive: boolean;
  respawnTimer: number;
  perspective: CameraPerspective;
  hitmarkerKind: 'none' | 'hit' | 'kill';
  damageFlash: number;
  pointerLocked: boolean;
  adsHeld: boolean;
  playerPos: [number, number, number];
  playerYaw: number;
  spreadRatio: number;
}

export interface EngineCallbacks {
  onHudUpdate: (hud: HudTelemetrySnapshot) => void;
  onLocalTransform: (payload: {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    pitch: number;
    weaponId: WeaponId;
    crouching: boolean;
    sliding: boolean;
    grounded: boolean;
  }) => void;
  onLocalFire: (payload: {
    weaponId: WeaponId;
    origin: [number, number, number];
    dir: [number, number, number];
    hitTargetId?: string;
    hitPoint?: [number, number, number];
  }) => void;
  onShotStats?: (didHit: boolean) => void;
  onPointerLockChange?: (locked: boolean) => void;
}

interface RemoteActorVisual {
  id: string;
  characterId: CharacterId;
  isBot: boolean;
  root: THREE.Group;
  hitbox: THREE.Mesh;
  shadowDisc: THREE.Mesh;
  mixer: THREE.AnimationMixer | null;
  actions: { idle?: THREE.AnimationAction; walk?: THREE.AnimationAction; run?: THREE.AnimationAction };
  targetPos: THREE.Vector3;
  targetYaw: number;
  alive: boolean;
  hp: number;
  hurtFlashTimer: number;
  koTimer: number;
  speed: number;
}

interface ParticleSlot {
  active: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  scale: number;
  color: THREE.Color;
}

interface TracerSlot {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _vec3C = new THREE.Vector3();
const _vec3D = new THREE.Vector3();
const _quatA = new THREE.Quaternion();
const _mat4A = new THREE.Matrix4();
const _scaleVec = new THREE.Vector3();
const _raycaster = new THREE.Raycaster();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.65)');
  grad.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class ArenaEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;
  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private disposeEnv: () => void;

  private currentMap: ArenaMapSpec = ARENA_MAPS['obsidian-foundry'];
  private builtMap: BuiltArenaScene | null = null;
  private physicsWorld: ArenaPhysicsWorld | null = null;

  private appState: AppScreenState = 'title';
  private perspective: CameraPerspective = 'first-person';
  private sensitivity = 0.0022;
  private localPlayerId = 'local';
  private localCharacterId: CharacterId = 'vanguard-soldier';
  private localAlive = true;
  private localHp = 100;
  private localMaxHp = 100;
  private localRespawnTimer = 0;

  private moveState: CharacterMoveState;
  private keys = new Set<string>();
  private jumpJustPressed = false;
  private dashJustPressed = false;
  private mouseFiring = false;
  private touchFiring = false;
  private adsHeld = false;
  private draggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;
  private skipNextLockedMouseMove = false;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private touchCrouch = false;

  // Weapons & combat
  private weaponId: WeaponId = 'pulse-carbine';
  private ammoMap: Record<WeaponId, number> = {
    'pulse-carbine': WEAPONS['pulse-carbine'].magSize,
    'rail-rifle': WEAPONS['rail-rifle'].magSize,
    'scatter-gun': WEAPONS['scatter-gun'].magSize,
    'frag-launcher': WEAPONS['frag-launcher'].magSize,
  };
  private fireCooldown = 0;
  private reloading = false;
  private reloadTimer = 0;
  private fireTriggerConsumed = false;
  private recoilPitch = 0;
  private recoilKickZ = 0;
  private hitmarkerKind: 'none' | 'hit' | 'kill' = 'none';
  private hitmarkerTimer = 0;
  private damageFlash = 0;
  private trauma = 0;
  private lastStrideFootstep = 0;

  // First-person weapon rig & local third-person character rig
  private fpWeaponHolder = new THREE.Group();
  private fpWeaponMesh: THREE.Group | null = null;
  private localTpRig: RemoteActorVisual | null = null;
  private muzzleLight = new THREE.PointLight(0xffb74d, 0, 12, 1.8);
  private muzzleFlashTimer = 0;

  // Remote actors & bots
  private remoteActors = new Map<string, RemoteActorVisual>();
  private contactShadowTex: THREE.CanvasTexture;
  private contactShadowGeo = new THREE.CircleGeometry(0.68, 16);
  private contactShadowMat: THREE.MeshBasicMaterial;

  // Pooled particle InstancedMesh & tracer pool
  private readonly MAX_PARTICLES = 96;
  private particleMesh: THREE.InstancedMesh;
  private particles: ParticleSlot[] = [];
  private particleCursor = 0;
  private tracers: TracerSlot[] = [];
  private projMeshes = new Map<string, THREE.Mesh>();
  private projGeo = new THREE.SphereGeometry(0.18, 10, 10);
  private projMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xf97316,
    emissiveIntensity: 1.4,
    roughness: 0.3,
  });

  // Loop & throttling
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private flyoverAngle = 0;
  private netSyncAccum = 0;
  private hudSyncAccum = 0;
  private hitstopTimer = 0;
  private resizeObserver: ResizeObserver;

  constructor(container: HTMLElement, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      76,
      (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight),
      0.1,
      450,
    );
    this.scene.add(this.camera);
    this.fpWeaponHolder.visible = false;
    this.camera.add(this.fpWeaponHolder);
    this.muzzleLight.position.set(0.22, -0.15, -0.9);
    this.camera.add(this.muzzleLight);

    this.disposeEnv = setupSceneEnvironment(this.scene, this.renderer, this.currentMap);

    if (!this.isSoftwareGl) {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.38, 0.92);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    this.contactShadowTex = createContactShadowTexture();
    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });

    // Pooled sparks / debris
    const pGeo = new THREE.OctahedronGeometry(0.085, 0);
    const pMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.particleMesh = new THREE.InstancedMesh(pGeo, pMat, this.MAX_PARTICLES);
    this.particleMesh.frustumCulled = false;
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: -100,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 0,
        color: new THREE.Color(0xf59e0b),
      });
      _mat4A.makeScale(0, 0, 0);
      this.particleMesh.setMatrixAt(i, _mat4A);
      this.particleMesh.setColorAt(i, this.particles[i].color);
    }
    this.scene.add(this.particleMesh);

    // Pooled tracers
    const tGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 6);
    tGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 12; i++) {
      const tMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(tGeo, tMat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracers.push({ mesh, life: 0, maxLife: 0.12 });
    }

    const sp = this.currentMap.spawnPoints[0];
    this.moveState = createInitialMoveState(sp.x, sp.y, sp.z, sp.yaw);

    this.loadMap('obsidian-foundry');
    this.equipWeapon('pulse-carbine');

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(this.container);

    // Preload GLB assets and refresh map/character rigs once available
    assetRegistry.preloadAll().then(() => {
      if (this.disposed) return;
      this.loadMap(this.currentMap.id, false);
      this.rebuildLocalTpRig();
    });

    this.clock.start();
    const [cx, cy, cz] = this.currentMap.flyoverCenter;
    const r = this.currentMap.flyoverRadius;
    this.camera.position.set(cx + r, this.currentMap.flyoverHeight, cz);
    this.camera.lookAt(cx, cy, cz);
    this.renderer.render(this.scene, this.camera);
    this.tick();
  }

  public setCallbacks(cb: EngineCallbacks): void {
    this.callbacks = cb;
  }

  public setSensitivity(sens: number): void {
    this.sensitivity = Math.max(0.0006, Math.min(0.008, sens));
  }

  public setPerspective(p: CameraPerspective): void {
    this.perspective = p;
    this.fpWeaponHolder.visible = p === 'first-person' && this.appState === 'playing';
    if (this.localTpRig) {
      this.localTpRig.root.visible = p === 'third-person' && this.appState === 'playing';
    }
  }

  public togglePerspective(): CameraPerspective {
    const next: CameraPerspective =
      this.perspective === 'first-person' ? 'third-person' : 'first-person';
    this.setPerspective(next);
    return next;
  }

  public setAppState(state: AppScreenState): void {
    this.appState = state;
    if (state !== 'playing') {
      this.clearHeldInputs();
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock?.();
      }
      this.fpWeaponHolder.visible = false;
      if (this.localTpRig) this.localTpRig.root.visible = false;
    } else {
      this.fpWeaponHolder.visible = this.perspective === 'first-person';
      if (this.localTpRig) this.localTpRig.root.visible = this.perspective === 'third-person';
    }
  }

  public setLocalIdentity(id: string, characterId: CharacterId): void {
    this.localPlayerId = id;
    if (this.localCharacterId !== characterId) {
      this.localCharacterId = characterId;
      this.rebuildLocalTpRig();
    }
  }

  public loadMap(mapId: ArenaMapSpec['id'], resetSpawn = true): void {
    const spec = ARENA_MAPS[mapId] ?? ARENA_MAPS['obsidian-foundry'];
    this.currentMap = spec;

    if (this.builtMap) {
      this.builtMap.dispose();
      this.builtMap = null;
    }
    this.clearProjectiles();

    this.disposeEnv();
    this.disposeEnv = setupSceneEnvironment(this.scene, this.renderer, spec);
    this.builtMap = buildArenaMapScene(this.scene, spec, this.renderer, this.isSoftwareGl);
    this.physicsWorld = createArenaPhysicsWorld(spec);

    if (resetSpawn) {
      const sp = spec.spawnPoints[0];
      this.moveState = createInitialMoveState(sp.x, sp.y, sp.z, sp.yaw);
      this.localAlive = true;
      this.localHp = 100;
      this.localRespawnTimer = 0;
      this.ammoMap = {
        'pulse-carbine': WEAPONS['pulse-carbine'].magSize,
        'rail-rifle': WEAPONS['rail-rifle'].magSize,
        'scatter-gun': WEAPONS['scatter-gun'].magSize,
        'frag-launcher': WEAPONS['frag-launcher'].magSize,
      };
      this.reloading = false;
    }
  }

  public applyLocalSpawn(x: number, y: number, z: number, yaw: number): void {
    this.moveState = createInitialMoveState(x, y, z, yaw);
    this.localAlive = true;
    this.localHp = 100;
    this.localRespawnTimer = 0;
  }

  public syncRemotePlayers(players: NetPlayerState[]): void {
    const seenIds = new Set<string>();

    for (const p of players) {
      if (p.id === this.localPlayerId) {
        const wasAlive = this.localAlive;
        if (p.hp < this.localHp && p.alive) {
          this.damageFlash = 0.75;
          this.trauma = Math.min(1, this.trauma + 0.35);
          tacticalAudio.playHurt();
        }
        this.localHp = p.hp;
        this.localMaxHp = p.maxHp;
        this.localAlive = p.alive;
        this.localRespawnTimer = p.respawnTimer;
        if (!wasAlive && p.alive) {
          this.applyLocalSpawn(p.x, p.y, p.z, p.yaw);
        }
        continue;
      }

      seenIds.add(p.id);
      let actor = this.remoteActors.get(p.id);
      if (!actor || actor.characterId !== p.characterId) {
        if (actor) this.removeRemoteActor(actor);
        actor = this.createRemoteActor(p);
        this.remoteActors.set(p.id, actor);
      }

      actor.targetPos.set(p.x, p.y, p.z);
      actor.targetYaw = p.yaw;
      actor.speed = Math.hypot(p.vx, p.vz);
      if (p.hp < actor.hp) {
        actor.hurtFlashTimer = 0.08;
      }
      if (actor.alive && !p.alive) {
        actor.koTimer = 0.45;
      }
      actor.hp = p.hp;
      actor.alive = p.alive;
    }

    for (const [id, actor] of this.remoteActors.entries()) {
      if (!seenIds.has(id)) {
        this.removeRemoteActor(actor);
        this.remoteActors.delete(id);
      }
    }
  }

  public handleRemoteFire(
    shooterId: string,
    weaponId: WeaponId,
    origin: [number, number, number],
    dir: [number, number, number],
    hitPoint?: [number, number, number],
  ): void {
    const spec = WEAPONS[weaponId] ?? WEAPONS['pulse-carbine'];
    const end: [number, number, number] = hitPoint ?? [
      origin[0] + dir[0] * 45,
      origin[1] + dir[1] * 45,
      origin[2] + dir[2] * 45,
    ];
    this.spawnTracer(origin, end, spec.color);
    if (hitPoint) {
      this.spawnBurstParticles(hitPoint[0], hitPoint[1], hitPoint[2], spec.color, 6);
    }
    if (shooterId !== this.localPlayerId && spec.projectileSpeed > 0 && this.physicsWorld) {
      const proj = spawnPhysicsProjectile(
        this.physicsWorld,
        `rproj-${Date.now()}-${Math.random()}`,
        shooterId,
        origin,
        dir,
        spec.projectileSpeed,
        spec.damage,
        spec.explosionRadius,
        spec.impulse,
      );
      const m = new THREE.Mesh(this.projGeo, this.projMat);
      m.position.set(origin[0], origin[1], origin[2]);
      this.scene.add(m);
      this.projMeshes.set(proj.id, m);
    }
  }

  public notifyHitConfirm(isKill: boolean): void {
    this.hitmarkerKind = isKill ? 'kill' : 'hit';
    this.hitmarkerTimer = isKill ? 0.28 : 0.16;
    if (isKill) {
      this.hitstopTimer = 0.035;
      this.trauma = Math.min(1, this.trauma + 0.28);
    }
    tacticalAudio.playHitmarker(isKill);
  }

  // Mobile / Touch Input API
  public setTouchMove(x: number, y: number, sprint: boolean): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveY = Math.max(-1, Math.min(1, y));
    this.touchSprint = sprint;
  }

  public addTouchLook(dx: number, dy: number): void {
    if (this.appState !== 'playing') return;
    this.moveState.yaw -= dx * this.sensitivity * 1.45;
    this.moveState.pitch = Math.max(
      -1.4,
      Math.min(1.4, this.moveState.pitch - dy * this.sensitivity * 1.45),
    );
  }

  public setTouchFiring(firing: boolean): void {
    this.touchFiring = firing;
    if (!firing) this.fireTriggerConsumed = false;
  }

  public triggerJump(): void {
    this.jumpJustPressed = true;
  }

  public triggerDash(): void {
    this.dashJustPressed = true;
  }

  public setTouchCrouch(crouch: boolean): void {
    this.touchCrouch = crouch;
  }

  public setAdsHeld(held: boolean): void {
    this.adsHeld = held;
  }

  public toggleAds(): boolean {
    this.adsHeld = !this.adsHeld;
    return this.adsHeld;
  }

  public equipWeapon(id: WeaponId): void {
    if (this.weaponId === id && this.fpWeaponMesh) return;
    this.weaponId = id;
    this.reloading = false;
    this.reloadTimer = 0;

    if (this.fpWeaponMesh) {
      this.fpWeaponHolder.remove(this.fpWeaponMesh);
      this.fpWeaponMesh = null;
    }
    const model = buildFirstPersonWeaponModel(id);
    model.position.set(0.26, -0.24, -0.42);
    this.fpWeaponHolder.add(model);
    this.fpWeaponMesh = model;
  }

  public cycleWeapon(): void {
    const idx = WEAPON_ORDER.indexOf(this.weaponId);
    const next = WEAPON_ORDER[(idx + 1) % WEAPON_ORDER.length];
    this.equipWeapon(next);
  }

  public startReload(): void {
    const spec = WEAPONS[this.weaponId];
    if (this.reloading || this.ammoMap[this.weaponId] >= spec.magSize) return;
    this.reloading = true;
    this.reloadTimer = spec.reloadTime;
    tacticalAudio.playReload();
  }

  public requestPointerLock(): void {
    if (this.appState !== 'playing') return;
    try {
      this.renderer.domElement.requestPointerLock?.();
    } catch {
      // Headless or touch fallback handled seamlessly
    }
  }

  private rebuildLocalTpRig(): void {
    if (this.localTpRig) {
      this.removeRemoteActor(this.localTpRig);
      this.localTpRig = null;
    }
    const inst = assetRegistry.instantiateCharacter(this.localCharacterId, 0x06b6d4);
    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.85, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = 0.92;
    inst.root.add(hitbox);

    const shadowDisc = new THREE.Mesh(this.contactShadowGeo, this.contactShadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.02;
    inst.root.add(shadowDisc);

    inst.root.visible = this.perspective === 'third-person' && this.appState === 'playing';
    this.scene.add(inst.root);

    this.localTpRig = {
      id: this.localPlayerId,
      characterId: this.localCharacterId,
      isBot: false,
      root: inst.root,
      hitbox,
      shadowDisc,
      mixer: inst.mixer,
      actions: inst.actions,
      targetPos: new THREE.Vector3(),
      targetYaw: 0,
      alive: true,
      hp: 100,
      hurtFlashTimer: 0,
      koTimer: 0,
      speed: 0,
    };
  }

  private createRemoteActor(p: NetPlayerState): RemoteActorVisual {
    const tint = p.isBot ? 0xef4444 : 0x06b6d4;
    const inst = assetRegistry.instantiateCharacter(p.characterId, tint);
    inst.root.position.set(p.x, p.y, p.z);
    inst.root.rotation.y = p.yaw;

    const hitbox = new THREE.Mesh(
      new THREE.CylinderGeometry(0.55, 0.55, 1.9, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = 0.95;
    hitbox.userData.targetPlayerId = p.id;
    inst.root.add(hitbox);

    const shadowDisc = new THREE.Mesh(this.contactShadowGeo, this.contactShadowMat);
    shadowDisc.rotation.x = -Math.PI / 2;
    shadowDisc.position.y = 0.025;
    inst.root.add(shadowDisc);

    this.scene.add(inst.root);

    return {
      id: p.id,
      characterId: p.characterId,
      isBot: p.isBot,
      root: inst.root,
      hitbox,
      shadowDisc,
      mixer: inst.mixer,
      actions: inst.actions,
      targetPos: new THREE.Vector3(p.x, p.y, p.z),
      targetYaw: p.yaw,
      alive: p.alive,
      hp: p.hp,
      hurtFlashTimer: 0,
      koTimer: 0,
      speed: 0,
    };
  }

  private removeRemoteActor(actor: RemoteActorVisual): void {
    this.scene.remove(actor.root);
    actor.hitbox.geometry.dispose();
    (actor.hitbox.material as THREE.Material).dispose();
  }

  private clearProjectiles(): void {
    for (const m of this.projMeshes.values()) {
      this.scene.remove(m);
    }
    this.projMeshes.clear();
  }

  private clearHeldInputs(): void {
    this.keys.clear();
    this.mouseFiring = false;
    this.touchFiring = false;
    this.adsHeld = false;
    this.draggingLook = false;
    this.fireTriggerConsumed = false;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
  }

  private handleResize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }
    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'INPUT' ||
        active.tagName === 'TEXTAREA' ||
        active.tagName === 'SELECT')
    ) {
      return;
    }

    if (this.appState !== 'playing') return;

    if (!this.keys.has(e.code)) {
      if (e.code === 'Space') this.jumpJustPressed = true;
      if (e.code === 'KeyQ' || e.code === 'KeyE') this.dashJustPressed = true;
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.equipWeapon('pulse-carbine');
      if (e.code === 'Digit2') this.equipWeapon('rail-rifle');
      if (e.code === 'Digit3') this.equipWeapon('scatter-gun');
      if (e.code === 'Digit4') this.equipWeapon('frag-launcher');
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onMouseMove = (e: MouseEvent) => {
    if (this.appState !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      if (this.skipNextLockedMouseMove) {
        this.skipNextLockedMouseMove = false;
        return;
      }
      if (Math.abs(e.movementX) > 220 || Math.abs(e.movementY) > 220) {
        return;
      }
      const mx = Math.max(-80, Math.min(80, e.movementX));
      const my = Math.max(-80, Math.min(80, e.movementY));
      this.moveState.yaw -= mx * this.sensitivity;
      this.moveState.pitch = Math.max(
        -1.35,
        Math.min(1.35, this.moveState.pitch - my * this.sensitivity),
      );
    } else if (this.draggingLook) {
      const dx = Math.max(-80, Math.min(80, e.clientX - this.lastDragX));
      const dy = Math.max(-80, Math.min(80, e.clientY - this.lastDragY));
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.moveState.yaw -= dx * this.sensitivity * 1.3;
      this.moveState.pitch = Math.max(
        -1.35,
        Math.min(1.35, this.moveState.pitch - dy * this.sensitivity * 1.3),
      );
    }
  };

  private onMouseDown = (e: MouseEvent) => {
    if (this.appState !== 'playing') return;
    if (e.target !== this.renderer.domElement) return;
    if (e.button === 0) {
      if (document.pointerLockElement !== this.renderer.domElement) {
        this.requestPointerLock();
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
      this.mouseFiring = true;
    } else if (e.button === 2) {
      this.adsHeld = true;
    }
  };

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) {
      this.mouseFiring = false;
      this.draggingLook = false;
      this.fireTriggerConsumed = false;
    } else if (e.button === 2) {
      this.adsHeld = false;
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    if (this.appState === 'playing') e.preventDefault();
  };

  private onPointerLockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) {
      this.skipNextLockedMouseMove = true;
    }
    this.callbacks.onPointerLockChange?.(locked);
  };

  private onWindowBlur = () => {
    this.clearHeldInputs();
  };

  private onVisibilityChange = () => {
    if (document.hidden) this.clearHeldInputs();
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('blur', this.onWindowBlur);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
  }

  private unbindEvents(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('blur', this.onWindowBlur);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
  }

  private spawnBurstParticles(
    x: number,
    y: number,
    z: number,
    colorHex: string,
    count: number,
  ): void {
    for (let i = 0; i < count; i++) {
      const slot = this.particles[this.particleCursor];
      this.particleCursor = (this.particleCursor + 1) % this.MAX_PARTICLES;
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.z = z;
      slot.vx = (Math.random() - 0.5) * 10;
      slot.vy = 2 + Math.random() * 7;
      slot.vz = (Math.random() - 0.5) * 10;
      slot.maxLife = 0.25 + Math.random() * 0.3;
      slot.life = slot.maxLife;
      slot.scale = 0.6 + Math.random() * 0.8;
      slot.color.set(colorHex);
      this.particleMesh.setColorAt(this.particleCursor, slot.color);
    }
    if (this.particleMesh.instanceColor) {
      this.particleMesh.instanceColor.needsUpdate = true;
    }
  }

  private spawnTracer(
    origin: [number, number, number],
    end: [number, number, number],
    colorHex: string,
  ): void {
    const slot = this.tracers.find((t) => t.life <= 0) ?? this.tracers[0];
    _vec3A.set(origin[0], origin[1], origin[2]);
    _vec3B.set(end[0], end[1], end[2]);
    const dist = _vec3A.distanceTo(_vec3B);
    if (dist < 0.2) return;

    slot.mesh.position.copy(_vec3A).lerp(_vec3B, 0.5);
    slot.mesh.lookAt(_vec3B);
    slot.mesh.scale.set(1, 1, dist);
    const mat = slot.mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.85;
    slot.mesh.visible = true;
    slot.maxLife = 0.11;
    slot.life = slot.maxLife;
  }

  private tryFireWeapon(): void {
    const spec = WEAPONS[this.weaponId];
    const wantsFire = this.mouseFiring || this.touchFiring;
    if (!wantsFire || !this.localAlive || this.reloading || this.fireCooldown > 0) return;
    if (!spec.automatic && this.fireTriggerConsumed) return;

    if (this.ammoMap[this.weaponId] <= 0) {
      this.startReload();
      return;
    }

    this.fireTriggerConsumed = true;
    this.fireCooldown = spec.fireInterval;
    this.ammoMap[this.weaponId] -= 1;

    tacticalAudio.playFire(this.weaponId);
    this.recoilPitch += spec.recoilPitch;
    this.recoilKickZ += spec.recoilKick;
    this.trauma = Math.min(1, this.trauma + (spec.id === 'pulse-carbine' ? 0.12 : 0.26));
    this.muzzleLight.color.set(spec.color);
    this.muzzleLight.intensity = 4.2;
    this.muzzleFlashTimer = 0.055;

    // Raycast origin from camera center
    this.camera.getWorldPosition(_vec3A);
    this.camera.getWorldDirection(_vec3B);

    const visualOrigin: [number, number, number] = [
      _vec3A.x + _vec3B.x * 0.5,
      _vec3A.y + _vec3B.y * 0.5 - 0.12,
      _vec3A.z + _vec3B.z * 0.5,
    ];

    if (spec.projectileSpeed > 0 && this.physicsWorld) {
      // Frag launcher physical grenade
      const proj = spawnPhysicsProjectile(
        this.physicsWorld,
        `lproj-${Date.now()}-${Math.random()}`,
        this.localPlayerId,
        visualOrigin,
        [_vec3B.x, _vec3B.y, _vec3B.z],
        spec.projectileSpeed,
        spec.damage,
        spec.explosionRadius,
        spec.impulse,
      );
      const m = new THREE.Mesh(this.projGeo, this.projMat);
      m.position.set(visualOrigin[0], visualOrigin[1], visualOrigin[2]);
      this.scene.add(m);
      this.projMeshes.set(proj.id, m);

      this.callbacks.onLocalFire({
        weaponId: spec.id,
        origin: visualOrigin,
        dir: [_vec3B.x, _vec3B.y, _vec3B.z],
      });
      return;
    }

    // Hitscan pellets (1 for rifles, 7 for scatter gun)
    const rayTargets: THREE.Object3D[] = [];
    if (this.builtMap) {
      for (const cm of this.builtMap.collidableMeshes) rayTargets.push(cm);
    }
    for (const actor of this.remoteActors.values()) {
      if (actor.alive) rayTargets.push(actor.hitbox);
    }

    const spreadFactor = this.adsHeld ? spec.spread * 0.45 : spec.spread;
    let bestTargetId: string | undefined;
    let bestHitPoint: [number, number, number] | undefined;

    for (let p = 0; p < spec.pellets; p++) {
      _vec3C.copy(_vec3B);
      _vec3C.x += (Math.random() - 0.5) * spreadFactor * 2;
      _vec3C.y += (Math.random() - 0.5) * spreadFactor * 2;
      _vec3C.z += (Math.random() - 0.5) * spreadFactor * 2;
      _vec3C.normalize();

      _raycaster.set(_vec3A, _vec3C);
      _raycaster.far = spec.range;
      const hits = _raycaster.intersectObjects(rayTargets, false);

      if (hits.length > 0) {
        const hit = hits[0];
        const hp: [number, number, number] = [hit.point.x, hit.point.y, hit.point.z];
        this.spawnTracer(visualOrigin, hp, spec.color);
        this.spawnBurstParticles(hp[0], hp[1], hp[2], spec.color, p === 0 ? 7 : 3);

        const targetPlayerId = hit.object.userData.targetPlayerId as string | undefined;
        const crateId = hit.object.userData.crateId as string | undefined;
        if (targetPlayerId) {
          bestTargetId = targetPlayerId;
          bestHitPoint = hp;
        } else if (crateId && this.physicsWorld) {
          applyCrateImpulse(
            this.physicsWorld,
            crateId,
            hp,
            [_vec3C.x, _vec3C.y, _vec3C.z],
            spec.impulse,
          );
          if (!bestHitPoint) bestHitPoint = hp;
        } else if (!bestHitPoint) {
          bestHitPoint = hp;
        }
      } else {
        const missEnd: [number, number, number] = [
          _vec3A.x + _vec3C.x * 55,
          _vec3A.y + _vec3C.y * 55,
          _vec3A.z + _vec3C.z * 55,
        ];
        this.spawnTracer(visualOrigin, missEnd, spec.color);
      }
    }

    this.callbacks.onShotStats?.(Boolean(bestTargetId));
    this.callbacks.onLocalFire({
      weaponId: spec.id,
      origin: visualOrigin,
      dir: [_vec3B.x, _vec3B.y, _vec3B.z],
      hitTargetId: bestTargetId,
      hitPoint: bestHitPoint,
    });
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    // Hitstop timer freezes simulation momentarily on kills while visuals/camera shake continue
    if (this.hitstopTimer > 0) {
      this.hitstopTimer = Math.max(0, this.hitstopTimer - dt);
    }

    const simDt = this.hitstopTimer > 0 ? dt * 0.08 : dt;

    // Update arena animations (jump pads, radar arrays, biome motes, spinning artifact)
    if (this.builtMap) {
      const t = this.clock.elapsedTime;
      for (const ring of this.builtMap.jumpPadRings) {
        ring.position.y = 0.45 + Math.sin(t * 4.5) * 0.14;
      }
      for (const dish of this.builtMap.radarDishes) {
        dish.rotation.y += dt * 0.65;
      }
      if (this.builtMap.ambientMotes) {
        this.builtMap.ambientMotes.rotation.y += dt * 0.03;
      }
      if (this.builtMap.relicGroup) {
        this.builtMap.relicGroup.rotation.y += dt * 0.9;
      }
    }

    if (this.appState === 'title') {
      // Smooth world flyover camera on title/lobby screen
      this.flyoverAngle += dt * 0.16;
      const [cx, cy, cz] = this.currentMap.flyoverCenter;
      const r = this.currentMap.flyoverRadius;
      this.camera.position.set(
        cx + Math.cos(this.flyoverAngle) * r,
        this.currentMap.flyoverHeight + Math.sin(this.flyoverAngle * 1.4) * 2.5,
        cz + Math.sin(this.flyoverAngle) * r,
      );
      this.camera.lookAt(cx, cy, cz);
      this.camera.fov = 68;
      this.camera.updateProjectionMatrix();
    } else if (this.appState === 'playing') {
      this.updateGameplay(simDt, dt);
    }

    this.updateRemoteActors(dt);
    this.updateParticlesAndTracers(dt);

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private updateGameplay(simDt: number, realDt: number): void {
    // Cooldowns & timers
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - realDt);
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer = Math.max(0, this.hitmarkerTimer - realDt);
      if (this.hitmarkerTimer === 0) this.hitmarkerKind = 'none';
    }
    if (this.damageFlash > 0) this.damageFlash = Math.max(0, this.damageFlash - realDt * 2.2);
    if (this.trauma > 0) this.trauma = Math.max(0, this.trauma - realDt * 2.8);
    if (this.muzzleFlashTimer > 0) {
      this.muzzleFlashTimer = Math.max(0, this.muzzleFlashTimer - realDt);
      if (this.muzzleFlashTimer === 0) this.muzzleLight.intensity = 0;
    }

    if (this.reloading) {
      this.reloadTimer -= realDt;
      if (this.reloadTimer <= 0) {
        this.reloading = false;
        this.ammoMap[this.weaponId] = WEAPONS[this.weaponId].magSize;
      }
    }

    if (this.localAlive) {
      const forward =
        (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
        (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) +
        this.touchMoveY;
      const right =
        (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
        (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
        this.touchMoveX;

      const input: CharacterMoveInput = {
        forward: Math.max(-1, Math.min(1, forward)),
        right: Math.max(-1, Math.min(1, right)),
        yaw: this.moveState.yaw,
        pitch: this.moveState.pitch,
        jumpHeld: this.keys.has('Space'),
        jumpJustPressed: this.jumpJustPressed,
        sprintHeld: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchSprint,
        crouchHeld: this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.touchCrouch,
        dashJustPressed: this.dashJustPressed,
      };
      this.jumpJustPressed = false;
      this.dashJustPressed = false;

      stepCharacterMovement(this.moveState, input, this.currentMap, simDt);

      // Movement audio feedback
      if (this.moveState.justJumped) tacticalAudio.playJump(false);
      if (this.moveState.justHitJumpPad) {
        tacticalAudio.playJump(true);
        this.spawnBurstParticles(this.moveState.x, this.moveState.y + 0.3, this.moveState.z, '#06b6d4', 10);
      }
      if (this.moveState.justDashed) {
        tacticalAudio.playDash();
        this.trauma = Math.min(1, this.trauma + 0.16);
      }
      if (this.moveState.justLanded) {
        tacticalAudio.playLand(this.moveState.landingImpactSpeed);
      }
      if (this.moveState.strideDistance - this.lastStrideFootstep >= 2.35) {
        this.lastStrideFootstep = this.moveState.strideDistance;
        tacticalAudio.playFootstep(input.sprintHeld);
      }

      this.tryFireWeapon();
    } else {
      this.jumpJustPressed = false;
      this.dashJustPressed = false;
    }

    // Step Cannon-ES physics world & sync dynamic crates + projectiles
    if (this.physicsWorld && this.builtMap) {
      stepArenaPhysicsWorld(this.physicsWorld, this.moveState, simDt);

      for (const crate of this.physicsWorld.crates) {
        const mesh = this.builtMap.crateMeshes.get(crate.id);
        if (mesh) {
          mesh.position.set(crate.body.position.x, crate.body.position.y, crate.body.position.z);
          mesh.quaternion.set(
            crate.body.quaternion.x,
            crate.body.quaternion.y,
            crate.body.quaternion.z,
            crate.body.quaternion.w,
          );
        }
      }

      // Update bouncing physics grenades
      for (let i = this.physicsWorld.projectiles.length - 1; i >= 0; i--) {
        const proj = this.physicsWorld.projectiles[i];
        proj.life -= simDt;
        const pm = this.projMeshes.get(proj.id);
        if (pm) {
          pm.position.set(proj.body.position.x, proj.body.position.y, proj.body.position.z);
        }

        // Check proximity detonation against enemies or fuse expiry
        let detonate = proj.life <= 0;
        if (!detonate) {
          for (const actor of this.remoteActors.values()) {
            if (!actor.alive || actor.id === proj.ownerId) continue;
            const d = Math.hypot(
              actor.root.position.x - proj.body.position.x,
              actor.root.position.y + 0.9 - proj.body.position.y,
              actor.root.position.z - proj.body.position.z,
            );
            if (d < 1.35) {
              detonate = true;
              break;
            }
          }
        }

        if (detonate) {
          const exPos: [number, number, number] = [
            proj.body.position.x,
            proj.body.position.y,
            proj.body.position.z,
          ];
          applyRadialExplosionImpulse(this.physicsWorld, exPos, proj.explosionRadius, proj.impulse);
          this.spawnBurstParticles(exPos[0], exPos[1], exPos[2], '#ef4444', 24);
          tacticalAudio.playExplosion();
          this.trauma = Math.min(1, this.trauma + 0.45);

          if (proj.ownerId === this.localPlayerId) {
            this.callbacks.onLocalFire({
              weaponId: 'frag-launcher',
              origin: exPos,
              dir: [0, 1, 0],
              hitPoint: exPos,
            });
          }

          this.physicsWorld.world.removeBody(proj.body);
          this.physicsWorld.projectiles.splice(i, 1);
          if (pm) {
            this.scene.remove(pm);
            this.projMeshes.delete(proj.id);
          }
        }
      }
    }

    // Update Camera (First-Person or Third-Person Over-The-Shoulder with wall pull-in)
    this.updateCameraRig(realDt);

    // Network transform sync at 20Hz
    this.netSyncAccum += realDt;
    if (this.netSyncAccum >= 0.05) {
      this.netSyncAccum = 0;
      this.callbacks.onLocalTransform({
        x: this.moveState.x,
        y: this.moveState.y,
        z: this.moveState.z,
        vx: this.moveState.vx,
        vy: this.moveState.vy,
        vz: this.moveState.vz,
        yaw: this.moveState.yaw,
        pitch: this.moveState.pitch,
        weaponId: this.weaponId,
        crouching: this.moveState.crouching,
        sliding: this.moveState.sliding,
        grounded: this.moveState.grounded,
      });
    }

    // Throttled HUD telemetry update at 10Hz
    this.hudSyncAccum += realDt;
    if (this.hudSyncAccum >= 0.1) {
      this.hudSyncAccum = 0;
      const spec = WEAPONS[this.weaponId];
      const speedMs = Math.hypot(this.moveState.vx, this.moveState.vz);
      this.callbacks.onHudUpdate({
        hp: this.localHp,
        maxHp: this.localMaxHp,
        ammo: this.ammoMap[this.weaponId],
        magSize: spec.magSize,
        reloading: this.reloading,
        reloadProgress: this.reloading ? 1 - Math.max(0, this.reloadTimer) / spec.reloadTime : 0,
        weaponId: this.weaponId,
        dashReadyRatio: 1 - this.moveState.dashCooldownTimer / 2.2,
        speedMs,
        sliding: this.moveState.sliding,
        crouching: this.moveState.crouching,
        grounded: this.moveState.grounded,
        alive: this.localAlive,
        respawnTimer: this.localRespawnTimer,
        perspective: this.perspective,
        hitmarkerKind: this.hitmarkerKind,
        damageFlash: this.damageFlash,
        pointerLocked: document.pointerLockElement === this.renderer.domElement,
        adsHeld: this.adsHeld,
        playerPos: [this.moveState.x, this.moveState.y, this.moveState.z],
        playerYaw: this.moveState.yaw,
        spreadRatio: Math.min(1, speedMs / 14) * 0.6 + (this.adsHeld ? 0 : 0.25),
      });
    }
  }

  private updateCameraRig(dt: number): void {
    const speed = Math.hypot(this.moveState.vx, this.moveState.vz);
    const bob =
      this.moveState.grounded && !this.moveState.sliding && speed > 0.8
        ? Math.sin(this.moveState.strideDistance * 1.9) * 0.045 * Math.min(1, speed / 9)
        : 0;

    // Decay recoil springs
    const recDecay = Math.exp(-14 * dt);
    this.recoilPitch *= recDecay;
    this.recoilKickZ *= recDecay;

    const shakeMag = this.trauma * this.trauma * 0.045;
    const shakeX = (Math.random() - 0.5) * shakeMag;
    const shakeY = (Math.random() - 0.5) * shakeMag;

    // Dynamic FOV kick for speed / slide / ADS
    const targetFov = this.adsHeld
      ? 56
      : this.moveState.sliding
        ? 86
        : 76 + Math.min(9, speed * 0.65);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 12, dt);
    this.camera.updateProjectionMatrix();

    if (this.perspective === 'first-person') {
      this.camera.position.set(
        this.moveState.x + shakeX,
        this.moveState.y + this.moveState.eyeHeight + bob + shakeY,
        this.moveState.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.moveState.yaw;
      this.camera.rotation.x = Math.max(-1.45, Math.min(1.45, this.moveState.pitch + this.recoilPitch));
      this.camera.rotation.z = this.moveState.sliding ? -0.05 : 0;

      // Weapon viewmodel sway & recoil
      if (this.fpWeaponMesh) {
        const swayX = Math.cos(this.moveState.strideDistance * 0.95) * 0.012 * Math.min(1, speed / 9);
        const swayY = Math.abs(bob) * 0.4;
        const targetX = this.adsHeld ? 0.04 : 0.26;
        const targetY = this.adsHeld ? -0.17 : -0.24;
        this.fpWeaponMesh.position.x = THREE.MathUtils.damp(this.fpWeaponMesh.position.x, targetX + swayX, 16, dt);
        this.fpWeaponMesh.position.y = THREE.MathUtils.damp(this.fpWeaponMesh.position.y, targetY - swayY, 16, dt);
        this.fpWeaponMesh.position.z = -0.42 + this.recoilKickZ;
        this.fpWeaponMesh.rotation.x = this.recoilPitch * 1.8;
      }
    } else {
      // Third-Person Unreal Over-the-Shoulder Rig with wall pull-in
      const pivotX = this.moveState.x;
      const pivotY = this.moveState.y + (this.moveState.crouching ? 1.15 : 1.55);
      const pivotZ = this.moveState.z;

      const sinY = Math.sin(this.moveState.yaw);
      const cosY = Math.cos(this.moveState.yaw);
      const cosP = Math.cos(this.moveState.pitch);
      const sinP = Math.sin(this.moveState.pitch);

      // Desired offset behind & slightly right of shoulder
      const desiredDist = this.adsHeld ? 2.1 : 3.4;
      const shoulderOffset = 0.62;
      _vec3A.set(pivotX, pivotY, pivotZ);
      _vec3B.set(
        pivotX + sinY * cosP * desiredDist + cosY * shoulderOffset,
        Math.max(this.moveState.y + 0.55, pivotY - sinP * desiredDist + 0.35),
        pivotZ + cosY * cosP * desiredDist - sinY * shoulderOffset,
      );

      // Wall pull-in raycast
      let finalDist = desiredDist;
      if (this.builtMap) {
        _vec3C.copy(_vec3B).sub(_vec3A);
        const fullLen = _vec3C.length();
        if (fullLen > 0.01) {
          _vec3C.divideScalar(fullLen);
          _raycaster.set(_vec3A, _vec3C);
          _raycaster.far = fullLen;
          const hits = _raycaster.intersectObjects(this.builtMap.collidableMeshes, false);
          if (hits.length > 0 && hits[0].distance < fullLen) {
            finalDist = Math.max(0.8, hits[0].distance - 0.35);
            _vec3B.copy(_vec3A).addScaledVector(_vec3C, finalDist);
            _vec3B.y = Math.max(this.moveState.y + 0.55, _vec3B.y);
          }
        }
      }

      this.camera.position.set(_vec3B.x + shakeX, _vec3B.y + shakeY, _vec3B.z);
      // Look forward along aim direction
      _vec3D.set(
        pivotX - sinY * cosP * 25,
        pivotY + sinP * 25,
        pivotZ - cosY * cosP * 25,
      );
      this.camera.lookAt(_vec3D);

      if (this.localTpRig) {
        this.localTpRig.root.position.set(this.moveState.x, this.moveState.y, this.moveState.z);
        this.localTpRig.root.rotation.y = this.moveState.yaw;
        this.localTpRig.root.visible = this.localAlive;
        this.driveActorAnimation(this.localTpRig, speed, dt);
      }
    }
  }

  private driveActorAnimation(actor: RemoteActorVisual, speed: number, dt: number): void {
    if (!actor.mixer) return;
    actor.mixer.update(dt);
    const { idle, walk, run } = actor.actions;
    if (!idle) return;

    if (speed < 0.6) {
      idle.setEffectiveWeight(1);
      walk?.setEffectiveWeight(0);
      run?.setEffectiveWeight(0);
    } else if (speed < 9.5) {
      const t = Math.min(1, speed / 7);
      idle.setEffectiveWeight(1 - t);
      walk?.setEffectiveWeight(t);
      run?.setEffectiveWeight(0);
    } else {
      idle.setEffectiveWeight(0);
      walk?.setEffectiveWeight(0.25);
      run?.setEffectiveWeight(0.75);
    }
  }

  private updateRemoteActors(dt: number): void {
    const smooth = 1 - Math.exp(-15 * dt);
    for (const actor of this.remoteActors.values()) {
      if (!actor.alive) {
        if (actor.koTimer > 0) {
          actor.koTimer = Math.max(0, actor.koTimer - dt);
          actor.root.rotation.x = THREE.MathUtils.damp(actor.root.rotation.x, -Math.PI * 0.45, 14, dt);
          actor.root.visible = true;
        } else {
          actor.root.visible = false;
        }
        continue;
      }

      actor.root.visible = true;
      actor.root.rotation.x = THREE.MathUtils.damp(actor.root.rotation.x, 0, 18, dt);
      actor.root.position.lerp(actor.targetPos, smooth);

      // Shortest angular interpolation for yaw
      let diff = actor.targetYaw - actor.root.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      actor.root.rotation.y += diff * smooth;

      this.driveActorAnimation(actor, actor.speed, dt);
    }
  }

  private updateParticlesAndTracers(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        _mat4A.makeScale(0, 0, 0);
        this.particleMesh.setMatrixAt(i, _mat4A);
        continue;
      }
      p.vy -= 18 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const s = p.scale * (p.life / p.maxLife);
      _vec3A.set(p.x, p.y, p.z);
      _scaleVec.set(s, s, s);
      _quatA.identity();
      _mat4A.compose(_vec3A, _quatA, _scaleVec);
      this.particleMesh.setMatrixAt(i, _mat4A);
    }
    if (dirty) {
      this.particleMesh.instanceMatrix.needsUpdate = true;
    }

    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      const mat = t.mesh.material as THREE.MeshBasicMaterial;
      if (t.life <= 0) {
        t.mesh.visible = false;
        mat.opacity = 0;
      } else {
        mat.opacity = 0.85 * (t.life / t.maxLife);
      }
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
      if (status === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();
    this.unbindEvents();

    if (this.builtMap) this.builtMap.dispose();
    if (this.localTpRig) this.removeRemoteActor(this.localTpRig);
    for (const actor of this.remoteActors.values()) {
      this.removeRemoteActor(actor);
    }
    this.remoteActors.clear();
    this.clearProjectiles();

    this.particleMesh.geometry.dispose();
    (this.particleMesh.material as THREE.Material).dispose();
    this.contactShadowGeo.dispose();
    this.contactShadowMat.dispose();
    this.contactShadowTex.dispose();
    this.projGeo.dispose();
    this.projMat.dispose();
    this.disposeEnv();
    this.composer?.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
