import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Gamepad2,
  List,
  MessageSquare,
  Pause,
  Send,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ARENA_MAPS } from '../shared/maps';
import {
  ChatMessage,
  KillFeedItem,
  NetPlayerState,
  ServerRoomInfo,
  WeaponId,
} from '../shared/types';
import { WEAPON_ORDER, WEAPONS } from '../shared/weapons';
import { HudTelemetrySnapshot } from '../game/ArenaEngine';

interface GameHudProps {
  hud: HudTelemetrySnapshot;
  room: ServerRoomInfo | null;
  players: NetPlayerState[];
  localPlayerId: string;
  timeRemainingSec: number;
  killFeed: KillFeedItem[];
  roomChat: ChatMessage[];
  chatOpen: boolean;
  onToggleChat: (open: boolean) => void;
  onSendRoomChat: (text: string) => void;
  scoreboardOpen: boolean;
  onToggleScoreboard: () => void;
  muted: boolean;
  onToggleMute: () => void;
  onTogglePerspective: () => void;
  touchEnabled: boolean;
  onToggleTouch: () => void;
  onPause: () => void;
  onSelectWeapon: (id: WeaponId) => void;
}

function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  room,
  players,
  localPlayerId,
  timeRemainingSec,
  killFeed,
  roomChat,
  chatOpen,
  onToggleChat,
  onSendRoomChat,
  scoreboardOpen,
  onToggleScoreboard,
  muted,
  onToggleMute,
  onTogglePerspective,
  touchEnabled,
  onToggleTouch,
  onPause,
  onSelectWeapon,
}) => {
  const [ghostHp, setGhostHp] = useState(hud.hp);
  const [chatText, setChatText] = useState('');
  const chatInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setGhostHp(hud.hp);
    }, 260);
    return () => clearTimeout(t);
  }, [hud.hp]);

  useEffect(() => {
    if (chatOpen) {
      chatInputRef.current?.focus();
    }
  }, [chatOpen]);

  const localNet = players.find((p) => p.id === localPlayerId);
  const mapSpec = room ? ARENA_MAPS[room.mapId] : ARENA_MAPS['obsidian-foundry'];
  const activeWeapon = WEAPONS[hud.weaponId];
  const reticleGap = Math.round(6 + hud.spreadRatio * 14);
  const lowHpOpacity = hud.hp < 35 && hud.alive ? ((35 - hud.hp) / 35) * 0.45 : 0;

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      onSendRoomChat(chatText);
      setChatText('');
    }
    onToggleChat(false);
  };

  return (
    <div className="fixed inset-0 z-10 pointer-events-none select-none">
      {/* Damage / Low HP Peripheral Vignette */}
      {(hud.damageFlash > 0.02 || lowHpOpacity > 0.02) && (
        <div
          className="fixed inset-0 pointer-events-none transition-opacity"
          style={{
            background:
              'radial-gradient(circle at center, transparent 52%, rgba(220, 38, 38, 0.72) 100%)',
            opacity: Math.max(hud.damageFlash * 0.65, lowHpOpacity),
          }}
        />
      )}

      {/* Exact (0,0) Center Reticle & Hitmarker */}
      {hud.alive && (
        <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <span className="w-1 h-1 rounded-full bg-white shadow" />
            <span
              className="absolute w-2.5 h-0.5 bg-white/90"
              style={{ transform: `translateX(-${reticleGap + 5}px)` }}
            />
            <span
              className="absolute w-2.5 h-0.5 bg-white/90"
              style={{ transform: `translateX(${reticleGap + 5}px)` }}
            />
            <span
              className="absolute w-0.5 h-2.5 bg-white/90"
              style={{ transform: `translateY(-${reticleGap + 5}px)` }}
            />
            <span
              className="absolute w-0.5 h-2.5 bg-white/90"
              style={{ transform: `translateY(${reticleGap + 5}px)` }}
            />
            {hud.hitmarkerKind !== 'none' && (
              <svg viewBox="0 0 24 24" className="w-6 h-6 absolute">
                <path
                  d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5"
                  stroke={hud.hitmarkerKind === 'kill' ? '#ef4444' : '#f59e0b'}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top-Left Cluster: Match Timer, Score, Minimap & Touch HP */}
      <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 flex items-start gap-2.5">
        {/* Live 2D Minimap projecting real map boxes & actors */}
        <div
          className={`${
            touchEnabled ? 'hidden md:block w-16 h-16 lg:w-24 lg:h-24' : 'hidden sm:block w-28 h-28'
          } bg-zinc-950/85 border border-zinc-800 rounded-xl p-1.5`}
        >
          <svg
            viewBox={`${-mapSpec.halfExtent} ${-mapSpec.halfExtent} ${mapSpec.halfExtent * 2} ${mapSpec.halfExtent * 2}`}
            className="w-full h-full"
          >
            <rect
              x={-mapSpec.halfExtent}
              y={-mapSpec.halfExtent}
              width={mapSpec.halfExtent * 2}
              height={mapSpec.halfExtent * 2}
              fill="#09090b"
            />
            {mapSpec.boxes.map((b) => (
              <rect
                key={b.id}
                x={b.x - b.w / 2}
                y={b.z - b.d / 2}
                width={b.w}
                height={b.d}
                fill="#3f3f46"
              />
            ))}
            {players.map((p) => {
              if (!p.alive || p.id === localPlayerId) return null;
              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.z}
                  r={2.1}
                  fill={p.isBot ? '#ef4444' : '#06b6d4'}
                />
              );
            })}
            <g
              transform={`translate(${hud.playerPos[0]}, ${hud.playerPos[2]}) rotate(${(-hud.playerYaw * 180) / Math.PI})`}
            >
              <polygon points="0,-3.2 2.4,2.4 -2.4,2.4" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* Score, Clock & Touch Compact Vitality */}
        <div className="bg-zinc-950/85 border border-zinc-800 rounded-xl px-3 py-1.5 sm:px-3.5 sm:py-2">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-400">Clock</div>
              <div className="font-mono-tabular text-sm sm:text-lg font-bold text-zinc-100 leading-tight">
                {formatClock(timeRemainingSec)}
              </div>
            </div>
            <div className="h-6 sm:h-7 w-px bg-zinc-800" />
            <div>
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider text-zinc-400">Kills</div>
              <div className="font-mono-tabular text-sm sm:text-lg font-bold text-amber-400 leading-tight">
                {localNet?.kills ?? 0}
                <span className="text-[11px] sm:text-xs text-zinc-400 font-normal">
                  /{room?.scoreLimit ?? 15}
                </span>
              </div>
            </div>
            {touchEnabled ? (
              <>
                <div className="h-6 w-px bg-zinc-800" />
                <div className="min-w-20">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono-tabular text-sm font-bold text-zinc-50 leading-tight">
                      {Math.round(hud.hp)}
                      <span className="text-[9px] text-zinc-400 font-normal ml-0.5">HP</span>
                    </span>
                    <span className="font-mono-tabular text-[10px] text-cyan-300">
                      {hud.speedMs.toFixed(0)}m/s
                    </span>
                  </div>
                  <div className="relative h-1.5 bg-zinc-800 rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all duration-75 ${
                        hud.hp > 35 ? 'bg-emerald-400' : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, hud.hp))}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="h-7 w-px bg-zinc-800 hidden sm:block" />
                <div className="hidden sm:block">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">Arena</div>
                  <div className="text-xs font-semibold text-zinc-200 max-w-32 truncate">
                    {room?.name ?? mapSpec.name}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top-Right Cluster: Utility Buttons + Kill Feed */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleMute();
            }}
            aria-label={muted ? 'Unmute audio [M]' : 'Mute audio [M]'}
            title="Mute / Unmute [M]"
            className="w-9 h-9 rounded-lg bg-zinc-950/85 border border-zinc-800 hover:border-zinc-600 text-zinc-200 flex items-center justify-center cursor-pointer"
          >
            {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePerspective();
            }}
            aria-label="Toggle camera perspective [V]"
            title="1st / 3rd Person Camera [V]"
            className="h-9 px-2.5 rounded-lg bg-zinc-950/85 border border-zinc-800 hover:border-zinc-600 text-zinc-200 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">
              {hud.perspective === 'first-person' ? '1P' : '3P'}
            </span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleTouch();
            }}
            aria-label="Toggle on-screen touch controls"
            title="Toggle Mobile Touch Controls"
            className={`w-9 h-9 rounded-lg border flex items-center justify-center cursor-pointer ${
              touchEnabled
                ? 'bg-cyan-600 border-cyan-400 text-zinc-950'
                : 'bg-zinc-950/85 border-zinc-800 hover:border-zinc-600 text-zinc-200'
            }`}
          >
            <Gamepad2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleScoreboard();
            }}
            aria-label="Toggle scoreboard [Tab]"
            title="Scoreboard [Tab]"
            className="w-9 h-9 rounded-lg bg-zinc-950/85 border border-zinc-800 hover:border-zinc-600 text-zinc-200 flex items-center justify-center cursor-pointer"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onPause();
            }}
            aria-label="Pause menu [P]"
            title="Pause [P / Esc]"
            className="w-9 h-9 rounded-lg bg-zinc-950/85 border border-zinc-800 hover:border-zinc-600 text-zinc-200 flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Touch Weapon & Ammo Readout (keeps bottom-right open for shoot/aim controls) */}
        {touchEnabled && (
          <div className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">
              {activeWeapon.name}
            </span>
            <span className="h-3.5 w-px bg-zinc-700" />
            <span className="font-mono-tabular text-xs font-bold text-amber-400 whitespace-nowrap">
              {hud.reloading
                ? `RLD ${Math.round(hud.reloadProgress * 100)}%`
                : `${hud.ammo}/${hud.magSize}`}
            </span>
          </div>
        )}

        {/* Live Kill Feed */}
        <div className="flex flex-col items-end gap-1">
          {killFeed.slice(0, touchEnabled ? 2 : 4).map((kf) => (
            <div
              key={kf.id}
              className="px-2.5 py-1 rounded bg-zinc-950/80 border border-zinc-800 text-xs flex items-center gap-1.5"
            >
              <span className="font-semibold text-amber-400">{kf.killerName}</span>
              <span className="text-zinc-500">[{WEAPONS[kf.weaponId]?.name ?? kf.weaponId}]</span>
              <span className="font-semibold text-zinc-200">{kf.victimName}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Respawn Banner when eliminated */}
      {!hud.alive && (
        <div className="fixed left-1/2 top-1/3 -translate-x-1/2 bg-zinc-950/92 border border-red-800 rounded-xl px-6 py-3 text-center">
          <div className="font-display text-lg font-bold text-red-400">ELIMINATED</div>
          <div className="font-mono-tabular text-xs text-zinc-300 mt-1">
            Respawning in {Math.max(0.1, hud.respawnTimer).toFixed(1)}s
          </div>
        </div>
      )}

      {/* In-Match Real-Time Chat (Desktop lower-left; touch uses chat drawer) */}
      {!touchEnabled && (
        <div
          className={`hidden md:flex flex-col w-72 absolute left-3 bottom-24 transition-opacity ${
            chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-80'
          }`}
        >
        <div className="bg-zinc-950/78 border border-zinc-800/90 rounded-lg p-2 max-h-32 overflow-y-auto tactical-scroll space-y-1">
          {roomChat.slice(-6).map((m) => (
            <div key={m.id} className="text-[11px] leading-snug break-words">
              <span className={m.isSystem ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'}>
                {m.senderName}:{' '}
              </span>
              <span className="text-zinc-200">{m.text}</span>
            </div>
          ))}
        </div>
        {chatOpen ? (
          <form onSubmit={handleChatSubmit} className="mt-1.5 flex gap-1.5 pointer-events-auto">
            <input
              ref={chatInputRef}
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  onToggleChat(false);
                }
              }}
              placeholder="Say to match [Enter]..."
              maxLength={200}
              className="flex-1 bg-zinc-950 border border-cyan-500 rounded-md px-2.5 py-1 text-xs text-zinc-100 focus:outline-none"
            />
            <button
              type="submit"
              aria-label="Send match chat"
              className="px-2.5 py-1 rounded-md bg-cyan-500 text-zinc-950 font-semibold text-xs cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onToggleChat(true)}
            className="mt-1 self-start flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-200 pointer-events-auto cursor-pointer"
          >
            <MessageSquare className="w-3 h-3" />
            <span>Press T to chat</span>
          </button>
        )}
      </div>
      )}

      {/* Touch / Mobile Chat Drawer when toggled */}
      {chatOpen && (
        <div className={`${touchEnabled ? '' : 'md:hidden'} fixed inset-x-3 top-14 z-30 max-w-md mx-auto bg-zinc-950/95 border border-zinc-700 rounded-xl p-3 pointer-events-auto`}>
          <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
            {roomChat.slice(-6).map((m) => (
              <div key={m.id} className="text-xs">
                <span className="text-cyan-400 font-semibold">{m.senderName}: </span>
                <span className="text-zinc-200">{m.text}</span>
              </div>
            ))}
          </div>
          <form onSubmit={handleChatSubmit} className="flex gap-2">
            <input
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Type message..."
              maxLength={200}
              autoFocus
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-cyan-500 text-zinc-950 font-bold text-xs"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => onToggleChat(false)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 text-zinc-200 text-xs"
            >
              Close
            </button>
          </form>
        </div>
      )}

      {/* Desktop Bottom-Left Cluster: Vitality + Movement Telemetry */}
      {!touchEnabled && (
        <div className="absolute bottom-3 left-3 bg-zinc-950/88 border border-zinc-800 rounded-xl px-3.5 py-2.5 w-68">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1">
              <span className="font-mono-tabular text-2xl font-bold text-zinc-50 leading-none">
                {Math.round(hud.hp)}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">HP</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-zinc-400">
              <span>{hud.speedMs.toFixed(1)} m/s</span>
              <span aria-hidden="true">·</span>
              <span className={hud.dashReadyRatio >= 0.99 ? 'text-cyan-400' : 'text-zinc-500'}>
                {hud.sliding ? 'SLIDE' : hud.dashReadyRatio >= 0.99 ? 'DASH READY' : 'DASH'}
              </span>
            </div>
          </div>
          {/* Health bar with delayed trailing ghost bar */}
          <div className="relative h-2 bg-zinc-800 rounded-full overflow-hidden mt-2">
            <div
              className="absolute inset-y-0 left-0 bg-red-400/60 transition-all duration-300"
              style={{ width: `${Math.max(0, Math.min(100, ghostHp))}%` }}
            />
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-75 ${
                hud.hp > 35 ? 'bg-emerald-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, hud.hp))}%` }}
            />
          </div>
          {/* Dash cooldown bar */}
          <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-1.5">
            <div
              className="h-full bg-cyan-400 transition-all duration-100"
              style={{ width: `${Math.round(Math.max(0, Math.min(1, hud.dashReadyRatio)) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Desktop Bottom-Right Cluster: Weapon Loadout & Ammo */}
      {!touchEnabled && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
          <div className="bg-zinc-950/88 border border-zinc-800 rounded-xl px-3.5 py-2 flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-100 whitespace-nowrap">
                {activeWeapon.name}
              </div>
              <div className="text-[11px] text-zinc-400">{activeWeapon.role}</div>
            </div>
            <div className="h-7 w-px bg-zinc-800" />
            <div className="font-mono-tabular text-right">
              {hud.reloading ? (
                <div className="text-xs font-bold text-amber-400 whitespace-nowrap">
                  RELOAD {Math.round(hud.reloadProgress * 100)}%
                </div>
              ) : (
                <div className="text-2xl font-bold text-zinc-50 leading-none whitespace-nowrap">
                  {hud.ammo}
                  <span className="text-xs text-zinc-400 font-normal">/{hud.magSize}</span>
                </div>
              )}
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 pointer-events-auto">
            {WEAPON_ORDER.map((wId) => {
              const spec = WEAPONS[wId];
              const active = wId === hud.weaponId;
              return (
                <button
                  key={wId}
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSelectWeapon(wId);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-zinc-800 border-amber-500 text-amber-400'
                      : 'bg-zinc-950/85 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="font-mono-tabular mr-1">[{spec.key}]</span>
                  <span>{spec.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Scoreboard Overlay */}
      {scoreboardOpen && (
        <div className="fixed inset-0 z-30 bg-black/55 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <div>
                <h2 className="font-display text-base font-bold text-zinc-100">
                  {room?.name ?? 'Match Scoreboard'}
                </h2>
                <div className="text-xs text-zinc-400">
                  {mapSpec.name} · Target {room?.scoreLimit ?? 15} Eliminations
                </div>
              </div>
              <button
                type="button"
                onClick={onToggleScoreboard}
                className="px-2.5 py-1 rounded bg-zinc-800 text-xs text-zinc-200 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-3 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800">
                    <th className="py-2 px-2">Operative</th>
                    <th className="py-2 px-2">Type</th>
                    <th className="py-2 px-2 text-right">Kills</th>
                    <th className="py-2 px-2 text-right">Deaths</th>
                    <th className="py-2 px-2 text-right">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {[...players]
                    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
                    .map((p) => (
                      <tr
                        key={p.id}
                        className={`border-b border-zinc-900 ${
                          p.id === localPlayerId ? 'bg-amber-500/10 text-amber-300 font-semibold' : 'text-zinc-200'
                        }`}
                      >
                        <td className="py-2 px-2">{p.name}</td>
                        <td className="py-2 px-2 text-zinc-400">
                          {p.isBot ? 'BOT' : 'ONLINE'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono-tabular">{p.kills}</td>
                        <td className="py-2 px-2 text-right font-mono-tabular">{p.deaths}</td>
                        <td className="py-2 px-2 text-right font-mono-tabular">{p.score}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
