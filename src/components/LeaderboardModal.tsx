import React, { useState, useEffect } from 'react';
import { LeaderboardEntry } from '../types/game';
import { Award, ArrowLeft, Shield, Sparkles, Trophy } from 'lucide-react';

interface LeaderboardModalProps {
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((res) => res.json())
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  return (
    <div id="leaderboard-modal-root" className="fixed inset-0 bg-[#0a0806]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 select-none font-serif">
      <div className="bg-[#0a0806] border-2 border-[#3d2b1f] rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-[#3d2b1f] bg-[#0a0806]/80">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-[#d4af37]" />
            <div>
              <h2 className="font-vintage font-black text-xl text-[#f4ecd8]">
                GETTYSBURG HALL OF FAME
              </h2>
              <p className="text-xs font-sans tracking-widest text-[#8b7355] uppercase mt-0.5">
                TOP ARCADE BATTLEFIELD SCORES & REGIMENTAL RANKS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] text-[#d4af37] border border-[#3d2b1f] rounded text-xs font-vintage font-bold cursor-pointer"
          >
            CLOSE [ESC]
          </button>
        </header>

        {/* Leaderboard Table */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-3">
          {loading ? (
            <div className="text-center py-12 text-[#8b7355] font-mono text-sm">
              Loading Battle Records...
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-12 text-[10px] font-sans tracking-widest text-[#8b7355] px-4 py-2 border-b border-[#3d2b1f] uppercase font-bold">
                <span className="col-span-1">#</span>
                <span className="col-span-4">Soldier / Commander</span>
                <span className="col-span-3">Army</span>
                <span className="col-span-2">Regiment Rank</span>
                <span className="col-span-2 text-right">Score</span>
              </div>

              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`grid grid-cols-12 items-center p-3 rounded border font-mono text-xs transition-all ${
                    idx === 0
                      ? 'bg-[#3d2b1f]/50 border-[#d4af37] text-white shadow ring-1 ring-[#d4af37]/50'
                      : idx === 1
                      ? 'bg-[#3d2b1f]/30 border-[#8b7355] text-stone-200'
                      : idx === 2
                      ? 'bg-[#3d2b1f]/20 border-[#8b7355]/60 text-stone-300'
                      : 'bg-[#0a0806] border-[#3d2b1f] text-stone-400'
                  }`}
                >
                  <span className="col-span-1 font-vintage font-bold text-[#d4af37]">
                    {idx + 1}
                  </span>
                  <span className="col-span-4 font-vintage font-bold text-[#f4ecd8] flex items-center gap-1.5">
                    {idx === 0 && '👑'} {entry.name}
                  </span>
                  <span className={`col-span-3 font-bold text-[11px] ${
                    entry.faction === 'NORTH' ? 'text-[#7ba4db]' : 'text-[#a0a0a0]'
                  }`}>
                    {entry.faction === 'NORTH' ? '★ UNION' : '⚔ CONFEDERATE'}
                  </span>
                  <span className="col-span-2 text-[#8b7355] text-[10px] truncate">
                    {entry.rank}
                  </span>
                  <span className="col-span-2 text-right font-arcade font-bold text-[#d4af37] text-sm">
                    {entry.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
