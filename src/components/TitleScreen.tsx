import React, { useState, useEffect, useRef } from 'react';
import { Faction, CharacterClass, CampaignMission, HistoricalSettings } from '../types/game';
import { CAMPAIGN_MISSIONS } from '../game/campaignData';
import { CHARACTER_CLASSES } from '../game/classesData';
import { audio } from '../services/audioService';
import { factionAnthem } from '../game/bandMelodies';
import { UnionFlag, ConfederateBattleFlag } from './BattleFlags';
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
  /** Which faction's march is currently previewing on hover/focus (null = none). */
  const previewFactionRef = useRef<Faction | null>(null);

  /** Hover/focus: preview the faction's anthem march. Stops when the pointer leaves. */
  const previewFactionMarch = (faction: Faction) => {
    if (previewFactionRef.current === faction) return;
    previewFactionRef.current = faction;
    try {
      audio.init();
      audio.playBandTune(factionAnthem(faction).id, { volume: 0.7, maxBars: 8 });
    } catch (e) {
      console.warn('March preview error:', e);
    }
  };

  const stopFactionMarchPreview = () => {
    if (!previewFactionRef.current) return;
    previewFactionRef.current = null;
    try {
      audio.stopBandMusic();
    } catch (e) {
      /* noop */
    }
  };

  // Never leave a march preview playing after the title screen goes away.
  useEffect(() => {
    return () => {
      previewFactionRef.current = null;
      try {
        audio.stopBandMusic();
      } catch (e) {
        /* noop */
      }
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTab === 'CAMPAIGN') {
        stopFactionMarchPreview();
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
      stopFactionMarchPreview();
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
      <style>{`
        @keyframes marquee-chase {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px 2px currentColor; }
          50% { opacity: 0.25; box-shadow: none; }
        }
        @keyframes arcade-blink {
          0%, 55% { opacity: 1; }
          56%, 100% { opacity: 0.12; }
        }
        @keyframes neon-flicker {
          0%, 100% { opacity: 1; }
          3% { opacity: 0.6; } 5% { opacity: 1; }
          42% { opacity: 1; } 44% { opacity: 0.5; } 46% { opacity: 1; }
          71% { opacity: 0.85; } 73% { opacity: 1; }
        }
        .marquee-bulb { animation: marquee-chase 1.1s infinite; }
        .arcade-blink { animation: arcade-blink 1.2s steps(1) infinite; }
        .neon-title { animation: neon-flicker 4.5s infinite; }
      `}</style>
      {/* Ambient Backdrop */}
      <div
        className="fixed inset-0 opacity-40 pointer-events-none"
        style={{ background: 'radial-gradient(circle at 50% 40%, #3d2b1f 0%, #0a0806 80%)' }}
      />
      <div className="fixed inset-0 opacity-20 pointer-events-none bg-immersive-dots" />

      {/* ARCADE MARQUEE HEADER */}
      <header id="title-header" className="relative z-10 max-w-4xl mx-auto w-full px-1 pt-1">
        <div className="relative bg-black/90 border-4 border-[#d4af37] rounded-lg px-3 py-4 sm:py-6 text-center overflow-hidden shadow-[0_0_40px_rgba(212,175,55,0.35),inset_0_0_60px_rgba(0,0,0,0.9)]">
          {/* Chasing marquee bulbs — top row */}
          <div className="absolute top-1.5 left-3 right-3 flex justify-between pointer-events-none" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={`top-${i}`}
                className="marquee-bulb w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ffe9a8] text-[#ffd75e]"
                style={{ animationDelay: `${(i % 2) * 0.55}s` }}
              />
            ))}
          </div>
          {/* Chasing marquee bulbs — bottom row */}
          <div className="absolute bottom-1.5 left-3 right-3 flex justify-between pointer-events-none" aria-hidden>
            {Array.from({ length: 18 }).map((_, i) => (
              <span
                key={`bot-${i}`}
                className="marquee-bulb w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ffe9a8] text-[#ffd75e]"
                style={{ animationDelay: `${((i + 1) % 2) * 0.55}s` }}
              />
            ))}
          </div>

          <div className="flex items-center justify-between text-[#d4af37] font-arcade text-[8px] sm:text-[10px] px-1 mb-2">
            <span>1UP</span>
            <span className="tracking-widest">INSERT COIN</span>
            <span>HIGH SCORE</span>
          </div>

          <p className="font-arcade text-[#ff5d5d] text-[9px] sm:text-xs tracking-[0.25em] mb-2 sm:mb-3 drop-shadow-[0_0_8px_rgba(255,93,93,0.8)]">
            ★ CIVIL WAR ARCADE COMBAT ★
          </p>
          <h1 className="neon-title font-arcade text-3xl sm:text-5xl md:text-6xl text-[#ffe9a8] leading-tight drop-shadow-[0_0_18px_rgba(255,215,94,0.9)]">
            GETTYSBURG
          </h1>
          <p className="font-arcade text-[#7ba4db] text-[8px] sm:text-[10px] tracking-[0.2em] mt-2 sm:mt-3 drop-shadow-[0_0_8px_rgba(123,164,219,0.8)]">
            JULY 1-3, 1863
          </p>
          <p className="arcade-blink font-arcade text-white text-[10px] sm:text-sm mt-3 sm:mt-4 tracking-widest">
            ▸ PRESS SPACE TO START ◂
          </p>
        </div>
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
          onClick={() => {
            stopFactionMarchPreview();
            onOpenMultiplayer(selectedFaction, selectedClass);
          }}
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
          
          {/* Faction Enlistment — ARCADE VS PICKER */}
          <div>
            <h2 className="font-arcade text-center text-[#d4af37] text-xs sm:text-sm tracking-widest mb-3 drop-shadow-[0_0_10px_rgba(212,175,55,0.7)]">
              ★ CHOOSE YOUR SIDE ★
            </h2>

            <div className="relative grid grid-cols-2 gap-2 sm:gap-4">
              {/* UNION — player 1 blue */}
              <button
                type="button"
                id="btn-select-north"
                onClick={() => handleSelectFaction('NORTH')}
                onMouseEnter={() => previewFactionMarch('NORTH')}
                onMouseLeave={stopFactionMarchPreview}
                onFocus={() => previewFactionMarch('NORTH')}
                onBlur={stopFactionMarchPreview}
                className={`relative overflow-hidden rounded-lg border-4 p-3 sm:p-5 text-center transition-all cursor-pointer active:scale-[0.97] min-h-[150px] sm:min-h-[190px] flex flex-col items-center justify-center gap-1.5 ${
                  selectedFaction === 'NORTH'
                    ? 'border-[#4da6ff] bg-[#0a1a33] shadow-[0_0_28px_rgba(77,166,255,0.75),inset_0_0_30px_rgba(77,166,255,0.25)]'
                    : 'border-[#1d3c61] bg-black/70 opacity-60 hover:opacity-90'
                }`}
              >
                <span className="font-arcade text-[8px] sm:text-[10px] text-[#4da6ff] tracking-widest">1P</span>
                <UnionFlag className="w-20 sm:w-28 h-auto rounded-[2px] shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />
                <span className={`font-arcade text-lg sm:text-2xl ${selectedFaction === 'NORTH' ? 'text-white drop-shadow-[0_0_12px_rgba(77,166,255,1)]' : 'text-[#7ba4db]'}`}>
                  UNION
                </span>
                <span className="font-arcade text-[7px] sm:text-[8px] text-[#7ba4db]/80 leading-relaxed">
                  20TH MAINE
                  <br />
                  ARMY OF THE POTOMAC
                </span>
                <span className="font-arcade text-[7px] sm:text-[8px] text-[#9fc2ef]/70 tracking-widest">
                  ♪ THE BATTLE CRY OF FREEDOM
                </span>
                <span className={`font-arcade text-[8px] sm:text-[10px] mt-1 px-3 py-1.5 rounded border-2 ${
                  selectedFaction === 'NORTH'
                    ? 'bg-[#4da6ff] text-black border-white arcade-blink'
                    : 'border-[#4da6ff]/60 text-[#4da6ff]'
                }`}>
                  {selectedFaction === 'NORTH' ? '★ READY' : 'SELECT'}
                </span>
              </button>

              {/* VS badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none" aria-hidden>
                <div className="font-arcade text-sm sm:text-lg text-[#ffe9a8] bg-black border-[3px] border-[#d4af37] rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.8)] -rotate-12">
                  VS
                </div>
              </div>

              {/* CONFEDERATE — player 2 red */}
              <button
                type="button"
                id="btn-select-south"
                onClick={() => handleSelectFaction('SOUTH')}
                onMouseEnter={() => previewFactionMarch('SOUTH')}
                onMouseLeave={stopFactionMarchPreview}
                onFocus={() => previewFactionMarch('SOUTH')}
                onBlur={stopFactionMarchPreview}
                className={`relative overflow-hidden rounded-lg border-4 p-3 sm:p-5 text-center transition-all cursor-pointer active:scale-[0.97] min-h-[150px] sm:min-h-[190px] flex flex-col items-center justify-center gap-1.5 ${
                  selectedFaction === 'SOUTH'
                    ? 'border-[#ff5d5d] bg-[#330a0a] shadow-[0_0_28px_rgba(255,93,93,0.75),inset_0_0_30px_rgba(255,93,93,0.25)]'
                    : 'border-[#5a2a2a] bg-black/70 opacity-60 hover:opacity-90'
                }`}
              >
                <span className="font-arcade text-[8px] sm:text-[10px] text-[#ff5d5d] tracking-widest">2P</span>
                <ConfederateBattleFlag className="w-20 sm:w-28 h-auto rounded-[2px] shadow-[0_2px_10px_rgba(0,0,0,0.6)]" />
                <span className={`font-arcade text-lg sm:text-2xl ${selectedFaction === 'SOUTH' ? 'text-white drop-shadow-[0_0_12px_rgba(255,93,93,1)]' : 'text-[#ff8a8a]'}`}>
                  CSA
                </span>
                <span className="font-arcade text-[7px] sm:text-[8px] text-[#ff8a8a]/80 leading-relaxed">
                  15TH ALABAMA
                  <br />
                  ARMY OF N. VIRGINIA
                </span>
                <span className="font-arcade text-[7px] sm:text-[8px] text-[#ffb3b3]/70 tracking-widest">
                  ♪ DIXIE
                </span>
                <span className={`font-arcade text-[8px] sm:text-[10px] mt-1 px-3 py-1.5 rounded border-2 ${
                  selectedFaction === 'SOUTH'
                    ? 'bg-[#ff5d5d] text-black border-white arcade-blink'
                    : 'border-[#ff5d5d]/60 text-[#ff5d5d]'
                }`}>
                  {selectedFaction === 'SOUTH' ? '★ READY' : 'SELECT'}
                </span>
              </button>
            </div>

            {/* Compact toggle (kept for quick switching) */}
            <div className="grid grid-cols-2 gap-1.5 mt-2">
              <button
                type="button"
                id="btn-toggle-north"
                onClick={() => handleSelectFaction('NORTH')}
                className={`py-1.5 rounded font-arcade text-[8px] sm:text-[9px] tracking-widest cursor-pointer border-2 transition-all ${
                  selectedFaction === 'NORTH'
                    ? 'bg-[#4da6ff] text-black border-white'
                    : 'bg-transparent text-[#7ba4db] border-[#1d3c61] hover:border-[#4da6ff]'
                }`}
              >
                ★ UNION
              </button>
              <button
                type="button"
                id="btn-toggle-south"
                onClick={() => handleSelectFaction('SOUTH')}
                className={`py-1.5 rounded font-arcade text-[8px] sm:text-[9px] tracking-widest cursor-pointer border-2 transition-all ${
                  selectedFaction === 'SOUTH'
                    ? 'bg-[#ff5d5d] text-black border-white'
                    : 'bg-transparent text-[#ff8a8a] border-[#5a2a2a] hover:border-[#ff5d5d]'
                }`}
              >
                ⚔ CSA
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
                  stopFactionMarchPreview();
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
