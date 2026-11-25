import * as CANNON from 'cannon-es';
import { ArenaMapSpec, MapBox, MapRamp } from '../shared/maps';

export const PLAYER_RADIUS = 0.46;
export const PLAYER_HEIGHT_STAND = 1.85;
export const PLAYER_HEIGHT_CROUCH = 1.1;
export const EYE_HEIGHT_STAND = 1.62;
export const EYE_HEIGHT_CROUCH = 0.96;

export const MOVE_CONFIG = {
  walkSpeed: 8.6,
  sprintSpeed: 12.2,
  crouchSpeed: 5.2,
  slideSpeed: 15.5,
  dashImpulse: 18.5,
  dashCooldown: 2.2,
  groundAccel: 76.0,
  groundBraking: 58.0,
  airAccel: 26.0,
  gravity: 26.0,
  jumpVelocity: 10.4,
  coyoteTime: 0.12,
  jumpBufferTime: 0.12,
  stepUpHeight: 0.55,
  slideDuration: 0.56,
  slideCooldown: 0.75,
};

export interface CharacterMoveState {
  x: number;
  y: number; // feet Y
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  grounded: boolean;
  crouching: boolean;
  sliding: boolean;
  slideTimer: number;
  slideCooldownTimer: number;
  slideDirX: number;
  slideDirZ: number;
  dashCooldownTimer: number;
  coyoteTimer: number;
  jumpBufferTimer: number;
  jumpHeldPrev: boolean;
  eyeHeight: number;
  strideDistance: number;
  justJumped: boolean;
  justLanded: boolean;
  justHitJumpPad: boolean;
  justDashed: boolean;
  landingImpactSpeed: number;
}

export interface CharacterMoveInput {
  forward: number; // -1..1 (+1 = W / forward)
  right: number; // -1..1 (+1 = D / right)
  yaw: number;
  pitch: number;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  sprintHeld: boolean;
  crouchHeld: boolean;
  dashJustPressed: boolean;
}

export function createInitialMoveState(
  x: number,
  y: number,
  z: number,
  yaw: number,
): CharacterMoveState {
  return {
    x,
    y,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    pitch: 0,
    grounded: true,
    crouching: false,
    sliding: false,
    slideTimer: 0,
    slideCooldownTimer: 0,
    slideDirX: 0,
    slideDirZ: -1,
    dashCooldownTimer: 0,
    coyoteTimer: 0,
    jumpBufferTimer: 0,
    jumpHeldPrev: false,
    eyeHeight: EYE_HEIGHT_STAND,
    strideDistance: 0,
    justJumped: false,
    justLanded: false,
    justHitJumpPad: false,
    justDashed: false,
    landingImpactSpeed: 0,
  };
}

export function sampleRampHeight(ramp: MapRamp, x: number, z: number, margin = 0): number | null {
  const halfW = ramp.w * 0.5 + margin;
  const halfD = ramp.d * 0.5 + margin;
  if (x < ramp.x - halfW || x > ramp.x + halfW || z < ramp.z - halfD || z > ramp.z + halfD) {
    return null;
  }

  let t = 0;
  if (ramp.riseDir === '+x') {
    t = (x - (ramp.x - ramp.w * 0.5)) / ramp.w;
  } else if (ramp.riseDir === '-x') {
    t = ((ramp.x + ramp.w * 0.5) - x) / ramp.w;
  } else if (ramp.riseDir === '+z') {
    t = (z - (ramp.z - ramp.d * 0.5)) / ramp.d;
  } else {
    t = ((ramp.z + ramp.d * 0.5) - z) / ramp.d;
  }

  const clamped = Math.max(0, Math.min(1, t));
  return ramp.yLow + (ramp.yHigh - ramp.yLow) * clamped;
}

