import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_MAPS, MAP_LIST } from '../shared/maps';
import {
  PLAYER_RADIUS,
  applyCrateImpulse,
  createArenaPhysicsWorld,
  createInitialMoveState,
  isPointInsideAnyCollider,
  stepArenaPhysicsWorld,
  stepCharacterMovement,
  CharacterMoveInput,
} from './physicsMovement';

function makeInput(overrides: Partial<CharacterMoveInput> = {}): CharacterMoveInput {
  return {
    forward: 0,
    right: 0,
    yaw: 0,
    pitch: 0,
    jumpHeld: false,
    jumpJustPressed: false,
    sprintHeld: false,
    crouchHeld: false,
    dashJustPressed: false,
    ...overrides,
  };
}

test('all map spawn points are clear of colliders and within playable bounds', () => {
  for (const map of MAP_LIST) {
    assert.ok(map.spawnPoints.length >= 4, `${map.id} should have at least 4 spawns`);
    for (const sp of map.spawnPoints) {
      assert.ok(
        Math.abs(sp.x) < map.halfExtent - PLAYER_RADIUS && Math.abs(sp.z) < map.halfExtent - PLAYER_RADIUS,
        `${map.id} spawn (${sp.x}, ${sp.z}) out of bounds`,
      );
      assert.equal(
        isPointInsideAnyCollider(sp.x, sp.y, sp.z, PLAYER_RADIUS, map),
        false,
        `${map.id} spawn (${sp.x}, ${sp.z}) overlaps a collider`,
      );
    }
  }
});

test('character accelerates smoothly on ground and brakes to stop', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const state = createInitialMoveState(0, 0, 30, 0);

  // Accelerate forward for 0.4s
  for (let i = 0; i < 24; i++) {
    stepCharacterMovement(state, makeInput({ forward: 1, sprintHeld: true }), map, 1 / 60);
  }
  const sprintSpeed = Math.hypot(state.vx, state.vz);
  assert.ok(sprintSpeed > 10, `expected sprint speed > 10 m/s, got ${sprintSpeed}`);
  assert.ok(state.z < 30, 'player should have moved forward (-Z)');

  // Release input and brake
  for (let i = 0; i < 30; i++) {
    stepCharacterMovement(state, makeInput(), map, 1 / 60);
  }
  const stoppedSpeed = Math.hypot(state.vx, state.vz);
  assert.ok(stoppedSpeed < 0.05, `expected smooth braking to stop, got ${stoppedSpeed}`);
});

test('jump, coyote time, and ramp elevation work smoothly', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const state = createInitialMoveState(0, 0, 30, 0);

  // Jump from ground
  stepCharacterMovement(state, makeInput({ jumpJustPressed: true, jumpHeld: true }), map, 1 / 60);
  assert.equal(state.justJumped, true);
  assert.equal(state.grounded, false);
  assert.ok(state.vy > 9);

  // Step forward in air and land back at y=0
  for (let i = 0; i < 80; i++) {
    stepCharacterMovement(state, makeInput({ jumpHeld: true }), map, 1 / 60);
  }
  assert.equal(state.grounded, true);
  assert.equal(state.y, 0);

  // Walk up east-north ramp (x=16, z=-17 -> z=-9 rises from 0 to 3.0m)
  const rampState = createInitialMoveState(16, 0, -17.5, Math.PI); // yaw PI faces +Z
  for (let i = 0; i < 120; i++) {
    stepCharacterMovement(rampState, makeInput({ forward: 1, yaw: Math.PI }), map, 1 / 60);
  }
  assert.ok(rampState.y > 2.2, `expected player to climb ramp > 2.2m, got y=${rampState.y}`);
});

test('jump pad launches character vertically and horizontally', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const pad = map.jumpPads[0];
  const state = createInitialMoveState(pad.x, pad.y, pad.z, 0);

  stepCharacterMovement(state, makeInput(), map, 1 / 60);
  assert.equal(state.justHitJumpPad, true);
  assert.ok(state.vy >= pad.boostY - 1);
});

test('cannon-es physics crates respond to weapon impulse', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const phys = createArenaPhysicsWorld(map);
  const crate = phys.crates[0];
  const initialX = crate.body.position.x;

  applyCrateImpulse(phys, crate.id, [initialX, crate.body.position.y, crate.body.position.z], [1, 0.2, 0], 65);
  const player = createInitialMoveState(0, 0, 30, 0);
  for (let i = 0; i < 15; i++) {
    stepArenaPhysicsWorld(phys, player, 1 / 60);
  }
  assert.ok(crate.body.position.x > initialX + 0.1, 'crate should move after impulse');
});
