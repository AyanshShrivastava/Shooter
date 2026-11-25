import { WebSocket, WebSocketServer } from 'ws';
import { ARENA_MAPS } from '../shared/maps';
import {
  CharacterId,
  ChatMessage,
  ClientToServerMessage,
  GameMode,
  KillFeedItem,
  MapId,
  NetPlayerState,
  ServerRoomInfo,
  ServerToClientMessage,
  WeaponId,
} from '../shared/types';
import { WEAPONS } from '../shared/weapons';
import {
  CharacterMoveState,
  createInitialMoveState,
  stepCharacterMovement,
} from '../game/physicsMovement';
import { BotTacticalMemory, evaluateBotStep, roleForWeapon } from './botAi';

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  name: string;
  characterId: CharacterId;
  roomId: string | null;
}

interface BotAgent {
  state: NetPlayerState;
  move: CharacterMoveState;
  memory: BotTacticalMemory;
}

interface RoomInternal {
  info: ServerRoomInfo;
  players: Map<string, NetPlayerState>;
  bots: Map<string, BotAgent>;
  chatHistory: ChatMessage[];
  roundEndedTimer: number;
}

const SCORE_LIMIT_BY_MODE: Record<GameMode, number> = {
  ffa: 15,
  skirmish: 20,
  duel: 10,
};

const ROUND_DURATION_SEC = 300;
const BOT_CALLSIGNS = [
  'UNIT-V7',
  'APEX-04',
  'SPECTRE-AI',
  'KESTREL-9',
  'TITAN-2',
  'VALKYRIE-X',
];

function sanitizeName(raw: string | undefined, fallback: string, maxLen = 18): string {
  const cleaned = (raw ?? '').replace(/[^\w\-\s]/g, '').trim().slice(0, maxLen);
  return cleaned || fallback;
}

