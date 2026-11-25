import { ArenaMapSpec, MapBox } from '../shared/maps';
import { NetPlayerState, WeaponId } from '../shared/types';
import { WEAPONS } from '../shared/weapons';
import { CharacterMoveInput, CharacterMoveState } from '../game/physicsMovement';

export interface BotTacticalMemory {
  patrolTarget: [number, number];
  patrolTimer: number;
  fireCooldown: number;
  reactionDelay: number;
  strafeSign: number;
  strafeTimer: number;
  jumpTimer: number;
  hurtEvadeTimer: number;
  hadLosPrev: boolean;
  lastKnownTargetPos: [number, number, number] | null;
}

function rayIntersectsAabb(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): boolean {
  let tmin = 0;
  let tmax = maxDist;

  // X slab
  if (Math.abs(dx) < 1e-6) {
    if (ox < minX || ox > maxX) return false;
  } else {
    const inv = 1 / dx;
    let t1 = (minX - ox) * inv;
    let t2 = (maxX - ox) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-6) {
    if (oy < minY || oy > maxY) return false;
  } else {
    const inv = 1 / dy;
    let t1 = (minY - oy) * inv;
    let t2 = (maxY - oy) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z slab
  if (Math.abs(dz) < 1e-6) {
    if (oz < minZ || oz > maxZ) return false;
  } else {
    const inv = 1 / dz;
    let t1 = (minZ - oz) * inv;
    let t2 = (maxZ - oz) * inv;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return tmax > 0.05 && tmin < maxDist;
}

/**
 * Checks whether a 3D sightline between two points is unobstructed by map architecture.
 */
export function hasLineOfSight(
  from: [number, number, number],
  to: [number, number, number],
  map: ArenaMapSpec,
): boolean {
  const vx = to[0] - from[0];
  const vy = to[1] - from[1];
  const vz = to[2] - from[2];
  const dist = Math.hypot(vx, vy, vz);
  if (dist < 0.1) return true;

  const dx = vx / dist;
  const dy = vy / dist;
  const dz = vz / dist;
  const maxCheck = Math.max(0, dist - 0.35);

  for (let i = 0; i < map.boxes.length; i++) {
    const b = map.boxes[i];
    if (
      rayIntersectsAabb(
        from[0],
        from[1],
        from[2],
        dx,
        dy,
        dz,
        maxCheck,
        b.x - b.w * 0.5,
        b.y,
        b.z - b.d * 0.5,
        b.x + b.w * 0.5,
        b.y + b.h,
        b.z + b.d * 0.5,
      )
    ) {
      return false;
    }
  }

  for (let i = 0; i < map.glbProps.length; i++) {
    const p = map.glbProps[i];
    if (!p.colliderHalf) continue;
    const [hx, hy, hz] = p.colliderHalf;
    if (
      rayIntersectsAabb(
        from[0],
        from[1],
        from[2],
        dx,
        dy,
        dz,
        maxCheck,
        p.x - hx,
        p.y,
        p.z - hz,
        p.x + hx,
        p.y + hy * 2,
        p.z + hz,
      )
    ) {
      return false;
    }
  }

  return true;
}

function probeBoxAhead(
  x: number,
  y: number,
  z: number,
  dirX: number,
  dirZ: number,
  lookAhead: number,
  map: ArenaMapSpec,
): MapBox | null {
  const steps = [1.1, lookAhead];
  for (const s of steps) {
    const px = x + dirX * s;
    const pz = z + dirZ * s;
    if (Math.abs(px) > map.halfExtent - 1.0 || Math.abs(pz) > map.halfExtent - 1.0) {
      return {
        id: 'perimeter',
        x: px,
        y: 0,
        z: pz,
        w: 2,
        h: 4,
        d: 2,
        kind: 'wall',
      };
    }
    for (let i = 0; i < map.boxes.length; i++) {
      const b = map.boxes[i];
      if (y >= b.y + b.h - 0.35 || y + 1.8 <= b.y) continue;
      if (
        px >= b.x - b.w * 0.5 - 0.65 &&
        px <= b.x + b.w * 0.5 + 0.65 &&
        pz >= b.z - b.d * 0.5 - 0.65 &&
        pz <= b.z + b.d * 0.5 + 0.65
      ) {
        return b;
      }
    }
  }
  return null;
}

function shortestAngleDiff(from: number, to: number): number {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function weaponPreferredRange(weaponId: WeaponId): { min: number; max: number } {
  switch (weaponId) {
    case 'scatter-gun':
      return { min: 4.5, max: 10.5 };
    case 'rail-rifle':
      return { min: 15.0, max: 28.0 };
    case 'frag-launcher':
      return { min: 10.0, max: 22.0 };
    default:
      return { min: 8.5, max: 17.5 };
  }
}

export interface BotStepDecision {
  moveInput: CharacterMoveInput;
  shouldFire: boolean;
  fireOrigin: [number, number, number];
  fireDir: [number, number, number];
  didHit: boolean;
  hitPoint?: [number, number, number];
  targetId?: string;
}

export function evaluateBotStep(
  botState: NetPlayerState,
  botMove: CharacterMoveState,
  mem: BotTacticalMemory,
  opponents: NetPlayerState[],
  map: ArenaMapSpec,
  dt: number,
  rng: () => number = Math.random,
): BotStepDecision {
  mem.strafeTimer -= dt;
  if (mem.strafeTimer <= 0) {
    mem.strafeTimer = 0.85 + rng() * 1.15;
    mem.strafeSign = rng() > 0.5 ? 1 : -1;
  }

  mem.jumpTimer -= dt;
  mem.hurtEvadeTimer = Math.max(0, mem.hurtEvadeTimer - dt);
  mem.fireCooldown = Math.max(0, mem.fireCooldown - dt);
  mem.patrolTimer -= dt;

  // Score opponents by visibility + proximity so visible threats take priority over hidden targets behind walls
  const botEye: [number, number, number] = [botState.x, botState.y + 1.48, botState.z];
  let bestTarget: NetPlayerState | null = null;
  let bestScore = -Infinity;
  let bestHasLos = false;
  let bestDist = Infinity;

  for (const other of opponents) {
    if (other.id === botState.id || !other.alive) continue;
    const dist = Math.hypot(other.x - botState.x, other.y - botState.y, other.z - botState.z);
    const targetCenter: [number, number, number] = [other.x, other.y + 1.12, other.z];
    const los = dist < 44 && hasLineOfSight(botEye, targetCenter, map);
    const score = (los ? 60 : 0) - dist;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
      bestHasLos = los;
      bestDist = dist;
    }
  }

  if (bestHasLos && !mem.hadLosPrev) {
    // Brief human-like reaction window when first spotting an enemy
    mem.reactionDelay = 0.18 + rng() * 0.18;
  }
  mem.hadLosPrev = bestHasLos;
  mem.reactionDelay = Math.max(0, mem.reactionDelay - dt);

  if (bestTarget && bestHasLos) {
    mem.lastKnownTargetPos = [bestTarget.x, bestTarget.y, bestTarget.z];
  }

  // Choose world-space navigation goal
  let goalX = mem.patrolTarget[0];
  let goalZ = mem.patrolTarget[1];

  if (mem.patrolTimer <= 0 || Math.hypot(goalX - botState.x, goalZ - botState.z) < 2.6) {
    mem.patrolTimer = 4.5 + rng() * 3.5;
    const sp = map.spawnPoints[Math.floor(rng() * map.spawnPoints.length)];
    goalX = sp ? sp.x : (rng() - 0.5) * map.halfExtent;
    goalZ = sp ? sp.z : (rng() - 0.5) * map.halfExtent;
    mem.patrolTarget = [goalX, goalZ];
  }

  // Use nearby jump pad if pursuing an elevated opponent or rotating aggressively
  let seekingJumpPad = false;
  if (bestTarget && bestTarget.y > botState.y + 1.5 && botState.y < 1.0) {
    let closestPadDist = 14;
    for (const pad of map.jumpPads) {
      const d = Math.hypot(pad.x - botState.x, pad.z - botState.z);
      if (d < closestPadDist) {
        closestPadDist = d;
        goalX = pad.x;
        goalZ = pad.z;
        seekingJumpPad = true;
      }
    }
  } else if (bestTarget) {
    if (bestHasLos) {
      goalX = bestTarget.x;
      goalZ = bestTarget.z;
    } else if (mem.lastKnownTargetPos) {
      goalX = mem.lastKnownTargetPos[0];
      goalZ = mem.lastKnownTargetPos[2];
    } else {
      goalX = bestTarget.x;
      goalZ = bestTarget.z;
    }
  }

  // Desired aim yaw (face enemy when in LOS, otherwise look along navigation direction)
  const navDx = goalX - botState.x;
  const navDz = goalZ - botState.z;
  const navDist = Math.hypot(navDx, navDz) || 1;
  const navYaw = Math.atan2(-navDx, -navDz);

  let desiredYaw = navYaw;
  if (bestTarget && bestHasLos) {
    desiredYaw = Math.atan2(-(bestTarget.x - botState.x), -(bestTarget.z - botState.z));
  }

  // Smooth turn speed (fast enough to track strafing, realistic enough not to snap instantaneously)
  const yawDiff = shortestAngleDiff(botMove.yaw, desiredYaw);
  const maxTurn = (bestHasLos ? 6.8 : 4.6) * dt;
  const nextYaw =
    Math.abs(yawDiff) <= maxTurn ? desiredYaw : botMove.yaw + Math.sign(yawDiff) * maxTurn;

  // Obstacle feeler rays in world-space navigation direction
  const dirX = navDx / navDist;
  const dirZ = navDz / navDist;
  const blockedCenter = probeBoxAhead(botState.x, botState.y, botState.z, dirX, dirZ, 2.8, map);

  let forward = 0.9;
  let right = 0.25 * mem.strafeSign;
  let jumpJustPressed = false;
  let crouchHeld = false;
  let dashJustPressed = false;
  let sprintHeld = false;

  if (bestTarget && bestHasLos && !seekingJumpPad) {
    const pref = weaponPreferredRange(botState.weaponId);
    if (bestDist < pref.min) {
      forward = -0.45;
      right = 0.92 * mem.strafeSign;
    } else if (bestDist <= pref.max) {
      forward = 0.15;
      right = 0.88 * mem.strafeSign;
    } else {
      forward = 0.92;
      right = 0.45 * mem.strafeSign;
      sprintHeld = bestDist > pref.max + 4;
    }
  } else {
    // Navigating around arena toward target or jump pad
    forward = 1.0;
    sprintHeld = !blockedCenter && navDist > 7;
    if (blockedCenter) {
      if (blockedCenter.y + blockedCenter.h - botState.y <= 1.55) {
        // Low crate/cover — vault jump over it!
        jumpJustPressed = true;
      } else {
        // Tall wall/bunker — probe left vs right flank direction
        const angle = 0.72;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const lx = dirX * cosA - dirZ * sinA;
        const lz = dirX * sinA + dirZ * cosA;
        const rx = dirX * cosA + dirZ * sinA;
        const rz = -dirX * sinA + dirZ * cosA;
        const leftBlocked = probeBoxAhead(botState.x, botState.y, botState.z, lx, lz, 3.2, map);
        const rightBlocked = probeBoxAhead(botState.x, botState.y, botState.z, rx, rz, 3.2, map);
        if (!leftBlocked && rightBlocked) mem.strafeSign = -1;
        else if (!rightBlocked && leftBlocked) mem.strafeSign = 1;
        forward = 0.35;
        right = 0.95 * mem.strafeSign;
      }
    }
  }

  // Reactive combat evasion: dash or crouch-slide when hurt
  if (mem.hurtEvadeTimer > 0) {
    right = 1.0 * mem.strafeSign;
    if (botMove.dashCooldownTimer <= 0) {
      dashJustPressed = true;
    } else if (Math.hypot(botMove.vx, botMove.vz) > 7.5 && botMove.slideCooldownTimer <= 0) {
      crouchHeld = true;
    }
  }

  // Occasional combat hop during close-range strafes
  if (mem.jumpTimer <= 0) {
    mem.jumpTimer = 2.4 + rng() * 2.8;
    if (bestHasLos && bestDist < 16) {
      jumpJustPressed = true;
    }
  }

  // Firing decision — strictly requires unobstructed 3D Line of Sight!
  let shouldFire = false;
  let didHit = false;
  let hitPoint: [number, number, number] | undefined;
  let fireDir: [number, number, number] = [-Math.sin(nextYaw), 0, -Math.cos(nextYaw)];

  if (
    bestTarget &&
    bestHasLos &&
    mem.reactionDelay <= 0 &&
    mem.fireCooldown <= 0 &&
    bestDist <= WEAPONS[botState.weaponId].range
  ) {
    const spec = WEAPONS[botState.weaponId];
    // Pace bursts realistically based on weapon archetype
    const burstScale =
      spec.id === 'pulse-carbine'
        ? 2.2
        : spec.id === 'rail-rifle'
          ? 1.5
          : spec.id === 'scatter-gun'
            ? 1.65
            : 1.8;
    mem.fireCooldown = spec.fireInterval * burstScale + rng() * 0.28;
    shouldFire = true;

    const dx = bestTarget.x - botEye[0];
    const dy = bestTarget.y + 1.12 - botEye[1];
    const dz = bestTarget.z - botEye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    fireDir = [dx / len, dy / len, dz / len];

    // Accuracy scales cleanly with distance and angular alignment
    const alignmentPenalty = Math.min(0.2, Math.abs(yawDiff) * 0.35);
    const baseAcc = spec.id === 'rail-rifle' ? 0.44 : spec.id === 'scatter-gun' ? 0.48 : 0.36;
    const hitChance = Math.max(0.14, baseAcc - bestDist * 0.0065 - alignmentPenalty);
    didHit = rng() < hitChance;
    if (didHit) {
      hitPoint = [bestTarget.x, bestTarget.y + 1.12, bestTarget.z];
    } else {
      const missSpread = 0.08 + bestDist * 0.002;
      const mx = fireDir[0] + (rng() - 0.5) * missSpread;
      const my = fireDir[1] + (rng() - 0.5) * missSpread;
      const mz = fireDir[2] + (rng() - 0.5) * missSpread;
      const mLen = Math.hypot(mx, my, mz) || 1;
      fireDir = [mx / mLen, my / mLen, mz / mLen];
      hitPoint = [
        botEye[0] + fireDir[0] * bestDist,
        Math.max(0.2, botEye[1] + fireDir[1] * bestDist),
        botEye[2] + fireDir[2] * bestDist,
      ];
    }
  }

  return {
    moveInput: {
      forward,
      right,
      yaw: nextYaw,
      pitch: 0,
      jumpHeld: jumpJustPressed,
      jumpJustPressed,
      sprintHeld,
      crouchHeld,
      dashJustPressed,
    },
    shouldFire,
    fireOrigin: botEye,
    fireDir,
    didHit,
    hitPoint,
    targetId: bestTarget?.id,
  };
}
