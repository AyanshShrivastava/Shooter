import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { LobbyScreen } from './components/LobbyScreen';
import { MobileControls } from './components/MobileControls';
import { OutcomeModal, PauseModal } from './components/PauseAndOutcomeModals';
import { ArenaEngine, HudTelemetrySnapshot } from './game/ArenaEngine';
import { tacticalAudio } from './game/audio';
import { useMultiplayerSocket } from './hooks/useMultiplayerSocket';
import {
  AppScreenState,
  CameraPerspective,
  CharacterId,
  GameMode,
  MapId,
  MatchResultSummary,
  WeaponId,
} from './shared/types';
import { WEAPONS } from './shared/weapons';

const INITIAL_HUD: HudTelemetrySnapshot = {
  hp: 100,
  maxHp: 100,
  ammo: WEAPONS['pulse-carbine'].magSize,
  magSize: WEAPONS['pulse-carbine'].magSize,
  reloading: false,
  reloadProgress: 0,
  weaponId: 'pulse-carbine',
  dashReadyRatio: 1,
  speedMs: 0,
  sliding: false,
  crouching: false,
  grounded: true,
  alive: true,
  respawnTimer: 0,
  perspective: 'first-person',
  hitmarkerKind: 'none',
  damageFlash: 0,
  pointerLocked: false,
  adsHeld: false,
  playerPos: [0, 0, 30],
  playerYaw: 0,
  spreadRatio: 0.25,
};