export function sampleSupportHeight(
  x: number,
  z: number,
  currentFeetY: number,
  radius: number,
  map: ArenaMapSpec,
): number {
  let highest = 0;

  // Check walkable tops of boxes
  for (let i = 0; i < map.boxes.length; i++) {
    const b = map.boxes[i];
    const top = b.y + b.h;
    if (top > currentFeetY + MOVE_CONFIG.stepUpHeight) continue;
    const hw = b.w * 0.5 + radius * 0.65;
    const hd = b.d * 0.5 + radius * 0.65;
    if (x >= b.x - hw && x <= b.x + hw && z >= b.z - hd && z <= b.z + hd) {
      if (top > highest) highest = top;
    }
  }

  // Check walkable ramps
  for (let i = 0; i < map.ramps.length; i++) {
    const r = map.ramps[i];
    const rh = sampleRampHeight(r, x, z, radius * 0.55);
    if (rh !== null && rh <= currentFeetY + MOVE_CONFIG.stepUpHeight + 0.35) {
      if (rh > highest) highest = rh;
    }
  }

  return highest;
}

function resolveCircleVsBox(
  px: number,
  pz: number,
  py: number,
  radius: number,
  playerHeight: number,
  bx: number,
  by: number,
  bz: number,
  bw: number,
  bh: number,
  bd: number,
  vx: number,
  vz: number,
): { x: number; z: number; vx: number; vz: number } {
  const boxTop = by + bh;
  // Ignore if player's feet can step on top or player is below bottom
  if (py >= boxTop - MOVE_CONFIG.stepUpHeight || py + playerHeight <= by + 0.05) {
    return { x: px, z: pz, vx, vz };
  }

  const minX = bx - bw * 0.5;
  const maxX = bx + bw * 0.5;
  const minZ = bz - bd * 0.5;
  const maxZ = bz + bd * 0.5;

  const closestX = Math.max(minX, Math.min(px, maxX));
  const closestZ = Math.max(minZ, Math.min(pz, maxZ));

  const dx = px - closestX;
  const dz = pz - closestZ;
  const distSq = dx * dx + dz * dz;

  if (distSq >= radius * radius) {
    return { x: px, z: pz, vx, vz };
  }

  if (distSq > 1e-6) {
    const dist = Math.sqrt(distSq);
    const nx = dx / dist;
    const nz = dz / dist;
    const push = radius - dist;
    const newX = px + nx * push;
    const newZ = pz + nz * push;
    const vn = vx * nx + vz * nz;
    if (vn < 0) {
      return { x: newX, z: newZ, vx: vx - nx * vn, vz: vz - nz * vn };
    }
    return { x: newX, z: newZ, vx, vz };
  }

  // Center is inside box; push out along shallowest axis
  const penLeft = px - minX;
  const penRight = maxX - px;
  const penTop = pz - minZ;
  const penBottom = maxZ - pz;
  const minPen = Math.min(penLeft, penRight, penTop, penBottom);
  if (minPen === penLeft) return { x: minX - radius, z: pz, vx: Math.min(0, vx), vz };
  if (minPen === penRight) return { x: maxX + radius, z: pz, vx: Math.max(0, vx), vz };
  if (minPen === penTop) return { x: px, z: minZ - radius, vx, vz: Math.min(0, vz) };
  return { x: px, z: maxZ + radius, vx, vz: Math.max(0, vz) };
}

export function isPointInsideAnyCollider(
  x: number,
  y: number,
  z: number,
  radius: number,
  map: ArenaMapSpec,
): boolean {
  for (const b of map.boxes) {
    if (y >= b.y + b.h || y + PLAYER_HEIGHT_STAND <= b.y) continue;
    const hw = b.w * 0.5 + radius;
    const hd = b.d * 0.5 + radius;
    if (x > b.x - hw && x < b.x + hw && z > b.z - hd && z < b.z + hd) {
      return true;
    }
  }
  for (const p of map.glbProps) {
    if (!p.colliderHalf) continue;
    const [hx, hy, hz] = p.colliderHalf;
    if (y >= p.y + hy * 2 || y + PLAYER_HEIGHT_STAND <= p.y) continue;
    if (Math.abs(x - p.x) < hx + radius && Math.abs(z - p.z) < hz + radius) {
      return true;
    }
  }
  return false;
}

