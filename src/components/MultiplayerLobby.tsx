import React, { useState, useEffect } from 'react';
import { Faction, CharacterClass } from '../types/game';
import { Users, Shield, ArrowLeft, Swords, Globe, Send, MessageSquare, Sparkles } from 'lucide-react';
import { audio } from '../services/audioService';

interface MultiplayerLobbyProps {
  faction: Faction;
  charClass: CharacterClass;
  onJoinRoom: (roomId: string, roomName: string, map: string, mode: 'TDM' | 'FFA') => void;
  onBack: () => void;
}

export const MultiplayerLobby: React.FC<MultiplayerLobbyProps> = ({
  faction,
  charClass,
  onJoinRoom,
  onBack,
}) => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedMap, setSelectedMap] = useState('the_angle');
  const [selectedMode, setSelectedMode] = useState<'TDM' | 'FFA'>('TDM');
  const [playerName, setPlayerName] = useState(
    faction === 'NORTH' ? 'Union Sharpshooter' : 'Rebel Raider'
  );
  const [chatMessages, setChatMessages] = useState<{ name: string; faction: string; text: string }[]>([
    { name: 'Col. Chamberlain', faction: 'NORTH', text: 'Stand firm at the crest! Hold the line!' },
    { name: 'Gen. Armistead', faction: 'SOUTH', text: 'Give them the cold steel, boys! Forward!' },
  ]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error('Failed to fetch rooms:', e);
    }
  };

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const rName = newRoomName.trim() || 'The Copse of Trees Battle';
    const rId = `room_${Date.now()}`;
    audio.init();
    audio.playBugleCharge();
    onJoinRoom(rId, rName, selectedMap, selectedMode);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setChatMessages((prev) => [
      ...prev,
      { name: playerName, faction, text: chatInput.trim() },
    ]);
    setChatInput('');
  };

  return (
    <div id="multiplayer-lobby-root" className="relative w-full h-screen bg-[#0a0806] text-stone-100 flex flex-col p-4 sm:p-8 overflow-y-auto z-10 select-none font-serif">
      {/* Ambient Backdrop Layers */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 50%, #3d2b1f 0%, #0a0806 70%)' }}
      />
      <div className="absolute inset-0 opacity-20 pointer-events-none bg-immersive-dots" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between max-w-6xl mx-auto w-full mb-6 border-b border-[#3d2b1f] pb-4">
        <button
          id="btn-lobby-back"
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] border border-[#8b7355]/60 text-[#f4ecd8] rounded text-sm font-vintage font-bold transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-[#d4af37]" /> Return to Title
        </button>

        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-vintage font-black text-transparent bg-clip-text bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f]">
            ONLINE PVP MULTIPLAYER SKIRMISH
          </h1>
          <p className="text-xs font-sans tracking-widest text-[#8b7355] uppercase mt-0.5">
            REAL-TIME BATTLEFIELD ROOMS &bull; UNION VS CONFEDERATE
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-sans tracking-wider bg-[#0a0806] border border-[#3d2b1f] px-3 py-1.5 rounded">
          <Globe className="w-4 h-4 text-[#d4af37]" />
          <span className="text-[#d4af37] font-bold">ONLINE LOBBY</span>
        </div>
      </header>

      {/* Main Content: Room Browser & Create Room */}
      <main className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto w-full my-auto">
        {/* Left Column: Live Public Battle Rooms */}
        <section className="lg:col-span-7 bg-[#0a0806]/90 border-2 border-[#3d2b1f] rounded-xl p-5 shadow-2xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-2">
            <h2 className="font-vintage font-bold text-base text-[#f4ecd8] flex items-center gap-2">
              <Swords className="w-5 h-5 text-[#d4af37]" /> Active Battlefield Rooms
            </h2>
            <button
              onClick={fetchRooms}
              className="text-xs text-[#d4af37] hover:underline font-mono cursor-pointer"
            >
              Refresh
            </button>
          </div>

          <div className="flex flex-col gap-3 max-h-[360px] overflow-y-auto pr-1">
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-[#8b7355] font-mono text-sm">
                Searching for active battlefield servers...
              </div>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.id}
                  className="bg-[#0a0806] border border-[#3d2b1f] hover:border-[#d4af37]/60 rounded p-4 transition-all flex items-center justify-between shadow"
                >
                  <div>
                    <div className="font-vintage font-bold text-sm text-[#f4ecd8]">{r.name}</div>
                    <div className="text-xs font-mono text-[#8b7355] mt-0.5">
                      Map: {r.map.replace('_', ' ').toUpperCase()} • Mode: {r.mode}
                    </div>
                    <div className="text-[11px] text-[#d4af37] font-mono mt-1">
                      Scores: Union {r.scores?.NORTH || 0} - Confederate {r.scores?.SOUTH || 0}
                    </div>
                  </div>

                  <button
                    id={`btn-join-room-${r.id}`}
                    onClick={() => {
                      audio.init();
                      audio.playBugleCharge();
                      onJoinRoom(r.id, r.name, r.map, r.mode);
                    }}
                    className="px-5 py-2.5 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-bold text-xs rounded border border-[#d4af37] shadow transition-all cursor-pointer tracking-wider"
                  >
                    JOIN BATTLE
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column: Create Custom Room & Field Chat */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Create Room Box */}
          <form
            onSubmit={handleCreateRoom}
            className="bg-[#0a0806]/90 border-2 border-[#3d2b1f] rounded-xl p-5 shadow-2xl flex flex-col gap-3"
          >
            <h3 className="font-vintage font-bold text-sm text-[#d4af37]">
              Host New Skirmish Room
            </h3>

            <div>
              <label className="text-[11px] font-sans tracking-wider text-[#8b7355] block mb-1 uppercase">Room Name:</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="e.g. 20th Maine Stand"
                className="w-full bg-[#0a0806] border border-[#3d2b1f] rounded p-2 text-xs text-[#f4ecd8] font-mono focus:border-[#d4af37] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-sans tracking-wider text-[#8b7355] block mb-1 uppercase">Map:</label>
                <select
                  value={selectedMap}
                  onChange={(e) => setSelectedMap(e.target.value)}
                  className="w-full bg-[#0a0806] border border-[#3d2b1f] rounded p-2 text-xs text-[#f4ecd8] font-mono outline-none"
                >
                  <option value="the_angle">The Angle (Day 3)</option>
                  <option value="round_top">Little Round Top (Day 2)</option>
                  <option value="wheatfield">The Wheatfield (Night)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-sans tracking-wider text-[#8b7355] block mb-1 uppercase">Mode:</label>
                <select
                  value={selectedMode}
                  onChange={(e) => setSelectedMode(e.target.value as any)}
                  className="w-full bg-[#0a0806] border border-[#3d2b1f] rounded p-2 text-xs text-[#f4ecd8] font-mono outline-none"
                >
                  <option value="TDM">Team Deathmatch</option>
                  <option value="FFA">Free For All</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="mt-2 w-full py-2.5 bg-[#1d3c61] hover:bg-blue-800 text-white font-vintage font-bold text-xs rounded border border-blue-400/50 shadow cursor-pointer transition-all tracking-wider"
            >
              CREATE & DEPLOY SERVER
            </button>
          </form>

          {/* Lobby Chat */}
          <div className="bg-[#0a0806]/90 border-2 border-[#3d2b1f] rounded-xl p-4 shadow-2xl flex flex-col gap-2">
            <h3 className="font-vintage font-bold text-xs text-[#d4af37] flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-[#d4af37]" /> War Council Telegrams
            </h3>

            <div className="bg-[#0a0806] border border-[#3d2b1f] rounded p-2.5 h-32 overflow-y-auto flex flex-col gap-1.5 text-[11px] font-mono">
              {chatMessages.map((msg, i) => (
                <div key={i} className="leading-tight">
                  <span className={`font-bold ${msg.faction === 'NORTH' ? 'text-[#7ba4db]' : 'text-[#d4af37]'}`}>
                    {msg.name}:
                  </span>{' '}
                  <span className="text-stone-300">{msg.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={handleSendChat} className="flex gap-2 mt-1">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send war dispatch..."
                className="flex-1 bg-[#0a0806] border border-[#3d2b1f] rounded px-2.5 py-1 text-xs text-[#f4ecd8] font-mono outline-none focus:border-[#d4af37]"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-[#3d2b1f] hover:bg-[#8b7355] text-[#d4af37] rounded text-xs font-bold font-mono cursor-pointer border border-[#3d2b1f]"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};
