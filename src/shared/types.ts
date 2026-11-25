export type MapId = 'obsidian-foundry' | 'helios-outpost' | 'borealis-citadel';

export type GameMode = 'ffa' | 'duel' | 'skirmish';

export type CharacterId = 'vanguard-soldier' | 'apex-mech';

export type WeaponId = 'pulse-carbine' | 'rail-rifle' | 'scatter-gun' | 'frag-launcher';

export type AppScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type CameraPerspective = 'first-person' | 'third-person';

export interface WeaponSpec {
  id: WeaponId;
  key: string;
  name: string;
  role: string;
  damage: number;
  fireInterval: number;
  magSize: number;
  reloadTime: number;
  pellets: number;
  spread: number;
  range: number;
  projectileSpeed: number; // 0 = hitscan ray + tracer, >0 = physical projectile
  explosionRadius: number;
  recoilPitch: number;
  recoilKick: number;
  impulse: number;
  color: string;
  automatic: boolean;
}

export interface ServerRoomInfo {
  id: string;
  name: string;
  region: string;
  mapId: MapId;
  mode: GameMode;
  playerCount: number;
  botCount: number;
  maxPlayers: number;
  fillBots: boolean;
  pingMs: number;
  inProgress: boolean;
  scoreLimit: number;
  timeRemainingSec: number;
}

export interface ChatMessage {
  id: string;
  channel: 'global' | 'room';
  roomId?: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
}

export interface NetPlayerState {
  id: string;
  name: string;
  characterId: CharacterId;
  weaponId: WeaponId;
  isBot: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  hp: number;
  maxHp: number;
  kills: number;
  deaths: number;
  score: number;
  alive: boolean;
  crouching: boolean;
  sliding: boolean;
  grounded: boolean;
  respawnTimer: number;
}

export interface KillFeedItem {
  id: string;
  killerName: string;
  victimName: string;
  weaponId: WeaponId;
  timestamp: number;
  isSelfKill?: boolean;
}

export interface MatchResultSummary {
  winnerName: string;
  winnerId: string;
  isVictory: boolean;
  kills: number;
  deaths: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  placement: number;
  totalParticipants: number;
  mapId: MapId;
  roomName: string;
}

export interface CrateNetState {
  id: string;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

export type ClientToServerMessage =
  | { type: 'hello'; name: string; characterId: CharacterId }
  | { type: 'room:list' }
  | {
      type: 'room:create';
      name: string;
      mapId: MapId;
      mode: GameMode;
      maxPlayers: number;
      fillBots: boolean;
    }
  | { type: 'room:join'; roomId: string; name: string; characterId: CharacterId }
  | { type: 'room:leave' }
  | { type: 'matchmake'; preferredMapId?: MapId; name: string; characterId: CharacterId }
  | {
      type: 'player:update';
      x: number;
      y: number;
      z: number;
      vx: number;
      vy: number;
      vz: number;
      yaw: number;
      pitch: number;
      weaponId: WeaponId;
      crouching: boolean;
      sliding: boolean;
      grounded: boolean;
    }
  | {
      type: 'player:fire';
      weaponId: WeaponId;
      origin: [number, number, number];
      dir: [number, number, number];
      hitTargetId?: string;
      hitPoint?: [number, number, number];
    }
  | { type: 'player:respawn_request' }
  | { type: 'chat:send'; channel: 'global' | 'room'; text: string };

export type ServerToClientMessage =
  | {
      type: 'welcome';
      clientId: string;
      onlineCount: number;
      rooms: ServerRoomInfo[];
      globalChat: ChatMessage[];
    }
  | { type: 'rooms:update'; rooms: ServerRoomInfo[]; onlineCount: number }
  | {
      type: 'room:joined';
      room: ServerRoomInfo;
      players: NetPlayerState[];
      roomChat: ChatMessage[];
    }
  | {
      type: 'room:snapshot';
      roomId: string;
      timeRemainingSec: number;
      players: NetPlayerState[];
    }
  | {
      type: 'player:fired';
      shooterId: string;
      weaponId: WeaponId;
      origin: [number, number, number];
      dir: [number, number, number];
      hitPoint?: [number, number, number];
    }
  | {
      type: 'player:damaged';
      targetId: string;
      attackerId: string;
      damage: number;
      newHp: number;
      weaponId: WeaponId;
    }
  | { type: 'killfeed:add'; item: KillFeedItem }
  | {
      type: 'match:ended';
      winnerId: string;
      winnerName: string;
      standings: NetPlayerState[];
      nextMapId: MapId;
    }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'error'; message: string };