export function stepCharacterMovement(
  state: CharacterMoveState,
  input: CharacterMoveInput,
  map: ArenaMapSpec,
  rawDt: number,
): CharacterMoveState {
  const dt = Math.min(Math.max(rawDt, 0.0001), 0.05);

  state.justJumped = false;
  state.justLanded = false;
  state.justHitJumpPad = false;
  state.justDashed = false;
  state.landingImpactSpeed = 0;

  state.yaw = input.yaw;
  state.pitch = Math.max(-1.42, Math.min(1.42, input.pitch));

  // Timers
  if (state.slideCooldownTimer > 0) state.slideCooldownTimer = Math.max(0, state.slideCooldownTimer - dt);
  if (state.dashCooldownTimer > 0) state.dashCooldownTimer = Math.max(0, state.dashCooldownTimer - dt);
  if (state.coyoteTimer > 0) state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  if (state.jumpBufferTimer > 0) state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);

  if (input.jumpJustPressed) {
    state.jumpBufferTimer = MOVE_CONFIG.jumpBufferTime;
  }

  // Forward (-Z when yaw=0) and Right (+X when yaw=0) basis
  const sinY = Math.sin(state.yaw);
  const cosY = Math.cos(state.yaw);
  const fwdX = -sinY;
  const fwdZ = -cosY;
  const rightX = cosY;
  const rightZ = -sinY;

  let wishX = fwdX * input.forward + rightX * input.right;
  let wishZ = fwdZ * input.forward + rightZ * input.right;
  const wishLen = Math.hypot(wishX, wishZ);
  if (wishLen > 1e-4) {
    wishX /= wishLen;
    wishZ /= wishLen;
  }

  const horizSpeed = Math.hypot(state.vx, state.vz);

  // Slide initiation (Unreal-style tactical crouch slide when moving briskly)
  if (
    input.crouchHeld &&
    !state.sliding &&
    state.grounded &&
    state.slideCooldownTimer <= 0 &&
    horizSpeed > 6.5
  ) {
    state.sliding = true;
    state.slideTimer = MOVE_CONFIG.slideDuration;
    state.slideCooldownTimer = MOVE_CONFIG.slideCooldown;
    if (wishLen > 0.1) {
      state.slideDirX = wishX;
      state.slideDirZ = wishZ;
    } else {
      state.slideDirX = state.vx / horizSpeed;
      state.slideDirZ = state.vz / horizSpeed;
    }
    state.vx = state.slideDirX * MOVE_CONFIG.slideSpeed;
    state.vz = state.slideDirZ * MOVE_CONFIG.slideSpeed;
  }

  if (state.sliding) {
    state.slideTimer -= dt;
    if (state.slideTimer <= 0 || !input.crouchHeld) {
      state.sliding = false;
    }
  }

  state.crouching = input.crouchHeld || state.sliding;

  // Tactical Dash impulse
  if (input.dashJustPressed && state.dashCooldownTimer <= 0) {
    state.dashCooldownTimer = MOVE_CONFIG.dashCooldown;
    const dashDirX = wishLen > 0.1 ? wishX : fwdX;
    const dashDirZ = wishLen > 0.1 ? wishZ : fwdZ;
    state.vx = dashDirX * MOVE_CONFIG.dashImpulse;
    state.vz = dashDirZ * MOVE_CONFIG.dashImpulse;
    if (!state.grounded) {
      state.vy = Math.max(state.vy, 3.2);
    }
    state.justDashed = true;
  }

  // Horizontal acceleration & Unreal braking friction
  const targetMaxSpeed = state.sliding
    ? MOVE_CONFIG.slideSpeed
    : state.crouching
      ? MOVE_CONFIG.crouchSpeed
      : input.sprintHeld && input.forward > 0.15
        ? MOVE_CONFIG.sprintSpeed
        : MOVE_CONFIG.walkSpeed;

  if (state.sliding) {
    // Smooth momentum decay during slide
    const slideDecay = Math.exp(-2.1 * dt);
    state.vx = state.vx * slideDecay + wishX * 2.5 * dt;
    state.vz = state.vz * slideDecay + wishZ * 2.5 * dt;
  } else if (state.grounded) {
    if (wishLen > 0.01) {
      // Turn-friendly ground acceleration
      const targetVx = wishX * targetMaxSpeed;
      const targetVz = wishZ * targetMaxSpeed;
      const dvx = targetVx - state.vx;
      const dvz = targetVz - state.vz;
      const dvLen = Math.hypot(dvx, dvz);
      const maxStep = MOVE_CONFIG.groundAccel * dt;
      if (dvLen <= maxStep) {
        state.vx = targetVx;
        state.vz = targetVz;
      } else {
        state.vx += (dvx / dvLen) * maxStep;
        state.vz += (dvz / dvLen) * maxStep;
      }
    } else {
      // Crisp ground braking deceleration
      const speed = Math.hypot(state.vx, state.vz);
      if (speed > 0) {
        const drop = MOVE_CONFIG.groundBraking * dt;
        const newSpeed = Math.max(0, speed - drop);
        const ratio = newSpeed / speed;
        state.vx *= ratio;
        state.vz *= ratio;
      }
    }
  } else {
    // Air control (preserves momentum while allowing strafing/air-steering)
    if (wishLen > 0.01) {
      const addVx = wishX * MOVE_CONFIG.airAccel * dt;
      const addVz = wishZ * MOVE_CONFIG.airAccel * dt;
      const proj = (state.vx + addVx) * wishX + (state.vz + addVz) * wishZ;
      if (proj <= targetMaxSpeed * 1.05 || Math.hypot(state.vx + addVx, state.vz + addVz) < horizSpeed) {
        state.vx += addVx;
        state.vz += addVz;
      }
    }
    // Slight air drag
    const airDrag = Math.exp(-0.35 * dt);
    state.vx *= airDrag;
    state.vz *= airDrag;
  }

  // Jump execution (supports coyote time + jump buffering + slide-jump boost!)
  if (state.jumpBufferTimer > 0 && (state.grounded || state.coyoteTimer > 0)) {
    state.vy = MOVE_CONFIG.jumpVelocity;
    if (state.sliding) {
      // Slide-jump carries forward burst
      state.vx *= 1.08;
      state.vz *= 1.08;
      state.sliding = false;
    }
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.justJumped = true;
  }

  // Variable jump height cut when jump key released early while ascending
  if (state.jumpHeldPrev && !input.jumpHeld && state.vy > 3.5) {
    state.vy *= 0.52;
  }
  state.jumpHeldPrev = input.jumpHeld;

  // Gravity
  state.vy -= MOVE_CONFIG.gravity * dt;

  // Integrate position (sub-stepped for collision stability)
  const prevY = state.y;
  const nextX = state.x + state.vx * dt;
  const nextZ = state.z + state.vz * dt;
  const nextY = state.y + state.vy * dt;

  let resX = nextX;
  let resZ = nextZ;
  const playerH = state.crouching ? PLAYER_HEIGHT_CROUCH : PLAYER_HEIGHT_STAND;

  // Resolve horizontal collisions against map boxes & GLB props
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < map.boxes.length; i++) {
      const b = map.boxes[i];
      const resolved = resolveCircleVsBox(
        resX,
        resZ,
        nextY,
        PLAYER_RADIUS,
        playerH,
        b.x,
        b.y,
        b.z,
        b.w,
        b.h,
        b.d,
        state.vx,
        state.vz,
      );
      resX = resolved.x;
      resZ = resolved.z;
      state.vx = resolved.vx;
      state.vz = resolved.vz;
    }

    for (let i = 0; i < map.glbProps.length; i++) {
      const prop = map.glbProps[i];
      if (!prop.colliderHalf) continue;
      const [hx, hy, hz] = prop.colliderHalf;
      const resolved = resolveCircleVsBox(
        resX,
        resZ,
        nextY,
        PLAYER_RADIUS,
        playerH,
        prop.x,
        prop.y,
        prop.z,
        hx * 2,
        hy * 2,
        hz * 2,
        state.vx,
        state.vz,
      );
      resX = resolved.x;
      resZ = resolved.z;
      state.vx = resolved.vx;
      state.vz = resolved.vz;
    }
  }

  // Clamp to playable arena boundary
  const bound = map.halfExtent - PLAYER_RADIUS;
  if (resX < -bound) {
    resX = -bound;
    state.vx = Math.max(0, state.vx);
  } else if (resX > bound) {
    resX = bound;
    state.vx = Math.min(0, state.vx);
  }
  if (resZ < -bound) {
    resZ = -bound;
    state.vz = Math.max(0, state.vz);
  } else if (resZ > bound) {
    resZ = bound;
    state.vz = Math.min(0, state.vz);
  }

  // Vertical support resolution (ground, boxes, ramps)
  const supportY = sampleSupportHeight(resX, resZ, Math.max(prevY, nextY), PLAYER_RADIUS, map);
  const wasGrounded = state.grounded;

  if (nextY <= supportY && state.vy <= 0.15) {
    if (!wasGrounded && state.vy < -3.5) {
      state.justLanded = true;
      state.landingImpactSpeed = Math.abs(state.vy);
    }
    state.y = supportY;
    state.vy = 0;
    state.grounded = true;
    state.coyoteTimer = MOVE_CONFIG.coyoteTime;
  } else if (wasGrounded && nextY - supportY <= 0.35 && state.vy <= 0.1) {
    // Stick smoothly when descending ramps
    state.y = supportY;
    state.vy = 0;
    state.grounded = true;
    state.coyoteTimer = MOVE_CONFIG.coyoteTime;
  } else {
    state.y = nextY;
    state.grounded = false;
  }

  // Jump pads check
  for (let i = 0; i < map.jumpPads.length; i++) {
    const pad = map.jumpPads[i];
    const dist = Math.hypot(resX - pad.x, resZ - pad.z);
    if (dist <= pad.radius && Math.abs(state.y - pad.y) <= 0.9 && state.vy < pad.boostY * 0.6) {
      state.vy = pad.boostY;
      state.vx += pad.boostHoriz[0];
      state.vz += pad.boostHoriz[1];
      state.grounded = false;
      state.coyoteTimer = 0;
      state.justHitJumpPad = true;
      break;
    }
  }

  // Update stride distance for walk/bob sync & smooth eyeHeight
  const movedDist = Math.hypot(resX - state.x, resZ - state.z);
  if (state.grounded && !state.sliding) {
    state.strideDistance += movedDist;
  }

  state.x = resX;
  state.z = resZ;

  const targetEye = state.crouching ? EYE_HEIGHT_CROUCH : EYE_HEIGHT_STAND;
  const eyeAlpha = 1 - Math.exp(-16 * dt);
  state.eyeHeight += (targetEye - state.eyeHeight) * eyeAlpha;

  return state;
}

