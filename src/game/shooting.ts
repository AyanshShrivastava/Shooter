export interface SpreadInput {
  baseSpread: number;
  speedMs: number;
  adsHeld: boolean;
  weaponBloom: number;
  grounded: boolean;
}

export interface HitZoneResult {
  isHeadshot: boolean;
  multiplier: number;
}

export interface AimAssistEvaluation {
  lookScale: number;
  magnetDir: [number, number, number] | null;
  autoFireLocked: boolean;
  targetId: string | null;
}

export function computeEffectiveSpread(input: SpreadInput): number {
  const adsMult = input.adsHeld ? 0.36 : 1.0;
  const moveMult = 1.0 + Math.min(0.85, input.speedMs / 13) * (input.adsHeld ? 0.35 : 0.75);
  const airMult = input.grounded ? 1.0 : 1.45;
  const bloomAdd = Math.max(0, input.weaponBloom) * (input.adsHeld ? 0.45 : 1.0);
  return Math.max(0.0005, input.baseSpread * adsMult * moveMult * airMult + bloomAdd);
}

export function computeHitZone(params: {
  hitY: number;
  actorBaseY: number;
  actorHeight?: number;
}): HitZoneResult {
  const height = params.actorHeight ?? 1.9;
  const relY = params.hitY - params.actorBaseY;
  // Top ~28% of character cylinder corresponds to upper neck/helmet hitbox
  const isHeadshot = relY >= height * 0.72 && relY <= height + 0.35;
  return {
    isHeadshot,
    multiplier: isHeadshot ? 1.5 : 1.0,
  };
}

export function updateFireInputBuffer(params: {
  currentBuffer: number;
  justPressed: boolean;
  dt: number;
  maxBuffer?: number;
}): number {
  const maxBuf = params.maxBuffer ?? 0.12;
  if (params.justPressed) return maxBuf;
  return Math.max(0, params.currentBuffer - Math.max(0, params.dt));
}

export interface TargetBodyCenter {
  id: string;
  x: number;
  y: number;
  z: number;
}

/**
 * Evaluates subtle touch aim-assist:
 * - Friction: slows reticle turn speed inside a 6.5 deg cone over an enemy for precise thumb tracking
 * - Magnetism: snaps hitscan aim vector within a tight 2.4 deg cone toward target center on mobile touch
 * - Auto-fire lock: detects when reticle is directly centered (< 2.1 deg) on a target in weapon range
 */
export function evaluateTouchAimAssist(params: {
  camPos: [number, number, number];
  camDir: [number, number, number];
  targets: TargetBodyCenter[];
  maxRange: number;
}): AimAssistEvaluation {
  const dirLen = Math.hypot(params.camDir[0], params.camDir[1], params.camDir[2]);
  if (dirLen < 1e-5 || params.targets.length === 0) {
    return { lookScale: 1, magnetDir: null, autoFireLocked: false, targetId: null };
  }
  const dx0 = params.camDir[0] / dirLen;
  const dy0 = params.camDir[1] / dirLen;
  const dz0 = params.camDir[2] / dirLen;

  const frictionCos = Math.cos((6.5 * Math.PI) / 180);
  const magnetCos = Math.cos((2.4 * Math.PI) / 180);
  const autoFireCos = Math.cos((2.1 * Math.PI) / 180);

  let bestDot = -1;
  let bestDir: [number, number, number] | null = null;
  let bestId: string | null = null;

  for (const t of params.targets) {
    const vx = t.x - params.camPos[0];
    const vy = t.y - params.camPos[1];
    const vz = t.z - params.camPos[2];
    const dist = Math.hypot(vx, vy, vz);
    if (dist < 0.6 || dist > params.maxRange) continue;

    const nx = vx / dist;
    const ny = vy / dist;
    const nz = vz / dist;
    const dot = nx * dx0 + ny * dy0 + nz * dz0;
    if (dot > bestDot) {
      bestDot = dot;
      bestDir = [nx, ny, nz];
      bestId = t.id;
    }
  }

  if (bestDot < frictionCos || !bestDir || !bestId) {
    return { lookScale: 1, magnetDir: null, autoFireLocked: false, targetId: null };
  }

  const frictionFactor = Math.min(1, (bestDot - frictionCos) / (1 - frictionCos));
  const lookScale = 1.0 - frictionFactor * 0.52;
  const magnetDir = bestDot >= magnetCos ? bestDir : null;
  const autoFireLocked = bestDot >= autoFireCos;

  return {
    lookScale,
    magnetDir,
    autoFireLocked,
    targetId: bestId,
  };
}
