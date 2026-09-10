import React, { useState } from 'react';
import { Play, RotateCcw, Home, Volume2, Settings, Shield, Sliders, Music, VolumeX, Crosshair } from 'lucide-react';
import { audio } from '../services/audioService';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
  crtScanlines: boolean;
  onToggleCrt: () => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  onResume,
  onRestart,
  onQuitToTitle,
  crtScanlines,
  onToggleCrt,
}) => {
  const [showAudioSettings, setShowAudioSettings] = useState<boolean>(true);
  const [masterVol, setMasterVol] = useState<number>(Math.round(audio.getMasterVolume() * 100));
  const [sfxVol, setSfxVol] = useState<number>(Math.round(audio.getSfxVolume() * 100));
  const [musicVol, setMusicVol] = useState<number>(Math.round(audio.getMusicVolume() * 100));

  const handleMasterChange = (val: number) => {
    setMasterVol(val);
    audio.setMasterVolume(val / 100);
  };

  const handleSfxChange = (val: number) => {
    setSfxVol(val);
    audio.setSfxVolume(val / 100);
    // Trigger preview blip
    audio.playHeartbeat(false);
  };

  const handleMusicChange = (val: number) => {
    setMusicVol(val);
    audio.setMusicVolume(val / 100);
  };

  return (
    <div id="pause-menu-root" className="fixed inset-0 bg-[#0a0806]/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none font-serif">
      <div className="bg-[#0a0806] border-2 border-[#3d2b1f] rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-center max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-2xl font-vintage font-black text-[#f4ecd8]">
            BATTLE PAUSED
          </h2>
          <p className="text-xs font-sans tracking-widest text-[#8b7355] uppercase mt-1">
            THE BATTLE OF GETTYSBURG &bull; JULY 1863
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            id="btn-pause-resume"
            onClick={onResume}
            className="w-full py-2.5 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-black text-sm rounded shadow border border-[#d4af37] transition-all flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <Play className="w-4 h-4 fill-current text-[#0a0806]" /> RESUME ENGAGEMENT
          </button>

          <button
            id="btn-pause-restart"
            onClick={onRestart}
            className="w-full py-2 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] text-[#f4ecd8] font-vintage font-bold text-xs rounded border border-[#3d2b1f] transition-all flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#d4af37]" /> RESTART BATTLE
          </button>

          <button
            id="btn-pause-quit"
            onClick={onQuitToTitle}
            className="w-full py-2 bg-red-950/40 hover:bg-red-900/50 text-red-300 font-vintage font-bold text-xs rounded border border-red-900/50 transition-all flex items-center justify-center gap-2 cursor-pointer tracking-wider"
          >
            <Home className="w-3.5 h-3.5" /> RETREAT TO TITLE SCREEN
          </button>
        </div>

        {/* Dedicated Audio Settings Panel */}
        <div className="p-3.5 bg-[#16110c] border border-[#3d2b1f] rounded-xl flex flex-col gap-3 text-left">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#3d2b1f]">
            <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-[#d4af37] uppercase">
              <Sliders className="w-3.5 h-3.5 text-[#d4af37]" /> AUDIO MIXER SETTINGS
            </div>
            <span className="text-[10px] font-mono text-[#8b7355]">REALTIME DSP</span>
          </div>

          {/* Master Volume Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-sans text-[#f4ecd8]">
              <span className="flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-[#d4af37]" /> Master Volume
              </span>
              <span className="font-mono text-[11px] text-[#d4af37]">{masterVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={masterVol}
              onChange={(e) => handleMasterChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#3d2b1f] rounded-lg appearance-none cursor-pointer accent-[#d4af37]"
            />
          </div>

          {/* Weapon SFX Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-sans text-[#f4ecd8]">
              <span className="flex items-center gap-1.5">
                <Crosshair className="w-3.5 h-3.5 text-[#e5a044]" /> Weapon & Battle SFX
              </span>
              <span className="font-mono text-[11px] text-[#e5a044]">{sfxVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={sfxVol}
              onChange={(e) => handleSfxChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#3d2b1f] rounded-lg appearance-none cursor-pointer accent-[#e5a044]"
            />
          </div>

          {/* Music & Ambience Slider */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs font-sans text-[#f4ecd8]">
              <span className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-[#7ba4db]" /> Music & Field Drums
              </span>
              <span className="font-mono text-[11px] text-[#7ba4db]">{musicVol}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVol}
              onChange={(e) => handleMusicChange(Number(e.target.value))}
              className="w-full h-1.5 bg-[#3d2b1f] rounded-lg appearance-none cursor-pointer accent-[#7ba4db]"
            />
          </div>
        </div>

        {/* Visual Settings Toggle */}
        <div className="pt-2 border-t border-[#3d2b1f] flex items-center justify-between text-xs font-sans tracking-wider text-[#8b7355]">
          <span>CRT ARCADE SCANLINES:</span>
          <button
            onClick={onToggleCrt}
            className={`px-3 py-1 rounded text-[10px] font-sans font-bold cursor-pointer transition-all ${
              crtScanlines ? 'bg-[#d4af37] text-[#0a0806]' : 'bg-[#3d2b1f] text-stone-400'
            }`}
          >
            {crtScanlines ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
    </div>
  );
};

