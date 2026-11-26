import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEffectiveSpread,
  computeHitZone,
  evaluateTouchAimAssist,
  updateFireInputBuffer,
} from './shooting';

test('computeEffectiveSpread tightens on ADS and blooms on sprint, airborne, and rapid fire', () => {
  const baseHip = computeEffectiveSpread({
    baseSpread: 0.014,
    speedMs: 0,
    adsHeld: false,
    weaponBloom: 0,
    grounded: true,
  });
  const adsStanding = computeEffectiveSpread({
    baseSpread: 0.014,
    speedMs: 0,
    adsHeld: true,
    weaponBloom: 0,
    grounded: true,
  });
  const sprintingAir = computeEffectiveSpread({
    baseSpread: 0.014,
    speedMs: 12,
    adsHeld: false,
    weaponBloom: 0.02,
    grounded: false,
  });

  assert.ok(adsStanding < baseHip, 'ADS spread should be tighter than hipfire');
  assert.ok(sprintingAir > baseHip * 2, 'Airborne sprinting with bloom should widen spread');
});

test('computeHitZone awards 1.5x headshot multiplier on upper helmet hitbox only', () => {
  const bodyHit = computeHitZone({ hitY: 0.95, actorBaseY: 0, actorHeight: 1.9 });
  assert.equal(bodyHit.isHeadshot, false);
  assert.equal(bodyHit.multiplier, 1.0);

  const headHit = computeHitZone({ hitY: 1.58, actorBaseY: 0, actorHeight: 1.9 });
  assert.equal(headHit.isHeadshot, true);
  assert.equal(headHit.multiplier, 1.5);
});

test('updateFireInputBuffer captures semi-auto trigger buffer and decays smoothly', () => {
  const buffered = updateFireInputBuffer({ currentBuffer: 0, justPressed: true, dt: 0.016 });
  assert.equal(buffered, 0.12);
  const decayed = updateFireInputBuffer({ currentBuffer: buffered, justPressed: false, dt: 0.05 });
  assert.ok(Math.abs(decayed - 0.07) < 1e-6);
  const expired = updateFireInputBuffer({ currentBuffer: decayed, justPressed: false, dt: 0.2 });
  assert.equal(expired, 0);
});

test('evaluateTouchAimAssist applies friction, tight magnetism, and auto-fire lock', () => {
  // Aiming dead-on at target at (0, 1.4, -15) from (0, 1.4, 0) looking -Z
  const onTarget = evaluateTouchAimAssist({
    camPos: [0, 1.4, 0],
    camDir: [0, 0, -1],
    targets: [{ id: 'bot-1', x: 0.25, y: 1.4, z: -15 }], // ~0.95 deg off center
    maxRange: 80,
  });
  assert.ok(onTarget.lookScale < 0.7, 'Should apply reticle friction near enemy');
  assert.ok(onTarget.magnetDir !== null, 'Should enable tight bullet magnetism inside 2.4 deg');
  assert.equal(onTarget.autoFireLocked, true, 'Should lock auto-fire inside 2.1 deg');
  assert.equal(onTarget.targetId, 'bot-1');

  // Aiming far away (30 deg off center) -> no friction, no magnetism, no autofire
  const offTarget = evaluateTouchAimAssist({
    camPos: [0, 1.4, 0],
    camDir: [0.6, 0, -0.8],
    targets: [{ id: 'bot-1', x: 0, y: 1.4, z: -15 }],
    maxRange: 80,
  });
  assert.equal(offTarget.lookScale, 1);
  assert.equal(offTarget.magnetDir, null);
  assert.equal(offTarget.autoFireLocked, false);
});