export interface PhysicsCrateHandle {
  id: string;
  body: CANNON.Body;
  size: number;
  kind: 'crate' | 'barrel';
}

export interface PhysicsProjectile {
  id: string;
  ownerId: string;
  body: CANNON.Body;
  life: number;
  damage: number;
  explosionRadius: number;
  impulse: number;
}

export interface ArenaPhysicsWorld {
  world: CANNON.World;
  playerBody: CANNON.Body;
  projMat: CANNON.Material;
  crates: PhysicsCrateHandle[];
  projectiles: PhysicsProjectile[];
}

export function createArenaPhysicsWorld(map: ArenaMapSpec): ArenaPhysicsWorld {
  const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -20, 0),
  });
  world.broadphase = new CANNON.SAPBroadphase(world);
  world.allowSleep = true;

  const defaultMat = new CANNON.Material('default');
  const crateMat = new CANNON.Material('crate');
  const projMat = new CANNON.Material('proj');

  world.addContactMaterial(
    new CANNON.ContactMaterial(defaultMat, crateMat, {
      friction: 0.45,
      restitution: 0.2,
    }),
  );
  world.addContactMaterial(
    new CANNON.ContactMaterial(defaultMat, projMat, {
      friction: 0.25,
      restitution: 0.68,
    }),
  );

  // Ground plane
  const groundBody = new CANNON.Body({
    mass: 0,
    material: defaultMat,
    shape: new CANNON.Plane(),
  });
  groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(groundBody);

  // Arena perimeter walls for physics crates & grenades
  const wallHeight = 14;
  const wallThickness = 2;
  const ext = map.halfExtent + 1;
  const wallSpecs: Array<[number, number, number, number, number, number]> = [
    [0, wallHeight / 2, -ext, ext * 2, wallHeight, wallThickness],
    [0, wallHeight / 2, ext, ext * 2, wallHeight, wallThickness],
    [-ext, wallHeight / 2, 0, wallThickness, wallHeight, ext * 2],
    [ext, wallHeight / 2, 0, wallThickness, wallHeight, ext * 2],
  ];
  for (const [wx, wy, wz, ww, wh, wd] of wallSpecs) {
    const wb = new CANNON.Body({
      mass: 0,
      material: defaultMat,
      shape: new CANNON.Box(new CANNON.Vec3(ww * 0.5, wh * 0.5, wd * 0.5)),
      position: new CANNON.Vec3(wx, wy, wz),
    });
    world.addBody(wb);
  }

  // Map boxes
  for (const b of map.boxes) {
    const body = new CANNON.Body({
      mass: 0,
      material: defaultMat,
      shape: new CANNON.Box(new CANNON.Vec3(b.w * 0.5, b.h * 0.5, b.d * 0.5)),
      position: new CANNON.Vec3(b.x, b.y + b.h * 0.5, b.z),
    });
    world.addBody(body);
  }

  // Ramps as tilted box colliders
  for (const r of map.ramps) {
    const rise = r.yHigh - r.yLow;
    const run = r.riseDir === '+x' || r.riseDir === '-x' ? r.w : r.d;
    const hyp = Math.hypot(run, rise);
    const angle = Math.atan2(rise, run);
    const thickness = 0.4;
    const hw = r.riseDir === '+x' || r.riseDir === '-x' ? hyp * 0.5 : r.w * 0.5;
    const hd = r.riseDir === '+z' || r.riseDir === '-z' ? hyp * 0.5 : r.d * 0.5;
    const body = new CANNON.Body({
      mass: 0,
      material: defaultMat,
      shape: new CANNON.Box(new CANNON.Vec3(hw, thickness * 0.5, hd)),
      position: new CANNON.Vec3(r.x, (r.yLow + r.yHigh) * 0.5 - thickness * 0.45, r.z),
    });
    if (r.riseDir === '+x') body.quaternion.setFromEuler(0, 0, angle);
    else if (r.riseDir === '-x') body.quaternion.setFromEuler(0, 0, -angle);
    else if (r.riseDir === '+z') body.quaternion.setFromEuler(-angle, 0, 0);
    else body.quaternion.setFromEuler(angle, 0, 0);
    world.addBody(body);
  }

  // Kinematic player physics collider so dynamic crates respond when pushed
  const playerBody = new CANNON.Body({
    mass: 0,
    type: CANNON.Body.KINEMATIC,
    material: defaultMat,
    shape: new CANNON.Cylinder(PLAYER_RADIUS * 1.05, PLAYER_RADIUS * 1.05, PLAYER_HEIGHT_STAND, 8),
    position: new CANNON.Vec3(0, PLAYER_HEIGHT_STAND * 0.5, 0),
  });
  world.addBody(playerBody);

  // Dynamic rigid-body crates and rolling barrels
  const crates: PhysicsCrateHandle[] = map.crates.map((c) => {
    const half = c.size * 0.5;
    const kind = c.kind ?? 'crate';
    const shape =
      kind === 'barrel'
        ? new CANNON.Cylinder(half * 0.72, half * 0.72, c.size * 1.15, 10)
        : new CANNON.Box(new CANNON.Vec3(half, half, half));
    const body = new CANNON.Body({
      mass: c.mass,
      material: crateMat,
      linearDamping: 0.22,
      angularDamping: 0.3,
      shape,
      position: new CANNON.Vec3(c.x, c.y, c.z),
    });
    world.addBody(body);
    return { id: c.id, body, size: c.size, kind };
  });

  return {
    world,
    playerBody,
    projMat,
    crates,
    projectiles: [],
  };
}

