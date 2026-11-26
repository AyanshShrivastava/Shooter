import test from 'node:test';
import assert from 'node:assert/strict';
import { ARENA_MAPS } from '../shared/maps';
import { createInitialMoveState } from '../game/physicsMovement';
import { NetPlayerState } from '../shared/types';
import { ArenaGameServer } from './gameServer';
import {
  BotTacticalMemory,
  computeBotDifficultyProfile,
  evaluateBotStep,
  findNearestCoverPoint,
  hasLineOfSight,
} from './botAi';

test('ArenaGameServer seeds 9 distinct maps and creates custom rooms', () => {
  const srv = new ArenaGameServer();
  const initial = srv.listRooms();
  assert.equal(initial.length, 9);
  const maps = new Set(initial.map((r) => r.mapId));
  assert.equal(maps.size, 9);

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
  assert.equal(srv.listRooms().length, 10);
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
  assert.equal(hasLineOfSight([-8, 1.5, 0], [8, 1.5, 0], map), false);
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

test('Bot AI finds sightline-breaking cover, predicts moving targets, and recovers when stuck', () => {
  const map = ARENA_MAPS['obsidian-foundry'];
  const coverSpot = findNearestCoverPoint([-7, 0, 12], [6, 0, 12], map);
  assert.ok(coverSpot !== null, 'expected a valid cover spot near central structures');
  assert.equal(
    hasLineOfSight([coverSpot[0], 1.35, coverSpot[1]], [6, 1.35, 12], map),
    false,
    'selected cover spot must break sightline to the threat',
  );

  // Verify velocity lead prediction shifts shot direction along target velocity
  const botState: NetPlayerState = {
    id: 'bot-2',
    name: 'APEX-04',
    characterId: 'apex-mech',
    weaponId: 'frag-launcher',
    isBot: true,
    x: -10,
    y: 0,
    z: 29,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw: -Math.PI / 2,
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
  const movingEnemy: NetPlayerState = {
    ...botState,
    id: 'human-2',
    name: 'Runner',
    isBot: false,
    x: 6,
    y: 0,
    z: 29,
    vx: 0,
    vz: -10, // sprinting toward -Z
  };
  const mem: BotTacticalMemory = {
    patrolTarget: [0, 29],
    patrolTimer: 3,
    fireCooldown: 0,
    reactionDelay: 0,
    strafeSign: 1,
    strafeTimer: 2,
    jumpTimer: 3,
    hurtEvadeTimer: 0,
    hadLosPrev: true,
    lastKnownTargetPos: [6, 0, 29],
    role: 'demolition',
    lastPos: [-10, 0, 29],
    stuckTimer: 0.7, // simulate bot jammed against corner
  };

  const decision = evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    mem,
    [botState, movingEnemy],
    map,
    0.05,
    () => 0.1,
  );
  assert.equal(decision.shouldFire, true);
  assert.ok(decision.fireDir[2] < -0.05, 'expected lead prediction to aim ahead along -Z');
  assert.equal(decision.moveInput.jumpJustPressed, true, 'expected stuck recovery jump');
  assert.equal(mem.strafeSign, -1, 'expected stuck recovery to flip strafe direction');
});

test('Bot AI dynamic difficulty scales accuracy and reaction time by player K/D and health', () => {
  const basePlayer: NetPlayerState = {
    id: 'human-3',
    name: 'Challenger',
    characterId: 'vanguard-soldier',
    weaponId: 'pulse-carbine',
    isBot: false,
    x: 6,
    y: 0,
    z: 29,
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

  const neutral = computeBotDifficultyProfile(basePlayer);
  const dominating = computeBotDifficultyProfile({ ...basePlayer, kills: 6, deaths: 1, hp: 100 });
  const strugglingLowHp = computeBotDifficultyProfile({ ...basePlayer, kills: 0, deaths: 4, hp: 18 });
  const lowHpOnly = computeBotDifficultyProfile({ ...basePlayer, kills: 2, deaths: 2, hp: 15 });
  const botTarget = computeBotDifficultyProfile({ ...basePlayer, isBot: true, kills: 10, deaths: 0, hp: 100 });

  assert.ok(dominating.accuracyMultiplier > neutral.accuracyMultiplier);
  assert.ok(dominating.reactionTimeMultiplier < neutral.reactionTimeMultiplier);
  assert.ok(strugglingLowHp.accuracyMultiplier < neutral.accuracyMultiplier);
  assert.ok(strugglingLowHp.reactionTimeMultiplier > neutral.reactionTimeMultiplier);
  assert.ok(lowHpOnly.accuracyMultiplier < neutral.accuracyMultiplier);
  assert.ok(lowHpOnly.reactionTimeMultiplier > neutral.reactionTimeMultiplier);
  assert.equal(botTarget.accuracyMultiplier, 1);
  assert.equal(botTarget.reactionTimeMultiplier, 1);

  // Verify evaluateBotStep translates profile into shorter reaction delay & higher hit chance for dominating targets
  const map = ARENA_MAPS['obsidian-foundry'];
  const botState: NetPlayerState = {
    ...basePlayer,
    id: 'bot-dda',
    name: 'UNIT-V7',
    isBot: true,
    x: -10,
    z: 29,
    yaw: -Math.PI / 2,
  };
  const makeMem = (): BotTacticalMemory => ({
    patrolTarget: [0, 29],
    patrolTimer: 3,
    fireCooldown: 0,
    reactionDelay: 0,
    strafeSign: 1,
    strafeTimer: 2,
    jumpTimer: 3,
    hurtEvadeTimer: 0,
    hadLosPrev: false,
    lastKnownTargetPos: null,
  });

  // 1) Newly acquiring LOS sets reactionDelay scaled by target K/D & HP
  const memDom = makeMem();
  const memStruggle = makeMem();
  evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    memDom,
    [botState, { ...basePlayer, kills: 6, deaths: 1, hp: 100 }],
    map,
    0.05,
    () => 0.5,
  );
  evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    memStruggle,
    [botState, { ...basePlayer, kills: 0, deaths: 4, hp: 15 }],
    map,
    0.05,
    () => 0.5,
  );
  assert.ok(
    memDom.reactionDelay < memStruggle.reactionDelay,
    'dominating healthy player should trigger shorter bot reaction delay than struggling low-HP player',
  );

  // 2) At mid-roll rng = 0.12, high-K/D healthy player is hit while struggling low-HP player is missed
  const memFireDom: BotTacticalMemory = { ...makeMem(), hadLosPrev: true, reactionDelay: 0 };
  const memFireStruggle: BotTacticalMemory = { ...makeMem(), hadLosPrev: true, reactionDelay: 0 };
  const fireDom = evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    memFireDom,
    [botState, { ...basePlayer, kills: 6, deaths: 1, hp: 100 }],
    map,
    0.05,
    () => 0.12,
  );
  const fireStruggle = evaluateBotStep(
    botState,
    createInitialMoveState(botState.x, botState.y, botState.z, botState.yaw),
    memFireStruggle,
    [botState, { ...basePlayer, kills: 0, deaths: 4, hp: 15 }],
    map,
    0.05,
    () => 0.12,
  );
  assert.equal(fireDom.shouldFire, true);
  assert.equal(fireStruggle.shouldFire, true);
  assert.equal(fireDom.didHit, true);
  assert.equal(fireStruggle.didHit, false);
});

