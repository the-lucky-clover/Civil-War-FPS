import React, { useState } from 'react';
import { CampaignMission, Faction, CharacterClass } from '../types/game';
import { audio } from '../services/audioService';
import { Shield, Target, Flag, Play, Compass, Clock, Award, Crosshair } from 'lucide-react';

interface MissionBriefingModalProps {
  mission: CampaignMission;
  faction: Faction;
  charClass: CharacterClass;
  onCommence: () => void;
}

export const MissionBriefingModal: React.FC<MissionBriefingModalProps> = ({
  mission,
  faction,
  charClass,
  onCommence,
}) => {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleStart = () => {
    setIsTransitioning(true);
    audio.playBugleCall('charge');
    setTimeout(() => {
      onCommence();
    }, 600); // 600ms dramatic fade-to-black
  };

  const primaryObjective =
    faction === 'NORTH' ? mission.unionObjective : mission.confederateObjective;

  return (
    <div
      id="mission-briefing-backdrop"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 select-none bg-[#0a0806]/90 backdrop-blur-md transition-opacity duration-500 ${
        isTransitioning ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <div
        id="mission-briefing-parchment"
        className="relative max-w-2xl w-full bg-[#16110c] border-2 border-[#8b7355] rounded-xl shadow-2xl p-6 md:p-8 flex flex-col gap-5 text-[#f4ecd8] font-serif overflow-hidden"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at center, rgba(61,43,31,0.5) 0%, rgba(10,8,6,0.95) 100%)',
        }}
      >
        {/* Subtle vintage stamp or watermark */}
        <div className="absolute top-4 right-4 text-[42px] font-vintage text-[#d4af37]/10 pointer-events-none rotate-12 font-black select-none">
          1863
        </div>

        {/* Header Ribbon */}
        <div className="border-b border-[#3d2b1f] pb-4 flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] font-mono tracking-widest text-[#d4af37]">
            <span className="flex items-center gap-1.5 uppercase font-bold">
              <Compass className="w-3.5 h-3.5 text-[#d4af37]" /> WAR DEPARTMENT FIELD DISPATCH
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> {mission.date}
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-vintage font-black text-[#f4ecd8] tracking-wide mt-1">
            {mission.title}
          </h1>
          <p className="text-xs sm:text-sm font-sans tracking-wide text-[#8b7355]">
            {mission.subtitle} &bull; <span className="text-[#d4af37]">{mission.location}</span>
          </p>
        </div>

        {/* Briefing Narrative */}
        <div className="bg-[#0a0806]/70 border border-[#3d2b1f] rounded-lg p-4 text-xs sm:text-sm leading-relaxed text-stone-300 italic">
          "{mission.briefing}"
        </div>

        {/* Mission Objectives & Win Conditions */}
        <div className="flex flex-col gap-3">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-[#d4af37] flex items-center gap-1.5">
            <Target className="w-4 h-4 text-[#d4af37]" /> MISSION ORDERS & WINNING CONDITIONS:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Objective */}
            <div className="bg-[#1f1710]/90 border border-[#d4af37]/40 rounded-lg p-3 flex flex-col gap-1 shadow-md">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#d4af37] uppercase">
                <Flag className="w-3.5 h-3.5 text-[#d4af37]" /> PRIMARY DIRECTIVE
              </div>
              <p className="text-xs text-stone-200 leading-snug">
                {primaryObjective}
              </p>
            </div>

            {/* Tactical Battle Win Conditions */}
            <div className="bg-[#1f1710]/90 border border-[#3d2b1f] rounded-lg p-3 flex flex-col gap-1 shadow-md">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300 uppercase">
                <Award className="w-3.5 h-3.5 text-amber-300" /> TACTICAL VICTORY RULES
              </div>
              <p className="text-xs text-stone-300 leading-snug">
                Deplete enemy regimental tickets to 0, raise the regimental flag at waypoints, or repel all waves of assaulting forces!
              </p>
            </div>
          </div>

          {/* Interactive Controls Reminder */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-[#0a0806]/60 border border-[#3d2b1f]/70 rounded-md text-[11px] font-mono text-stone-400">
            <span><strong className="text-[#d4af37]">[E] KEY:</strong> Commandeer Cannons & Open Doors</span>
            <span><strong className="text-[#d4af37]">[V] KEY:</strong> Bayonet Strike</span>
            <span><strong className="text-[#d4af37]">[F] KEY:</strong> Regimental Ability</span>
            <span><strong className="text-[#d4af37]">[Q] KEY:</strong> Canteen Heal</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#3d2b1f]">
          <button
            id="btn-commence-engagement"
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-3 bg-gradient-to-b from-[#d4af37] via-[#b8972e] to-[#8b7355] hover:brightness-110 text-[#0a0806] font-vintage font-black text-sm rounded shadow-xl border border-[#fff8e7] transition-all flex items-center justify-center gap-2.5 cursor-pointer tracking-wider uppercase"
          >
            <Play className="w-4 h-4 fill-current text-[#0a0806]" /> COMMENCE ENGAGEMENT
          </button>
        </div>
      </div>
    </div>
  );
};
