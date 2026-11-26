import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Crosshair,
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
  const [killBanner, setKillBanner] = useState<string | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const lastKillStreakRef = useRef(0);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setGhostHp(hud.hp);
    }, 260);
    return () => clearTimeout(t);
  }, [hud.hp]);

  useEffect(() => {
    if (hud.killStreak > lastKillStreakRef.current && hud.killStreak > 0) {
      const label =
        hud.killStreak >= 4
          ? `UNSTOPPABLE · ${hud.killStreak} STREAK`
          : hud.killStreak === 3
            ? 'TRIPLE ELIMINATION'
            : hud.killStreak === 2
              ? 'DOUBLE ELIMINATION'
              : 'TARGET ELIMINATED';
      setKillBanner(label);
      const t = window.setTimeout(() => setKillBanner(null), 1700);
      lastKillStreakRef.current = hud.killStreak;
      return () => clearTimeout(t);
    }
    if (hud.killStreak === 0) {
      lastKillStreakRef.current = 0;
    }
  }, [hud.killStreak]);

  useEffect(() => {
    if (chatOpen) {
      chatInputRef.current?.focus();
    }
  }, [chatOpen]);

  const localNet = players.find((p) => p.id === localPlayerId);
  const mapSpec = room ? ARENA_MAPS[room.mapId] : ARENA_MAPS['obsidian-foundry'];
  const activeWeapon = WEAPONS[hud.weaponId];
  const scoreLimit = room?.scoreLimit ?? 15;
  const localKills = localNet?.kills ?? 0;
  const killProgressPct = Math.min(100, Math.round((localKills / Math.max(1, scoreLimit)) * 100));

  const rankIndex = useMemo(() => {
    if (players.length === 0) return 1;
    const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const idx = sorted.findIndex((p) => p.id === localPlayerId);
    return idx >= 0 ? idx + 1 : 1;
  }, [players, localPlayerId]);

  const reticleGap = Math.round(6 + hud.spreadRatio * 14);
  const lowHpOpacity = hud.hp < 35 && hud.alive ? ((35 - hud.hp) / 35) * 0.45 : 0;
  const lowAmmo = !hud.reloading && hud.ammo <= Math.max(1, Math.ceil(hud.magSize * 0.25));
  const reloadCircumference = 2 * Math.PI * 19;
  const reloadOffset = reloadCircumference * (1 - Math.max(0, Math.min(1, hud.reloadProgress)));

  const mobilityState = hud.sliding
    ? 'SLIDING'
    : !hud.grounded
      ? 'AIRBORNE'
      : hud.crouching
        ? 'CROUCH'
        : hud.sprinting
          ? 'SPRINT'
          : hud.dashReadyRatio >= 0.99
            ? 'DASH READY'
            : 'RECHARGING';

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      onSendRoomChat(chatText);
      setChatText('');
    }
    onToggleChat(false);
  };

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none">
      {/* Damage / Low HP Peripheral Vignette */}
      {(hud.damageFlash > 0.02 || lowHpOpacity > 0.02) && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity"
          style={{
            background:
              'radial-gradient(circle at center, transparent 54%, rgba(220, 38, 38, 0.72) 100%)',
            opacity: Math.max(hud.damageFlash * 0.65, lowHpOpacity),
          }}
        />
      )}

      {/* Directional Attacker Indicator Ring */}
      {hud.alive && hud.damageFlash > 0.06 && hud.damageAngle !== null && (
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) rotate(${(hud.damageAngle * 180) / Math.PI}deg)`,
            opacity: Math.min(1, hud.damageFlash * 1.3),
          }}
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <path
              d="M 32 11 Q 50 4 68 11 L 61 19 Q 50 14 39 19 Z"
              fill="#ef4444"
            />
          </svg>
        </div>
      )}

      {/* Upper-Center Streak / Elimination Toast */}
      {killBanner && hud.alive && (
        <div className="absolute left-1/2 top-14 @2xl:top-16 -translate-x-1/2 pointer-events-none">
          <div className="px-4 py-1 bg-zinc-950/92 border border-amber-500/70 rounded-md shadow-lg flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-display text-xs @2xl:text-sm font-bold tracking-wider text-amber-300 whitespace-nowrap">
              {killBanner}
            </span>
          </div>
        </div>
      )}

      {/* Exact (0,0) Center Weapon-Adaptive Reticle, Reload Ring & Hitmarker */}
      {hud.alive && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="relative w-14 h-14 flex items-center justify-center">
            {hud.reloading && (
              <svg viewBox="0 0 48 48" className="w-12 h-12 absolute -rotate-90">
                <circle
                  cx="24"
                  cy="24"
                  r="19"
                  fill="none"
                  stroke="rgba(255,255,255,0.16)"
                  strokeWidth="2.5"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="19"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="2.5"
                  strokeDasharray={reloadCircumference}
                  strokeDashoffset={reloadOffset}
                  strokeLinecap="round"
                />
              </svg>
            )}

            {hud.weaponId === 'scatter-gun' ? (
              <>
                <span
                  className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: activeWeapon.color }}
                />
                <svg viewBox="0 0 48 48" className="w-12 h-12 absolute">
                  <path
                    d="M 14 14 A 14 14 0 0 0 14 34 M 34 14 A 14 14 0 0 1 34 34"
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </>
            ) : hud.weaponId === 'rail-rifle' ? (
              <>
                <span className="w-1.5 h-1.5 rotate-45 border border-cyan-300 bg-cyan-400/50" />
                <span className="absolute w-3.5 h-[1.5px] bg-cyan-200/90 -translate-x-4" />
                <span className="absolute w-3.5 h-[1.5px] bg-cyan-200/90 translate-x-4" />
                <span className="absolute w-[1.5px] h-2.5 bg-cyan-200/80 -translate-y-4" />
                <span className="absolute w-[1.5px] h-2.5 bg-cyan-200/80 translate-y-4" />
              </>
            ) : hud.weaponId === 'frag-launcher' ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                <svg viewBox="0 0 48 48" className="w-11 h-11 absolute">
                  <path
                    d="M 17 20 L 24 14 L 31 20 M 19 30 L 29 30 M 21 35 L 27 35"
                    fill="none"
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                  />
                </svg>
              </>
            ) : (
              <>
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
              </>
            )}

            {hud.hitmarkerKind !== 'none' && (
              <svg
                viewBox="0 0 24 24"
                className={hud.hitmarkerKind === 'crit' ? 'w-8 h-8 absolute' : 'w-7 h-7 absolute'}
              >
                <path
                  d="M4 4l5 5M20 4l-5 5M4 20l5-5M20 20l-5-5"
                  stroke={
                    hud.hitmarkerKind === 'kill'
                      ? '#ef4444'
                      : hud.hitmarkerKind === 'crit'
                        ? '#fbbf24'
                        : '#f59e0b'
                  }
                  strokeWidth={hud.hitmarkerKind === 'crit' ? '3' : '2.5'}
                  strokeLinecap="round"
                />
                {hud.hitmarkerKind === 'crit' && (
                  <path
                    d="M2.5 2.5l3 3M21.5 2.5l-3 3M2.5 21.5l3-3M21.5 21.5l-3-3"
                    stroke="#fef08a"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Top-Left Cluster: Tactical Radar Minimap + Match Status Strip */}
      <div className="absolute top-2.5 left-2.5 @2xl:top-3 @2xl:left-3 flex items-start gap-2.5">
        <div
          className={`${
            touchEnabled ? 'hidden @3xl:block w-16 h-16 @5xl:w-24 @5xl:h-24' : 'hidden @2xl:block w-28 h-28'
          } bg-zinc-950/88 border border-zinc-700/80 rounded-lg p-1.5 shadow-md`}
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
            {/* Subtle tactical radar crosshairs */}
            <line
              x1={-mapSpec.halfExtent}
              y1={0}
              x2={mapSpec.halfExtent}
              y2={0}
              stroke="#1e293b"
              strokeWidth="0.6"
            />
            <line
              x1={0}
              y1={-mapSpec.halfExtent}
              x2={0}
              y2={mapSpec.halfExtent}
              stroke="#1e293b"
              strokeWidth="0.6"
            />
            {mapSpec.boxes.map((b) => (
              <rect
                key={b.id}
                x={b.x - b.w / 2}
                y={b.z - b.d / 2}
                width={b.w}
                height={b.d}
                fill={b.kind === 'bridge' ? '#334155' : '#475569'}
              />
            ))}
            {players.map((p) => {
              if (!p.alive || p.id === localPlayerId) return null;
              return (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.z}
                  r={2.2}
                  fill={p.isBot ? '#ef4444' : '#06b6d4'}
                />
              );
            })}
            {/* Player Position + FOV Cone */}
            <g
              transform={`translate(${hud.playerPos[0]}, ${hud.playerPos[2]}) rotate(${(-hud.playerYaw * 180) / Math.PI})`}
            >
              <polygon
                points="0,0 -9,-16 9,-16"
                fill="rgba(245, 158, 11, 0.22)"
              />
              <polygon points="0,-3.4 2.5,2.5 -2.5,2.5" fill="#f59e0b" />
            </g>
          </svg>
        </div>

        {/* Match Clock, Eliminations Goal Bar, Rank & Touch Vitality */}
        <div className="bg-zinc-950/88 border border-zinc-700/80 rounded-lg px-3 py-1.5 @2xl:px-3.5 @2xl:py-2 shadow-md">
          <div className="flex items-center gap-2.5 @2xl:gap-3">
            <div>
              <div className="text-[9px] @2xl:text-[10px] uppercase tracking-wider text-zinc-400">Clock</div>
              <div className="font-mono-tabular text-sm @2xl:text-lg font-bold text-zinc-100 leading-tight">
                {formatClock(timeRemainingSec)}
              </div>
            </div>
            <div className="h-6 @2xl:h-7 w-px bg-zinc-800" />
            <div className="min-w-14">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[9px] @2xl:text-[10px] uppercase tracking-wider text-zinc-400">
                  Kills
                </span>
                <span className="font-mono-tabular text-[10px] text-cyan-400 font-semibold">
                  #{rankIndex}
                </span>
              </div>
              <div className="font-mono-tabular text-sm @2xl:text-lg font-bold text-amber-400 leading-tight">
                {localKills}
                <span className="text-[11px] @2xl:text-xs text-zinc-400 font-normal">
                  /{scoreLimit}
                </span>
              </div>
              <div className="h-1 bg-zinc-800 rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full bg-amber-400 transition-all duration-200"
                  style={{ width: `${killProgressPct}%` }}
                />
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
                <div className="h-7 w-px bg-zinc-800 hidden @2xl:block" />
                <div className="hidden @2xl:block">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-400">Arena</div>
                  <div className="text-xs font-semibold text-zinc-200 max-w-36 truncate">
                    {room?.name ?? mapSpec.name}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Top-Right Cluster: Utility Buttons + Weapon-Coded Kill Feed */}
      <div className="absolute top-2.5 right-2.5 @2xl:top-3 @2xl:right-3 flex flex-col items-end gap-2">
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
            className="w-9 h-9 rounded-lg bg-zinc-950/88 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 flex items-center justify-center cursor-pointer"
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
            className="h-9 px-2.5 rounded-lg bg-zinc-950/88 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
          >
            <Camera className="w-4 h-4 text-cyan-400" />
            <span className="hidden @2xl:inline">
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
                : 'bg-zinc-950/88 border-zinc-700/80 hover:border-zinc-500 text-zinc-200'
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
            className="w-9 h-9 rounded-lg bg-zinc-950/88 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 flex items-center justify-center cursor-pointer"
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
            className="w-9 h-9 rounded-lg bg-zinc-950/88 border border-zinc-700/80 hover:border-zinc-500 text-zinc-200 flex items-center justify-center cursor-pointer"
          >
            <Pause className="w-4 h-4" />
          </button>
        </div>

        {/* Compact Touch Weapon & Ammo Readout */}
        {touchEnabled && (
          <div className="bg-zinc-950/88 border border-zinc-700/80 rounded-lg px-2.5 py-1 flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeWeapon.color }}
            />
            <span className="text-[11px] font-semibold text-zinc-200 whitespace-nowrap">
              {activeWeapon.name}
            </span>
            {hud.autoFireEnabled && (
              <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                AUTO
              </span>
            )}
            <span className="h-3.5 w-px bg-zinc-700" />
            <span
              className={`font-mono-tabular text-xs font-bold whitespace-nowrap ${
                lowAmmo ? 'text-red-400' : 'text-amber-400'
              }`}
            >
              {hud.reloading
                ? `RLD ${Math.round(hud.reloadProgress * 100)}%`
                : `${hud.ammo}/${hud.magSize}`}
            </span>
          </div>
        )}

        {/* Live Kill Feed */}
        <div className="flex flex-col items-end gap-1">
          {killFeed.slice(0, touchEnabled ? 2 : 4).map((kf) => {
            const wSpec = WEAPONS[kf.weaponId];
            const involvesLocal =
              kf.killerName === localNet?.name || kf.victimName === localNet?.name;
            return (
              <div
                key={kf.id}
                className={`px-2.5 py-1 rounded border text-xs flex items-center gap-1.5 ${
                  involvesLocal
                    ? 'bg-zinc-950/92 border-amber-500/60'
                    : 'bg-zinc-950/82 border-zinc-800'
                }`}
              >
                <span className="font-semibold text-amber-400">{kf.killerName}</span>
                <span
                  className="text-[10px] font-mono-tabular px-1 py-0.5 rounded bg-zinc-900"
                  style={{ color: wSpec?.color ?? '#94a3b8' }}
                >
                  {wSpec?.name.split(' ')[0] ?? kf.weaponId}
                </span>
                <span className="font-semibold text-zinc-200">{kf.victimName}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Respawn Banner when eliminated */}
      {!hud.alive && (
        <div className="absolute left-1/2 top-1/3 -translate-x-1/2 bg-zinc-950/92 border border-red-800 rounded-lg px-6 py-3 text-center shadow-lg">
          <div className="font-display text-lg font-bold text-red-400">ELIMINATED</div>
          <div className="font-mono-tabular text-xs text-zinc-300 mt-1">
            Respawning in {Math.max(0.1, hud.respawnTimer).toFixed(1)}s
          </div>
        </div>
      )}

      {/* In-Match Real-Time Chat (Desktop lower-left; touch uses chat drawer) */}
      {!touchEnabled && (
        <div
          className={`hidden @3xl:flex flex-col w-72 absolute left-3 bottom-28 transition-opacity ${
            chatOpen ? 'opacity-100 pointer-events-auto' : 'opacity-82'
          }`}
        >
          <div className="bg-zinc-950/82 border border-zinc-800/90 rounded-lg p-2 max-h-32 overflow-y-auto tactical-scroll space-y-1">
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
              className="mt-1 self-start flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white pointer-events-auto cursor-pointer"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Press T to chat</span>
            </button>
          )}
        </div>
      )}

      {/* Touch / Mobile Chat Drawer when toggled */}
      {chatOpen && (
        <div className={`${touchEnabled ? '' : '@3xl:hidden'} absolute inset-x-3 top-14 z-30 max-w-md mx-auto bg-zinc-950/95 border border-zinc-700 rounded-xl p-3 pointer-events-auto`}>
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
        <div className="absolute bottom-3 left-3 bg-zinc-950/90 border border-zinc-700/80 rounded-lg px-3.5 py-2.5 w-72 shadow-md">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono-tabular text-2xl font-bold leading-none ${
                  hud.hp > 35 ? 'text-zinc-50' : 'text-red-400'
                }`}
              >
                {Math.round(hud.hp)}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-zinc-400">HP</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular text-zinc-300">
              <span>{hud.speedMs.toFixed(1)} m/s</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  hud.sliding
                    ? 'text-amber-400 font-semibold'
                    : hud.dashReadyRatio >= 0.99
                      ? 'text-cyan-400 font-semibold'
                      : 'text-zinc-400'
                }
              >
                {mobilityState}
              </span>
            </div>
          </div>

          {/* Segmented-feel Vitality Bar with Delayed Trailing Damage Ghost */}
          <div className="relative h-2.5 bg-zinc-800 rounded-sm overflow-hidden mt-2">
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

          {/* Dash Cooldown Gauge */}
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[9px] font-mono-tabular text-zinc-400 shrink-0">[Q] DASH</span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-100"
                style={{ width: `${Math.round(Math.max(0, Math.min(1, hud.dashReadyRatio)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Desktop Bottom-Right Cluster: Weapon Loadout Deck & Ammo */}
      {!touchEnabled && (
        <div className="absolute bottom-3 right-3 flex flex-col items-end gap-1.5">
          <div className="bg-zinc-950/90 border border-zinc-700/80 rounded-lg px-3.5 py-2 flex items-center gap-3 shadow-md">
            <div
              className="w-1 h-8 rounded-full"
              style={{ backgroundColor: activeWeapon.color }}
            />
            <div className="text-right">
              <div className="text-xs font-semibold text-zinc-100 whitespace-nowrap">
                {activeWeapon.name}
              </div>
              <div className="text-[11px] text-zinc-400">{activeWeapon.role}</div>
            </div>
            <div className="h-7 w-px bg-zinc-800" />
            <div className="font-mono-tabular text-right min-w-16">
              {hud.reloading ? (
                <div className="text-xs font-bold text-amber-400 whitespace-nowrap">
                  RELOAD {Math.round(hud.reloadProgress * 100)}%
                </div>
              ) : (
                <div>
                  <div
                    className={`text-2xl font-bold leading-none whitespace-nowrap ${
                      lowAmmo ? 'text-red-400' : 'text-zinc-50'
                    }`}
                  >
                    {hud.ammo}
                    <span className="text-xs text-zinc-400 font-normal">/{hud.magSize}</span>
                  </div>
                  {lowAmmo && (
                    <div className="text-[9px] font-bold text-amber-400 tracking-wider mt-0.5">
                      [R] RELOAD
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="hidden @2xl:flex items-center gap-1.5 pointer-events-auto">
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
                  className={`px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    active
                      ? 'bg-zinc-800 border-amber-500 text-amber-300'
                      : 'bg-zinc-950/88 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className="w-1.5 h-3 rounded-sm"
                    style={{ backgroundColor: spec.color, opacity: active ? 1 : 0.45 }}
                  />
                  <span className="font-mono-tabular">[{spec.key}]</span>
                  <span>{spec.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab Scoreboard Overlay */}
      {scoreboardOpen && (
        <div className="absolute inset-0 z-30 bg-black/55 flex items-center justify-center p-4 pointer-events-auto">
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
