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
  model: 'truck' | 'helmet';
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
      {
        id: 'foundry-truck-1',
        model: 'truck',
        x: -24,
        y: 0,
        z: 10,
        rotY: 0.45,
        scale: 1.25,
        colliderHalf: [2.6, 1.8, 1.4],
      },
      {
        id: 'foundry-truck-2',
        model: 'truck',
        x: 24,
        y: 0,
        z: -10,
        rotY: -2.6,
        scale: 1.25,
        colliderHalf: [2.6, 1.8, 1.4],
      },
      {
        id: 'foundry-relic',
        model: 'helmet',
        x: 0,
        y: 3.9,
        z: 0,
        rotY: 0,
        scale: 0.9,
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
      {
        id: 'helios-truck-1',
        model: 'truck',
        x: -24,
        y: 0,
        z: 14,
        rotY: 0.9,
        scale: 1.3,
        colliderHalf: [2.6, 1.8, 1.4],
      },
      {
        id: 'helios-truck-2',
        model: 'truck',
        x: 24,
        y: 0,
        z: -14,
        rotY: -2.2,
        scale: 1.3,
        colliderHalf: [2.6, 1.8, 1.4],
      },
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
      {
        id: 'citadel-truck-1',
        model: 'truck',
        x: 20,
        y: 0,
        z: 22,
        rotY: -0.7,
        scale: 1.25,
        colliderHalf: [2.6, 1.8, 1.4],
      },
      {
        id: 'citadel-truck-2',
        model: 'truck',
        x: -20,
        y: 0,
        z: -22,
        rotY: 2.4,
        scale: 1.25,
        colliderHalf: [2.6, 1.8, 1.4],
      },
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
};

export const MAP_LIST: ArenaMapSpec[] = Object.values(ARENA_MAPS);
