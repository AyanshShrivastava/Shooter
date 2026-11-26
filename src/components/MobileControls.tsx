import React, { useRef, useState } from 'react';
import {
  Crosshair,
  Focus,
  MessageSquare,
  RotateCw,
  Zap,
} from 'lucide-react';
import { WeaponId } from '../shared/types';
import { WEAPON_ORDER, WEAPONS } from '../shared/weapons';

interface MobileControlsProps {
  activeWeapon: WeaponId;
  adsHeld: boolean;
  autoFireEnabled: boolean;
  rotatedLandscape?: boolean;
  onMove: (x: number, y: number, sprint: boolean) => void;
  onLook: (dx: number, dy: number) => void;
  onFireChange: (firing: boolean) => void;
  onToggleAds: () => void;
  onToggleAutoFire: () => void;
  onJump: () => void;
  onDash: () => void;
  onSlideChange: (sliding: boolean) => void;
  onReload: () => void;
  onSwapWeapon: () => void;
  onSelectWeapon: (id: WeaponId) => void;
  onOpenChat: () => void;
}

export const MobileControls: React.FC<MobileControlsProps> = ({
  activeWeapon,
  adsHeld,
  autoFireEnabled,
  rotatedLandscape = false,
  onMove,
  onLook,
  onFireChange,
  onToggleAds,
  onToggleAutoFire,
  onJump,
  onDash,
  onSlideChange,
  onReload,
  onSwapWeapon,
  onSelectWeapon,
  onOpenChat,
}) => {
  const joyPointerId = useRef<number | null>(null);
  const joyOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [knob, setKnob] = useState<{ x: number; y: number; active: boolean; sprint: boolean }>({
    x: 0,
    y: 0,
    active: false,
    sprint: false,
  });

  const lookPointerId = useRef<number | null>(null);
  const lastLook = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const shootPointerId = useRef<number | null>(null);
  const shootLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const aimPointerId = useRef<number | null>(null);
  const aimLastPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const aimDragDist = useRef<number>(0);

  const MAX_RADIUS = 42;

  const mapDelta = (vdx: number, vdy: number): [number, number] =>
    rotatedLandscape ? [vdy, -vdx] : [vdx, vdy];

  const handleJoyDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    joyPointerId.current = e.pointerId;
    const rect = e.currentTarget.getBoundingClientRect();
    joyOrigin.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateJoy(e.clientX, e.clientY);
  };

  const updateJoy = (clientX: number, clientY: number) => {
    const [dx, dy] = mapDelta(clientX - joyOrigin.current.x, clientY - joyOrigin.current.y);
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = dist > 2 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 2 ? Math.sin(angle) * clamped : 0;
    const normX = kx / MAX_RADIUS;
    const normY = -ky / MAX_RADIUS; // +Y up = forward
    const sprint = dist > MAX_RADIUS * 0.72 && normY > 0.42;
    setKnob({ x: kx, y: ky, active: true, sprint });
    onMove(normX, normY, sprint);
  };

  const handleJoyMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    updateJoy(e.clientX, e.clientY);
  };

  const handleJoyUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joyPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    joyPointerId.current = null;
    setKnob({ x: 0, y: 0, active: false, sprint: false });
    onMove(0, 0, false);
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    lastLook.current = { x: e.clientX, y: e.clientY };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const [dx, dy] = mapDelta(e.clientX - lastLook.current.x, e.clientY - lastLook.current.y);
    lastLook.current = { x: e.clientX, y: e.clientY };
    onLook(dx * 1.45, dy * 1.45);
  };

  const handleLookUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (lookPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    lookPointerId.current = null;
  };

  const handleShootDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    shootPointerId.current = e.pointerId;
    shootLastPos.current = { x: e.clientX, y: e.clientY };
    onFireChange(true);
  };

  const handleShootMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shootPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const [dx, dy] = mapDelta(
      e.clientX - shootLastPos.current.x,
      e.clientY - shootLastPos.current.y,
    );
    shootLastPos.current = { x: e.clientX, y: e.clientY };
    if (dx !== 0 || dy !== 0) {
      onLook(dx * 1.35, dy * 1.35);
    }
  };

  const handleShootUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (shootPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    shootPointerId.current = null;
    onFireChange(false);
  };

  const handleAimDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    aimPointerId.current = e.pointerId;
    aimLastPos.current = { x: e.clientX, y: e.clientY };
    aimDragDist.current = 0;
  };

  const handleAimMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (aimPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    const [dx, dy] = mapDelta(
      e.clientX - aimLastPos.current.x,
      e.clientY - aimLastPos.current.y,
    );
    aimLastPos.current = { x: e.clientX, y: e.clientY };
    aimDragDist.current += Math.hypot(dx, dy);
    if (dx !== 0 || dy !== 0) {
      onLook(dx * 1.35, dy * 1.35);
    }
  };

  const handleAimUp = (e: React.PointerEvent<HTMLButtonElement>, cancelled = false) => {
    if (aimPointerId.current !== e.pointerId) return;
    e.stopPropagation();
    aimPointerId.current = null;
    if (!cancelled && aimDragDist.current < 8) {
      onToggleAds();
    }
  };

  return (
    <div className="absolute inset-0 z-20 pointer-events-none select-none">
      {/* Right-half touch aim surface (behind action buttons) */}
      <div
        className="absolute right-0 top-14 bottom-0 w-[56%] pointer-events-auto touch-none"
        aria-label="Touch aim area"
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookUp}
        onPointerCancel={handleLookUp}
      />

      {/* Left-Thumb Secondary Quick-Fire Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.stopPropagation();
          onFireChange(true);
        }}
        onPointerUp={(e) => {
          e.stopPropagation();
          onFireChange(false);
        }}
        onPointerCancel={() => onFireChange(false)}
        aria-label="Left fire button"
        className="absolute left-4 bottom-36 w-12 h-12 rounded-2xl bg-amber-500/85 border-2 border-amber-300 text-zinc-950 font-bold flex items-center justify-center shadow-lg pointer-events-auto active:scale-95"
      >
        <Crosshair className="w-6 h-6" />
      </button>

      {/* Left Virtual Movement Thumbstick */}
      <div
        className="absolute left-4 bottom-4 w-28 h-28 rounded-full border-2 border-zinc-400/35 bg-zinc-950/50 flex items-center justify-center pointer-events-auto touch-none"
        aria-label="Movement joystick"
        onPointerDown={handleJoyDown}
        onPointerMove={handleJoyMove}
        onPointerUp={handleJoyUp}
        onPointerCancel={handleJoyUp}
      >
        <div
          className={`w-11 h-11 rounded-full border-2 transition-colors flex items-center justify-center text-[9px] font-bold ${
            knob.sprint
              ? 'bg-amber-500/85 border-amber-200 text-zinc-950'
              : knob.active
                ? 'bg-cyan-400/80 border-cyan-200 text-zinc-950'
                : 'bg-zinc-200/35 border-zinc-300/60 text-zinc-100'
          }`}
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        >
          {knob.sprint ? 'RUN' : ''}
        </div>
      </div>

      {/* Bottom-Center Compact Horizontal Weapon Selector Strip */}
      <div className="flex items-center gap-1 @2xl:gap-1.5 absolute bottom-2.5 left-1/2 -translate-x-1/2 pointer-events-auto">
        {WEAPON_ORDER.map((wId) => {
          const spec = WEAPONS[wId];
          const active = wId === activeWeapon;
          return (
            <button
              key={wId}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectWeapon(wId);
              }}
              aria-label={`Select ${spec.name}`}
              className={`h-8 @2xl:h-10 px-2 @2xl:px-2.5 rounded-lg @2xl:rounded-xl border text-[10px] @2xl:text-[11px] font-bold transition-colors whitespace-nowrap active:scale-95 ${
                active
                  ? 'bg-amber-500 border-amber-300 text-zinc-950'
                  : 'bg-zinc-950/85 border-zinc-700 text-zinc-200'
              }`}
            >
              {spec.name.split(' ')[0]}
            </button>
          );
        })}
      </div>

      {/* Right Thumb Shooter Control Arc (>= 44px touch targets) */}
      <div className="absolute right-4 bottom-3 flex flex-col items-end gap-2 pointer-events-none">
        {/* Upper Tactical Row: Chat, Swap, Reload, Slide, Jump */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat();
            }}
            aria-label="Open match chat"
            className="w-11 h-11 rounded-xl bg-zinc-900/85 border border-zinc-600/80 text-zinc-100 flex items-center justify-center active:scale-95"
          >
            <MessageSquare className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSwapWeapon();
            }}
            aria-label="Switch weapon"
            className="@2xl:hidden h-11 px-2.5 rounded-xl bg-zinc-900/85 border border-zinc-600/80 text-[11px] font-bold text-zinc-100 active:scale-95"
          >
            SWAP
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReload();
            }}
            aria-label="Reload weapon"
            className="w-11 h-11 rounded-xl bg-zinc-900/85 border border-zinc-600/80 text-zinc-100 flex items-center justify-center active:scale-95"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              onSlideChange(true);
            }}
            onPointerUp={(e) => {
              e.stopPropagation();
              onSlideChange(false);
            }}
            onPointerCancel={() => onSlideChange(false)}
            aria-label="Slide or crouch"
            className="h-11 px-3 rounded-xl bg-zinc-900/85 border border-zinc-600/80 text-[11px] font-bold text-zinc-100 active:bg-cyan-600/75"
          >
            SLIDE
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onJump();
            }}
            aria-label="Jump"
            className="w-12 h-12 rounded-2xl bg-zinc-900/85 border border-zinc-500/80 text-[11px] font-bold text-zinc-100 active:bg-zinc-700"
          >
            JUMP
          </button>
        </div>

        {/* Lower Primary Shooter Row: AUTO, Dash, AIM (Scope/ADS + drag), SHOOT (+ drag) */}
        <div className="flex items-end gap-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleAutoFire();
            }}
            aria-label="Toggle auto-fire"
            aria-pressed={autoFireEnabled}
            className={`w-11 h-11 rounded-xl border text-[10px] font-bold flex flex-col items-center justify-center transition-colors active:scale-95 ${
              autoFireEnabled
                ? 'bg-emerald-500 border-emerald-200 text-zinc-950'
                : 'bg-zinc-900/85 border-zinc-600/80 text-zinc-300'
            }`}
          >
            <span>AUTO</span>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDash();
            }}
            aria-label="Tactical dash"
            className="w-12 h-12 rounded-2xl bg-zinc-900/85 border border-cyan-500/75 text-cyan-300 flex flex-col items-center justify-center active:bg-cyan-600/70"
          >
            <Zap className="w-4 h-4" />
            <span className="text-[9px] font-bold leading-none mt-0.5">DASH</span>
          </button>
          <button
            type="button"
            onPointerDown={handleAimDown}
            onPointerMove={handleAimMove}
            onPointerUp={(e) => handleAimUp(e, false)}
            onPointerCancel={(e) => handleAimUp(e, true)}
            aria-label="Aim down sights"
            aria-pressed={adsHeld}
            className={`w-13 h-13 rounded-2xl border-2 flex flex-col items-center justify-center transition-colors touch-none active:scale-95 ${
              adsHeld
                ? 'bg-cyan-500 border-cyan-200 text-zinc-950'
                : 'bg-zinc-900/85 border-zinc-500/80 text-zinc-100'
            }`}
          >
            <Focus className="w-5 h-5" />
            <span className="text-[9px] font-bold leading-none mt-0.5">AIM</span>
          </button>
          <button
            type="button"
            onPointerDown={handleShootDown}
            onPointerMove={handleShootMove}
            onPointerUp={handleShootUp}
            onPointerCancel={handleShootUp}
            aria-label="Fire weapon"
            className="w-16 h-16 rounded-2xl bg-amber-500/95 border-2 border-amber-200 text-zinc-950 font-bold flex flex-col items-center justify-center shadow-lg touch-none active:scale-95"
          >
            <Crosshair className="w-7 h-7" />
            <span className="text-[9px] font-extrabold leading-none mt-0.5">SHOOT</span>
          </button>
        </div>
      </div>
    </div>
  );
};
