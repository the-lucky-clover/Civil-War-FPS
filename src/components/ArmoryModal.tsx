import React, { useState } from 'react';
import { HISTORICAL_WEAPONS } from '../game/weapons';
import { WeaponData } from '../types/game';
import { ArrowLeft, Crosshair, Zap, Shield, Sparkles, BookOpen } from 'lucide-react';
import { audio } from '../services/audioService';

interface ArmoryModalProps {
  onClose: () => void;
}

export const ArmoryModal: React.FC<ArmoryModalProps> = ({ onClose }) => {
  const weaponsList = Object.values(HISTORICAL_WEAPONS);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponData>(weaponsList[0]);

  const playPreviewSound = (w: WeaponData) => {
    audio.init();
    if (w.id.includes('colt') || w.id.includes('lemat')) {
      audio.playRevolverFire();
    } else {
      audio.playMusketFire();
    }
  };

  return (
    <div id="armory-modal-root" className="fixed inset-0 bg-[#0a0806]/90 backdrop-blur-md z-50 flex items-center justify-center p-4 sm:p-8 select-none font-serif">
      <div className="bg-[#0a0806] border-2 border-[#3d2b1f] rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between p-5 border-b border-[#3d2b1f] bg-[#0a0806]/80">
          <div className="flex items-center gap-3">
            <BookOpen className="w-6 h-6 text-[#d4af37]" />
            <div>
              <h2 className="font-vintage font-black text-xl text-[#f4ecd8]">
                1863 GETTYSBURG WEAPONS ARMORY
              </h2>
              <p className="text-xs font-sans tracking-widest text-[#8b7355] uppercase mt-0.5">
                HISTORICAL INFANTRY FIREARMS & ORDNANCE SPECIFICATIONS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] text-[#d4af37] border border-[#3d2b1f] rounded text-xs font-vintage font-bold cursor-pointer"
          >
            CLOSE ARMORY [ESC]
          </button>
        </header>

        {/* Content */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 overflow-y-auto flex-1">
          {/* Weapon Selection Sidebar */}
          <div className="md:col-span-5 flex flex-col gap-2.5">
            <div className="text-xs font-sans tracking-widest text-[#d4af37] uppercase mb-1 font-bold">SELECT WEAPON:</div>
            {weaponsList.map((w) => (
              <button
                key={w.id}
                onClick={() => {
                  setSelectedWeapon(w);
                  audio.init();
                  audio.playReloadStage('PRIMER');
                }}
                className={`p-3.5 rounded border text-left transition-all cursor-pointer ${
                  selectedWeapon.id === w.id
                    ? 'border-[#d4af37] bg-[#3d2b1f]/60 shadow-md text-white ring-1 ring-[#d4af37]'
                    : 'border-[#3d2b1f] bg-[#0a0806] hover:border-[#8b7355] text-stone-400'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-vintage font-bold text-sm text-[#f4ecd8]">{w.name}</span>
                  <span className="text-[10px] font-mono text-[#d4af37]">{w.caliber}</span>
                </div>
                <div className="text-xs text-[#8b7355] truncate mt-1">{w.shortName}</div>
              </button>
            ))}
          </div>

          {/* Weapon Deep Inspection Detail */}
          <div className="md:col-span-7 bg-[#0a0806] border border-[#3d2b1f] rounded-xl p-5 flex flex-col justify-between shadow-inner">
            <div>
              <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-3">
                <div>
                  <h3 className="text-xl font-vintage font-black text-[#f4ecd8]">{selectedWeapon.name}</h3>
                  <p className="text-xs font-mono text-[#8b7355] mt-0.5">{selectedWeapon.caliber} • {selectedWeapon.range} YDS EFFECTIVE RANGE</p>
                </div>
                <button
                  onClick={() => playPreviewSound(selectedWeapon)}
                  className="px-3 py-1.5 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] rounded text-xs font-vintage font-bold cursor-pointer border border-[#d4af37] tracking-wider"
                >
                  🔊 TEST FIRE
                </button>
              </div>

              {/* Stats Bar */}
              <div className="grid grid-cols-2 gap-4 my-5">
                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <div className="flex items-center justify-between text-xs text-stone-300 mb-1 font-mono">
                    <span>Stopping Power:</span>
                    <span className="font-bold text-[#d4af37]">{selectedWeapon.damage} HP</span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden">
                    <div className="h-full bg-red-600" style={{ width: `${Math.min(100, (selectedWeapon.damage / 150) * 100)}%` }} />
                  </div>
                </div>

                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <div className="flex items-center justify-between text-xs text-stone-300 mb-1 font-mono">
                    <span>Accuracy (Spread):</span>
                    <span className="font-bold text-[#d4af37]">{Math.round(selectedWeapon.accuracy * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${selectedWeapon.accuracy * 100}%` }} />
                  </div>
                </div>

                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <div className="flex items-center justify-between text-xs text-stone-300 mb-1 font-mono">
                    <span>Magazine Capacity:</span>
                    <span className="font-bold text-[#d4af37]">{selectedWeapon.magazineSize} Round(s)</span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden">
                    <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, (selectedWeapon.magazineSize / 9) * 100)}%` }} />
                  </div>
                </div>

                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <div className="flex items-center justify-between text-xs text-stone-300 mb-1 font-mono">
                    <span>Reload Duration:</span>
                    <span className="font-bold text-[#d4af37]">{selectedWeapon.reloadTime}s</span>
                  </div>
                  <div className="w-full h-2 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#8b7355] to-[#d4af37]" style={{ width: `${Math.max(10, 100 - (selectedWeapon.reloadTime / 4) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* Description & Historical Notes */}
              <div className="flex flex-col gap-3 text-xs text-stone-300 leading-relaxed font-sans">
                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <span className="font-bold text-[#d4af37] block mb-0.5 font-vintage uppercase">Tactical Usage:</span>
                  <p>{selectedWeapon.description}</p>
                </div>

                <div className="bg-[#0a0806] p-3 rounded border border-[#3d2b1f]">
                  <span className="font-bold text-[#d4af37] block mb-0.5 font-vintage uppercase">Historical Gettysburg Note:</span>
                  <p className="italic text-stone-400">{selectedWeapon.historicalNote}</p>
                </div>
              </div>
            </div>

            {selectedWeapon.hasBayonet && (
              <div className="mt-4 p-2.5 bg-[#3d2b1f]/40 border border-[#8b7355]/40 rounded text-xs text-[#f4ecd8] flex items-center gap-2">
                <span>🗡️</span>
                <span>Fitted with 18-inch triangular socket bayonet for instant sprint-thrust melee combat.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
