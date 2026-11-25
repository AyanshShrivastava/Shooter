import React from 'react';
import { CameraPerspective, MatchResultSummary } from '../shared/types';
import { ARENA_MAPS } from '../shared/maps';

interface PauseModalProps {
  perspective: CameraPerspective;
  sensitivity: number;
  onSensitivityChange: (val: number) => void;
  onTogglePerspective: () => void;
  onResume: () => void;
  onLeaveMatch: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  perspective,
  sensitivity,
  onSensitivityChange,
  onTogglePerspective,
  onResume,
  onLeaveMatch,
}) => {
  return (
    <div className="fixed inset-0 z-30 bg-black/75 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-100">Match Paused</h2>
          <p className="text-xs text-zinc-400 mt-1">
            Simulation continues live on the multiplayer server.
          </p>
        </div>

        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-300">Camera Perspective</span>
            <button
              type="button"
              onClick={onTogglePerspective}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-cyan-400 cursor-pointer"
            >
              {perspective === 'first-person' ? 'First Person' : 'Third Person'}
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between text-xs text-zinc-300 mb-1">
              <label htmlFor="sens-range">Aim Sensitivity</label>
              <span className="font-mono-tabular text-amber-400">
                {(sensitivity * 1000).toFixed(1)}
              </span>
            </div>
            <input
              id="sens-range"
              type="range"
              min={0.0008}
              max={0.006}
              step={0.0002}
              value={sensitivity}
              onChange={(e) => onSensitivityChange(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={onResume}
            className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold text-sm cursor-pointer"
          >
            Resume Match
          </button>
          <button
            type="button"
            onClick={onLeaveMatch}
            className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs cursor-pointer"
          >
            Leave to Server Lobby
          </button>
        </div>
      </div>
    </div>
  );
};

interface OutcomeModalProps {
  summary: MatchResultSummary;
  onPlayAgain: () => void;
  onReturnLobby: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  summary,
  onPlayAgain,
  onReturnLobby,
}) => {
  const accuracy =
    summary.shotsFired > 0
      ? Math.round((summary.shotsHit / summary.shotsFired) * 100)
      : 0;
  const mapName = ARENA_MAPS[summary.mapId]?.name ?? summary.mapId;

  return (
    <div className="fixed inset-0 z-30 bg-black/80 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {summary.roomName} · {mapName}
          </div>
          <h2
            className={`font-display text-2xl font-bold mt-1 ${
              summary.isVictory ? 'text-amber-400' : 'text-zinc-100'
            }`}
          >
            {summary.isVictory ? 'Victory Secured' : `Match Complete · #${summary.placement}`}
          </h2>
          <p className="text-xs text-zinc-400 mt-1">
            Round winner: <span className="text-cyan-400 font-semibold">{summary.winnerName}</span>
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[11px] text-zinc-400">Kills / Deaths</div>
            <div className="font-mono-tabular text-lg font-bold text-zinc-100 mt-0.5">
              {summary.kills} / {summary.deaths}
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[11px] text-zinc-400">Accuracy</div>
            <div className="font-mono-tabular text-lg font-bold text-cyan-400 mt-0.5">
              {accuracy}%
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className="text-[11px] text-zinc-400">Placement</div>
            <div className="font-mono-tabular text-lg font-bold text-amber-400 mt-0.5">
              #{summary.placement}/{summary.totalParticipants}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5">
          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="flex-1 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold text-sm cursor-pointer"
          >
            Play Again
          </button>
          <button
            type="button"
            onClick={onReturnLobby}
            className="px-4 py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs cursor-pointer"
          >
            Server Lobby
          </button>
        </div>
      </div>
    </div>
  );
};
