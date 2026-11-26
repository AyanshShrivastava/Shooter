import { MapId } from './types';

export interface MapBox {
  id: string;
  x: number;
  y: number; // bottom Y
  z: number;
  w: number; // X width
  h: number; // Y height
  d: number; // Z depth
  kind: 'floor' | 'cover' | 'tower' | 'bridge' | 'wall' | 'core';
  color?: string;
}

export interface MapRamp {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  yLow: number;
  yHigh: number;
  /** Direction along which height rises from yLow to yHigh */
  riseDir: '+x' | '-x' | '+z' | '-z';
}

export interface MapJumpPad {
  id: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  boostY: number;
  boostHoriz: [number, number];
}

export interface MapSpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

export interface MapGlbProp {
  id: string;
  model:
    | 'barrier'
    | 'barrel'
    | 'ammo_box'
    | 'container'
    | 'rock'
    | 'helmet'
    | 'bench'
    | 'picnic_table'
    | 'planter'
    | 'bookshelf'
    | 'table';
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  colliderHalf?: [number, number, number];
}

export interface MapDynamicCrate {
  id: string;
  x: number;
  y: number;
  z: number;
  size: number;
  mass: number;
  kind?: 'crate' | 'barrel';
}

export interface ArenaMapSpec {
  id: MapId;
  name: string;
  subtitle: string;
  biome: string;
  description: string;
  halfExtent: number;
  skyTopColor: string;
  skyHorizonColor: string;
  fogColor: string;
  fogDensity: number;
  sunColor: string;
  sunIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  accentColor: string;
  groundTint: string;
  structureTint: string;
  trimTint: string;
  boxes: MapBox[];
  ramps: MapRamp[];
  jumpPads: MapJumpPad[];
  glbProps: MapGlbProp[];
  crates: MapDynamicCrate[];
  spawnPoints: MapSpawnPoint[];
  flyoverCenter: [number, number, number];
  flyoverRadius: number;
  flyoverHeight: number;
}

