import { ArenaMapSpec, MapBox } from '../shared/maps';
import { NetPlayerState, WeaponId } from '../shared/types';
import { WEAPONS } from '../shared/weapons';
import { CharacterMoveInput, CharacterMoveState } from '../game/physicsMovement';

export type BotRole = 'rusher' | 'sharpshooter' | 'flanker' | 'demolition';

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
  role?: BotRole;
  lastPos?: [number, number, number];
  stuckTimer?: number;
  coverTarget?: [number, number] | null;
  coverTimer?: number;
}

export function roleForWeapon(weaponId: WeaponId): BotRole {
  switch (weaponId) {
    case 'scatter-gun':
      return 'rusher';
    case 'rail-rifle':
      return 'sharpshooter';
    case 'frag-launcher':
      return 'demolition';
    default:
      return 'flanker';
  }
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

function isInsideBoxXZ(x: number, z: number, map: ArenaMapSpec, pad = 0.9): boolean {
  if (Math.abs(x) > map.halfExtent - pad || Math.abs(z) > map.halfExtent - pad) return true;
  for (let i = 0; i < map.boxes.length; i++) {
    const b = map.boxes[i];
    if (b.h < 0.8) continue;
    if (
      x >= b.x - b.w * 0.5 - pad &&
      x <= b.x + b.w * 0.5 + pad &&
      z >= b.z - b.d * 0.5 - pad &&
      z <= b.z + b.d * 0.5 + pad
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Finds the closest tactical cover point behind a solid structure that breaks sightline to a threat.
 */
export function findNearestCoverPoint(
  botPos: [number, number, number],
  threatPos: [number, number, number],
  map: ArenaMapSpec,
): [number, number] | null {
  const threatEye: [number, number, number] = [threatPos[0], threatPos[1] + 1.35, threatPos[2]];
  let bestSpot: [number, number] | null = null;
  let bestScore = Infinity;

  for (let i = 0; i < map.boxes.length; i++) {
    const b = map.boxes[i];
    if (b.h < 1.8) continue;
    const margin = 1.45;
    const candidates: Array<[number, number]> = [
      [b.x + b.w * 0.5 + margin, b.z],
      [b.x - b.w * 0.5 - margin, b.z],
      [b.x, b.z + b.d * 0.5 + margin],
      [b.x, b.z - b.d * 0.5 - margin],
    ];

    for (const [cx, cz] of candidates) {
      if (isInsideBoxXZ(cx, cz, map, 0.75)) continue;
      const distBot = Math.hypot(cx - botPos[0], cz - botPos[2]);
      if (distBot > 22) continue;
      const candidateEye: [number, number, number] = [cx, 1.35, cz];
      if (!hasLineOfSight(candidateEye, threatEye, map)) {
        const distThreat = Math.hypot(cx - threatPos[0], cz - threatPos[2]);
        const score = distBot - Math.min(12, distThreat) * 0.25;
        if (score < bestScore) {
          bestScore = score;
          bestSpot = [cx, cz];
        }
      }
    }
  }

  return bestSpot;
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
  const steps = [1.05, lookAhead];
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

function weaponPreferredRange(weaponId: WeaponId, role: BotRole): { min: number; max: number } {
  if (role === 'rusher') return { min: 3.5, max: 9.0 };
  if (role === 'sharpshooter') return { min: 16.0, max: 30.0 };
  if (role === 'demolition') return { min: 10.5, max: 21.0 };
  switch (weaponId) {
    case 'scatter-gun':
      return { min: 4.0, max: 9.5 };
    case 'rail-rifle':
      return { min: 15.0, max: 28.0 };
    case 'frag-launcher':
      return { min: 10.0, max: 22.0 };
    default:
      return { min: 8.5, max: 17.5 };
  }
}

export interface BotDifficultyProfile {
  kdr: number;
  hpRatio: number;
  difficultyScale: number;
  accuracyMultiplier: number;
  reactionTimeMultiplier: number;
}

/**
 * Computes dynamic bot accuracy and reaction-time multipliers from a player's K/D ratio and current HP.
 * Neutral (1.0x) when no human player target is engaged.
 */
export function computeBotDifficultyProfile(target: NetPlayerState | null): BotDifficultyProfile {
  if (!target || target.isBot) {
    return {
      kdr: 1,
      hpRatio: 1,
      difficultyScale: 1,
      accuracyMultiplier: 1,
      reactionTimeMultiplier: 1,
    };
  }

  const kills = Math.max(0, target.kills);
  const deaths = Math.max(0, target.deaths);
  const kdr = kills / Math.max(1, deaths);
  const maxHp = Math.max(1, target.maxHp || 100);
  const hpRatio = Math.max(0, Math.min(1, target.hp / maxHp));

  let kdOffset = 0;
  if (kills === 0 && deaths === 0) {
    kdOffset = 0;
  } else if (kdr >= 1) {
    kdOffset = Math.min(0.45, (kdr - 1) * 0.18);
  } else {
    kdOffset = -Math.min(0.35, (1 - kdr) * 0.22 + Math.max(0, deaths - kills) * 0.04);
  }

  const hpOffset =
    hpRatio >= 0.65
      ? ((hpRatio - 0.65) / 0.35) * 0.07
      : -((0.65 - hpRatio) / 0.65) * 0.28;

  const difficultyScale = Math.max(0.55, Math.min(1.52, 1.0 + kdOffset + hpOffset));
  const accuracyMultiplier = Number(difficultyScale.toFixed(4));
  const reactionTimeMultiplier = Number(
    Math.max(0.55, Math.min(1.45, 2.0 - difficultyScale)).toFixed(4),
  );

  return {
    kdr: Number(kdr.toFixed(3)),
    hpRatio: Number(hpRatio.toFixed(3)),
    difficultyScale: Number(difficultyScale.toFixed(4)),
    accuracyMultiplier,
    reactionTimeMultiplier,
  };
}

export interface BotStepDecision {
  moveInput: CharacterMoveInput;
  shouldFire: boolean;
  fireOrigin: [number, number, number];
  fireDir: [number, number, number];
  didHit: boolean;
  hitPoint?: [number, number, number];
  targetId?: string;
  difficulty: BotDifficultyProfile;
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
  const role = mem.role ?? roleForWeapon(botState.weaponId);
  mem.role = role;

  mem.strafeTimer -= dt;
  if (mem.strafeTimer <= 0) {
    mem.strafeTimer = (role === 'rusher' ? 0.65 : 0.9) + rng() * 0.95;
    mem.strafeSign = rng() > 0.5 ? 1 : -1;
  }

  mem.jumpTimer -= dt;
  mem.hurtEvadeTimer = Math.max(0, mem.hurtEvadeTimer - dt);
  mem.fireCooldown = Math.max(0, mem.fireCooldown - dt);
  mem.patrolTimer -= dt;
  mem.coverTimer = Math.max(0, (mem.coverTimer ?? 0) - dt);

  // Track movement progress to detect and break out of corner/obstacle snags
  if (!mem.lastPos) {
    mem.lastPos = [botState.x, botState.y, botState.z];
    mem.stuckTimer = 0;
  } else {
    const movedDist = Math.hypot(botState.x - mem.lastPos[0], botState.z - mem.lastPos[2]);
    if (movedDist < 0.25 * dt) {
      mem.stuckTimer = (mem.stuckTimer ?? 0) + dt;
    } else {
      mem.stuckTimer = 0;
    }
    mem.lastPos = [botState.x, botState.y, botState.z];
  }

  // Score opponents by 3D visibility, proximity, and low-HP finish priority
  const botEye: [number, number, number] = [botState.x, botState.y + 1.48, botState.z];
  let bestTarget: NetPlayerState | null = null;
  let bestScore = -Infinity;
  let bestHasLos = false;
  let bestDist = Infinity;

  for (const other of opponents) {
    if (other.id === botState.id || !other.alive) continue;
    const dist = Math.hypot(other.x - botState.x, other.y - botState.y, other.z - botState.z);
    const targetCenter: [number, number, number] = [other.x, other.y + 1.12, other.z];
    const los = dist < 48 && hasLineOfSight(botEye, targetCenter, map);
    const lowHpBonus = other.hp <= 30 ? 8 : 0;
    const score = (los ? 65 : 0) + lowHpBonus - dist;
    if (score > bestScore) {
      bestScore = score;
      bestTarget = other;
      bestHasLos = los;
      bestDist = dist;
    }
  }

  const difficulty = computeBotDifficultyProfile(bestTarget);

  if (bestHasLos && !mem.hadLosPrev) {
    mem.reactionDelay = (0.55 + rng() * 0.45) * difficulty.reactionTimeMultiplier;
  }
  mem.hadLosPrev = bestHasLos;
  mem.reactionDelay = Math.max(0, mem.reactionDelay - dt);

  if (bestTarget && bestHasLos) {
    mem.lastKnownTargetPos = [bestTarget.x, bestTarget.y, bestTarget.z];
  }

  // Gentle velocity lead prediction so strafing remains dodgeable
  let aimTargetX = bestTarget ? bestTarget.x : botState.x;
  let aimTargetY = bestTarget ? bestTarget.y + 1.12 : botState.y + 1.12;
  let aimTargetZ = bestTarget ? bestTarget.z : botState.z;
  if (bestTarget) {
    const leadTime =
      botState.weaponId === 'frag-launcher'
        ? Math.min(0.42, bestDist / 42)
        : Math.min(0.14, 0.03 + bestDist * 0.0025);
    aimTargetX += bestTarget.vx * leadTime;
    aimTargetZ += bestTarget.vz * leadTime;
    if (botState.weaponId === 'frag-launcher') {
      aimTargetY = bestTarget.y + 0.4;
    } else {
      aimTargetY += bestTarget.vy * leadTime * 0.25;
    }
  }

  // Retreat to cover only when critically low
  let retreatingToCover = false;
  if (botState.hp <= 22 && bestTarget && bestHasLos) {
    if (!mem.coverTarget || mem.coverTimer <= 0) {
      mem.coverTarget = findNearestCoverPoint(
        [botState.x, botState.y, botState.z],
        [bestTarget.x, bestTarget.y, bestTarget.z],
        map,
      );
      mem.coverTimer = 2.0;
    }
    if (mem.coverTarget) {
      retreatingToCover = true;
    }
  } else if (botState.hp > 50) {
    mem.coverTarget = null;
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

  let seekingElevation = false;
  if (retreatingToCover && mem.coverTarget) {
    goalX = mem.coverTarget[0];
    goalZ = mem.coverTarget[1];
  } else if (
    (bestTarget && bestTarget.y > botState.y + 1.5 && botState.y < 1.0) ||
    (role === 'sharpshooter' && botState.y < 1.5 && (!bestTarget || bestDist > 18))
  ) {
    // Pursue elevated targets or seek sniper high-ground via nearest jump pad or ramp
    let bestElevScore = 15;
    for (const pad of map.jumpPads) {
      const d = Math.hypot(pad.x - botState.x, pad.z - botState.z);
      if (d < bestElevScore) {
        bestElevScore = d;
        goalX = pad.x;
        goalZ = pad.z;
        seekingElevation = true;
      }
    }
    if (!seekingElevation && map.ramps.length > 0) {
      let bestRampDist = 18;
      for (const r of map.ramps) {
        const d = Math.hypot(r.x - botState.x, r.z - botState.z);
        if (d < bestRampDist) {
          bestRampDist = d;
          goalX = r.x;
          goalZ = r.z;
          seekingElevation = true;
        }
      }
    }
  }

  if (!retreatingToCover && !seekingElevation && bestTarget) {
    if (bestHasLos) {
      if (role === 'flanker' && bestDist > 11) {
        // Approach on a lateral flanking arc rather than straight down the centerline
        const toBotX = botState.x - bestTarget.x;
        const toBotZ = botState.z - bestTarget.z;
        const len = Math.hypot(toBotX, toBotZ) || 1;
        const perpX = (-toBotZ / len) * 6.5 * mem.strafeSign;
        const perpZ = (toBotX / len) * 6.5 * mem.strafeSign;
        goalX = bestTarget.x + perpX;
        goalZ = bestTarget.z + perpZ;
      } else {
        goalX = bestTarget.x;
        goalZ = bestTarget.z;
      }
    } else if (mem.lastKnownTargetPos) {
      goalX = mem.lastKnownTargetPos[0];
      goalZ = mem.lastKnownTargetPos[2];
    } else {
      goalX = bestTarget.x;
      goalZ = bestTarget.z;
    }
  }

  const navDx = goalX - botState.x;
  const navDz = goalZ - botState.z;
  const navDist = Math.hypot(navDx, navDz) || 1;
  const navYaw = Math.atan2(-navDx, -navDz);

  let desiredYaw = navYaw;
  if (bestTarget && bestHasLos && !retreatingToCover) {
    desiredYaw = Math.atan2(-(aimTargetX - botState.x), -(aimTargetZ - botState.z));
  }

  const yawDiff = shortestAngleDiff(botMove.yaw, desiredYaw);
  const maxTurn = (bestHasLos ? 3.8 : 3.2) * (0.85 + 0.15 * difficulty.accuracyMultiplier) * dt;
  const nextYaw =
    Math.abs(yawDiff) <= maxTurn ? desiredYaw : botMove.yaw + Math.sign(yawDiff) * maxTurn;

  const dirX = navDx / navDist;
  const dirZ = navDz / navDist;
  const blockedCenter = probeBoxAhead(botState.x, botState.y, botState.z, dirX, dirZ, 2.9, map);

  let forward = 0.85;
  let right = 0.18 * mem.strafeSign;
  let jumpJustPressed = false;
  let crouchHeld = false;
  let dashJustPressed = false;
  let sprintHeld = false;

  if (retreatingToCover) {
    forward = 0.95;
    sprintHeld = true;
    right = 0.15 * mem.strafeSign;
  } else if (bestTarget && bestHasLos && !seekingElevation) {
    const pref = weaponPreferredRange(botState.weaponId, role);
    if (bestDist < pref.min) {
      forward = -0.45;
      right = 0.55 * mem.strafeSign;
    } else if (bestDist <= pref.max) {
      forward = role === 'rusher' ? 0.35 : 0.08;
      right = 0.52 * mem.strafeSign;
    } else {
      forward = 0.88;
      right = (role === 'flanker' ? 0.45 : 0.25) * mem.strafeSign;
      sprintHeld = bestDist > pref.max + 5;
    }
  } else {
    forward = 1.0;
    sprintHeld = !blockedCenter && navDist > 6.5;
    if (blockedCenter) {
      if (blockedCenter.y + blockedCenter.h - botState.y <= 1.55) {
        jumpJustPressed = true;
      } else {
        const angle = 0.78;
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
        right = 0.98 * mem.strafeSign;
      }
    }
  }

  // Unstuck recovery if jammed against geometry for > 0.55s
  if ((mem.stuckTimer ?? 0) > 0.55) {
    mem.stuckTimer = 0;
    mem.strafeSign = -mem.strafeSign;
    jumpJustPressed = true;
    right = 1.0 * mem.strafeSign;
    forward = -0.35;
    if (botMove.dashCooldownTimer <= 0) {
      dashJustPressed = true;
    }
  }

  // Reactive combat evasion when hurt
  if (mem.hurtEvadeTimer > 0) {
    right = 1.0 * mem.strafeSign;
    if (botMove.dashCooldownTimer <= 0) {
      dashJustPressed = true;
    } else if (Math.hypot(botMove.vx, botMove.vz) > 7.2 && botMove.slideCooldownTimer <= 0) {
      crouchHeld = true;
    }
  }

  // Occasional combat hop (less bunny-hop spam)
  if (mem.jumpTimer <= 0) {
    mem.jumpTimer = 4.5 + rng() * 4.5;
    if (bestHasLos && bestDist < 12 && rng() < 0.4) {
      jumpJustPressed = true;
    }
  }

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
    const burstScale =
      spec.id === 'pulse-carbine'
        ? 3.2
        : spec.id === 'rail-rifle'
          ? 2.25
          : spec.id === 'scatter-gun'
            ? 2.4
            : 2.55;
    const cadenceMult = Math.max(0.82, Math.min(1.22, 0.55 + 0.45 * difficulty.reactionTimeMultiplier));
    mem.fireCooldown = (spec.fireInterval * burstScale + 0.18 + rng() * 0.55) * cadenceMult;
    shouldFire = true;

    const dx = aimTargetX - botEye[0];
    const dy = aimTargetY - botEye[1];
    const dz = aimTargetZ - botEye[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    fireDir = [dx / len, dy / len, dz / len];

    const alignmentPenalty = Math.min(0.18, Math.abs(yawDiff) * 0.35);
    const baseAcc =
      spec.id === 'rail-rifle'
        ? 0.24
        : spec.id === 'scatter-gun'
          ? 0.28
          : spec.id === 'frag-launcher'
            ? 0.24
            : 0.22;
    const rawHitChance = Math.max(0.05, baseAcc - bestDist * 0.007 - alignmentPenalty);
    const hitChance = Math.max(
      0.05,
      Math.min(0.62, rawHitChance * difficulty.accuracyMultiplier),
    );
    didHit = rng() < hitChance;
    if (didHit) {
      hitPoint = [aimTargetX, aimTargetY, aimTargetZ];
    } else {
      const missSpread = (0.14 + bestDist * 0.003) / Math.sqrt(difficulty.accuracyMultiplier);
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
    difficulty,
  };
}