export function spawnPhysicsProjectile(
  phys: ArenaPhysicsWorld,
  id: string,
  ownerId: string,
  origin: [number, number, number],
  dir: [number, number, number],
  speed: number,
  damage: number,
  explosionRadius: number,
  impulse: number,
): PhysicsProjectile {
  const body = new CANNON.Body({
    mass: 2.5,
    material: phys.projMat,
    linearDamping: 0.05,
    shape: new CANNON.Sphere(0.18),
    position: new CANNON.Vec3(origin[0], origin[1], origin[2]),
  });
  body.velocity.set(dir[0] * speed, dir[1] * speed + 2.4, dir[2] * speed);
  phys.world.addBody(body);
  const proj: PhysicsProjectile = {
    id,
    ownerId,
    body,
    life: 2.4,
    damage,
    explosionRadius,
    impulse,
  };
  phys.projectiles.push(proj);
  return proj;
}

export function applyCrateImpulse(
  phys: ArenaPhysicsWorld,
  crateId: string,
  hitPoint: [number, number, number],
  dir: [number, number, number],
  magnitude: number,
): void {
  const crate = phys.crates.find((c) => c.id === crateId);
  if (!crate) return;
  crate.body.wakeUp();
  const impulse = new CANNON.Vec3(dir[0] * magnitude, dir[1] * magnitude + magnitude * 0.22, dir[2] * magnitude);
  const worldPt = new CANNON.Vec3(hitPoint[0], hitPoint[1], hitPoint[2]);
  crate.body.applyImpulse(impulse, worldPt.vsub(crate.body.position));
}