export const ARENA_MAPS: Record<MapId, ArenaMapSpec> = {
  'obsidian-foundry': {
    id: 'obsidian-foundry',
    name: 'Obsidian Foundry',
    subtitle: 'Smelter Sector 04',
    biome: 'Industrial Complex',
    description:
      'Multi-tier steel foundry with elevated catwalks, sloped loading ramps, jump vents, and armored cargo cover.',
    halfExtent: 38,
    skyTopColor: '#244b7a',
    skyHorizonColor: '#c47247',
    fogColor: '#5c4a46',
    fogDensity: 0.0045,
    sunColor: '#ffd4a3',
    sunIntensity: 2.7,
    hemiSkyColor: '#a5c9ff',
    hemiGroundColor: '#5e3c28',
    accentColor: '#F59E0B',
    groundTint: '#363c48',
    structureTint: '#4d5768',
    trimTint: '#f59e0b',
    boxes: [
      // Central smelter core monument (landmark visible from spawn)
      { id: 'core-base', x: 0, y: 0, z: 0, w: 6.5, h: 3.4, d: 6.5, kind: 'core' },
      { id: 'core-spire', x: 0, y: 3.4, z: 0, w: 3.2, h: 9.5, d: 3.2, kind: 'tower', color: '#272c35' },
      // East & West elevated catwalk platforms
      { id: 'catwalk-east', x: 16, y: 0, z: 0, w: 7, h: 3.0, d: 18, kind: 'bridge' },
      { id: 'catwalk-west', x: -16, y: 0, z: 0, w: 7, h: 3.0, d: 18, kind: 'bridge' },
      // North & South sniper balconies
      { id: 'balcony-north', x: 0, y: 0, z: -22, w: 16, h: 3.4, d: 5.5, kind: 'bridge' },
      { id: 'balcony-south', x: 0, y: 0, z: 22, w: 16, h: 3.4, d: 5.5, kind: 'bridge' },
      // Tactical shipping container cover blocks around center
      { id: 'cover-nw', x: -8.5, y: 0, z: -9, w: 4.2, h: 2.3, d: 2.4, kind: 'cover', color: '#b45309' },
      { id: 'cover-ne', x: 8.5, y: 0, z: -9, w: 4.2, h: 2.3, d: 2.4, kind: 'cover', color: '#334155' },
      { id: 'cover-sw', x: -8.5, y: 0, z: 9, w: 4.2, h: 2.3, d: 2.4, kind: 'cover', color: '#334155' },
      { id: 'cover-se', x: 8.5, y: 0, z: 9, w: 4.2, h: 2.3, d: 2.4, kind: 'cover', color: '#b45309' },
      // Corner industrial pylons
      { id: 'pylon-nw', x: -25, y: 0, z: -25, w: 4, h: 8, d: 4, kind: 'tower' },
      { id: 'pylon-ne', x: 25, y: 0, z: -25, w: 4, h: 8, d: 4, kind: 'tower' },
      { id: 'pylon-sw', x: -25, y: 0, z: 25, w: 4, h: 8, d: 4, kind: 'tower' },
      { id: 'pylon-se', x: 25, y: 0, z: 25, w: 4, h: 8, d: 4, kind: 'tower' },
    ],
    ramps: [
      { id: 'ramp-east-n', x: 16, z: -13, w: 4.6, d: 8, yLow: 0, yHigh: 3.0, riseDir: '+z' },
      { id: 'ramp-east-s', x: 16, z: 13, w: 4.6, d: 8, yLow: 0, yHigh: 3.0, riseDir: '-z' },
      { id: 'ramp-west-n', x: -16, z: -13, w: 4.6, d: 8, yLow: 0, yHigh: 3.0, riseDir: '+z' },
      { id: 'ramp-west-s', x: -16, z: 13, w: 4.6, d: 8, yLow: 0, yHigh: 3.0, riseDir: '-z' },
      { id: 'ramp-north-w', x: -12, z: -22, w: 8, d: 4.6, yLow: 0, yHigh: 3.4, riseDir: '+x' },
      { id: 'ramp-south-e', x: 12, z: 22, w: 8, d: 4.6, yLow: 0, yHigh: 3.4, riseDir: '-x' },
    ],
    jumpPads: [
      { id: 'pad-nw', x: -7, y: 0, z: 0, radius: 1.7, boostY: 14.5, boostHoriz: [-4, 0] },
      { id: 'pad-se', x: 7, y: 0, z: 0, radius: 1.7, boostY: 14.5, boostHoriz: [4, 0] },
      { id: 'pad-n', x: 0, y: 0, z: -15, radius: 1.6, boostY: 13.5, boostHoriz: [0, -4] },
      { id: 'pad-s', x: 0, y: 0, z: 15, radius: 1.6, boostY: 13.5, boostHoriz: [0, 4] },
    ],
    glbProps: [
      { id: 'foundry-barrier-1', model: 'barrier', x: -12, y: 0, z: 18, rotY: 0.2, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'foundry-barrier-2', model: 'barrier', x: 12, y: 0, z: -18, rotY: Math.PI + 0.2, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'foundry-barrier-3', model: 'barrier', x: -24, y: 0, z: 6, rotY: Math.PI * 0.5, scale: 1.65, colliderHalf: [0.5, 0.9, 1.3] },
      { id: 'foundry-barrier-4', model: 'barrier', x: 24, y: 0, z: -6, rotY: Math.PI * 0.5, scale: 1.65, colliderHalf: [0.5, 0.9, 1.3] },
      { id: 'foundry-cont-1', model: 'container', x: -22, y: 0, z: 10, rotY: 0.4, scale: 2.6, colliderHalf: [0.85, 0.65, 0.85] },
      { id: 'foundry-cont-2', model: 'container', x: 22, y: 0, z: -10, rotY: -2.7, scale: 2.6, colliderHalf: [0.85, 0.65, 0.85] },
      { id: 'foundry-ammo-1', model: 'ammo_box', x: 16, y: 3.0, z: -4, rotY: 0.3, scale: 3.8 },
      { id: 'foundry-ammo-2', model: 'ammo_box', x: -16, y: 3.0, z: 4, rotY: -0.4, scale: 3.8 },
      { id: 'foundry-barrel-s1', model: 'barrel', x: -9.8, y: 0, z: -9, rotY: 0, scale: 1.25 },
      { id: 'foundry-barrel-s2', model: 'barrel', x: 9.8, y: 0, z: 9, rotY: 1.2, scale: 1.25 },
      {
        id: 'foundry-relic',
        model: 'helmet',
        x: 0,
        y: 3.9,
        z: 0,
        rotY: 0,
        scale: 0.95,
      },
    ],
    crates: [
      { id: 'crate-1', x: -4.5, y: 0.65, z: -5.5, size: 1.25, mass: 18, kind: 'crate' },
      { id: 'crate-2', x: 4.5, y: 0.65, z: 5.5, size: 1.25, mass: 18, kind: 'crate' },
      { id: 'crate-3', x: 11.5, y: 0.65, z: 0, size: 1.15, mass: 15, kind: 'barrel' },
      { id: 'crate-4', x: -11.5, y: 0.65, z: 0, size: 1.15, mass: 15, kind: 'barrel' },
      { id: 'crate-5', x: 0, y: 4.1, z: -22, size: 1.1, mass: 14, kind: 'crate' },
      { id: 'crate-6', x: 0, y: 4.1, z: 22, size: 1.1, mass: 14, kind: 'crate' },
      { id: 'barrel-7', x: -6.2, y: 0.6, z: 11.2, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'barrel-8', x: 6.2, y: 0.6, z: -11.2, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -12, y: 0, z: 29, yaw: -0.39 },
      { x: 12, y: 0, z: -29, yaw: Math.PI - 0.39 },
      { x: -27, y: 0, z: -13, yaw: -Math.PI * 0.65 },
      { x: 27, y: 0, z: 13, yaw: Math.PI * 0.35 },
      { x: -19, y: 0, z: 19, yaw: -Math.PI * 0.25 },
      { x: 19, y: 0, z: -19, yaw: Math.PI * 0.75 },
    ],
    flyoverCenter: [0, 2.5, 0],
    flyoverRadius: 34,
    flyoverHeight: 14,
  },

  'helios-outpost': {
    id: 'helios-outpost',
    name: 'Helios Outpost',
    subtitle: 'Redrock Canyon Ridge',
    biome: 'Arid Canyon Base',
    description:
      'Sunlit canyon military outpost featuring stepped sandstone bunkers, sniper watchtowers, and open-air sightlines.',
    halfExtent: 42,
    skyTopColor: '#2563eb',
    skyHorizonColor: '#f5b873',
    fogColor: '#d9a46c',
    fogDensity: 0.007,
    sunColor: '#fff1d0',
    sunIntensity: 2.6,
    hemiSkyColor: '#93c5fd',
    hemiGroundColor: '#9a5b32',
    accentColor: '#EA580C',
    groundTint: '#b47449',
    structureTint: '#d6c3a5',
    trimTint: '#ea580c',
    boxes: [
      // Central command radar bunker
      { id: 'helios-bunker', x: 0, y: 0, z: 0, w: 8, h: 2.8, d: 8, kind: 'core', color: '#cbb99e' },
      { id: 'helios-mast', x: 0, y: 2.8, z: 0, w: 2.2, h: 8.5, d: 2.2, kind: 'tower', color: '#475569' },
      // Stepped flank bunkers
      { id: 'flank-e', x: 18, y: 0, z: 4, w: 7, h: 2.6, d: 12, kind: 'bridge', color: '#c2ad8d' },
      { id: 'flank-w', x: -18, y: 0, z: -4, w: 7, h: 2.6, d: 12, kind: 'bridge', color: '#c2ad8d' },
      // Sandstone monolith cover blocks
      { id: 'rock-n', x: -6, y: 0, z: -15, w: 5, h: 3.2, d: 3.5, kind: 'cover', color: '#9a5b32' },
      { id: 'rock-s', x: 6, y: 0, z: 15, w: 5, h: 3.2, d: 3.5, kind: 'cover', color: '#9a5b32' },
      { id: 'wall-nw', x: -12, y: 0, z: 12, w: 4.5, h: 2.1, d: 2.2, kind: 'cover', color: '#78716c' },
      { id: 'wall-se', x: 12, y: 0, z: -12, w: 4.5, h: 2.1, d: 2.2, kind: 'cover', color: '#78716c' },
      // Watchtowers
      { id: 'watch-n', x: 0, y: 0, z: -26, w: 6, h: 4.2, d: 6, kind: 'tower', color: '#b8a384' },
      { id: 'watch-s', x: 0, y: 0, z: 26, w: 6, h: 4.2, d: 6, kind: 'tower', color: '#b8a384' },
    ],
    ramps: [
      { id: 'h-ramp-c1', x: -6.5, z: 0, w: 5, d: 4.5, yLow: 0, yHigh: 2.8, riseDir: '+x' },
      { id: 'h-ramp-c2', x: 6.5, z: 0, w: 5, d: 4.5, yLow: 0, yHigh: 2.8, riseDir: '-x' },
      { id: 'h-ramp-e', x: 18, z: -6, w: 4.8, d: 8, yLow: 0, yHigh: 2.6, riseDir: '+z' },
      { id: 'h-ramp-w', x: -18, z: 6, w: 4.8, d: 8, yLow: 0, yHigh: 2.6, riseDir: '-z' },
    ],
    jumpPads: [
      { id: 'h-pad-n', x: 0, y: 0, z: -18, radius: 1.8, boostY: 15.5, boostHoriz: [0, -5] },
      { id: 'h-pad-s', x: 0, y: 0, z: 18, radius: 1.8, boostY: 15.5, boostHoriz: [0, 5] },
      { id: 'h-pad-e', x: 11, y: 0, z: 11, radius: 1.6, boostY: 13.0, boostHoriz: [-3, -3] },
      { id: 'h-pad-w', x: -11, y: 0, z: -11, radius: 1.6, boostY: 13.0, boostHoriz: [3, 3] },
    ],
    glbProps: [
      { id: 'helios-rock-1', model: 'rock', x: -24, y: 0, z: 14, rotY: 0.8, scale: 17, colliderHalf: [1.6, 0.85, 1.4] },
      { id: 'helios-rock-2', model: 'rock', x: 24, y: 0, z: -14, rotY: -2.1, scale: 17, colliderHalf: [1.6, 0.85, 1.4] },
      { id: 'helios-rock-3', model: 'rock', x: -26, y: 0, z: -26, rotY: 1.5, scale: 21, colliderHalf: [1.9, 1.0, 1.6] },
      { id: 'helios-rock-4', model: 'rock', x: 26, y: 0, z: 26, rotY: -1.1, scale: 21, colliderHalf: [1.9, 1.0, 1.6] },
      { id: 'helios-barrier-1', model: 'barrier', x: -8, y: 0, z: 22, rotY: 0.15, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'helios-barrier-2', model: 'barrier', x: 8, y: 0, z: -22, rotY: Math.PI + 0.15, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'helios-ammo-1', model: 'ammo_box', x: 18, y: 2.6, z: 6, rotY: 0.4, scale: 3.8 },
      { id: 'helios-ammo-2', model: 'ammo_box', x: -18, y: 2.6, z: -6, rotY: -0.5, scale: 3.8 },
      {
        id: 'helios-relic',
        model: 'helmet',
        x: 0,
        y: 3.3,
        z: 0,
        rotY: 0.6,
        scale: 0.95,
      },
    ],
    crates: [
      { id: 'hc-1', x: -4, y: 0.65, z: 8, size: 1.25, mass: 16, kind: 'crate' },
      { id: 'hc-2', x: 4, y: 0.65, z: -8, size: 1.25, mass: 16, kind: 'crate' },
      { id: 'hc-3', x: 18, y: 3.3, z: 4, size: 1.15, mass: 14, kind: 'barrel' },
      { id: 'hc-4', x: -18, y: 3.3, z: -4, size: 1.15, mass: 14, kind: 'barrel' },
      { id: 'hb-5', x: -8, y: 0.6, z: 14, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'hb-6', x: 8, y: 0.6, z: -14, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -14, y: 0, z: 32, yaw: -0.41 },
      { x: 14, y: 0, z: -32, yaw: Math.PI - 0.41 },
      { x: 32, y: 0, z: 8, yaw: Math.PI * 0.42 },
      { x: -32, y: 0, z: -8, yaw: -Math.PI * 0.58 },
      { x: -24, y: 0, z: -22, yaw: -Math.PI * 0.75 },
      { x: 24, y: 0, z: 22, yaw: Math.PI * 0.25 },
    ],
    flyoverCenter: [0, 3, 0],
    flyoverRadius: 38,
    flyoverHeight: 16,
  },

  'borealis-citadel': {
    id: 'borealis-citadel',
    name: 'Borealis Citadel',
    subtitle: 'Cryo Spire Station',
    biome: 'Arctic Research Facility',
    description:
      'High-altitude alpine cryo-citadel with elevated sky-bridges, basalt monoliths, and high-velocity jump vents.',
    halfExtent: 38,
    skyTopColor: '#1e3a8a',
    skyHorizonColor: '#7dd3fc',
    fogColor: '#2c4c70',
    fogDensity: 0.006,
    sunColor: '#e0f2fe',
    sunIntensity: 2.4,
    hemiSkyColor: '#7dd3fc',
    hemiGroundColor: '#1e293b',
    accentColor: '#06B6D4',
    groundTint: '#cbd5e1',
    structureTint: '#334155',
    trimTint: '#06b6d4',
    boxes: [
      // Central Cryo Reactor Spire
      { id: 'cryo-plinth', x: 0, y: 0, z: 0, w: 7, h: 3.2, d: 7, kind: 'core', color: '#1e293b' },
      { id: 'cryo-spire', x: 0, y: 3.2, z: 0, w: 2.6, h: 11, d: 2.6, kind: 'tower', color: '#0284c7' },
      // Elevated Twin Bridges
      { id: 'bridge-n', x: 0, y: 0, z: -15, w: 20, h: 3.0, d: 5, kind: 'bridge', color: '#475569' },
      { id: 'bridge-s', x: 0, y: 0, z: 15, w: 20, h: 3.0, d: 5, kind: 'bridge', color: '#475569' },
      // Basalt Cover Pillars
      { id: 'basalt-e', x: 14, y: 0, z: 0, w: 3.5, h: 4.5, d: 6, kind: 'cover', color: '#1e293b' },
      { id: 'basalt-w', x: -14, y: 0, z: 0, w: 3.5, h: 4.5, d: 6, kind: 'cover', color: '#1e293b' },
      { id: 'cryo-cube-nw', x: -10, y: 0, z: -7, w: 3, h: 2.2, d: 3, kind: 'cover', color: '#0ea5e9' },
      { id: 'cryo-cube-se', x: 10, y: 0, z: 7, w: 3, h: 2.2, d: 3, kind: 'cover', color: '#0ea5e9' },
      // Outer Citadel Towers
      { id: 'spire-e', x: 25, y: 0, z: 0, w: 5, h: 7.5, d: 5, kind: 'tower', color: '#334155' },
      { id: 'spire-w', x: -25, y: 0, z: 0, w: 5, h: 7.5, d: 5, kind: 'tower', color: '#334155' },
    ],
    ramps: [
      { id: 'b-ramp-nw', x: -14, z: -15, w: 8, d: 4.8, yLow: 0, yHigh: 3.0, riseDir: '+x' },
      { id: 'b-ramp-ne', x: 14, z: -15, w: 8, d: 4.8, yLow: 0, yHigh: 3.0, riseDir: '-x' },
      { id: 'b-ramp-sw', x: -14, z: 15, w: 8, d: 4.8, yLow: 0, yHigh: 3.0, riseDir: '+x' },
      { id: 'b-ramp-se', x: 14, z: 15, w: 8, d: 4.8, yLow: 0, yHigh: 3.0, riseDir: '-x' },
    ],
    jumpPads: [
      { id: 'b-pad-e', x: 8.5, y: 0, z: 0, radius: 1.7, boostY: 15, boostHoriz: [-4, 0] },
      { id: 'b-pad-w', x: -8.5, y: 0, z: 0, radius: 1.7, boostY: 15, boostHoriz: [4, 0] },
      { id: 'b-pad-n', x: 0, y: 0, z: -24, radius: 1.7, boostY: 14, boostHoriz: [0, 5] },
      { id: 'b-pad-s', x: 0, y: 0, z: 24, radius: 1.7, boostY: 14, boostHoriz: [0, -5] },
    ],
    glbProps: [
      { id: 'citadel-barrier-1', model: 'barrier', x: 20, y: 0, z: 22, rotY: -0.7, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'citadel-barrier-2', model: 'barrier', x: -20, y: 0, z: -22, rotY: 2.4, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'citadel-cont-1', model: 'container', x: -21, y: 0, z: 21, rotY: 0.8, scale: 2.7, colliderHalf: [0.9, 0.65, 0.9] },
      { id: 'citadel-cont-2', model: 'container', x: 21, y: 0, z: -21, rotY: -2.3, scale: 2.7, colliderHalf: [0.9, 0.65, 0.9] },
      { id: 'citadel-rock-1', model: 'rock', x: -28, y: 0, z: 0, rotY: 0.4, scale: 16, colliderHalf: [1.5, 0.8, 1.3] },
      { id: 'citadel-rock-2', model: 'rock', x: 28, y: 0, z: 0, rotY: 2.8, scale: 16, colliderHalf: [1.5, 0.8, 1.3] },
      { id: 'citadel-ammo-1', model: 'ammo_box', x: 4, y: 3.0, z: -15, rotY: 0.2, scale: 3.8 },
      { id: 'citadel-ammo-2', model: 'ammo_box', x: -4, y: 3.0, z: 15, rotY: -0.2, scale: 3.8 },
      {
        id: 'citadel-relic',
        model: 'helmet',
        x: 0,
        y: 3.7,
        z: 0,
        rotY: 0,
        scale: 0.95,
      },
    ],
    crates: [
      { id: 'bc-1', x: -6, y: 0.65, z: 7, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'bc-2', x: 6, y: 0.65, z: -7, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'bc-3', x: 0, y: 3.7, z: -15, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'bc-4', x: 0, y: 3.7, z: 15, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'bb-5', x: 9, y: 0.6, z: 10, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'bb-6', x: -9, y: 0.6, z: -10, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -15, y: 0, z: 29, yaw: -0.48 },
      { x: 15, y: 0, z: -29, yaw: Math.PI - 0.48 },
      { x: 22, y: 0, z: -10, yaw: Math.PI * 0.6 },
      { x: -22, y: 0, z: 10, yaw: -Math.PI * 0.4 },
      { x: -28, y: 0, z: -18, yaw: -Math.PI * 0.7 },
      { x: 28, y: 0, z: 18, yaw: Math.PI * 0.3 },
    ],
    flyoverCenter: [0, 3.0, 0],
    flyoverRadius: 34,
    flyoverHeight: 15,
  },

  'estate-garden': {
    id: 'estate-garden',
    name: 'Verdant Estate',
    subtitle: 'Royal Botanical Gardens',
    biome: 'Formal Estate & Pavilion',
    description:
      'Lush hedge labyrinth featuring a classical pavilion gazebo, tiered stone fountain, floral planter beds, park benches, and low-poly cypress groves.',
    halfExtent: 38,
    skyTopColor: '#1d4ed8',
    skyHorizonColor: '#7dd3fc',
    fogColor: '#4ade80',
    fogDensity: 0.005,
    sunColor: '#fffbeb',
    sunIntensity: 2.6,
    hemiSkyColor: '#bae6fd',
    hemiGroundColor: '#365314',
    accentColor: '#10B981',
    groundTint: '#4d7c0f',
    structureTint: '#f1f5f9',
    trimTint: '#10b981',
    boxes: [
      // Central Tiered Stone Fountain Monument
      { id: 'fountain-base', x: 0, y: 0, z: 0, w: 7.2, h: 1.3, d: 7.2, kind: 'core', color: '#e2e8f0' },
      { id: 'fountain-tier', x: 0, y: 1.3, z: 0, w: 3.2, h: 2.4, d: 3.2, kind: 'tower', color: '#cbd5e1' },
      // Elevated Classical Pavilion Gazebo (North Lawn)
      { id: 'gazebo-platform', x: 0, y: 0, z: -22, w: 14, h: 2.4, d: 14, kind: 'bridge', color: '#f8fafc' },
      { id: 'gazebo-roof-spire', x: 0, y: 2.4, z: -22, w: 2.6, h: 7.2, d: 2.6, kind: 'tower', color: '#0f766e' },
      // Elevated Arched Promenade Terrace (South Lawn)
      { id: 'terrace-south', x: 0, y: 0, z: 22, w: 16, h: 2.2, d: 6.5, kind: 'bridge', color: '#f8fafc' },
      // Sculpted Boxwood Hedge Maze Walls (2.4m High Tactical Sightline Breaks)
      { id: 'hedge-nw-1', x: -10, y: 0, z: -10, w: 2.8, h: 2.4, d: 11, kind: 'cover', color: '#166534' },
      { id: 'hedge-nw-2', x: -17, y: 0, z: -4.5, w: 11, h: 2.4, d: 2.8, kind: 'cover', color: '#166534' },
      { id: 'hedge-ne-1', x: 10, y: 0, z: -10, w: 2.8, h: 2.4, d: 11, kind: 'cover', color: '#166534' },
      { id: 'hedge-ne-2', x: 17, y: 0, z: -4.5, w: 11, h: 2.4, d: 2.8, kind: 'cover', color: '#166534' },
      { id: 'hedge-sw-1', x: -10, y: 0, z: 10, w: 2.8, h: 2.4, d: 11, kind: 'cover', color: '#166534' },
      { id: 'hedge-sw-2', x: -17, y: 0, z: 4.5, w: 11, h: 2.4, d: 2.8, kind: 'cover', color: '#166534' },
      { id: 'hedge-se-1', x: 10, y: 0, z: 10, w: 2.8, h: 2.4, d: 11, kind: 'cover', color: '#166534' },
      { id: 'hedge-se-2', x: 17, y: 0, z: 4.5, w: 11, h: 2.4, d: 2.8, kind: 'cover', color: '#166534' },
      // Flank Colonnade Watchtowers
      { id: 'colonnade-w', x: -25, y: 0, z: 0, w: 4.5, h: 6.5, d: 4.5, kind: 'tower', color: '#e2e8f0' },
      { id: 'colonnade-e', x: 25, y: 0, z: 0, w: 4.5, h: 6.5, d: 4.5, kind: 'tower', color: '#e2e8f0' },
    ],
    ramps: [
      { id: 'ramp-gazebo-w', x: -9, z: -22, w: 6, d: 4.5, yLow: 0, yHigh: 2.4, riseDir: '+x' },
      { id: 'ramp-gazebo-e', x: 9, z: -22, w: 6, d: 4.5, yLow: 0, yHigh: 2.4, riseDir: '-x' },
      { id: 'ramp-terrace-w', x: -11, z: 22, w: 6, d: 4.5, yLow: 0, yHigh: 2.2, riseDir: '+x' },
      { id: 'ramp-terrace-e', x: 11, z: 22, w: 6, d: 4.5, yLow: 0, yHigh: 2.2, riseDir: '-x' },
    ],
    jumpPads: [
      { id: 'gpad-c1', x: -6.5, y: 0, z: 0, radius: 1.6, boostY: 14.5, boostHoriz: [-4, 0] },
      { id: 'gpad-c2', x: 6.5, y: 0, z: 0, radius: 1.6, boostY: 14.5, boostHoriz: [4, 0] },
      { id: 'gpad-n', x: 0, y: 0, z: -14, radius: 1.6, boostY: 13.5, boostHoriz: [0, -5] },
      { id: 'gpad-s', x: 0, y: 0, z: 14, radius: 1.6, boostY: 13.5, boostHoriz: [0, 5] },
    ],
    glbProps: [
      // Painted Wooden Benches along walking paths
      { id: 'g-bench-1', model: 'bench', x: -10, y: 0, z: -17, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'g-bench-2', model: 'bench', x: 10, y: 0, z: -17, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'g-bench-3', model: 'bench', x: -10, y: 0, z: 17, rotY: Math.PI, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'g-bench-4', model: 'bench', x: 10, y: 0, z: 17, rotY: Math.PI, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      // Wooden Picnic Tables on recreation terraces
      { id: 'g-table-1', model: 'picnic_table', x: -21, y: 0, z: 16, rotY: 0.4, scale: 0.95, colliderHalf: [1.1, 0.45, 1.45] },
      { id: 'g-table-2', model: 'picnic_table', x: 21, y: 0, z: -16, rotY: -0.4, scale: 0.95, colliderHalf: [1.1, 0.45, 1.45] },
      // Flower Planter Boxes lining paths
      { id: 'g-planter-1', model: 'planter', x: -4.5, y: 0, z: -7, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'g-planter-2', model: 'planter', x: 4.5, y: 0, z: -7, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'g-planter-3', model: 'planter', x: -4.5, y: 0, z: 7, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'g-planter-4', model: 'planter', x: 4.5, y: 0, z: 7, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      // Garden Rock Outcrops
      { id: 'g-rock-1', model: 'rock', x: -24, y: 0, z: -20, rotY: 0.5, scale: 15, colliderHalf: [1.4, 0.8, 1.3] },
      { id: 'g-rock-2', model: 'rock', x: 24, y: 0, z: 20, rotY: -1.2, scale: 15, colliderHalf: [1.4, 0.8, 1.3] },
      // Ammo reserves in Gazebo and Terrace
      { id: 'g-ammo-1', model: 'ammo_box', x: 0, y: 2.4, z: -25, rotY: 0, scale: 3.8 },
      { id: 'g-ammo-2', model: 'ammo_box', x: 0, y: 2.2, z: 24, rotY: Math.PI, scale: 3.8 },
      {
        id: 'garden-relic',
        model: 'helmet',
        x: 0,
        y: 3.8,
        z: 0,
        rotY: 0,
        scale: 0.95,
      },
    ],
    crates: [
      { id: 'gc-1', x: -16, y: 0.65, z: -10, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'gc-2', x: 16, y: 0.65, z: 10, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'gb-3', x: 0, y: 2.9, z: -20, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'gb-4', x: 0, y: 2.7, z: 20, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'gc-5', x: -21, y: 0.6, z: 10, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'gc-6', x: 21, y: 0.6, z: -10, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -12, y: 0, z: 28, yaw: -0.42 },
      { x: 12, y: 0, z: -28, yaw: Math.PI - 0.42 },
      { x: 28, y: 0, z: 8, yaw: Math.PI * 0.45 },
      { x: -28, y: 0, z: -8, yaw: -Math.PI * 0.55 },
      { x: -18, y: 0, z: 20, yaw: -Math.PI * 0.3 },
      { x: 18, y: 0, z: -20, yaw: Math.PI * 0.7 },
    ],
    flyoverCenter: [0, 2.8, 0],
    flyoverRadius: 36,
    flyoverHeight: 15,
  },

  'safehouse-manor': {
    id: 'safehouse-manor',
    name: 'Safehouse Manor',
    subtitle: 'Alpine Residential Compound',
    biome: 'Two-Story Residence & Grounds',
    description:
      'Scandinavian residential villa featuring a double-height Great Hall, interior staircases, wrap-around timber porch, master study library, dining room, and patio.',
    halfExtent: 38,
    skyTopColor: '#1e3a8a',
    skyHorizonColor: '#fb923c',
    fogColor: '#475569',
    fogDensity: 0.0055,
    sunColor: '#fed7aa',
    sunIntensity: 2.6,
    hemiSkyColor: '#bae6fd',
    hemiGroundColor: '#451a03',
    accentColor: '#F97316',
    groundTint: '#78350f',
    structureTint: '#e2e8f0',
    trimTint: '#ea580c',
    boxes: [
      // Central Great Hall Atrium Core & Stone Fireplace Chimney
      { id: 'atrium-core', x: 0, y: 0, z: 0, w: 8, h: 0.6, d: 8, kind: 'core', color: '#78350f' },
      { id: 'chimney-stack', x: 0, y: 0, z: -13.5, w: 4.2, h: 9.5, d: 3.6, kind: 'tower', color: '#57534e' },
      // Second-Story Mezzanine Loft Balconies overlooking Great Hall (3.2m elevation)
      { id: 'loft-north', x: 0, y: 0, z: -7.5, w: 18, h: 3.2, d: 4.5, kind: 'bridge', color: '#92400e' },
      { id: 'loft-south', x: 0, y: 0, z: 7.5, w: 18, h: 3.2, d: 4.5, kind: 'bridge', color: '#92400e' },
      { id: 'loft-east', x: 8, y: 0, z: 0, w: 4.5, h: 3.2, d: 13, kind: 'bridge', color: '#92400e' },
      { id: 'loft-west', x: -8, y: 0, z: 0, w: 4.5, h: 3.2, d: 13, kind: 'bridge', color: '#92400e' },
      // Ground-Floor Living Quarters & Tactical Cover
      { id: 'kitchen-counter', x: -16, y: 0, z: -8, w: 6.5, h: 2.2, d: 3.2, kind: 'cover', color: '#78716c' },
      { id: 'pantry-wall', x: -16, y: 0, z: 8, w: 6.5, h: 3.0, d: 3.2, kind: 'cover', color: '#44403c' },
      { id: 'study-room-wall', x: 16, y: 0, z: -8, w: 6.5, h: 3.0, d: 3.2, kind: 'cover', color: '#44403c' },
      { id: 'lounge-divider', x: 16, y: 0, z: 8, w: 6.5, h: 2.2, d: 3.2, kind: 'cover', color: '#78716c' },
      // Exterior Wrap-around Timber Porch Veranda
      { id: 'porch-front', x: 0, y: 0, z: 18, w: 22, h: 1.0, d: 5.5, kind: 'bridge', color: '#b45309' },
      { id: 'porch-back', x: 0, y: 0, z: -20, w: 22, h: 1.0, d: 5.5, kind: 'bridge', color: '#b45309' },
      // Outer Compound Outpost Towers / Carports
      { id: 'garage-outpost-w', x: -26, y: 0, z: 0, w: 5, h: 6.5, d: 5, kind: 'tower', color: '#334155' },
      { id: 'gazebo-outpost-e', x: 26, y: 0, z: 0, w: 5, h: 6.5, d: 5, kind: 'tower', color: '#334155' },
    ],
    ramps: [
      // Interior Grand Staircases to 2nd-Floor Loft Balcony
      { id: 'stair-west', x: -8, z: 0, w: 4.5, d: 7.5, yLow: 0, yHigh: 3.2, riseDir: '+z' },
      { id: 'stair-east', x: 8, z: 0, w: 4.5, d: 7.5, yLow: 0, yHigh: 3.2, riseDir: '-z' },
      // Porch Step Ramps
      { id: 'step-porch-front', x: 0, z: 22, w: 7, d: 3, yLow: 0, yHigh: 1.0, riseDir: '-z' },
      { id: 'step-porch-back', x: 0, z: -24, w: 7, d: 3, yLow: 0, yHigh: 1.0, riseDir: '+z' },
    ],
    jumpPads: [
      // Great Hall Atrium High-Velocity Vent
      { id: 'atrium-vent', x: 0, y: 0, z: 0, radius: 1.7, boostY: 15.5, boostHoriz: [0, 0] },
      { id: 'porch-vent-e', x: 16, y: 0, z: 18, radius: 1.6, boostY: 13.5, boostHoriz: [-4, -4] },
      { id: 'porch-vent-w', x: -16, y: 0, z: -18, radius: 1.6, boostY: 13.5, boostHoriz: [4, 4] },
    ],
    glbProps: [
      // Wooden Bookshelves in Master Study & Hallway
      { id: 'm-bookshelf-1', model: 'bookshelf', x: 16, y: 0, z: -10, rotY: 0, scale: 1.25, colliderHalf: [0.85, 1.3, 0.4] },
      { id: 'm-bookshelf-2', model: 'bookshelf', x: 16, y: 0, z: -6, rotY: Math.PI, scale: 1.25, colliderHalf: [0.85, 1.3, 0.4] },
      { id: 'm-bookshelf-3', model: 'bookshelf', x: 0, y: 3.2, z: -9, rotY: 0, scale: 1.2, colliderHalf: [0.8, 1.2, 0.38] },
      // Dining Room Table and Study Table
      { id: 'm-table-1', model: 'table', x: -16, y: 0, z: 0, rotY: Math.PI / 2, scale: 1.35, colliderHalf: [0.75, 0.52, 0.48] },
      { id: 'm-table-2', model: 'table', x: 16, y: 0, z: 0, rotY: 0, scale: 1.35, colliderHalf: [0.75, 0.52, 0.48] },
      // Wooden Picnic Tables on Porch & Deck
      { id: 'm-picnic-1', model: 'picnic_table', x: 7, y: 1.0, z: 18, rotY: 0, scale: 0.95, colliderHalf: [1.1, 0.45, 1.45] },
      { id: 'm-picnic-2', model: 'picnic_table', x: -7, y: 1.0, z: -20, rotY: Math.PI, scale: 0.95, colliderHalf: [1.1, 0.45, 1.45] },
      // Painted Benches on Veranda
      { id: 'm-bench-1', model: 'bench', x: -7, y: 1.0, z: 18, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'm-bench-2', model: 'bench', x: 7, y: 1.0, z: -20, rotY: Math.PI, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      // Planters on Balcony & Porch
      { id: 'm-planter-1', model: 'planter', x: -10, y: 1.0, z: 18, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'm-planter-2', model: 'planter', x: 10, y: 1.0, z: 18, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      // Ammo boxes in study & pantry
      { id: 'm-ammo-1', model: 'ammo_box', x: 16, y: 0, z: -12, rotY: 0, scale: 3.8 },
      { id: 'm-ammo-2', model: 'ammo_box', x: -16, y: 0, z: 12, rotY: Math.PI, scale: 3.8 },
      {
        id: 'manor-relic',
        model: 'helmet',
        x: 0,
        y: 4.0,
        z: 0,
        rotY: 0,
        scale: 0.95,
      },
    ],
    crates: [
      { id: 'mc-1', x: -5, y: 0.65, z: 5, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'mc-2', x: 5, y: 0.65, z: -5, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'mc-3', x: 0, y: 3.8, z: -7.5, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'mc-4', x: 0, y: 3.8, z: 7.5, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'mb-5', x: -16, y: 0.6, z: 4, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'mb-6', x: 16, y: 0.6, z: -4, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -14, y: 0, z: 28, yaw: -0.45 },
      { x: 14, y: 0, z: -28, yaw: Math.PI - 0.45 },
      { x: 28, y: 0, z: 10, yaw: Math.PI * 0.4 },
      { x: -28, y: 0, z: -10, yaw: -Math.PI * 0.6 },
      { x: -20, y: 0, z: 18, yaw: -Math.PI * 0.28 },
      { x: 20, y: 0, z: -18, yaw: Math.PI * 0.72 },
    ],
    flyoverCenter: [0, 3.2, 0],
    flyoverRadius: 36,
    flyoverHeight: 16,
  },

  'neon-rooftop': {
    id: 'neon-rooftop',
    name: 'Neon Skydome',
    subtitle: 'Cyberpunk Skyscraper Roof',
    biome: 'High-Altitude Metropolis Rooftop',
    description:
      'Vertical high-rise skyscraper roof under a twilight metropolis sky, featuring a central helipad, heavy HVAC fan units, elevator penthouse, and illuminated neon perimeters.',
    halfExtent: 40,
    skyTopColor: '#020617',
    skyHorizonColor: '#3b0764',
    fogColor: '#0f172a',
    fogDensity: 0.005,
    sunColor: '#38bdf8',
    sunIntensity: 2.2,
    hemiSkyColor: '#06b6d4',
    hemiGroundColor: '#020617',
    accentColor: '#06B6D4',
    groundTint: '#0f172a',
    structureTint: '#1e293b',
    trimTint: '#06b6d4',
    boxes: [
      // Central Helipad Launch Core
      { id: 'helipad-core', x: 0, y: 0, z: 0, w: 14, h: 0.4, d: 14, kind: 'core', color: '#1e293b' },
      // Elevator Penthouse Tower & Upper Maintenance Bridge
      { id: 'penthouse-tower', x: 0, y: 0, z: -20, w: 16, h: 5.5, d: 10, kind: 'tower', color: '#0f172a' },
      { id: 'penthouse-deck', x: 0, y: 0, z: -10, w: 20, h: 3.2, d: 8, kind: 'bridge', color: '#334155' },
      // Heavy Industrial HVAC Turbine Banks (Waist & Shoulder Cover)
      { id: 'hvac-bank-east', x: 18, y: 0, z: 6, w: 8, h: 2.4, d: 12, kind: 'cover', color: '#475569' },
      { id: 'hvac-bank-west', x: -18, y: 0, z: 6, w: 8, h: 2.4, d: 12, kind: 'cover', color: '#475569' },
      // Server Relay Pods
      { id: 'server-pod-east', x: 16, y: 0, z: -16, w: 6, h: 3.0, d: 6, kind: 'cover', color: '#1e293b' },
      { id: 'server-pod-west', x: -16, y: 0, z: -16, w: 6, h: 3.0, d: 6, kind: 'cover', color: '#1e293b' },
      // Southern Communications Catwalk
      { id: 'comm-gantry-south', x: 0, y: 0, z: 22, w: 22, h: 2.2, d: 6, kind: 'bridge', color: '#334155' },
    ],
    ramps: [
      { id: 'ramp-penthouse-e', x: 12, z: -10, w: 3.2, d: 8, yLow: 0, yHigh: 3.2, riseDir: '-z' },
      { id: 'ramp-penthouse-w', x: -12, z: -10, w: 3.2, d: 8, yLow: 0, yHigh: 3.2, riseDir: '-z' },
    ],
    jumpPads: [
      { id: 'pad-roof-1', x: -16, y: 0, z: 22, radius: 1.8, boostY: 15, boostHoriz: [0.35, -0.7] },
      { id: 'pad-roof-2', x: 16, y: 0, z: 22, radius: 1.8, boostY: 15, boostHoriz: [-0.35, -0.7] },
    ],
    glbProps: [
      { id: 'rf-cont-1', model: 'container', x: -18, y: 0, z: -6, rotY: 0, scale: 0.95 },
      { id: 'rf-cont-2', model: 'container', x: 18, y: 0, z: -6, rotY: 0, scale: 0.95 },
      { id: 'rf-barr-1', model: 'barrier', x: 0, y: 0, z: 12, rotY: 0, scale: 1.1 },
      { id: 'rf-barr-2', model: 'barrier', x: -7, y: 0, z: 12, rotY: 0.2, scale: 1.1 },
      { id: 'rf-barr-3', model: 'barrier', x: 7, y: 0, z: 12, rotY: -0.2, scale: 1.1 },
      { id: 'rf-ammo-1', model: 'ammo_box', x: 0, y: 3.2, z: -10, rotY: 0, scale: 3.8 },
      { id: 'rf-ammo-2', model: 'ammo_box', x: 0, y: 2.2, z: 22, rotY: Math.PI, scale: 3.8 },
      { id: 'roof-relic', model: 'helmet', x: 0, y: 4.2, z: -10, rotY: 0, scale: 0.95 },
    ],
    crates: [
      { id: 'rc-1', x: -7, y: 0.65, z: 0, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'rc-2', x: 7, y: 0.65, z: 0, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'rb-3', x: -14, y: 0.6, z: 16, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'rb-4', x: 14, y: 0.6, z: 16, size: 1.1, mass: 14, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -28, y: 0, z: 26, yaw: -0.4 },
      { x: 28, y: 0, z: 26, yaw: 0.4 },
      { x: -28, y: 0, z: -6, yaw: Math.PI * 0.4 },
      { x: 28, y: 0, z: -6, yaw: -Math.PI * 0.4 },
      { x: -6, y: 0, z: 32, yaw: 0 },
      { x: 6, y: 0, z: 32, yaw: 0 },
    ],
    flyoverCenter: [0, 3.2, 0],
    flyoverRadius: 36,
    flyoverHeight: 18,
  },

  'oasis-temple': {
    id: 'oasis-temple',
    name: 'Sunken Sanctuary',
    subtitle: 'Ancient Desert Colonnade',
    biome: 'Ancient Sandstone Oasis Ruins',
    description:
      'Ancient low-poly sandstone temple ruins nestled around a turquoise oasis pool, stepped pyramids, stone pillar colonnades, palm trees, sun-bleached ramp walks, and central altar.',
    halfExtent: 42,
    skyTopColor: '#0284c7',
    skyHorizonColor: '#fed7aa',
    fogColor: '#d97706',
    fogDensity: 0.0045,
    sunColor: '#fef08a',
    sunIntensity: 3.2,
    hemiSkyColor: '#7dd3fc',
    hemiGroundColor: '#78350f',
    accentColor: '#F59E0B',
    groundTint: '#d97706',
    structureTint: '#fde68a',
    trimTint: '#b45309',
    boxes: [
      // Central Altar Court & Sarcophagus Pedestal
      { id: 'sanctuary-core', x: 0, y: 0, z: 0, w: 12, h: 0.8, d: 12, kind: 'core', color: '#b45309' },
      { id: 'altar-pedestal', x: 0, y: 0.8, z: 0, w: 4.8, h: 2.2, d: 4.8, kind: 'cover', color: '#92400e' },
      // Stepped Ziggurat Temple (3.5m Upper Tier)
      { id: 'pyramid-upper', x: 0, y: 0, z: -22, w: 22, h: 3.5, d: 12, kind: 'tower', color: '#ca8a04' },
      // Colonnade Pillars & Shaded Stone Wings
      { id: 'colonnade-east', x: 17, y: 0, z: 4, w: 5, h: 3.2, d: 18, kind: 'bridge', color: '#b45309' },
      { id: 'colonnade-west', x: -17, y: 0, z: 4, w: 5, h: 3.2, d: 18, kind: 'bridge', color: '#b45309' },
      // Sunken Oasis Reflection Pool Curb & Ramparts
      { id: 'sunken-pool-curb', x: 0, y: 0, z: 18, w: 18, h: 0.45, d: 10, kind: 'cover', color: '#0284c7' },
    ],
    ramps: [
      { id: 'stairs-pyramid-e', x: 13, z: -22, w: 4, d: 8, yLow: 0, yHigh: 3.5, riseDir: '-z' },
      { id: 'stairs-pyramid-w', x: -13, z: -22, w: 4, d: 8, yLow: 0, yHigh: 3.5, riseDir: '-z' },
    ],
    jumpPads: [
      { id: 'pad-oasis-1', x: -17, y: 0, z: -10, radius: 1.8, boostY: 15, boostHoriz: [0.6, 0.4] },
      { id: 'pad-oasis-2', x: 17, y: 0, z: -10, radius: 1.8, boostY: 15, boostHoriz: [-0.6, 0.4] },
    ],
    glbProps: [
      // Ancient Desert Boulders & Sacred Slabs
      { id: 'oa-rock-1', model: 'rock', x: -22, y: 0, z: 20, rotY: 0.4, scale: 16, colliderHalf: [1.4, 0.8, 1.3] },
      { id: 'oa-rock-2', model: 'rock', x: 22, y: 0, z: 20, rotY: -0.8, scale: 16, colliderHalf: [1.4, 0.8, 1.3] },
      // Tables & Benches in shaded colonnades
      { id: 'oa-table-1', model: 'table', x: 17, y: 0, z: 4, rotY: 0, scale: 1.2, colliderHalf: [0.75, 0.5, 0.5] },
      { id: 'oa-table-2', model: 'table', x: -17, y: 0, z: 4, rotY: 0, scale: 1.2, colliderHalf: [0.75, 0.5, 0.5] },
      { id: 'oa-bench-1', model: 'bench', x: 17, y: 0, z: 9, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'oa-bench-2', model: 'bench', x: -17, y: 0, z: 9, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      // Ammo boxes in shrine and pool banks
      { id: 'oa-ammo-1', model: 'ammo_box', x: 0, y: 3.5, z: -22, rotY: 0, scale: 3.8 },
      { id: 'oa-ammo-2', model: 'ammo_box', x: 0, y: 0, z: 24, rotY: Math.PI, scale: 3.8 },
      { id: 'oasis-relic', model: 'helmet', x: 0, y: 4.5, z: 0, rotY: 0, scale: 0.95 },
    ],
    crates: [
      { id: 'oac-1', x: -8, y: 0.65, z: -8, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'oac-2', x: 8, y: 0.65, z: -8, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'oab-3', x: 0, y: 3.9, z: -22, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'oab-4', x: -24, y: 0.6, z: 0, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'oab-5', x: 24, y: 0.6, z: 0, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -28, y: 0, z: 28, yaw: -0.45 },
      { x: 28, y: 0, z: 28, yaw: 0.45 },
      { x: -30, y: 0, z: -10, yaw: Math.PI * 0.35 },
      { x: 30, y: 0, z: -10, yaw: -Math.PI * 0.35 },
      { x: -12, y: 0, z: 32, yaw: 0 },
      { x: 12, y: 0, z: 32, yaw: 0 },
    ],
    flyoverCenter: [0, 2.5, 0],
    flyoverRadius: 38,
    flyoverHeight: 18,
  },

  'cyber-harbor': {
    id: 'cyber-harbor',
    name: 'Port Meridian',
    subtitle: 'Automated Freight Terminal',
    biome: 'Maritime Container Harbor',
    description:
      'Industrial deep-water container dockyard featuring stacked freight tiers, loading crane bridges, steel catwalk ramps, and harbor jump vents.',
    halfExtent: 40,
    skyTopColor: '#0c4a6e',
    skyHorizonColor: '#bae6fd',
    fogColor: '#385c75',
    fogDensity: 0.0046,
    sunColor: '#fef3c7',
    sunIntensity: 2.8,
    hemiSkyColor: '#7dd3fc',
    hemiGroundColor: '#1e293b',
    accentColor: '#0EA5E9',
    groundTint: '#334155',
    structureTint: '#1e293b',
    trimTint: '#0ea5e9',
    boxes: [
      // Central Harbor Control Tower & Cargo Deck
      { id: 'harbor-core', x: 0, y: 0, z: 0, w: 9, h: 2.4, d: 9, kind: 'core', color: '#1e293b' },
      { id: 'harbor-mast', x: 0, y: 2.4, z: 0, w: 2.6, h: 9.0, d: 2.6, kind: 'tower', color: '#0369a1' },
      // East & West Stacked Freight Bridges
      { id: 'freight-deck-e', x: 17, y: 0, z: 0, w: 7.5, h: 3.0, d: 18, kind: 'bridge', color: '#334155' },
      { id: 'freight-deck-w', x: -17, y: 0, z: 0, w: 7.5, h: 3.0, d: 18, kind: 'bridge', color: '#334155' },
      // Color-coded Shipping Container Cover Lanes
      { id: 'ship-nw', x: -9, y: 0, z: -12, w: 6.2, h: 2.7, d: 2.8, kind: 'cover', color: '#0284c7' },
      { id: 'ship-ne', x: 9, y: 0, z: -12, w: 6.2, h: 2.7, d: 2.8, kind: 'cover', color: '#ea580c' },
      { id: 'ship-sw', x: -9, y: 0, z: 12, w: 6.2, h: 2.7, d: 2.8, kind: 'cover', color: '#ea580c' },
      { id: 'ship-se', x: 9, y: 0, z: 12, w: 6.2, h: 2.7, d: 2.8, kind: 'cover', color: '#0284c7' },
      // North & South Gantry Crane Pylons
      { id: 'crane-n', x: 0, y: 0, z: -24, w: 12, h: 3.4, d: 5, kind: 'bridge', color: '#0f172a' },
      { id: 'crane-s', x: 0, y: 0, z: 24, w: 12, h: 3.4, d: 5, kind: 'bridge', color: '#0f172a' },
    ],
    ramps: [
      { id: 'h-ramp-e-n', x: 17, z: -13, w: 5, d: 8, yLow: 0, yHigh: 3.0, riseDir: '+z' },
      { id: 'h-ramp-e-s', x: 17, z: 13, w: 5, d: 8, yLow: 0, yHigh: 3.0, riseDir: '-z' },
      { id: 'h-ramp-w-n', x: -17, z: -13, w: 5, d: 8, yLow: 0, yHigh: 3.0, riseDir: '+z' },
      { id: 'h-ramp-w-s', x: -17, z: 13, w: 5, d: 8, yLow: 0, yHigh: 3.0, riseDir: '-z' },
    ],
    jumpPads: [
      { id: 'ch-pad-n', x: 0, y: 0, z: -16, radius: 1.7, boostY: 14.5, boostHoriz: [0, -5] },
      { id: 'ch-pad-s', x: 0, y: 0, z: 16, radius: 1.7, boostY: 14.5, boostHoriz: [0, 5] },
      { id: 'ch-pad-e', x: 9.5, y: 0, z: 0, radius: 1.6, boostY: 14.0, boostHoriz: [4, 0] },
      { id: 'ch-pad-w', x: -9.5, y: 0, z: 0, radius: 1.6, boostY: 14.0, boostHoriz: [-4, 0] },
    ],
    glbProps: [
      { id: 'ch-cont-1', model: 'container', x: -25, y: 0, z: 14, rotY: 0.25, scale: 2.7, colliderHalf: [0.9, 0.65, 0.9] },
      { id: 'ch-cont-2', model: 'container', x: 25, y: 0, z: -14, rotY: -2.9, scale: 2.7, colliderHalf: [0.9, 0.65, 0.9] },
      { id: 'ch-barr-1', model: 'barrier', x: -6, y: 0, z: 18, rotY: 0.1, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'ch-barr-2', model: 'barrier', x: 6, y: 0, z: -18, rotY: Math.PI + 0.1, scale: 1.65, colliderHalf: [1.3, 0.9, 0.5] },
      { id: 'ch-ammo-1', model: 'ammo_box', x: 17, y: 3.0, z: 0, rotY: 0, scale: 3.8 },
      { id: 'ch-ammo-2', model: 'ammo_box', x: -17, y: 3.0, z: 0, rotY: Math.PI, scale: 3.8 },
      { id: 'ch-relic', model: 'helmet', x: 0, y: 3.1, z: 0, rotY: 0, scale: 0.95 },
    ],
    crates: [
      { id: 'chc-1', x: -6, y: 0.65, z: -6, size: 1.25, mass: 17, kind: 'crate' },
      { id: 'chc-2', x: 6, y: 0.65, z: 6, size: 1.25, mass: 17, kind: 'crate' },
      { id: 'chb-3', x: 0, y: 4.0, z: -24, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'chb-4', x: 0, y: 4.0, z: 24, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'chb-5', x: -24, y: 0.6, z: -5, size: 1.05, mass: 12, kind: 'barrel' },
      { id: 'chb-6', x: 24, y: 0.6, z: 5, size: 1.05, mass: 12, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -16, y: 0, z: 30, yaw: -0.45 },
      { x: 16, y: 0, z: -30, yaw: Math.PI - 0.45 },
      { x: -30, y: 0, z: -10, yaw: -Math.PI * 0.6 },
      { x: 30, y: 0, z: 10, yaw: Math.PI * 0.4 },
      { x: -25, y: 0, z: 24, yaw: -Math.PI * 0.3 },
      { x: 25, y: 0, z: -24, yaw: Math.PI * 0.7 },
    ],
    flyoverCenter: [0, 3.0, 0],
    flyoverRadius: 37,
    flyoverHeight: 16,
  },

  'zen-pagoda': {
    id: 'zen-pagoda',
    name: 'Kitsune Shrine',
    subtitle: 'Crimson Pagoda Courtyard',
    biome: 'Autumn Mountain Sanctuary',
    description:
      'Serene raked-stone courtyard anchored by a multi-tier vermilion pagoda, arched footbridges, crimson torii gates, stone lanterns, and autumn maple groves.',
    halfExtent: 38,
    skyTopColor: '#1e40af',
    skyHorizonColor: '#fdba74',
    fogColor: '#9a5b4a',
    fogDensity: 0.0044,
    sunColor: '#ffe4b5',
    sunIntensity: 2.85,
    hemiSkyColor: '#bae6fd',
    hemiGroundColor: '#5c2d1b',
    accentColor: '#F43F5E',
    groundTint: '#cbd5e1',
    structureTint: '#b91c1c',
    trimTint: '#f59e0b',
    boxes: [
      // Central Multi-Tier Vermilion Pagoda Base & Spire
      { id: 'pagoda-plinth', x: 0, y: 0, z: 0, w: 8.5, h: 1.8, d: 8.5, kind: 'core', color: '#475569' },
      { id: 'pagoda-tier-1', x: 0, y: 1.8, z: 0, w: 4.8, h: 4.2, d: 4.8, kind: 'tower', color: '#b91c1c' },
      { id: 'pagoda-tier-2', x: 0, y: 6.0, z: 0, w: 3.0, h: 4.6, d: 3.0, kind: 'tower', color: '#991b1b' },
      // Raised Stone & Timber Courtyard Bridges
      { id: 'shrine-bridge-n', x: 0, y: 0, z: -18, w: 18, h: 2.6, d: 6.0, kind: 'bridge', color: '#78350f' },
      { id: 'shrine-bridge-s', x: 0, y: 0, z: 18, w: 18, h: 2.6, d: 6.0, kind: 'bridge', color: '#78350f' },
      // Zen Garden Monolith Cover Walls
      { id: 'zen-wall-e', x: 14, y: 0, z: 0, w: 3.2, h: 2.5, d: 10, kind: 'cover', color: '#64748b' },
      { id: 'zen-wall-w', x: -14, y: 0, z: 0, w: 3.2, h: 2.5, d: 10, kind: 'cover', color: '#64748b' },
      { id: 'shrine-gate-nw', x: -11, y: 0, z: -10, w: 4.5, h: 2.2, d: 2.4, kind: 'cover', color: '#b91c1c' },
      { id: 'shrine-gate-se', x: 11, y: 0, z: 10, w: 4.5, h: 2.2, d: 2.4, kind: 'cover', color: '#b91c1c' },
      // Flank Bell Towers
      { id: 'bell-tower-w', x: -24, y: 0, z: 0, w: 4.4, h: 6.8, d: 4.4, kind: 'tower', color: '#991b1b' },
      { id: 'bell-tower-e', x: 24, y: 0, z: 0, w: 4.4, h: 6.8, d: 4.4, kind: 'tower', color: '#991b1b' },
    ],
    ramps: [
      { id: 'zp-ramp-nw', x: -13, z: -18, w: 8, d: 4.8, yLow: 0, yHigh: 2.6, riseDir: '+x' },
      { id: 'zp-ramp-ne', x: 13, z: -18, w: 8, d: 4.8, yLow: 0, yHigh: 2.6, riseDir: '-x' },
      { id: 'zp-ramp-sw', x: -13, z: 18, w: 8, d: 4.8, yLow: 0, yHigh: 2.6, riseDir: '+x' },
      { id: 'zp-ramp-se', x: 13, z: 18, w: 8, d: 4.8, yLow: 0, yHigh: 2.6, riseDir: '-x' },
    ],
    jumpPads: [
      { id: 'zp-pad-w', x: -7.5, y: 0, z: 0, radius: 1.65, boostY: 14.5, boostHoriz: [-4, 0] },
      { id: 'zp-pad-e', x: 7.5, y: 0, z: 0, radius: 1.65, boostY: 14.5, boostHoriz: [4, 0] },
      { id: 'zp-pad-n', x: 0, y: 0, z: -11.5, radius: 1.6, boostY: 13.8, boostHoriz: [0, -5] },
      { id: 'zp-pad-s', x: 0, y: 0, z: 11.5, radius: 1.6, boostY: 13.8, boostHoriz: [0, 5] },
    ],
    glbProps: [
      { id: 'zp-rock-1', model: 'rock', x: -20, y: 0, z: 16, rotY: 0.6, scale: 15, colliderHalf: [1.4, 0.8, 1.3] },
      { id: 'zp-rock-2', model: 'rock', x: 20, y: 0, z: -16, rotY: -1.4, scale: 15, colliderHalf: [1.4, 0.8, 1.3] },
      { id: 'zp-bench-1', model: 'bench', x: -10, y: 0, z: 12, rotY: Math.PI, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'zp-bench-2', model: 'bench', x: 10, y: 0, z: -12, rotY: 0, scale: 1.3, colliderHalf: [0.75, 0.55, 0.35] },
      { id: 'zp-planter-1', model: 'planter', x: -6, y: 0, z: 6.5, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'zp-planter-2', model: 'planter', x: 6, y: 0, z: -6.5, rotY: 0, scale: 1.4, colliderHalf: [0.65, 0.32, 0.32] },
      { id: 'zp-ammo-1', model: 'ammo_box', x: 0, y: 2.6, z: -18, rotY: 0, scale: 3.8 },
      { id: 'zp-ammo-2', model: 'ammo_box', x: 0, y: 2.6, z: 18, rotY: Math.PI, scale: 3.8 },
      { id: 'zp-relic', model: 'helmet', x: 0, y: 2.5, z: 0, rotY: 0, scale: 0.95 },
    ],
    crates: [
      { id: 'zpc-1', x: -6, y: 0.65, z: -6, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'zpc-2', x: 6, y: 0.65, z: 6, size: 1.2, mass: 16, kind: 'crate' },
      { id: 'zpb-3', x: 4, y: 3.2, z: -18, size: 1.1, mass: 14, kind: 'barrel' },
      { id: 'zpb-4', x: -4, y: 3.2, z: 18, size: 1.1, mass: 14, kind: 'barrel' },
    ],
    spawnPoints: [
      { x: -13, y: 0, z: 28, yaw: -0.42 },
      { x: 13, y: 0, z: -28, yaw: Math.PI - 0.42 },
      { x: -28, y: 0, z: -12, yaw: -Math.PI * 0.55 },
      { x: 28, y: 0, z: 12, yaw: Math.PI * 0.45 },
      { x: -20, y: 0, z: 22, yaw: -Math.PI * 0.3 },
      { x: 20, y: 0, z: -22, yaw: Math.PI * 0.7 },
    ],
    flyoverCenter: [0, 3.2, 0],
    flyoverRadius: 35,
    flyoverHeight: 16,
  },
};

export const MAP_LIST: ArenaMapSpec[] = Object.values(ARENA_MAPS);