export default function App() {
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<ArenaEngine | null>(null);

  const [screenState, setScreenState] = useState<AppScreenState>('title');
  const [callsign, setCallsign] = useState('Operative-01');
  const [characterId, setCharacterId] = useState<CharacterId>('vanguard-soldier');
  const [selectedMapId, setSelectedMapId] = useState<MapId>('obsidian-foundry');
  const [hud, setHud] = useState<HudTelemetrySnapshot>(INITIAL_HUD);
  const [muted, setMuted] = useState(false);
  const [perspective, setPerspective] = useState<CameraPerspective>('first-person');
  const [sensitivity, setSensitivity] = useState(0.0022);
  const [chatOpen, setChatOpen] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [matchSummary, setMatchSummary] = useState<MatchResultSummary | null>(null);
  const [touchEnabled, setTouchEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const hasFinePointer = window.matchMedia?.('(pointer: fine)').matches ?? false;
    const isCoarseOnly =
      (window.matchMedia?.('(pointer: coarse)').matches ?? false) && !hasFinePointer;
    return isCoarseOnly || Math.min(window.innerWidth, window.innerHeight) < 768;
  });
  const [isPortraitMobile, setIsPortraitMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth && Math.min(window.innerWidth, window.innerHeight) < 768;
  });
  const [rotateDismissed, setRotateDismissed] = useState(false);

  const shotsFiredRef = useRef(0);
  const shotsHitRef = useRef(0);
  const damageDealtRef = useRef(0);
  const autostartTriggeredRef = useRef(false);
  const screenStateRef = useRef<AppScreenState>(screenState);
  screenStateRef.current = screenState;

  const socket = useMultiplayerSocket({
    onRoomJoined: (room, roomPlayers) => {
      const engine = engineRef.current;
      if (!engine) return;
      engine.loadMap(room.mapId, true);
      const me = roomPlayers.find((p) => p.id === socketRef.current.clientId);
      if (me) {
        engine.setLocalIdentity(me.id, me.characterId);
        engine.applyLocalSpawn(me.x, me.y, me.z, me.yaw);
      }
      engine.syncRemotePlayers(roomPlayers);
      shotsFiredRef.current = 0;
      shotsHitRef.current = 0;
      damageDealtRef.current = 0;
      setMatchSummary(null);
      setScoreboardOpen(false);
      setChatOpen(false);
      setScreenState('playing');
      (document.activeElement as HTMLElement | null)?.blur?.();
    },
    onSnapshot: (roomPlayers) => {
      engineRef.current?.syncRemotePlayers(roomPlayers);
    },
    onRemoteFire: (msg) => {
      engineRef.current?.handleRemoteFire(
        msg.shooterId,
        msg.weaponId,
        msg.origin,
        msg.dir,
        msg.hitPoint,
      );
    },
    onDamaged: (msg) => {
      const myId = socketRef.current.clientId;
      if (msg.attackerId === myId && msg.targetId !== myId) {
        damageDealtRef.current += msg.damage;
        engineRef.current?.notifyHitConfirm(msg.newHp <= 0);
      }
    },
    onMatchEnded: (ev) => {
      const myId = socketRef.current.clientId;
      const room = socketRef.current.activeRoom;
      const idx = ev.standings.findIndex((s) => s.id === myId);
      const me = idx >= 0 ? ev.standings[idx] : undefined;
      setMatchSummary({
        winnerId: ev.winnerId,
        winnerName: ev.winnerName,
        isVictory: ev.winnerId === myId,
        kills: me?.kills ?? 0,
        deaths: me?.deaths ?? 0,
        damageDealt: damageDealtRef.current,
        shotsFired: shotsFiredRef.current,
        shotsHit: shotsHitRef.current,
        placement: idx >= 0 ? idx + 1 : ev.standings.length,
        totalParticipants: ev.standings.length,
        mapId: room?.mapId ?? selectedMapId,
        roomName: room?.name ?? 'Vanguard Arena',
      });
      setScreenState('gameover');
    },
  });

  const socketRef = useRef(socket);
  socketRef.current = socket;

  // Sync body[data-state] and engine appState
  useEffect(() => {
    document.body.dataset.state = screenState;
    engineRef.current?.setAppState(screenState);
  }, [screenState]);

  // Mount Three.js + Cannon-ES engine once
  useEffect(() => {
    const host = canvasHostRef.current;
    if (!host) return;

    const engine = new ArenaEngine(host, {
      onHudUpdate: (snapshot) => setHud(snapshot),
      onLocalTransform: (payload) => {
        socketRef.current.sendTransform(payload);
      },
      onLocalFire: (payload) => {
        socketRef.current.sendFire(payload);
      },
      onShotStats: (didHit) => {
        shotsFiredRef.current += 1;
        if (didHit) shotsHitRef.current += 1;
      },
    });
    engine.setAppState(screenStateRef.current);
    engineRef.current = engine;

    const onResize = () => {
      const minDim = Math.min(window.innerWidth, window.innerHeight);
      if (minDim < 768) {
        setTouchEnabled(true);
      }
      setIsPortraitMobile(window.innerHeight > window.innerWidth && minDim < 768);
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Update engine local identity when clientId or characterId changes
  useEffect(() => {
    engineRef.current?.setLocalIdentity(socket.clientId, characterId);
  }, [socket.clientId, characterId]);

  const handleSelectMap = useCallback((mapId: MapId) => {
    setSelectedMapId(mapId);
    if (screenStateRef.current === 'title') {
      engineRef.current?.loadMap(mapId, true);
    }
  }, []);

  const tryLockLandscape = useCallback(() => {
    if (!touchEnabled) return;
    try {
      const ori = screen.orientation as unknown as { lock?: (o: string) => Promise<void> };
      ori?.lock?.('landscape')?.catch(() => {});
    } catch {
      // Orientation lock unsupported in desktop or restricted iframe
    }
  }, [touchEnabled]);

  const handleQuickMatch = useCallback(() => {
    (document.activeElement as HTMLElement | null)?.blur?.();
    tryLockLandscape();
    if (socketRef.current.connected) {
      socketRef.current.quickMatch(selectedMapId, callsign, characterId);
    } else {
      // Immediate offline-resilient entry into selected arena until WS finishes handshake
      engineRef.current?.loadMap(selectedMapId, true);
      setScreenState('playing');
    }
  }, [callsign, characterId, selectedMapId, tryLockLandscape]);

  const handleJoinRoom = useCallback(
    (roomId: string) => {
      (document.activeElement as HTMLElement | null)?.blur?.();
      tryLockLandscape();
      socketRef.current.joinRoom(roomId, callsign, characterId);
    },
    [callsign, characterId, tryLockLandscape],
  );

  const handleCreateRoom = useCallback(
    (opts: {
      name: string;
      mapId: MapId;
      mode: GameMode;
      maxPlayers: number;
      fillBots: boolean;
    }) => {
      socketRef.current.createRoom(opts);
    },
    [],
  );

  const handleLeaveToLobby = useCallback(() => {
    socketRef.current.leaveRoom();
    setMatchSummary(null);
    setScoreboardOpen(false);
    setChatOpen(false);
    setScreenState('title');
    engineRef.current?.loadMap(selectedMapId, true);
  }, [selectedMapId]);

  const handleToggleMute = useCallback(() => {
    const next = tacticalAudio.toggleMute();
    setMuted(next);
  }, []);

  const handleTogglePerspective = useCallback(() => {
    const next = engineRef.current?.togglePerspective();
    if (next) setPerspective(next);
  }, []);

  const handleSensitivityChange = useCallback((val: number) => {
    setSensitivity(val);
    engineRef.current?.setSensitivity(val);
  }, []);

  const handlePlayAgain = useCallback(() => {
    const room = socketRef.current.activeRoom;
    if (room) {
      socketRef.current.joinRoom(room.id, callsign, characterId);
    } else {
      handleQuickMatch();
    }
  }, [callsign, characterId, handleQuickMatch]);

  // ?autostart=1 support for instant deployment / verification
  useEffect(() => {
    if (autostartTriggeredRef.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      autostartTriggeredRef.current = true;
      if (socket.connected) {
        socket.quickMatch(selectedMapId, callsign, characterId);
      } else {
        engineRef.current?.loadMap(selectedMapId, true);
        setScreenState('playing');
      }
    }
  }, [socket.connected, socket, selectedMapId, callsign, characterId]);

  // Global keyboard shortcuts (Title Enter/Space, Playing P/Esc/M/V/Tab/T)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const inInput =
        active &&
        (active.tagName === 'INPUT' ||
          active.tagName === 'TEXTAREA' ||
          active.tagName === 'SELECT');

      if (screenStateRef.current === 'title') {
        if (!inInput && (e.code === 'Enter' || e.code === 'Space')) {
          e.preventDefault();
          handleQuickMatch();
        }
        return;
      }

      if (inInput) return;

      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (screenStateRef.current === 'playing') {
          if (chatOpen) {
            setChatOpen(false);
          } else if (scoreboardOpen) {
            setScoreboardOpen(false);
          } else {
            setScreenState('paused');
          }
        } else if (screenStateRef.current === 'paused') {
          setScreenState('playing');
        }
      } else if (e.code === 'KeyM') {
        handleToggleMute();
      } else if (e.code === 'KeyV' && screenStateRef.current === 'playing') {
        handleTogglePerspective();
      } else if (e.code === 'Tab' && screenStateRef.current === 'playing') {
        e.preventDefault();
        setScoreboardOpen((v) => !v);
      } else if (e.code === 'KeyT' && screenStateRef.current === 'playing') {
        e.preventDefault();
        if (document.pointerLockElement) document.exitPointerLock?.();
        setChatOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chatOpen, scoreboardOpen, handleQuickMatch, handleToggleMute, handleTogglePerspective]);

  return (
    <main className="relative w-full h-dvh overflow-hidden bg-zinc-950">
      {/* Isolated empty WebGL mount node */}
      <div
        ref={canvasHostRef}
        data-testid="arena-canvas"
        className="game-canvas-host fixed inset-0 z-0"
      />

      {screenState === 'title' && (
        <LobbyScreen
          connected={socket.connected}
          onlineCount={socket.onlineCount}
          callsign={callsign}
          onCallsignChange={setCallsign}
          characterId={characterId}
          onCharacterChange={setCharacterId}
          selectedMapId={selectedMapId}
          onSelectMap={handleSelectMap}
          rooms={socket.rooms}
          globalChat={socket.globalChat}
          errorMsg={socket.errorMsg}
          onQuickMatch={handleQuickMatch}
          onJoinRoom={handleJoinRoom}
          onCreateRoom={handleCreateRoom}
          onSendGlobalChat={(text) => socket.sendChat('global', text)}
        />
      )}

      {screenState === 'playing' && (
        <>
          <GameHud
            hud={hud}
            room={socket.activeRoom}
            players={socket.players}
            localPlayerId={socket.clientId}
            timeRemainingSec={socket.timeRemainingSec}
            killFeed={socket.killFeed}
            roomChat={socket.roomChat}
            chatOpen={chatOpen}
            onToggleChat={setChatOpen}
            onSendRoomChat={(text) => socket.sendChat('room', text)}
            scoreboardOpen={scoreboardOpen}
            onToggleScoreboard={() => setScoreboardOpen((v) => !v)}
            muted={muted}
            onToggleMute={handleToggleMute}
            onTogglePerspective={handleTogglePerspective}
            touchEnabled={touchEnabled}
            onToggleTouch={() => setTouchEnabled((v) => !v)}
            onPause={() => setScreenState('paused')}
            onSelectWeapon={(wId: WeaponId) => engineRef.current?.equipWeapon(wId)}
          />

          {touchEnabled && (
            <MobileControls
              activeWeapon={hud.weaponId}
              adsHeld={hud.adsHeld}
              onMove={(x, y, sprint) => engineRef.current?.setTouchMove(x, y, sprint)}
              onLook={(dx, dy) => engineRef.current?.addTouchLook(dx, dy)}
              onFireChange={(f) => engineRef.current?.setTouchFiring(f)}
              onToggleAds={() => engineRef.current?.toggleAds()}
              onJump={() => engineRef.current?.triggerJump()}
              onDash={() => engineRef.current?.triggerDash()}
              onSlideChange={(s) => engineRef.current?.setTouchCrouch(s)}
              onReload={() => engineRef.current?.startReload()}
              onSwapWeapon={() => engineRef.current?.cycleWeapon()}
              onSelectWeapon={(wId: WeaponId) => engineRef.current?.equipWeapon(wId)}
              onOpenChat={() => setChatOpen((v) => !v)}
            />
          )}

          {isPortraitMobile && !rotateDismissed && (
            <div className="fixed inset-x-3 top-14 z-30 flex items-center justify-between gap-2 bg-zinc-950/92 border border-amber-500/70 rounded-xl px-3 py-2 text-xs text-zinc-100 pointer-events-auto">
              <span>Rotate phone horizontally for wide shooter controls</span>
              <button
                type="button"
                onClick={() => setRotateDismissed(true)}
                className="px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-semibold shrink-0"
              >
                OK
              </button>
            </div>
          )}
        </>
      )}

      {screenState === 'paused' && (
        <PauseModal
          perspective={perspective}
          sensitivity={sensitivity}
          onSensitivityChange={handleSensitivityChange}
          onTogglePerspective={handleTogglePerspective}
          onResume={() => setScreenState('playing')}
          onLeaveMatch={handleLeaveToLobby}
        />
      )}

      {screenState === 'gameover' && matchSummary && (
        <OutcomeModal
          summary={matchSummary}
          onPlayAgain={handlePlayAgain}
          onReturnLobby={handleLeaveToLobby}
        />
      )}
    </main>
  );
}