export function applyRadialExplosionImpulse(
  phys: ArenaPhysicsWorld,
  center: [number, number, number],
  radius: number,
  strength: number,
): void {
  const cx = center[0];
  const cy = center[1];
  const cz = center[2];
  for (const c of phys.crates) {
    const dx = c.body.position.x - cx;
    const dy = c.body.position.y - cy + 0.4;
    const dz = c.body.position.z - cz;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < radius && dist > 0.01) {
      c.body.wakeUp();
      const falloff = 1 - dist / radius;
      const scale = (strength * falloff) / dist;
      c.body.applyImpulse(new CANNON.Vec3(dx * scale, (dy + 1.2) * scale, dz * scale));
    }
  }
}

export function stepArenaPhysicsWorld(
  phys: ArenaPhysicsWorld,
  playerState: CharacterMoveState,
  dt: number,
): void {
  phys.playerBody.position.set(
    playerState.x,
    playerState.y + (playerState.crouching ? PLAYER_HEIGHT_CROUCH : PLAYER_HEIGHT_STAND) * 0.5,
    playerState.z,
  );
  phys.playerBody.velocity.set(playerState.vx, playerState.vy, playerState.vz);

  // Player-to-prop physical momentum transfer (wakes crates/barrels on contact)
  const playerSpeed = Math.hypot(playerState.vx, playerState.vz);
  if (playerSpeed > 0.6) {
    for (let i = 0; i < phys.crates.length; i++) {
      const c = phys.crates[i];
      const dx = c.body.position.x - playerState.x;
      const dz = c.body.position.z - playerState.z;
      const dy = c.body.position.y - (playerState.y + 0.85);
      const minDist = PLAYER_RADIUS + c.size * 0.58;
      const dist = Math.hypot(dx, dz);
      if (dist < minDist && dist > 0.001 && Math.abs(dy) < 1.35) {
        c.body.wakeUp();
        const nx = dx / dist;
        const nz = dz / dist;
        const pushStrength = Math.min(28, playerSpeed * 2.4) * dt * 16;
        c.body.applyImpulse(
          new CANNON.Vec3(nx * pushStrength, pushStrength * 0.12, nz * pushStrength),
          new CANNON.Vec3(0, 0.15, 0),
        );
      }
    }
  }

  phys.world.step(1 / 60, dt, 3);
}