function sanitizeChat(raw: string | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export class ArenaGameServer {
  private clients = new Map<string, ConnectedClient>();
  private rooms = new Map<string, RoomInternal>();
  private globalChat: ChatMessage[] = [];
  private seq = 0;
  private tickInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.seedDefaultRooms();
    this.pushGlobalChat({
      id: this.nextId('msg'),
      channel: 'global',
      senderId: 'system',
      senderName: 'Command',
      text: 'Vanguard Arena matchmaking network online. Select a server or click Quick Match to deploy.',
      timestamp: Date.now(),
      isSystem: true,
    });
  }

  private nextId(prefix: string): string {
    this.seq += 1;
    return `${prefix}-${Date.now().toString(36)}-${this.seq}`;
  }

  private seedDefaultRooms(): void {
    this.createRoom({
      id: 'srv-foundry-na',
      name: 'Foundry Sector 04',
      region: 'NA-East',
      mapId: 'obsidian-foundry',
      mode: 'ffa',
      maxPlayers: 8,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-helios-eu',
      name: 'Redrock Canyon',
      region: 'EU-West',
      mapId: 'helios-outpost',
      mode: 'skirmish',
      maxPlayers: 8,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-citadel-ap',
      name: 'Cryo Spire Duel',
      region: 'Asia-Pacific',
      mapId: 'borealis-citadel',
      mode: 'duel',
      maxPlayers: 4,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-garden-eu',
      name: 'Verdant Courtyard',
      region: 'EU-Central',
      mapId: 'estate-garden',
      mode: 'ffa',
      maxPlayers: 8,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-manor-us',
      name: 'Safehouse Residence',
      region: 'US-West',
      mapId: 'safehouse-manor',
      mode: 'skirmish',
      maxPlayers: 8,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-neon-jp',
      name: 'Neo Skydome 24',
      region: 'Asia-East',
      mapId: 'neon-rooftop',
      mode: 'ffa',
      maxPlayers: 8,
      fillBots: true,
    });
    this.createRoom({
      id: 'srv-oasis-me',
      name: 'Sunken Sanctuary',
      region: 'Middle-East',
      mapId: 'oasis-temple',
      mode: 'skirmish',
      maxPlayers: 8,
      fillBots: true,
    });
  }

  public createRoom(opts: {
    id?: string;
    name: string;
    region?: string;
    mapId: MapId;
    mode: GameMode;
    maxPlayers: number;
    fillBots: boolean;
  }): ServerRoomInfo {
    const id = opts.id ?? this.nextId('srv');
    const mapId: MapId = ARENA_MAPS[opts.mapId] ? opts.mapId : 'obsidian-foundry';
    const mode: GameMode = SCORE_LIMIT_BY_MODE[opts.mode] ? opts.mode : 'ffa';
    const maxPlayers = Math.max(2, Math.min(12, Math.round(opts.maxPlayers || 8)));
    const info: ServerRoomInfo = {
      id,
      name: sanitizeName(opts.name, 'Tactical Arena', 28),
      region: opts.region ?? 'Global',
      mapId,
      mode,
      playerCount: 0,
      botCount: 0,
      maxPlayers,
      fillBots: Boolean(opts.fillBots),
      pingMs: 14 + Math.floor(Math.random() * 22),
      inProgress: true,
      scoreLimit: SCORE_LIMIT_BY_MODE[mode],
      timeRemainingSec: ROUND_DURATION_SEC,
    };
    const room: RoomInternal = {
      info,
      players: new Map(),
      bots: new Map(),
      chatHistory: [],
      roundEndedTimer: 0,
    };
    this.rooms.set(id, room);
    this.reconcileRoomBots(room);
    return this.getRoomSummary(room);
  }

  private getRoomSummary(room: RoomInternal): ServerRoomInfo {
    return {
      ...room.info,
      playerCount: room.players.size,
      botCount: room.bots.size,
      timeRemainingSec: Math.ceil(room.info.timeRemainingSec),
    };
  }

  public listRooms(): ServerRoomInfo[] {
    return Array.from(this.rooms.values()).map((r) => this.getRoomSummary(r));
  }

  public findBestMatchRoom(preferredMapId?: MapId): ServerRoomInfo {
    const rooms = Array.from(this.rooms.values());
    const open = rooms.filter((r) => r.players.size < r.info.maxPlayers && r.roundEndedTimer <= 0);
    open.sort((a, b) => {
      const aMapScore = preferredMapId && a.info.mapId === preferredMapId ? 10 : 0;
      const bMapScore = preferredMapId && b.info.mapId === preferredMapId ? 10 : 0;
      const aPopScore = a.players.size > 0 ? 5 + a.players.size : 0;
      const bPopScore = b.players.size > 0 ? 5 + b.players.size : 0;
      return bMapScore + bPopScore - (aMapScore + aPopScore);
    });
    if (open.length > 0) {
      return this.getRoomSummary(open[0]);
    }
    return this.createRoom({
      name: `Quick Arena #${this.rooms.size + 1}`,
      region: 'Auto',
      mapId: preferredMapId ?? 'obsidian-foundry',
      mode: 'ffa',
      maxPlayers: 8,
      fillBots: true,
    });
  }

  public getOnlineCount(): number {
    return Math.max(1, this.clients.size);
  }

  public attachWebSocketServer(wss: WebSocketServer): void {
    wss.on('connection', (ws) => {
      const clientId = this.nextId('usr');
      const client: ConnectedClient = {
        id: clientId,
        ws,
        name: `Vanguard-${clientId.slice(-3).toUpperCase()}`,
        characterId: 'vanguard-soldier',
        roomId: null,
      };
      this.clients.set(clientId, client);

      this.send(ws, {
        type: 'welcome',
        clientId,
        onlineCount: this.getOnlineCount(),
        rooms: this.listRooms(),
        globalChat: this.globalChat,
      });
      this.broadcastLobbyState();

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw)) as ClientToServerMessage;
          this.handleClientMessage(client, msg);
        } catch {
          this.send(ws, { type: 'error', message: 'Invalid message payload.' });
        }
      });

      ws.on('close', () => {
        this.leaveCurrentRoom(client);
        this.clients.delete(clientId);
        this.broadcastLobbyState();
      });
    });

    if (!this.tickInterval) {
      this.tickInterval = setInterval(() => this.tickRooms(0.05), 50);
    }
  }

  public dispose(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  private send(ws: WebSocket, msg: ServerToClientMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastAll(msg: ServerToClientMessage): void {
    const payload = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(payload);
      }
    }
  }

  private broadcastRoom(room: RoomInternal, msg: ServerToClientMessage, excludeClientId?: string): void {
    const payload = JSON.stringify(msg);
    for (const c of this.clients.values()) {
      if (c.roomId === room.info.id && c.id !== excludeClientId && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(payload);
      }
    }
  }

  private broadcastLobbyState(): void {
    this.broadcastAll({
      type: 'rooms:update',
      rooms: this.listRooms(),
      onlineCount: this.getOnlineCount(),
    });
  }

  private pushGlobalChat(msg: ChatMessage): void {
    this.globalChat.push(msg);
    if (this.globalChat.length > 40) this.globalChat.shift();
  }

  private pushRoomChat(room: RoomInternal, msg: ChatMessage): void {
    room.chatHistory.push(msg);
    if (room.chatHistory.length > 40) room.chatHistory.shift();
    this.broadcastRoom(room, { type: 'chat:message', message: msg });
  }

  private handleClientMessage(client: ConnectedClient, msg: ClientToServerMessage): void {
    switch (msg.type) {
      case 'hello': {
        client.name = sanitizeName(msg.name, client.name);
        client.characterId = msg.characterId === 'apex-mech' ? 'apex-mech' : 'vanguard-soldier';
        break;
      }
      case 'room:list': {
        this.send(client.ws, {
          type: 'rooms:update',
          rooms: this.listRooms(),
          onlineCount: this.getOnlineCount(),
        });
        break;
      }
      case 'room:create': {
        const created = this.createRoom({
          name: msg.name,
          mapId: msg.mapId,
          mode: msg.mode,
          maxPlayers: msg.maxPlayers,
          fillBots: msg.fillBots,
        });
        this.broadcastLobbyState();
        this.joinRoom(client, created.id);
        break;
      }
      case 'room:join': {
        client.name = sanitizeName(msg.name, client.name);
        client.characterId = msg.characterId === 'apex-mech' ? 'apex-mech' : 'vanguard-soldier';
        this.joinRoom(client, msg.roomId);
        break;
      }
      case 'room:leave': {
        this.leaveCurrentRoom(client);
        this.broadcastLobbyState();
        break;
      }
      case 'matchmake': {
        client.name = sanitizeName(msg.name, client.name);
        client.characterId = msg.characterId === 'apex-mech' ? 'apex-mech' : 'vanguard-soldier';
        const room = this.findBestMatchRoom(msg.preferredMapId);
        this.joinRoom(client, room.id);
        break;
      }
      case 'player:update': {
        if (!client.roomId) return;
        const room = this.rooms.get(client.roomId);
        if (!room) return;
        const p = room.players.get(client.id);
        if (!p || !p.alive) return;
        const map = ARENA_MAPS[room.info.mapId];
        const ext = map.halfExtent;
        p.x = Math.max(-ext, Math.min(ext, msg.x));
        p.y = Math.max(-5, Math.min(40, msg.y));
        p.z = Math.max(-ext, Math.min(ext, msg.z));
        p.vx = msg.vx;
        p.vy = msg.vy;
        p.vz = msg.vz;
        p.yaw = msg.yaw;
        p.pitch = msg.pitch;
        p.weaponId = WEAPONS[msg.weaponId] ? msg.weaponId : 'pulse-carbine';
        p.crouching = Boolean(msg.crouching);
        p.sliding = Boolean(msg.sliding);
        p.grounded = Boolean(msg.grounded);
        break;
      }
      case 'player:fire': {
        if (!client.roomId) return;
        const room = this.rooms.get(client.roomId);
        if (!room || room.roundEndedTimer > 0) return;
        const shooter = room.players.get(client.id);
        if (!shooter || !shooter.alive) return;
        this.processWeaponFire(room, shooter, msg.weaponId, msg.origin, msg.dir, msg.hitTargetId, msg.hitPoint);
        break;
      }
      case 'player:respawn_request': {
        if (!client.roomId) return;
        const room = this.rooms.get(client.roomId);
        if (!room) return;
        const p = room.players.get(client.id);
        if (p && !p.alive && p.respawnTimer <= 0) {
          this.respawnParticipant(room, p);
        }
        break;
      }
      case 'chat:send': {
        const text = sanitizeChat(msg.text);
        if (!text) return;
        if (msg.channel === 'room' && client.roomId) {
          const room = this.rooms.get(client.roomId);
          if (!room) return;
          this.pushRoomChat(room, {
            id: this.nextId('msg'),
            channel: 'room',
            roomId: room.info.id,
            senderId: client.id,
            senderName: client.name,
            text,
            timestamp: Date.now(),
          });
        } else {
          const chatMsg: ChatMessage = {
            id: this.nextId('msg'),
            channel: 'global',
            senderId: client.id,
            senderName: client.name,
            text,
            timestamp: Date.now(),
          };
          this.pushGlobalChat(chatMsg);
          this.broadcastAll({ type: 'chat:message', message: chatMsg });
        }
        break;
      }
    }
  }

  private joinRoom(client: ConnectedClient, roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) {
      this.send(client.ws, { type: 'error', message: 'Selected server room no longer exists.' });
      return;
    }
    if (room.players.size >= room.info.maxPlayers) {
      this.send(client.ws, { type: 'error', message: 'Server room is full.' });
      return;
    }

    this.leaveCurrentRoom(client);

    const map = ARENA_MAPS[room.info.mapId];
    const sp = map.spawnPoints[room.players.size % map.spawnPoints.length];
    const playerState: NetPlayerState = {
      id: client.id,
      name: client.name,
      characterId: client.characterId,
      weaponId: 'pulse-carbine',
      isBot: false,
      x: sp.x,
      y: sp.y,
      z: sp.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: sp.yaw,
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

    client.roomId = room.info.id;
    room.players.set(client.id, playerState);
    this.setSpawnProtect(client.id, 4500);
    this.reconcileRoomBots(room);

    this.send(client.ws, {
      type: 'room:joined',
      room: this.getRoomSummary(room),
      players: this.collectParticipants(room),
      roomChat: room.chatHistory,
    });

    this.pushRoomChat(room, {
      id: this.nextId('sys'),
      channel: 'room',
      roomId: room.info.id,
      senderId: 'system',
      senderName: 'Arena',
      text: `${client.name} deployed into ${room.info.name}.`,
      timestamp: Date.now(),
      isSystem: true,
    });

    this.broadcastLobbyState();
  }

  private leaveCurrentRoom(client: ConnectedClient): void {
    if (!client.roomId) return;
    const room = this.rooms.get(client.roomId);
    client.roomId = null;
    if (!room) return;

    room.players.delete(client.id);
    this.reconcileRoomBots(room);
    this.pushRoomChat(room, {
      id: this.nextId('sys'),
      channel: 'room',
      roomId: room.info.id,
      senderId: 'system',
      senderName: 'Arena',
      text: `${client.name} disconnected from the match.`,
      timestamp: Date.now(),
      isSystem: true,
    });
  }

  private reconcileRoomBots(room: RoomInternal): void {
    const desiredTotal = room.info.fillBots ? Math.min(4, room.info.maxPlayers) : 0;
    const neededBots = Math.max(0, desiredTotal - room.players.size);

    while (room.bots.size > neededBots) {
      const firstKey = room.bots.keys().next().value;
      if (!firstKey) break;
      room.bots.delete(firstKey);
    }

    const map = ARENA_MAPS[room.info.mapId];
    let idx = 0;
    while (room.bots.size < neededBots) {
      const botId = this.nextId('bot');
      const sp = map.spawnPoints[(room.players.size + room.bots.size + idx) % map.spawnPoints.length];
      idx++;
      const characterId: CharacterId = idx % 2 === 0 ? 'vanguard-soldier' : 'apex-mech';
      const weaponList: WeaponId[] = ['pulse-carbine', 'rail-rifle', 'scatter-gun', 'frag-launcher'];
      const weaponId = weaponList[idx % weaponList.length];
      const botName = BOT_CALLSIGNS[(room.bots.size + idx) % BOT_CALLSIGNS.length];
      const state: NetPlayerState = {
        id: botId,
        name: botName,
        characterId,
        weaponId,
        isBot: true,
        x: sp.x,
        y: sp.y,
        z: sp.z,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: sp.yaw,
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
      room.bots.set(botId, {
        state,
        move: createInitialMoveState(sp.x, sp.y, sp.z, sp.yaw),
        memory: {
          patrolTarget: [0, 0],
          patrolTimer: 1 + Math.random() * 2,
          fireCooldown: 0.7 + Math.random() * 0.7,
          reactionDelay: 0.25,
          strafeSign: Math.random() > 0.5 ? 1 : -1,
          strafeTimer: 1.2,
          jumpTimer: 2 + Math.random() * 2.5,
          hurtEvadeTimer: 0,
          hadLosPrev: false,
          lastKnownTargetPos: null,
          role: roleForWeapon(weaponId),
          stuckTimer: 0,
          coverTarget: null,
          coverTimer: 0,
        },
      });
    }
    room.info.botCount = room.bots.size;
  }

  private collectParticipants(room: RoomInternal): NetPlayerState[] {
    return [
      ...Array.from(room.players.values()),
      ...Array.from(room.bots.values()).map((b) => b.state),
    ];
  }

  private findParticipant(room: RoomInternal, id: string): NetPlayerState | undefined {
    return room.players.get(id) ?? room.bots.get(id)?.state;
  }

  private spawnProtectUntil = new Map<string, number>();

  private setSpawnProtect(id: string, durationMs = 4000): void {
    this.spawnProtectUntil.set(id, Date.now() + durationMs);
  }

  private respawnParticipant(room: RoomInternal, target: NetPlayerState): void {
    const map = ARENA_MAPS[room.info.mapId];
    const sp = map.spawnPoints[Math.floor(Math.random() * map.spawnPoints.length)];
    target.x = sp.x;
    target.y = sp.y;
    target.z = sp.z;
    target.vx = 0;
    target.vy = 0;
    target.vz = 0;
    target.yaw = sp.yaw;
    target.pitch = 0;
    target.hp = target.maxHp;
    target.alive = true;
    target.respawnTimer = 0;
    this.setSpawnProtect(target.id, 3500);
    const bot = room.bots.get(target.id);
    if (bot) {
      bot.move = createInitialMoveState(sp.x, sp.y, sp.z, sp.yaw);
      bot.memory.hadLosPrev = false;
      bot.memory.lastKnownTargetPos = null;
      bot.memory.hurtEvadeTimer = 0;
      bot.memory.coverTarget = null;
      bot.memory.coverTimer = 0;
      bot.memory.stuckTimer = 0;
      bot.memory.lastPos = [sp.x, sp.y, sp.z];
    }
  }

  private processWeaponFire(
    room: RoomInternal,
    shooter: NetPlayerState,
    weaponId: WeaponId,
    origin: [number, number, number],
    dir: [number, number, number],
    hitTargetId?: string,
    hitPoint?: [number, number, number],
  ): void {
    const spec = WEAPONS[weaponId] ?? WEAPONS['pulse-carbine'];

    this.broadcastRoom(
      room,
      {
        type: 'player:fired',
        shooterId: shooter.id,
        weaponId: spec.id,
        origin,
        dir,
        hitPoint,
      },
      shooter.isBot ? undefined : shooter.id,
    );

    if (spec.explosionRadius > 0 && hitPoint) {
      // Splash damage around impact point
      for (const target of this.collectParticipants(room)) {
        if (!target.alive) continue;
        const dist = Math.hypot(
          target.x - hitPoint[0],
          target.y + 0.9 - hitPoint[1],
          target.z - hitPoint[2],
        );
        if (dist <= spec.explosionRadius) {
          const factor = Math.max(0.25, 1 - dist / spec.explosionRadius);
          const dmg = Math.round(spec.damage * factor);
          this.applyDamage(room, target, shooter, dmg, spec.id);
        }
      }
      return;
    }

    if (hitTargetId) {
      const target = this.findParticipant(room, hitTargetId);
      if (target && target.alive && target.id !== shooter.id) {
        const dist = Math.hypot(target.x - shooter.x, target.y - shooter.y, target.z - shooter.z);
        if (dist <= spec.range + 5) {
          const dmg = spec.pellets > 1 ? Math.round(spec.damage * 4.5) : spec.damage;
          this.applyDamage(room, target, shooter, dmg, spec.id);
        }
      }
    }
  }

  private applyDamage(
    room: RoomInternal,
    target: NetPlayerState,
    attacker: NetPlayerState,
    damage: number,
    weaponId: WeaponId,
  ): void {
    if (!target.alive || room.roundEndedTimer > 0) return;
    const protectUntil = this.spawnProtectUntil.get(target.id) ?? 0;
    if (Date.now() < protectUntil) return;

    target.hp = Math.max(0, target.hp - damage);
    const hurtBot = room.bots.get(target.id);
    if (hurtBot && target.hp > 0) {
      hurtBot.memory.hurtEvadeTimer = 0.65;
      hurtBot.memory.strafeSign = Math.random() > 0.5 ? 1 : -1;
      hurtBot.memory.lastKnownTargetPos = [attacker.x, attacker.y, attacker.z];
    }
    this.broadcastRoom(room, {
      type: 'player:damaged',
      targetId: target.id,
      attackerId: attacker.id,
      damage,
      newHp: target.hp,
      weaponId,
    });

    if (target.hp <= 0) {
      target.alive = false;
      target.deaths += 1;
      target.respawnTimer = 2.8;
      if (attacker.id !== target.id) {
        attacker.kills += 1;
        attacker.score += 100;
      }
      const killItem: KillFeedItem = {
        id: this.nextId('kf'),
        killerName: attacker.name,
        victimName: target.name,
        weaponId,
        timestamp: Date.now(),
        isSelfKill: attacker.id === target.id,
      };
      this.broadcastRoom(room, { type: 'killfeed:add', item: killItem });

      if (attacker.id !== target.id && attacker.kills >= room.info.scoreLimit) {
        this.endRoomRound(room, attacker);
      }
    }
  }

  private endRoomRound(room: RoomInternal, winner: NetPlayerState): void {
    room.roundEndedTimer = 7.0;
    const standings = this.collectParticipants(room).sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const mapIds: MapId[] = [
      'obsidian-foundry',
      'helios-outpost',
      'borealis-citadel',
      'estate-garden',
      'safehouse-manor',
      'neon-rooftop',
      'oasis-temple',
    ];
    const nextMapId = mapIds[(mapIds.indexOf(room.info.mapId) + 1) % mapIds.length];

    this.broadcastRoom(room, {
      type: 'match:ended',
      winnerId: winner.id,
      winnerName: winner.name,
      standings,
      nextMapId,
    });
  }

  public tickRooms(dt: number): void {
    for (const room of this.rooms.values()) {
      // Only actively simulate rooms that have at least 1 human player connected
      if (room.players.size === 0) continue;

      if (room.roundEndedTimer > 0) {
        room.roundEndedTimer -= dt;
        if (room.roundEndedTimer <= 0) {
          // Reset scores for next round
          room.info.timeRemainingSec = ROUND_DURATION_SEC;
          for (const p of this.collectParticipants(room)) {
            p.kills = 0;
            p.deaths = 0;
            p.score = 0;
            this.respawnParticipant(room, p);
          }
        }
        continue;
      }

      room.info.timeRemainingSec = Math.max(0, room.info.timeRemainingSec - dt);
      if (room.info.timeRemainingSec <= 0) {
        const standings = this.collectParticipants(room).sort((a, b) => b.kills - a.kills);
        if (standings[0]) {
          this.endRoomRound(room, standings[0]);
          continue;
        }
      }

      // Update respawn timers
      for (const p of this.collectParticipants(room)) {
        if (!p.alive) {
          p.respawnTimer = Math.max(0, p.respawnTimer - dt);
          if (p.respawnTimer <= 0) {
            this.respawnParticipant(room, p);
          }
        }
      }

      // Step tactical AI bots
      this.stepRoomBots(room, dt);

      // Broadcast 20Hz authoritative snapshot
      this.broadcastRoom(room, {
        type: 'room:snapshot',
        roomId: room.info.id,
        timeRemainingSec: Math.ceil(room.info.timeRemainingSec),
        players: this.collectParticipants(room),
      });
    }
  }

  private stepRoomBots(room: RoomInternal, dt: number): void {
    const map = ARENA_MAPS[room.info.mapId];
    const allParticipants = this.collectParticipants(room);

    for (const bot of room.bots.values()) {
      if (!bot.state.alive) continue;

      const decision = evaluateBotStep(bot.state, bot.move, bot.memory, allParticipants, map, dt);

      if (decision.shouldFire) {
        this.processWeaponFire(
          room,
          bot.state,
          bot.state.weaponId,
          decision.fireOrigin,
          decision.fireDir,
          decision.didHit ? decision.targetId : undefined,
          decision.hitPoint,
        );
      }

      stepCharacterMovement(bot.move, decision.moveInput, map, dt);

      bot.state.x = bot.move.x;
      bot.state.y = bot.move.y;
      bot.state.z = bot.move.z;
      bot.state.vx = bot.move.vx;
      bot.state.vy = bot.move.vy;
      bot.state.vz = bot.move.vz;
      bot.state.yaw = bot.move.yaw;
      bot.state.crouching = bot.move.crouching;
      bot.state.sliding = bot.move.sliding;
      bot.state.grounded = bot.move.grounded;
    }
  }
}
