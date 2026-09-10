import React, { useState, useEffect } from 'react';
import { Faction, CharacterClass, CampaignMission, HistoricalSettings } from '../types/game';
import { CAMPAIGN_MISSIONS } from '../game/campaignData';
import { CHARACTER_CLASSES } from '../game/classesData';
import { audio } from '../services/audioService';
import { HISTORICAL_WEAPONS } from '../game/weapons';
import { Shield, Crosshair, Award, Volume2, HelpCircle, Swords, Users, Play, Sparkles, BookOpen, Settings, Check, Flame, Heart } from 'lucide-react';

interface TitleScreenProps {
  onStartCampaign: (faction: Faction, charClass: CharacterClass, mission: CampaignMission) => void;
  onOpenMultiplayer: (faction: Faction, charClass: CharacterClass) => void;
  onOpenArmory: () => void;
  onOpenLeaderboard: () => void;
  historicalSettings: HistoricalSettings;
  onUpdateHistoricalSettings: (settings: HistoricalSettings) => void;
  crtScanlines: boolean;
  onToggleCrt: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartCampaign,
  onOpenMultiplayer,
  onOpenArmory,
  onOpenLeaderboard,
  historicalSettings,
  onUpdateHistoricalSettings,
  crtScanlines,
  onToggleCrt,
}) => {
  const [selectedFaction, setSelectedFaction] = useState<Faction>('NORTH');
  const [selectedClass, setSelectedClass] = useState<CharacterClass>('INFANTRY');
  const [selectedMission, setSelectedMission] = useState<CampaignMission>(CAMPAIGN_MISSIONS[0]);
  const [activeTab, setActiveTab] = useState<'CAMPAIGN' | 'CLASSES' | 'SETTINGS'>('CAMPAIGN');
  const [soundTestKey, setSoundTestKey] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTab === 'CAMPAIGN') {
        audio.init();
        audio.playBugleCharge();
        onStartCampaign(selectedFaction, selectedClass, selectedMission);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFaction, selectedClass, selectedMission, activeTab, onStartCampaign]);

  const handleSelectFaction = (faction: Faction) => {
    setSelectedFaction(faction);
    try {
      audio.init();
      audio.playHuzzahCheer(faction);
    } catch (e) {
      console.warn('Audio cheer error:', e);
    }
  };

  const handleSoundTest = (type: string) => {
    try {
      audio.init();
      setSoundTestKey(type);
      if (type === 'musket') audio.playMusketFire();
      if (type === 'cannon') audio.playCannonBlast();
      if (type === 'revolver') audio.playRevolverFire();
      if (type === 'bugle') audio.playBugleCharge();
      if (type === 'bayonet') audio.playBayonetSwing();
      if (type === 'cheer') audio.playHuzzahCheer(selectedFaction);
    } catch (e) {
      console.warn('Sound test error:', e);
    }
  };

  return (
    <div
      id="title-screen-container"
      className="relative w-full min-h-full bg-[#0a0806] text-stone-100 flex flex-col justify-between p-3 sm:p-6 md:p-8 z-10 pb-20 touch-auto"
    >
      {/* Ambient Backdrop */}
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, #3d2b1f 0%, #0a0806 80%)' }}
      />
      <div className="fixed inset-0 opacity-20 pointer-events-none bg-immersive-dots" />

      {/* Header Banner */}
      <header id="title-header" className="relative z-10 text-center max-w-4xl mx-auto pt-2 pb-2 px-2">
        <p className="text-[#d4af37] tracking-[0.3em] sm:tracking-[0.4em] text-[10px] sm:text-xs font-sans uppercase mb-1 drop-shadow-md">
          Arcade Civil War First-Person Combat &bull; July 1–3, 1863
        </p>
        
        <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] italic tracking-tight leading-none border-b-2 sm:border-b-4 border-[#d4af37]/30 pb-2 sm:pb-3 font-vintage drop-shadow-[0_4px_16px_rgba(0,0,0,0.9)]">
          GETTYSBURG
        </h1>
        <p className="text-[#8b7355] text-xs sm:text-sm md:text-base italic mt-1 sm:mt-2">
          High Water Mark of the Rebellion &bull; Run &amp; Gun FPS
        </p>
      </header>

      {/* Navigation Tabs Bar */}
      <nav id="title-nav-bar" className="relative z-10 flex justify-center flex-wrap gap-2 sm:gap-6 text-xs sm:text-sm font-sans font-bold tracking-widest text-[#8b7355] my-2">
        <button
          id="nav-tab-campaign"
          type="button"
          onClick={() => setActiveTab('CAMPAIGN')}
          className={`cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 ${
            activeTab === 'CAMPAIGN'
              ? 'text-white border-[#d4af37] underline decoration-[#d4af37] underline-offset-4 sm:underline-offset-8'
              : 'border-transparent hover:text-[#d4af37] hover:border-[#d4af37]'
          }`}
        >
          CAMPAIGN
        </button>

        <button
          id="nav-tab-classes"
          type="button"
          onClick={() => setActiveTab('CLASSES')}
          className={`cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 ${
            activeTab === 'CLASSES'
              ? 'text-white border-[#d4af37] underline decoration-[#d4af37] underline-offset-4 sm:underline-offset-8'
              : 'border-transparent hover:text-[#d4af37] hover:border-[#d4af37]'
          }`}
        >
          CLASSES ({CHARACTER_CLASSES.length})
        </button>

        <button
          id="nav-tab-multiplayer"
          type="button"
          onClick={() => onOpenMultiplayer(selectedFaction, selectedClass)}
          className="cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 border-transparent hover:text-[#d4af37] hover:border-[#d4af37] flex items-center gap-1"
        >
          MULTIPLAYER
        </button>

        <button
          id="nav-tab-armory"
          type="button"
          onClick={onOpenArmory}
          className="cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 border-transparent hover:text-[#d4af37] hover:border-[#d4af37]"
        >
          ARMORY
        </button>

        <button
          id="nav-tab-leaderboard"
          type="button"
          onClick={onOpenLeaderboard}
          className="cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 border-transparent hover:text-[#d4af37] hover:border-[#d4af37]"
        >
          HALL OF FAME
        </button>

        <button
          id="nav-tab-settings"
          type="button"
          onClick={() => setActiveTab('SETTINGS')}
          className={`cursor-pointer px-2.5 py-1.5 min-h-[40px] transition-all border-b-2 ${
            activeTab === 'SETTINGS'
              ? 'text-white border-[#d4af37] underline decoration-[#d4af37] underline-offset-4 sm:underline-offset-8'
              : 'border-transparent hover:text-[#d4af37] hover:border-[#d4af37]'
          }`}
        >
          HISTORICAL SETTINGS
        </button>
      </nav>

      {/* Main Interactive Content Area */}
      <main id="title-main-content" className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 max-w-7xl mx-auto w-full items-start my-2">
        
        {/* Left Column: Faction & Class Selector */}
        <section id="faction-class-selection" className="lg:col-span-5 bg-[#0a0806]/90 backdrop-blur-md border-2 border-[#3d2b1f] rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4">
          
          {/* Faction Enlistment */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-sans tracking-widest text-[#d4af37] flex items-center gap-2 uppercase font-bold">
                <Shield className="w-4 h-4 text-[#d4af37]" /> 1. Choose Allegiance
              </h2>
              <span className="text-[10px] font-mono text-[#8b7355]">
                {selectedFaction === 'NORTH' ? '★ UNION ARMY' : '⚔ REBEL ARMY'}
              </span>
            </div>

            {/* Quick Segmented Mobile / Desktop Toggle Bar */}
            <div className="grid grid-cols-2 gap-1.5 bg-[#0a0806] border border-[#3d2b1f] p-1 rounded-lg mb-2.5">
              <button
                type="button"
                id="btn-toggle-north"
                onClick={() => handleSelectFaction('NORTH')}
                className={`py-2 px-2 rounded font-sans font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
                  selectedFaction === 'NORTH'
                    ? 'bg-blue-700 text-white shadow-md border border-blue-400'
                    : 'text-stone-400 hover:text-white bg-transparent'
                }`}
              >
                ★ UNION (USA)
              </button>
              <button
                type="button"
                id="btn-toggle-south"
                onClick={() => handleSelectFaction('SOUTH')}
                className={`py-2 px-2 rounded font-sans font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-[40px] ${
                  selectedFaction === 'SOUTH'
                    ? 'bg-zinc-700 text-white shadow-md border border-zinc-400'
                    : 'text-stone-400 hover:text-white bg-transparent'
                }`}
              >
                ⚔ CONFEDERATE (CSA)
              </button>
            </div>
            
            {/* Detailed Regiment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Union Faction Card */}
              <button
                type="button"
                id="btn-select-north"
                onClick={() => handleSelectFaction('NORTH')}
                className={`group relative text-left min-h-[160px] sm:h-56 border-2 sm:border-4 border-[#1d3c61] bg-[#1d3c61]/15 flex flex-col items-center justify-end p-3 sm:p-4 transition-all hover:bg-[#1d3c61]/35 overflow-hidden cursor-pointer rounded-lg active:scale-[0.98] ${
                  selectedFaction === 'NORTH' ? 'ring-2 ring-blue-400 bg-[#1d3c61]/35 border-blue-500' : 'opacity-80'
                }`}
              >
                <div className="absolute top-1 left-2 text-[#1d3c61] font-sans font-bold text-5xl sm:text-6xl opacity-30 select-none pointer-events-none">
                  USA
                </div>
                <div className="w-full h-1/2 bg-gradient-to-t from-[#0a0806] via-[#1d3c61]/80 to-transparent absolute bottom-0 left-0 pointer-events-none" />
                
                <h3 className="relative z-20 text-lg sm:text-xl font-bold text-white mb-0.5 font-vintage tracking-wider text-center break-words pointer-events-none">
                  THE UNION
                </h3>
                <p className="relative z-20 text-[#7ba4db] text-[9px] sm:text-[10px] uppercase tracking-wider font-sans mb-2 text-center pointer-events-none">
                  20th Maine • Army of the Potomac
                </p>
                <div className={`relative z-20 w-full py-1.5 sm:py-2 text-white text-center text-xs font-bold tracking-tight rounded border pointer-events-none ${
                  selectedFaction === 'NORTH' ? 'bg-blue-600 border-blue-300 shadow-md' : 'bg-[#1d3c61] border-blue-500/60'
                }`}>
                  {selectedFaction === 'NORTH' ? '★ ENLISTED' : 'SELECT UNION'}
                </div>
              </button>

              {/* Confederate Faction Card */}
              <button
                type="button"
                id="btn-select-south"
                onClick={() => handleSelectFaction('SOUTH')}
                className={`group relative text-left min-h-[160px] sm:h-56 border-2 sm:border-4 border-[#5a5a5a] bg-[#5a5a5a]/15 flex flex-col items-center justify-end p-3 sm:p-4 transition-all hover:bg-[#5a5a5a]/35 overflow-hidden cursor-pointer rounded-lg active:scale-[0.98] ${
                  selectedFaction === 'SOUTH' ? 'ring-2 ring-zinc-300 bg-[#5a5a5a]/35 border-zinc-400' : 'opacity-80'
                }`}
              >
                <div className="absolute top-1 left-2 text-[#5a5a5a] font-sans font-bold text-5xl sm:text-6xl opacity-30 select-none pointer-events-none">
                  CSA
                </div>
                <div className="w-full h-1/2 bg-gradient-to-t from-[#0a0806] via-[#5a5a5a]/80 to-transparent absolute bottom-0 left-0 pointer-events-none" />
                
                <h3 className="relative z-20 text-lg sm:text-xl font-bold text-white mb-0.5 font-vintage tracking-wider text-center break-words pointer-events-none">
                  CONFEDERACY
                </h3>
                <p className="relative z-20 text-[#a0a0a0] text-[9px] sm:text-[10px] uppercase tracking-wider font-sans mb-2 text-center pointer-events-none">
                  15th Alabama • Army of N. Virginia
                </p>
                <div className={`relative z-20 w-full py-1.5 sm:py-2 text-white text-center text-xs font-bold tracking-tight rounded border pointer-events-none ${
                  selectedFaction === 'SOUTH' ? 'bg-zinc-600 border-zinc-300 shadow-md' : 'bg-[#5a5a5a] border-zinc-500/60'
                }`}>
                  {selectedFaction === 'SOUTH' ? '★ ENLISTED' : 'SELECT CONFEDERACY'}
                </div>
              </button>
            </div>
          </div>

          {/* Quick Role & Class Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-sans tracking-widest text-[#d4af37] flex items-center gap-2 uppercase font-bold">
                <Crosshair className="w-4 h-4 text-[#d4af37]" /> 2. Select Role
              </h2>
              <button
                onClick={() => setActiveTab('CLASSES')}
                className="text-[10px] font-mono text-[#8b7355] hover:text-[#d4af37] underline"
              >
                View Roles Details &rarr;
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {CHARACTER_CLASSES.map((c) => (
                <button
                  key={c.id}
                  id={`btn-class-${c.id.toLowerCase()}`}
                  onClick={() => {
                    setSelectedClass(c.id);
                    audio.init();
                    audio.playReloadStage('PRIMER');
                  }}
                  className={`p-2 rounded border text-left flex flex-col justify-between transition-all cursor-pointer ${
                    selectedClass === c.id
                      ? 'border-[#d4af37] bg-[#3d2b1f]/70 text-white ring-1 ring-[#d4af37]'
                      : 'border-[#3d2b1f] bg-[#0a0806] hover:border-[#8b7355] text-stone-400'
                  }`}
                >
                  <div>
                    <div className="font-bold text-xs font-vintage text-[#f4ecd8] flex items-center justify-between">
                      <span>{c.title}</span>
                      {selectedClass === c.id && <Check className="w-3.5 h-3.5 text-[#d4af37]" />}
                    </div>
                    <div className="text-[10px] text-[#d4af37] font-mono mt-0.5 truncate">
                      {selectedFaction === 'NORTH'
                        ? (HISTORICAL_WEAPONS[c.primaryWeaponUnion]?.name || c.primaryWeaponUnion)
                        : (HISTORICAL_WEAPONS[c.primaryWeaponConfed]?.name || c.primaryWeaponConfed)}
                    </div>
                  </div>
                  <div className="text-[9px] text-[#8b7355] mt-1 bg-[#0a0806] px-1 py-0.5 rounded border border-[#3d2b1f] truncate">
                    {c.abilityName}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Quick Controls Cheat-Sheet */}
          <div className="bg-[#0a0806] border border-[#3d2b1f] rounded p-2.5 text-[10px] sm:text-[11px] text-stone-400 font-mono">
            <div className="text-[#d4af37] font-bold mb-1 flex items-center justify-between">
              <span>BATTLE CONTROLS:</span>
              <span className="text-[9px] text-[#8b7355]">KEYBOARD / TOUCH</span>
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
              <div><span className="text-stone-200 font-bold">L-Click / Fire:</span> Shoot Musket</div>
              <div><span className="text-stone-200 font-bold">R-Click / ADS:</span> Aim Down Sights</div>
              <div><span className="text-stone-200 font-bold">R Key:</span> Ramrod Reload</div>
              <div><span className="text-stone-200 font-bold">G Key:</span> Class Special Ability</div>
              <div><span className="text-stone-200 font-bold">V or F:</span> Bayonet Thrust</div>
              <div><span className="text-stone-200 font-bold">E Key:</span> Napoleon 12-Pdr Cannon</div>
            </div>
          </div>
        </section>

        {/* Right Column: Mission Briefing / Classes View / Historical Settings View */}
        <section id="mode-mission-selection" className="lg:col-span-7 bg-[#0a0806]/90 backdrop-blur-md border-2 border-[#3d2b1f] rounded-xl p-4 sm:p-5 shadow-2xl flex flex-col gap-4">
          
          {/* TAB 1: CAMPAIGN MISSION SELECTION */}
          {activeTab === 'CAMPAIGN' && (
            <div className="flex flex-col gap-3 sm:gap-4">
              <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-2">
                <span className="text-xs font-sans tracking-widest font-bold text-[#d4af37] uppercase">
                  HISTORICAL ENGAGEMENTS (DAY 1–3)
                </span>
                <span className="text-xs font-mono text-[#8b7355]">{selectedMission.date}</span>
              </div>

              {/* Mission Selector Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {CAMPAIGN_MISSIONS.map((m) => (
                  <button
                    key={m.id}
                    id={`btn-mission-${m.id}`}
                    onClick={() => {
                      setSelectedMission(m);
                      audio.init();
                      audio.playReloadStage('PRIMER');
                    }}
                    className={`p-3 rounded border text-left transition-all cursor-pointer ${
                      selectedMission.id === m.id
                        ? 'border-[#d4af37] bg-[#3d2b1f]/60 shadow-md ring-1 ring-[#d4af37] text-white'
                        : 'border-[#3d2b1f] bg-[#0a0806] hover:border-[#8b7355] text-stone-400'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-sans font-bold tracking-widest text-[#d4af37]">DAY {m.day}</span>
                      <span className="text-[9px] font-mono text-[#8b7355]">{m.waves} Waves &bull; {m.estimatedTime}</span>
                    </div>
                    <div className="font-vintage font-bold text-xs sm:text-sm text-[#f4ecd8] mt-0.5">{m.title}</div>
                    <div className="text-[11px] text-[#8b7355] truncate mt-0.5">{m.location}</div>
                  </button>
                ))}
              </div>

              {/* Mission Briefing Details Card */}
              <div className="bg-[#0a0806] border border-[#3d2b1f] rounded p-3.5 font-sans flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-1.5">
                  <span className="font-vintage font-bold text-[#d4af37] text-sm sm:text-base">{selectedMission.title}</span>
                  <span className="text-xs font-mono text-[#8b7355]">{selectedMission.location}</span>
                </div>
                <p className="text-xs text-stone-300 leading-relaxed italic">
                  "{selectedMission.briefing}"
                </p>
                <div className="mt-1 bg-[#3d2b1f]/30 border border-[#3d2b1f] rounded p-2 text-xs">
                  <span className="font-bold text-[#d4af37] uppercase tracking-wide text-[11px]">
                    {selectedFaction === 'NORTH' ? 'Union Regiment Order:' : 'Confederate Regiment Order:'}
                  </span>
                  <p className="text-stone-200 mt-0.5 text-xs">
                    {selectedFaction === 'NORTH' ? selectedMission.unionObjective : selectedMission.confederateObjective}
                  </p>
                </div>
              </div>

              {/* Big Launch Button */}
              <button
                id="btn-launch-campaign"
                onClick={() => {
                  audio.init();
                  audio.playBugleCharge();
                  onStartCampaign(selectedFaction, selectedClass, selectedMission);
                }}
                className="w-full py-3.5 sm:py-4 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-black text-lg sm:text-xl rounded shadow-2xl border-2 border-[#d4af37] transition-all flex items-center justify-center gap-3 tracking-widest cursor-pointer transform active:scale-[0.99]"
              >
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current text-[#0a0806]" />
                COMMENCE BATTLE
              </button>
            </div>
          )}

          {/* TAB 2: DETAILED CLASSES BREAKDOWN */}
          {activeTab === 'CLASSES' && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-2">
                <span className="text-xs font-sans tracking-widest font-bold text-[#d4af37] uppercase">
                  REGIMENTAL COMBAT ROLES &amp; ABILITIES
                </span>
                <span className="text-xs font-mono text-[#8b7355]">4 Roles Available</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CHARACTER_CLASSES.map((cls) => (
                  <button
                    key={cls.id}
                    type="button"
                    onClick={() => {
                      setSelectedClass(cls.id);
                      audio.init();
                      audio.playReloadStage('PRIMER');
                    }}
                    className={`p-3 rounded-lg border text-left flex flex-col gap-1.5 transition-all cursor-pointer ${
                      selectedClass === cls.id
                        ? 'border-[#d4af37] bg-[#3d2b1f]/50 ring-1 ring-[#d4af37]'
                        : 'border-[#3d2b1f] bg-[#0a0806] hover:border-[#8b7355]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-vintage font-bold text-sm text-[#f4ecd8]">{cls.title}</div>
                      <span className="text-[10px] font-mono text-[#d4af37] bg-[#0a0806] px-1.5 py-0.5 rounded border border-[#3d2b1f]">
                        CD: {cls.abilityCooldown}s
                      </span>
                    </div>

                    <p className="text-[11px] text-stone-300 italic">{cls.description}</p>

                    <div className="text-[10px] font-mono text-stone-400 bg-[#0a0806] p-1.5 rounded border border-[#3d2b1f]">
                      <div className="text-[#7ba4db]">
                        ★ Union: {HISTORICAL_WEAPONS[cls.primaryWeaponUnion]?.name || cls.primaryWeaponUnion}
                      </div>
                      <div className="text-[#a0a0a0]">
                        ⚔ Rebel: {HISTORICAL_WEAPONS[cls.primaryWeaponConfed]?.name || cls.primaryWeaponConfed}
                      </div>
                    </div>

                    <div className="text-[10px] font-sans text-[#d4af37] font-bold flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Ability: {cls.abilityName}
                    </div>
                    <p className="text-[10px] text-stone-400">{cls.abilityDescription}</p>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setActiveTab('CAMPAIGN')}
                className="w-full py-2.5 bg-[#3d2b1f] hover:bg-[#3d2b1f]/80 text-[#d4af37] font-vintage font-bold text-xs rounded border border-[#3d2b1f] cursor-pointer"
              >
                &larr; BACK TO MISSION SELECTION
              </button>
            </div>
          )}

          {/* TAB 3: HISTORICAL ACCURACY SETTINGS */}
          {activeTab === 'SETTINGS' && (
            <div className="flex flex-col gap-4 p-1">
              <div className="flex items-center justify-between border-b border-[#3d2b1f] pb-2">
                <span className="text-xs font-sans tracking-widest font-bold text-[#d4af37] uppercase">
                  HISTORICAL ACCURACY &amp; SIMULATION
                </span>
                <span className="text-xs font-mono text-[#8b7355]">Options</span>
              </div>

              {/* 1. Weapon Behavior Drill */}
              <div className="flex items-center justify-between p-3 bg-[#0a0806] border border-[#3d2b1f] rounded">
                <div>
                  <div className="font-bold text-sm text-[#f4ecd8]">Weapon Reload &amp; Accuracy Behavior</div>
                  <div className="text-xs text-[#8b7355]">
                    {historicalSettings.weaponBehavior === 'AUTHENTIC'
                      ? 'Authentic 9-step drill (12s reload, dense black powder smoke clouds)'
                      : 'Arcade fast drill (3.2s reload, responsive run-and-gun combat)'}
                  </div>
                </div>
                <button
                  onClick={() =>
                    onUpdateHistoricalSettings({
                      ...historicalSettings,
                      weaponBehavior: historicalSettings.weaponBehavior === 'AUTHENTIC' ? 'ARCADE' : 'AUTHENTIC',
                    })
                  }
                  className={`px-3 py-1.5 rounded text-xs font-sans font-bold tracking-widest transition-all cursor-pointer ${
                    historicalSettings.weaponBehavior === 'AUTHENTIC' ? 'bg-[#d4af37] text-[#0a0806]' : 'bg-[#3d2b1f] text-stone-300'
                  }`}
                >
                  {historicalSettings.weaponBehavior}
                </button>
              </div>

              {/* 2. Period-Accurate Uniforms */}
              <div className="flex items-center justify-between p-3 bg-[#0a0806] border border-[#3d2b1f] rounded">
                <div>
                  <div className="font-bold text-sm text-[#f4ecd8]">Authentic Regimental Uniforms &amp; Battle Colors</div>
                  <div className="text-xs text-[#8b7355]">
                    Iron Brigade Hardee black hats &amp; 20th Maine dark wool vs 15th Alabama butternut slouch hats
                  </div>
                </div>
                <button
                  onClick={() =>
                    onUpdateHistoricalSettings({
                      ...historicalSettings,
                      authenticUniforms: !historicalSettings.authenticUniforms,
                    })
                  }
                  className={`px-3 py-1.5 rounded text-xs font-sans font-bold tracking-widest transition-all cursor-pointer ${
                    historicalSettings.authenticUniforms ? 'bg-[#d4af37] text-[#0a0806]' : 'bg-[#3d2b1f] text-stone-400'
                  }`}
                >
                  {historicalSettings.authenticUniforms ? 'AUTHENTIC' : 'STANDARD'}
                </button>
              </div>

              {/* 3. CRT Arcade Scanlines */}
              <div className="flex items-center justify-between p-3 bg-[#0a0806] border border-[#3d2b1f] rounded">
                <div>
                  <div className="font-bold text-sm text-[#f4ecd8]">Retro Arcade CRT Scanline Overlay</div>
                  <div className="text-xs text-[#8b7355]">Phosphor beam arcade CRT monitor simulation</div>
                </div>
                <button
                  onClick={onToggleCrt}
                  className={`px-3 py-1.5 rounded text-xs font-sans font-bold tracking-widest transition-all cursor-pointer ${
                    crtScanlines ? 'bg-[#d4af37] text-[#0a0806]' : 'bg-[#3d2b1f] text-stone-400'
                  }`}
                >
                  {crtScanlines ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* 4. Audio Synthesizer Test */}
              <div className="p-3 bg-[#0a0806] border border-[#3d2b1f] rounded">
                <div className="font-bold text-sm text-[#f4ecd8] mb-2 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#d4af37]" /> Battlefield Sound Synthesizer Test:
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'musket', label: 'Musket' },
                    { id: 'cannon', label: '12-Pdr Cannon' },
                    { id: 'revolver', label: 'Revolver' },
                    { id: 'bugle', label: 'Bugle' },
                    { id: 'bayonet', label: 'Bayonet' },
                    { id: 'cheer', label: 'Army Cheer' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSoundTest(s.id)}
                      className="px-2 py-1.5 bg-[#3d2b1f]/50 hover:bg-[#3d2b1f] text-[11px] font-mono text-[#d4af37] rounded border border-[#3d2b1f] cursor-pointer"
                    >
                      🔊 {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer Bar */}
      <footer id="title-footer" className="relative z-10 w-full flex flex-col items-center gap-2 pt-2 pb-1">
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="h-[1px] w-16 sm:w-48 bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
          <p className="text-[#d4af37] font-sans text-[9px] sm:text-xs tracking-[0.3em] sm:tracking-[0.5em] uppercase animate-pulse text-center">
            PRESS SPACEBAR OR CLICK TO START BATTLE
          </p>
          <div className="h-[1px] w-16 sm:w-48 bg-gradient-to-r from-transparent via-[#d4af37]/50 to-transparent" />
        </div>

        <div className="w-full flex items-center justify-between text-[9px] sm:text-[10px] text-[#8b7355] font-sans uppercase tracking-tighter px-2">
          <span>&copy; 1863 TITANIC INTERACTIVE &bull; GETTYSBURG FPS ARCADE</span>
          <span>HIGH WATER MARK EDITION</span>
        </div>
      </footer>
    </div>
  );
};
