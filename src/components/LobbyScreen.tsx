import React, { useState } from 'react';
import {
  Globe,
  MapPin,
  MessageSquare,
  Play,
  Plus,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react';
import { MAP_LIST } from '../shared/maps';
import {
  CharacterId,
  ChatMessage,
  GameMode,
  MapId,
  ServerRoomInfo,
} from '../shared/types';

interface LobbyScreenProps {
  connected: boolean;
  onlineCount: number;
  callsign: string;
  onCallsignChange: (val: string) => void;
  characterId: CharacterId;
  onCharacterChange: (id: CharacterId) => void;
  selectedMapId: MapId;
  onSelectMap: (id: MapId) => void;
  rooms: ServerRoomInfo[];
  globalChat: ChatMessage[];
  errorMsg: string | null;
  onQuickMatch: () => void;
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (opts: {
    name: string;
    mapId: MapId;
    mode: GameMode;
    maxPlayers: number;
    fillBots: boolean;
  }) => void;
  onSendGlobalChat: (text: string) => void;
}

export const LobbyScreen: React.FC<LobbyScreenProps> = ({
  connected,
  onlineCount,
  callsign,
  onCallsignChange,
  characterId,
  onCharacterChange,
  selectedMapId,
  onSelectMap,
  rooms,
  globalChat,
  errorMsg,
  onQuickMatch,
  onJoinRoom,
  onCreateRoom,
  onSendGlobalChat,
}) => {
  const [activeTab, setActiveTab] = useState<'servers' | 'maps' | 'chat'>('servers');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('Vanguard Custom');
  const [newRoomMap, setNewRoomMap] = useState<MapId>(selectedMapId);
  const [newRoomMode, setNewRoomMode] = useState<GameMode>('ffa');
  const [newRoomMaxPlayers, setNewRoomMaxPlayers] = useState(8);
  const [newRoomFillBots, setNewRoomFillBots] = useState(true);
  const [chatDraft, setChatDraft] = useState('');

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    onSendGlobalChat(chatDraft);
    setChatDraft('');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newRoomName.trim().length < 2) return;
    onCreateRoom({
      name: newRoomName.trim(),
      mapId: newRoomMap,
      mode: newRoomMode,
      maxPlayers: newRoomMaxPlayers,
      fillBots: newRoomFillBots,
    });
    setShowCreateModal(false);
  };

  return (
    <div className="fixed inset-0 z-10 flex flex-col justify-between gap-2 sm:gap-3 p-2.5 sm:p-4 md:p-6 pointer-events-none">
      {/* Top Row: Emblem Lockup + Online Network Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 pointer-events-auto shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3.5 bg-zinc-950/88 border border-zinc-800 px-3 py-1.5 sm:px-4 sm:py-2.5 rounded-xl">
          <svg
            viewBox="0 0 36 36"
            className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
            aria-hidden="true"
          >
            <polygon
              points="18,2 33,10 29,28 18,34 7,28 3,10"
              fill="#18181b"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <polygon points="18,8 26,24 18,20 10,24" fill="#f59e0b" />
            <circle cx="18" cy="14" r="2.2" fill="#06b6d4" />
          </svg>
          <div>
            <h1 className="font-display text-base sm:text-xl md:text-2xl font-bold tracking-wider text-zinc-50 leading-none">
              VANGUARD ARENA
            </h1>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs text-zinc-400 mt-0.5 sm:mt-1">
              <span>{connected ? 'Matchmaker Online' : 'Connecting...'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-cyan-400">
                {onlineCount} {onlineCount === 1 ? 'Operative' : 'Operatives'} Online
              </span>
            </div>
          </div>
        </div>

        {/* Primary Deploy Action + Callsign */}
        <div className="flex items-center gap-2 bg-zinc-950/88 border border-zinc-800 p-1.5 sm:p-2 rounded-xl">
          <div className="flex flex-col px-1.5 sm:px-2">
            <label htmlFor="callsign-input" className="text-[10px] sm:text-[11px] text-zinc-400 font-medium">
              Callsign
            </label>
            <input
              id="callsign-input"
              type="text"
              value={callsign}
              maxLength={18}
              onChange={(e) => onCallsignChange(e.target.value)}
              placeholder="Enter callsign"
              className="w-28 sm:w-32 md:w-40 bg-transparent text-xs sm:text-sm font-semibold text-zinc-100 focus:outline-none border-b border-zinc-700 focus:border-amber-500 pb-0.5"
            />
          </div>
          <button
            type="button"
            data-start="true"
            onClick={onQuickMatch}
            className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-display font-bold text-xs sm:text-sm tracking-wide transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            <span>Quick Match</span>
          </button>
        </div>
      </div>

      {/* Main Content Area: Left Tactical Panel + Right Chat (works on both 844x390 landscape phone & 1440x900 desktop) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="w-full md:w-[480px] lg:w-[540px] h-full md:h-auto md:max-h-full lg:max-h-[540px] bg-zinc-950/90 border border-zinc-800 rounded-xl flex flex-col overflow-hidden pointer-events-auto">
          {/* Segmented Navigation Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 sm:p-2.5 border-b border-zinc-800 bg-zinc-900/70 shrink-0">
            <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('servers')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'servers'
                    ? 'bg-zinc-800 text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Servers ({rooms.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('maps')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === 'maps'
                    ? 'bg-zinc-800 text-amber-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Maps & Rig</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer md:hidden ${
                  activeTab === 'chat'
                    ? 'bg-zinc-800 text-cyan-400'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Chat</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-400" />
              <span>Host Server</span>
            </button>
          </div>

          {errorMsg && (
            <div className="px-4 py-2 bg-red-950/80 border-b border-red-800 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Tab Body */}
          <div className="p-3.5 overflow-y-auto tactical-scroll space-y-2.5 flex-1">
            {activeTab === 'servers' && (
              <>
                {rooms.length === 0 ? (
                  <div className="py-8 text-center text-sm text-zinc-400">
                    Loading live server roster...
                  </div>
                ) : (
                  rooms.map((room) => {
                    const mapSpec = MAP_LIST.find((m) => m.id === room.mapId);
                    return (
                      <div
                        key={room.id}
                        className="flex items-center justify-between gap-3 p-3 rounded-lg bg-zinc-900/90 border border-zinc-800 hover:border-zinc-700 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h2 className="text-sm font-semibold text-zinc-100 truncate">
                              {room.name}
                            </h2>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-zinc-400 mt-1">
                            <span className="text-amber-400 font-medium">
                              {mapSpec?.name ?? room.mapId}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="uppercase">{room.mode}</span>
                            <span aria-hidden="true">·</span>
                            <span>{room.region}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">
                              {room.playerCount}/{room.maxPlayers}
                              {room.botCount > 0 ? ` (+${room.botCount} Bots)` : ' Players'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="font-mono-tabular text-xs text-cyan-400">
                            {room.pingMs}ms
                          </span>
                          <button
                            type="button"
                            onClick={() => onJoinRoom(room.id)}
                            className="px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-amber-500 hover:text-zinc-950 text-zinc-100 text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'maps' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-zinc-300 mb-2">
                    Select Arena Map (Live 3D Preview)
                  </div>
                  <div className="space-y-2">
                    {MAP_LIST.map((m) => {
                      const active = m.id === selectedMapId;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => onSelectMap(m.id)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                            active
                              ? 'bg-zinc-800/95 border-amber-500'
                              : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-zinc-100">{m.name}</span>
                            <span className="text-xs text-zinc-400">{m.biome}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {m.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-zinc-300 mb-2">
                    Operative 3D Model Rig
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onCharacterChange('vanguard-soldier')}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        characterId === 'vanguard-soldier'
                          ? 'bg-zinc-800 border-cyan-400'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        <span>Vanguard Soldier</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">Armored Infantry GLB</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCharacterChange('apex-mech')}
                      className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        characterId === 'apex-mech'
                          ? 'bg-zinc-800 border-cyan-400'
                          : 'bg-zinc-900/80 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                        <Users className="w-4 h-4 text-amber-400" />
                        <span>Apex Mech</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-1">Robotic Chassis GLB</div>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="flex flex-col h-56 lg:hidden">
                <div className="flex-1 overflow-y-auto tactical-scroll space-y-1.5 pr-1">
                  {globalChat.map((m) => (
                    <div key={m.id} className="text-xs leading-relaxed">
                      <span
                        className={
                          m.isSystem ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'
                        }
                      >
                        {m.senderName}:{' '}
                      </span>
                      <span className="text-zinc-200">{m.text}</span>
                    </div>
                  ))}
                </div>
                <form onSubmit={handleChatSubmit} className="flex gap-2 mt-2.5 pt-2 border-t border-zinc-800">
                  <input
                    type="text"
                    value={chatDraft}
                    onChange={(e) => setChatDraft(e.target.value)}
                    placeholder="Message global lobby..."
                    maxLength={200}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    aria-label="Send global chat message"
                    className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-zinc-950 font-semibold text-xs cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>

        {/* Side Real-Time Global Chat Panel (visible on landscape mobile md+ and desktop) */}
        <div className="hidden md:flex w-72 lg:w-88 h-full max-h-60 lg:max-h-72 bg-zinc-950/90 border border-zinc-800 rounded-xl flex-col overflow-hidden pointer-events-auto shrink-0">
          <div className="px-3.5 py-2 border-b border-zinc-800 bg-zinc-900/70 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
              <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
              <span>Global Lobby Chat</span>
            </div>
            <span className="text-[11px] text-zinc-400 font-mono-tabular">
              {globalChat.length} msgs
            </span>
          </div>
          <div className="flex-1 p-2.5 sm:p-3 overflow-y-auto tactical-scroll space-y-1.5">
            {globalChat.map((m) => (
              <div key={m.id} className="text-xs leading-relaxed break-words">
                <span
                  className={
                    m.isSystem ? 'text-amber-400 font-semibold' : 'text-cyan-400 font-semibold'
                  }
                >
                  {m.senderName}:{' '}
                </span>
                <span className="text-zinc-200">{m.text}</span>
              </div>
            ))}
          </div>
          <form
            onSubmit={handleChatSubmit}
            className="p-2 border-t border-zinc-800 flex items-center gap-2 bg-zinc-900/50 shrink-0"
          >
            <input
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Send message to online players..."
              maxLength={200}
              aria-label="Global chat message input"
              className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              aria-label="Send message"
              className="p-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Bottom Safe-Margin Flat Control Hint (hidden on short landscape phones) */}
      <div className="text-center text-xs text-zinc-400 hud-text-stroke pointer-events-none hidden lg:block shrink-0">
        WASD Move · Space Jump · Shift Sprint · C Slide · Q Dash · 1-4 Weapons · V 1st/3rd Cam · T Chat
      </div>

      {/* Host Custom Server Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-30 bg-black/70 flex items-center justify-center p-4 pointer-events-auto">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
              <h2 className="font-display text-base font-bold text-zinc-100">Host Custom Server</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close server creation dialog"
                className="p-1 text-zinc-400 hover:text-zinc-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-4 space-y-3.5">
              <div>
                <label htmlFor="room-name" className="block text-xs text-zinc-400 mb-1">
                  Server Name
                </label>
                <input
                  id="room-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={28}
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="room-map" className="block text-xs text-zinc-400 mb-1">
                    Arena Map
                  </label>
                  <select
                    id="room-map"
                    value={newRoomMap}
                    onChange={(e) => setNewRoomMap(e.target.value as MapId)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    {MAP_LIST.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="room-mode" className="block text-xs text-zinc-400 mb-1">
                    Game Mode
                  </label>
                  <select
                    id="room-mode"
                    value={newRoomMode}
                    onChange={(e) => setNewRoomMode(e.target.value as GameMode)}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="ffa">Free For All (15)</option>
                    <option value="skirmish">Skirmish (20)</option>
                    <option value="duel">Duel (10)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <label htmlFor="room-max" className="block text-xs text-zinc-400 mb-1">
                    Max Players ({newRoomMaxPlayers})
                  </label>
                  <input
                    id="room-max"
                    type="range"
                    min={2}
                    max={12}
                    value={newRoomMaxPlayers}
                    onChange={(e) => setNewRoomMaxPlayers(Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-zinc-200 cursor-pointer pt-4">
                  <input
                    type="checkbox"
                    checked={newRoomFillBots}
                    onChange={(e) => setNewRoomFillBots(e.target.checked)}
                    className="accent-amber-500"
                  />
                  <span>Fill empty slots with Bots</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-200 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold cursor-pointer"
                >
                  Launch Server
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
