import { useCallback, useEffect, useRef, useState } from 'react';
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

export interface MatchEndEvent {
  winnerId: string;
  winnerName: string;
  standings: NetPlayerState[];
  nextMapId: MapId;
}

export interface MultiplayerCallbacks {
  onRoomJoined?: (room: ServerRoomInfo, players: NetPlayerState[]) => void;
  onSnapshot?: (players: NetPlayerState[], timeRemainingSec: number) => void;
  onRemoteFire?: (msg: Extract<ServerToClientMessage, { type: 'player:fired' }>) => void;
  onDamaged?: (msg: Extract<ServerToClientMessage, { type: 'player:damaged' }>) => void;
  onMatchEnded?: (ev: MatchEndEvent) => void;
}

export function useMultiplayerSocket(callbacks: MultiplayerCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string>('local');
  const [onlineCount, setOnlineCount] = useState(1);
  const [rooms, setRooms] = useState<ServerRoomInfo[]>([]);
  const [activeRoom, setActiveRoom] = useState<ServerRoomInfo | null>(null);
  const [players, setPlayers] = useState<NetPlayerState[]>([]);
  const [timeRemainingSec, setTimeRemainingSec] = useState(300);
  const [globalChat, setGlobalChat] = useState<ChatMessage[]>([]);
  const [roomChat, setRoomChat] = useState<ChatMessage[]>([]);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sendRaw = useCallback((msg: ClientToServerMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  useEffect(() => {
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${proto}//${window.location.host}/ws`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (disposed) return;
        setConnected(true);
        setErrorMsg(null);
      };

      ws.onmessage = (ev) => {
        if (disposed) return;
        try {
          const msg = JSON.parse(String(ev.data)) as ServerToClientMessage;
          switch (msg.type) {
            case 'welcome':
              setClientId(msg.clientId);
              setOnlineCount(msg.onlineCount);
              setRooms(msg.rooms);
              setGlobalChat(msg.globalChat);
              break;
            case 'rooms:update':
              setOnlineCount(msg.onlineCount);
              setRooms(msg.rooms);
              break;
            case 'room:joined':
              setActiveRoom(msg.room);
              setPlayers(msg.players);
              setTimeRemainingSec(msg.room.timeRemainingSec);
              setRoomChat(msg.roomChat);
              setKillFeed([]);
              cbRef.current.onRoomJoined?.(msg.room, msg.players);
              break;
            case 'room:snapshot':
              setTimeRemainingSec(msg.timeRemainingSec);
              setPlayers(msg.players);
              cbRef.current.onSnapshot?.(msg.players, msg.timeRemainingSec);
              break;
            case 'player:fired':
              cbRef.current.onRemoteFire?.(msg);
              break;
            case 'player:damaged':
              cbRef.current.onDamaged?.(msg);
              break;
            case 'killfeed:add':
              setKillFeed((prev) => [msg.item, ...prev].slice(0, 5));
              break;
            case 'match:ended':
              cbRef.current.onMatchEnded?.({
                winnerId: msg.winnerId,
                winnerName: msg.winnerName,
                standings: msg.standings,
                nextMapId: msg.nextMapId,
              });
              break;
            case 'chat:message':
              if (msg.message.channel === 'room') {
                setRoomChat((prev) => {
                  if (prev.some((m) => m.id === msg.message.id)) return prev;
                  return [...prev, msg.message].slice(-40);
                });
              } else {
                setGlobalChat((prev) => {
                  if (prev.some((m) => m.id === msg.message.id)) return prev;
                  return [...prev, msg.message].slice(-40);
                });
              }
              break;
            case 'error':
              setErrorMsg(msg.message);
              break;
          }
        } catch {
          // Ignore malformed frame
        }
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        reconnectTimerRef.current = window.setTimeout(connect, 1500);
      };
    };

    // Also fetch initial server list over HTTP for immediate first-paint data
    fetch('/api/servers')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!disposed && data?.rooms) {
          setRooms(data.rooms);
          if (typeof data.onlineCount === 'number') setOnlineCount(data.onlineCount);
        }
      })
      .catch(() => {});

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  const joinRoom = useCallback(
    (roomId: string, name: string, characterId: CharacterId) => {
      setErrorMsg(null);
      sendRaw({ type: 'room:join', roomId, name, characterId });
    },
    [sendRaw],
  );

  const quickMatch = useCallback(
    (preferredMapId: MapId | undefined, name: string, characterId: CharacterId) => {
      setErrorMsg(null);
      sendRaw({ type: 'matchmake', preferredMapId, name, characterId });
    },
    [sendRaw],
  );

  const createRoom = useCallback(
    (opts: {
      name: string;
      mapId: MapId;
      mode: GameMode;
      maxPlayers: number;
      fillBots: boolean;
    }) => {
      setErrorMsg(null);
      sendRaw({ type: 'room:create', ...opts });
    },
    [sendRaw],
  );

  const leaveRoom = useCallback(() => {
    sendRaw({ type: 'room:leave' });
    setActiveRoom(null);
    setPlayers([]);
    setKillFeed([]);
  }, [sendRaw]);

  const sendTransform = useCallback(
    (payload: {
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
    }) => {
      sendRaw({ type: 'player:update', ...payload });
    },
    [sendRaw],
  );

  const sendFire = useCallback(
    (payload: {
      weaponId: WeaponId;
      origin: [number, number, number];
      dir: [number, number, number];
      hitTargetId?: string;
      hitPoint?: [number, number, number];
      isHeadshot?: boolean;
      pelletsHit?: number;
    }) => {
      sendRaw({ type: 'player:fire', ...payload });
    },
    [sendRaw],
  );

  const sendChat = useCallback(
    (channel: 'global' | 'room', text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      sendRaw({ type: 'chat:send', channel, text: trimmed });
    },
    [sendRaw],
  );

  return {
    connected,
    clientId,
    onlineCount,
    rooms,
    activeRoom,
    players,
    timeRemainingSec,
    globalChat,
    roomChat,
    killFeed,
    errorMsg,
    joinRoom,
    quickMatch,
    createRoom,
    leaveRoom,
    sendTransform,
    sendFire,
    sendChat,
  };
}
