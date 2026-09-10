import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Faction } from '../types/game';
import { Award, RotateCcw, Home, Trophy, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
import { audio } from '../services/audioService';

interface GameOverModalProps {
  isVictory: boolean;
  score: number;
  kills: number;
  headshots: number;
  bayonetKills: number;
  faction: Faction;
  missionTitle: string;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isVictory,
  score,
  kills,
  headshots,
  bayonetKills,
  faction,
  missionTitle,
  onRestart,
  onQuitToTitle,
}) => {
  const [playerName, setPlayerName] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isVictory) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: faction === 'NORTH' ? ['#3b82f6', '#d4af37', '#ffffff'] : ['#a8a29e', '#dc2626', '#d4af37'],
      });
    }
  }, [isVictory, faction]);

  const handleSubmitScore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim() || submitted) return;

    try {
      await fetch('/api/leaderboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: playerName.trim(),
          score,
          faction,
          rank: isVictory ? (faction === 'NORTH' ? 'Hero of Cemetery Ridge' : 'High Water Mark Breaker') : 'Battle Veteran',
        }),
      });
      setSubmitted(true);
      audio.init();
      audio.playReloadStage('SUCCESS');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div id="game-over-root" className="fixed inset-0 bg-[#0a0806]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-serif">
      <div className="bg-[#0a0806] border-2 border-[#3d2b1f] rounded-2xl max-w-lg w-full p-6 shadow-2xl flex flex-col gap-5 text-center">
        
        {/* Header */}
        <div>
          <div className="flex justify-center mb-2">
            {isVictory ? (
              <div className="p-3 bg-[#3d2b1f]/60 border border-[#d4af37]/60 rounded-full text-[#d4af37]">
                <Trophy className="w-10 h-10 animate-bounce" />
              </div>
            ) : (
              <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-full text-red-400">
                <XCircle className="w-10 h-10" />
              </div>
            )}
          </div>

          <h2 className={`text-3xl font-vintage font-black ${isVictory ? 'text-transparent bg-clip-text bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f]' : 'text-red-400'}`}>
            {isVictory ? 'DECISIVE VICTORY!' : 'FIELD OVERRUN!'}
          </h2>
          <p className="text-xs font-sans tracking-widest text-[#8b7355] uppercase mt-1">
            {missionTitle} &bull; {faction === 'NORTH' ? 'UNION VICTORY' : 'CONFEDERATE STAND'}
          </p>
        </div>

        {/* Score Stats Card */}
        <div className="bg-[#0a0806] border border-[#3d2b1f] rounded-xl p-4 flex flex-col gap-3 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-2">
            <span className="text-[#8b7355] font-sans tracking-wider uppercase">FINAL ARCADE SCORE:</span>
            <span className="font-arcade text-[#d4af37] text-lg font-bold">
              {score.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-[#0a0806] p-2 rounded border border-[#3d2b1f]">
              <div className="text-[#8b7355] text-[10px] font-sans uppercase tracking-wider">CASUALTIES</div>
              <div className="text-base font-bold text-[#f4ecd8] mt-0.5">{kills}</div>
            </div>

            <div className="bg-[#0a0806] p-2 rounded border border-[#3d2b1f]">
              <div className="text-[#8b7355] text-[10px] font-sans uppercase tracking-wider">HEADSHOTS</div>
              <div className="text-base font-bold text-[#d4af37] mt-0.5">{headshots}</div>
            </div>

            <div className="bg-[#0a0806] p-2 rounded border border-[#3d2b1f]">
              <div className="text-[#8b7355] text-[10px] font-sans uppercase tracking-wider">BAYONET KILLS</div>
              <div className="text-base font-bold text-red-400 mt-0.5">{bayonetKills}</div>
            </div>
          </div>

          {/* Medals & Honors Citation */}
          <div className="bg-[#3d2b1f]/30 border border-[#8b7355]/40 rounded p-2.5 text-left text-[11px] text-[#f4ecd8] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#d4af37] shrink-0" />
            <div>
              <div className="font-vintage font-bold text-[#d4af37]">
                {isVictory ? 'Citation for Conspicuous Gallantry' : 'Honorable Service Mention'}
              </div>
              <div className="text-[#8b7355] text-[10px]">
                {headshots > 3 ? 'Sharpshooter Marksmanship Ribbon' : bayonetKills > 2 ? 'Order of the Fixed Bayonet' : 'Gettysburg Campaign Medal'}
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Submission */}
        {!submitted ? (
          <form onSubmit={handleSubmitScore} className="flex gap-2">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter soldier/commander name..."
              className="flex-1 bg-[#0a0806] border border-[#3d2b1f] rounded px-3 py-2 text-xs font-mono text-[#f4ecd8] outline-none focus:border-[#d4af37]"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-bold text-xs rounded border border-[#d4af37] cursor-pointer tracking-wider"
            >
              SAVE SCORE
            </button>
          </form>
        ) : (
          <div className="p-2 bg-[#3d2b1f]/50 border border-[#d4af37]/50 rounded text-xs font-mono text-[#d4af37] flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-[#d4af37]" /> Score Saved to Gettysburg Hall of Fame!
          </div>
        )}

        {/* Buttons */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <button
            onClick={onRestart}
            className="py-3 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-bold text-xs rounded shadow border border-[#d4af37] flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <RotateCcw className="w-4 h-4 text-[#0a0806]" /> PLAY AGAIN
          </button>

          <button
            onClick={onQuitToTitle}
            className="py-3 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] text-[#f4ecd8] font-vintage font-bold text-xs rounded border border-[#3d2b1f] flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <Home className="w-4 h-4 text-[#d4af37]" /> TITLE SCREEN
          </button>
        </div>
      </div>
    </div>
  );
};
