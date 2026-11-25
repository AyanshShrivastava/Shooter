import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_MAPS } from '../shared/maps';
import { createInitialMoveState } from '../game/physicsMovement';
import { NetPlayerState } from '../shared/types';
import { ArenaGameServer } from './gameServer';
import { BotTacticalMemory, evaluateBotStep, hasLineOfSight } from './botAi';

test('ArenaGameServer seeds 3 distinct maps and creates custom rooms', () => {
  const srv = new ArenaGameServer();
  const initial = srv.listRooms();
  assert.equal(initial.length, 3);
  const maps = new Set(initial.map((r) => r.mapId));
  assert.equal(maps.size, 3);

  const custom = srv.createRoom({
    name: 'West Coast Skirmish',
    mapId: 'borealis-citadel',
    mode: 'skirmish',
    maxPlayers: 10,
    fillBots: true,
  });
  assert.equal(custom.name, 'West Coast Skirmish');
  assert.equal(custom.mapId, 'borealis-citadel');
  assert.equal(custom.scoreLimit, 20);
  assert.equal(srv.listRooms().length, 4);
  srv.dispose();
});

test('ArenaGameServer matchmaker honors preferred map when open', () => {
  const srv = new ArenaGameServer();
  const matched = srv.findBestMatchRoom('helios-outpost');
  assert.equal(matched.mapId, 'helios-outpost');
  srv.dispose();
});

test('Bot AI hasLineOfSight respects solid cover walls and open lanes', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  // Across the central core monolith (-8, 1.5, 0) to (+8, 1.5, 0) is blocked by core-base
  assert.equal(hasLineOfSight([-8, 1.5, 0], [8, 1.5, 0], map), false);
  // Open south corridor (-10, 1.5, 29) to (+10, 1.5, 29) is unobstructed
  assert.equal(hasLineOfSight([-10, 1.5, 29], [10, 1.5, 29], map), true);
});

test('Bot AI does not fire blindly through walls and dashes when hurt', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const botState: NetPlayerState = {
    id: 'bot-1',
    name: 'UNIT-V7',
    characterId: 'vanguard-soldier',
    weaponId: 'pulse-carbine',
    isBot: true,
    x: -8,
    y: 0,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: 0,
    pitch: 0,
    hp: 100,
    maxHp: 100,
    kills: 0,
    deaths: 0,
    score: 0,
    alive: true,
    crouching: false,
    sliding: false,
    grounded: true,
    respawnTimer: 0,
  };
  const enemyBehindWall: NetPlayerState = {
    ...botState,
    id: 'human-1',
    name: 'Operative',
    isBot: false,
    x: 8,
    y: 0,
    z: 0,
  };
  const mem: BotTacticalMemory = {
    patrolTarget: [0, 0],
    patrolTimer: 3,
    fireCooldown: 0,
    reactionDelay: 0,
    strafeSign: 1,
    strafeTimer: 1,
    jumpTimer: 2,
    hurtEvadeTimer: 0,
    hadLosPrev: false,
    lastKnownTargetPos: null,
  };

  const blockedDecision = evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    mem,
    [botState, enemyBehindWall],
    map,
    0.05,
    () => 0.25,
  );
  assert.equal(blockedDecision.shouldFire, false);

  // Move bot and enemy into the open south corridor and verify bot engages and evades on hurt
  botState.x = -10;
  botState.z = 29;
  enemyBehindWall.x = 6;
  enemyBehindWall.z = 29;
  mem.hadLosPrev = true;
  mem.reactionDelay = 0;
  mem.hurtEvadeTimer = 0.5;
  const openDecision = evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    mem,
    [botState, enemyBehindWall],
    map,
    0.05,
    () => 0.1,
  );
  assert.equal(openDecision.shouldFire, true);
  assert.equal(openDecision.moveInput.dashJustPressed, true);
});
