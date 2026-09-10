import React, { useState, useRef, useEffect } from 'react';
import {
  Faction,
  CharacterClass,
  ScorePopup,
  KillFeedItem,
  WeatherType,
  MinimapEntity,
  FlagWaypoint,
  CampaignMission,
  InteractivePrompt,
  TicketState,
} from '../types/game';
import { HISTORICAL_WEAPONS } from '../game/weapons';
import { CHARACTER_CLASSES } from '../game/classesData';
import { Minimap } from './Minimap';
import {
  Shield,
  Crosshair,
  Zap,
  Award,
  Flame,
  Compass,
  RefreshCw,
  Volume2,
  Pause,
  Sparkles,
  Heart,
  CloudRain,
  Sun,
  CloudFog,
  Clock,
  Skull,
  Target,
  Flag,
  AlertTriangle,
} from 'lucide-react';

interface GameHUDProps {
  faction: Faction;
  charClass: CharacterClass;
  health: number;
  maxHealth: number;
  stamina: number;
  canteenCharges: number;
  weaponKey: string;
  currentAmmo: number;
  reserveAmmo: number;
  isReloading: boolean;
  reloadProgress: number;
  isAimingADS: boolean;
  score: number;
  combo: number;
  artilleryCharge: number;
  wave: number;
  totalWaves: number;
  scorePopups: ScorePopup[];
  killFeed: KillFeedItem[];
  isLocked: boolean;
  abilityCooldown: number;
  abilityMaxCooldown: number;
  abilityActiveTimer: number;
  abilityMaxDuration: number;
  hitMarker?: { isHeadshot: boolean; damage: number; timestamp: number } | null;
  atmosphere?: { timeOfDay: string; weather: WeatherType };
  onWeatherChange?: (w: WeatherType) => void;
  lastStandState?: { active: boolean; remaining: number };
  interactivePrompt?: InteractivePrompt | null;
  cannonState?: { isMounted: boolean; reloadProgress: number };
  ticketState?: TicketState;
  minimapEntities?: MinimapEntity[];
  flagWaypoints?: FlagWaypoint[];
  campaignMission?: CampaignMission;
  onPointerLockRequest: () => void;
  onPause: () => void;
  onMelee: () => void;
  onReload: () => void;
  onCanteen: () => void;
  onArtillery: () => void;
  onShoot: () => void;
  onToggleADS: () => void;
  onAbility: () => void;
  onInteract?: () => void;
  onTouchMove?: (x: number, y: number) => void;
  onTouchLook?: (dx: number, dy: number) => void;
}

export const GameHUD: React.FC<GameHUDProps> = ({
  faction,
  charClass,
  health,
  maxHealth,
  stamina,
  canteenCharges,
  weaponKey,
  currentAmmo,
  reserveAmmo,
  isReloading,
  reloadProgress,
  isAimingADS,
  score,
  combo,
  artilleryCharge,
  wave,
  totalWaves,
  scorePopups,
  killFeed,
  isLocked,
  abilityCooldown,
  abilityMaxCooldown,
  abilityActiveTimer,
  abilityMaxDuration,
  hitMarker,
  atmosphere,
  onWeatherChange,
  lastStandState,
  interactivePrompt,
  cannonState,
  ticketState,
  minimapEntities,
  flagWaypoints,
  campaignMission,
  onPointerLockRequest,
  onPause,
  onMelee,
  onReload,
  onCanteen,
  onArtillery,
  onShoot,
  onToggleADS,
  onAbility,
  onInteract,
  onTouchMove,
  onTouchLook,
}) => {
  const currentWeapon = HISTORICAL_WEAPONS[weaponKey] || HISTORICAL_WEAPONS['springfield_1861'];
  const currentClassDef = CHARACTER_CLASSES.find((c) => c.id === charClass) || CHARACTER_CLASSES[0];
  const healthPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
  const isLowHealth = healthPct < 30;

  // Active hit marker display state
  const [activeHitMarker, setActiveHitMarker] = useState<{ isHeadshot: boolean; damage: number } | null>(null);

  useEffect(() => {
    if (hitMarker && hitMarker.timestamp) {
      setActiveHitMarker({ isHeadshot: hitMarker.isHeadshot, damage: hitMarker.damage });
      const timer = setTimeout(() => {
        setActiveHitMarker(null);
      }, 240);
      return () => clearTimeout(timer);
    }
  }, [hitMarker]);

  // Touch Virtual Joystick tracking
  const lookTouchId = useRef<number | null>(null);
  const moveTouchId = useRef<number | null>(null);
  const lastLookPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const moveCenterPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      setIsTouchDevice(true);
    }
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.clientX < window.innerWidth / 2 && moveTouchId.current === null) {
        moveTouchId.current = touch.identifier;
        moveCenterPos.current = { x: touch.clientX, y: touch.clientY };
      } else if (touch.clientX >= window.innerWidth / 2 && lookTouchId.current === null) {
        lookTouchId.current = touch.identifier;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === moveTouchId.current && onTouchMove) {
        const dx = (touch.clientX - moveCenterPos.current.x) / 45;
        const dy = (touch.clientY - moveCenterPos.current.y) / 45;
        onTouchMove(Math.max(-1, Math.min(1, dx)), Math.max(-1, Math.min(1, dy)));
      } else if (touch.identifier === lookTouchId.current && onTouchLook) {
        const dx = touch.clientX - lastLookPos.current.x;
        const dy = touch.clientY - lastLookPos.current.y;
        lastLookPos.current = { x: touch.clientX, y: touch.clientY };
        onTouchLook(dx, dy);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      if (touch.identifier === moveTouchId.current) {
        moveTouchId.current = null;
        if (onTouchMove) onTouchMove(0, 0);
      } else if (touch.identifier === lookTouchId.current) {
        lookTouchId.current = null;
      }
    }
  };

  const abilityReady = abilityCooldown <= 0;
  const isAbilityActive = abilityActiveTimer > 0;

  return (
    <div
      id="game-hud-root"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-2 sm:p-5 select-none font-sans"
    >
      {/* Low Health Blood Vignette */}
      {isLowHealth && (
        <div className="absolute inset-0 bg-red-950/35 border-4 sm:border-8 border-red-800/50 animate-pulse pointer-events-none" />
      )}

      {/* Sniper Telescopic Scope Overlay when ADS with Whitworth */}
      {isAimingADS && weaponKey.includes('whitworth') && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[320px] sm:w-[500px] h-[320px] sm:h-[500px] rounded-full border-4 border-amber-900/80 bg-stone-900/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.92)] relative flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-stone-100/70" />
            <div className="absolute h-full w-[1px] bg-stone-100/70" />
            <div className="absolute w-20 sm:w-28 h-20 sm:h-28 rounded-full border border-stone-100/40" />
            <div className="absolute bottom-6 sm:bottom-12 text-[9px] sm:text-[10px] font-mono text-amber-300 tracking-widest uppercase">
              1863 HEXAGONAL WHITWORTH OPTIC • 500 YDS
            </div>
          </div>
        </div>
      )}

      {/* Standard Crosshair for non-scoped ADS */}
      {/* Standard Crosshair or Cannon Gunner Sighting Reticle */}
      {!isAimingADS && !cannonState?.isMounted && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="relative flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-amber-400/90 rounded-full shadow" />
            <div className="absolute -top-3 w-0.5 h-2 bg-stone-100/70" />
            <div className="absolute -bottom-3 w-0.5 h-2 bg-stone-100/70" />
            <div className="absolute -left-3 w-2 h-0.5 bg-stone-100/70" />
            <div className="absolute -right-3 w-2 h-0.5 bg-stone-100/70" />
          </div>
        </div>
      )}

      {/* Cannon Gunner Sighting Reticle and HUD */}
      {cannonState?.isMounted && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-25">
          <div className="relative w-64 h-64 sm:w-80 sm:h-80 rounded-full border-2 border-[#d4af37]/80 flex items-center justify-center">
            <div className="absolute w-full h-[1px] bg-[#d4af37]/70" />
            <div className="absolute h-full w-[1px] bg-[#d4af37]/70" />
            <div className="w-20 h-20 rounded-full border border-[#d4af37]/50" />
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
            <div className="absolute top-8 w-6 h-[1px] bg-[#d4af37]" />
            <div className="absolute top-16 w-10 h-[1px] bg-[#d4af37]" />
            <div className="absolute bottom-16 w-10 h-[1px] bg-[#d4af37]" />
            <div className="absolute bottom-8 w-6 h-[1px] bg-[#d4af37]" />
          </div>

          <div className="mt-6 flex flex-col items-center gap-1 bg-[#0a0806]/95 border-2 border-[#d4af37] px-5 py-2.5 rounded-lg shadow-2xl">
            <div className="text-xs sm:text-sm font-vintage font-black text-[#d4af37] tracking-wider uppercase flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-400" />
              12-POUNDER NAPOLEON ARTILLERY BATTERY
            </div>
            <div className="text-[11px] font-mono text-[#f4ecd8]">
              {cannonState.reloadProgress >= 1 ? (
                <span className="text-emerald-400 font-bold tracking-widest animate-pulse">
                  ★ CANISTER SHOT ARMED & READY ★
                </span>
              ) : (
                <span className="text-amber-400">
                  RELOADING CANISTER: {Math.round(cannonState.reloadProgress * 100)}%
                </span>
              )}
            </div>
            <div className="text-[9px] font-mono text-[#8b7355] mt-0.5">
              [LEFT CLICK] FIRE CANISTER &bull; [E] DISMOUNT CANNON
            </div>
          </div>
        </div>
      )}

      {/* Last Stand Heroic 5-second Survival Overlay */}
      {lastStandState?.active && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-40 bg-red-950/40 border-8 border-red-600 animate-pulse">
          <div className="bg-[#0a0806]/95 border-4 border-red-600 rounded-xl p-4 sm:p-6 shadow-[0_0_50px_rgba(239,68,68,0.8)] flex flex-col items-center gap-2 text-center max-w-md animate-bounce">
            <div className="flex items-center gap-2 text-red-500 font-vintage font-black text-xl sm:text-2xl tracking-widest uppercase">
              <AlertTriangle className="w-7 h-7 text-red-500" />
              LAST STAND! INCAPACITATED!
            </div>
            <p className="text-xs sm:text-sm font-sans font-bold text-stone-200">
              LAND A KILL WITHIN <span className="text-red-400 font-mono font-black text-lg">{lastStandState.remaining.toFixed(1)}s</span> TO SURVIVE!
            </p>
            <div className="w-full h-2.5 bg-stone-900 rounded-full overflow-hidden border border-red-500 mt-1">
              <div
                className="h-full bg-red-600 transition-all duration-75"
                style={{ width: `${(lastStandState.remaining / 5.0) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Interactive Proximity Action Prompt [E] */}
      {interactivePrompt && !cannonState?.isMounted && (
        <div className="absolute bottom-24 sm:bottom-28 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-lg bg-[#0a0806]/95 border-2 border-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.4)] animate-pulse pointer-events-auto z-30">
          <button
            onClick={onInteract}
            className="px-2 py-0.5 rounded bg-gradient-to-b from-[#f4ecd8] to-[#d4af37] text-[#0a0806] font-mono font-black text-xs sm:text-sm shadow cursor-pointer active:scale-95"
          >
            [{interactivePrompt.key}]
          </button>
          <span className="font-vintage font-bold text-xs sm:text-sm text-[#f4ecd8] uppercase tracking-wider">
            {interactivePrompt.action}
          </span>
          {interactivePrompt.distance > 0 && (
            <span className="text-[10px] font-mono text-[#8b7355]">
              ({interactivePrompt.distance}m)
            </span>
          )}
        </div>
      )}

      {/* Visual Hit Marker System */}
      {activeHitMarker && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div
            className={`relative flex items-center justify-center transition-all duration-75 ${
              activeHitMarker.isHeadshot ? 'scale-125' : 'scale-100'
            }`}
          >
            <svg
              width={activeHitMarker.isHeadshot ? "52" : "38"}
              height={activeHitMarker.isHeadshot ? "52" : "38"}
              viewBox="0 0 48 48"
              className="animate-in zoom-in-75 duration-75"
            >
              <line
                x1="11" y1="11" x2="19" y2="19"
                stroke={activeHitMarker.isHeadshot ? "#FFD700" : "#FFFFFF"}
                strokeWidth={activeHitMarker.isHeadshot ? "4" : "3"}
                strokeLinecap="round"
              />
              <line
                x1="37" y1="11" x2="29" y2="19"
                stroke={activeHitMarker.isHeadshot ? "#FFD700" : "#FFFFFF"}
                strokeWidth={activeHitMarker.isHeadshot ? "4" : "3"}
                strokeLinecap="round"
              />
              <line
                x1="11" y1="37" x2="19" y2="29"
                stroke={activeHitMarker.isHeadshot ? "#FFD700" : "#FFFFFF"}
                strokeWidth={activeHitMarker.isHeadshot ? "4" : "3"}
                strokeLinecap="round"
              />
              <line
                x1="37" y1="37" x2="29" y2="29"
                stroke={activeHitMarker.isHeadshot ? "#FFD700" : "#FFFFFF"}
                strokeWidth={activeHitMarker.isHeadshot ? "4" : "3"}
                strokeLinecap="round"
              />
            </svg>

            {activeHitMarker.isHeadshot && (
              <div className="absolute -top-7 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/90 border border-[#FFD700] text-[#FFD700] text-[9px] font-mono font-black tracking-widest uppercase shadow-lg whitespace-nowrap">
                <Skull className="w-3 h-3 text-[#FFD700]" /> HEADSHOT!
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pointer Lock Prompt if on desktop and mouse is not locked */}
      {!isLocked && !isTouchDevice && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0a0806]/80 backdrop-blur-xs z-30 pointer-events-auto p-4">
          <button
            id="btn-resume-lock"
            onClick={onPointerLockRequest}
            className="px-6 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] font-vintage font-black text-lg sm:text-xl rounded shadow-2xl border-2 border-[#d4af37] transform active:scale-95 transition-all flex items-center gap-3 cursor-pointer tracking-wider text-center"
          >
            <Crosshair className="w-6 h-6 text-[#0a0806] shrink-0" />
            CLICK TO AIM & ENGAGE
          </button>
        </div>
      )}

      {/* TOP BAR: Header, Wave, Score, Killfeed */}
      <header id="hud-top-bar" className="flex flex-wrap items-start justify-between w-full gap-2">
        {/* Top Left: Wave & Faction / Class Info & Dynamic Objective Tracker */}
        <div className="flex flex-col gap-1.5 bg-[#0a0806]/90 backdrop-blur-md border border-[#3d2b1f] rounded-lg p-2 sm:p-2.5 shadow-2xl max-w-sm">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              id="btn-hud-pause"
              onClick={onPause}
              className="pointer-events-auto p-1.5 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] rounded text-[#d4af37] transition-all cursor-pointer border border-[#3d2b1f]"
              title="Pause Game"
            >
              <Pause className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`text-[11px] sm:text-xs font-vintage font-bold tracking-wide ${faction === 'NORTH' ? 'text-[#7ba4db]' : 'text-[#a0a0a0]'}`}>
                  {faction === 'NORTH' ? 'UNION' : 'CONFEDERATE'} • {currentClassDef.title}
                </span>
                <span className="text-[9px] sm:text-[10px] font-sans font-bold tracking-wider px-1.5 py-0.5 bg-[#3d2b1f] border border-[#d4af37]/40 text-[#d4af37] rounded">
                  WAVE {wave}/{totalWaves}
                </span>
              </div>
              <div className="text-[9px] font-mono text-[#8b7355]">
                GETTYSBURG 1863
              </div>
            </div>
          </div>

          {/* Dynamic Time-of-Day & Atmospheric Weather Banner */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#3d2b1f]/70 text-[10px] font-mono text-[#f4ecd8]/90">
            <div className="flex items-center gap-1.5 truncate">
              <Clock className="w-3 h-3 text-[#d4af37] shrink-0" />
              <span className="truncate">{atmosphere?.timeOfDay || '09:30 AM • Morning Mist'}</span>
            </div>

            {/* Quick Weather Atmosphere Selector */}
            <div className="flex items-center gap-1 pointer-events-auto shrink-0">
              <button
                onClick={() => onWeatherChange?.('CLEAR')}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors text-[9px] cursor-pointer ${
                  atmosphere?.weather === 'CLEAR'
                    ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/60'
                    : 'text-stone-400 hover:text-stone-200 border border-transparent'
                }`}
                title="Clear Skies"
              >
                <Sun className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
              <button
                onClick={() => onWeatherChange?.('LIGHT_RAIN')}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors text-[9px] cursor-pointer ${
                  atmosphere?.weather === 'LIGHT_RAIN'
                    ? 'bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/60'
                    : 'text-stone-400 hover:text-stone-200 border border-transparent'
                }`}
                title="Atmospheric Rain"
              >
                <CloudRain className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Rain</span>
              </button>
              <button
                onClick={() => onWeatherChange?.('HEAVY_FOG')}
                className={`flex items-center gap-0.5 px-1 py-0.5 rounded transition-colors text-[9px] cursor-pointer ${
                  atmosphere?.weather === 'HEAVY_FOG'
                    ? 'bg-purple-500/30 text-purple-300 font-bold border border-purple-500/60'
                    : 'text-stone-400 hover:text-stone-200 border border-transparent'
                }`}
                title="Heavy Fog"
              >
                <CloudFog className="w-2.5 h-2.5" />
                <span className="hidden sm:inline">Fog</span>
              </button>
            </div>
          </div>

          {/* Dynamic Mission Objective Tracker */}
          <div className="flex flex-col gap-1 pt-1.5 border-t border-[#3d2b1f]/80">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#d4af37] font-bold flex items-center gap-1 uppercase tracking-wider">
                <Target className="w-3 h-3 text-[#d4af37]" /> MISSION DIRECTIVE:
              </span>
              <span className="text-[#8b7355] text-[9px] font-sans truncate max-w-[120px]">
                {campaignMission?.title || 'BATTLE OF GETTYSBURG'}
              </span>
            </div>
            <div className="bg-[#1a120b]/80 border border-[#d4af37]/30 rounded px-2 py-1 text-[11px] font-serif text-[#f4ecd8] leading-tight">
              {faction === 'NORTH'
                ? (campaignMission?.unionObjective || 'Hold the Line & Repulse Confederate Assaulting Brigades!')
                : (campaignMission?.confederateObjective || 'Advance on the Ridge & Break Through the Union Line!')}
            </div>

            {/* CTF Ticket Status Bar */}
            {ticketState && (
              <div className="flex flex-col gap-1 mt-0.5 pt-1 border-t border-[#3d2b1f]/60 text-[10px] font-mono">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-[#7ba4db] font-bold">UNION: {ticketState.unionTickets}</span>
                  <span className="text-[#d4af37] flex items-center gap-0.5">
                    <Flag className="w-2.5 h-2.5" />
                    {flagWaypoints?.filter((f) => f.controllingFaction === 'NORTH').length || 0} vs {flagWaypoints?.filter((f) => f.controllingFaction === 'SOUTH').length || 0} FLAGS
                  </span>
                  <span className="text-red-400 font-bold">REBEL: {ticketState.confedTickets}</span>
                </div>
                <div className="w-full h-1.5 bg-[#0a0806] rounded-full overflow-hidden flex border border-[#3d2b1f]">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{
                      width: `${(ticketState.unionTickets / ((ticketState.unionTickets + ticketState.confedTickets) || 1)) * 100}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-600 transition-all duration-300"
                    style={{
                      width: `${(ticketState.confedTickets / ((ticketState.unionTickets + ticketState.confedTickets) || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Top Center: Arcade Score & Combo Meter */}
        <div className="bg-[#0a0806]/95 border border-[#d4af37]/70 rounded-lg px-3 sm:px-5 py-1.5 sm:py-2 shadow-2xl flex items-center gap-2 sm:gap-3">
          <Award className="w-4 h-4 sm:w-5 sm:h-5 text-[#d4af37]" />
          <div>
            <div className="text-[8px] sm:text-[9px] font-sans tracking-widest text-[#8b7355] uppercase">SCORE</div>
            <div className="text-base sm:text-xl font-vintage font-black text-[#f4ecd8] tracking-wider leading-none">
              {score.toLocaleString()}
            </div>
          </div>
          {combo > 1 && (
            <div className="px-1.5 sm:px-2 py-0.5 bg-[#d4af37] text-[#0a0806] font-sans text-[10px] sm:text-xs font-black rounded animate-bounce tracking-tight">
              x{combo} COMBO!
            </div>
          )}
        </div>

        {/* Top Right: Minimap & Killfeed */}
        <div className="flex flex-col items-end gap-2 pointer-events-none">
          {minimapEntities && minimapEntities.length > 0 && (
            <div className="pointer-events-auto">
              <Minimap
                playerPos={{
                  x: minimapEntities.find((e) => e.type === 'PLAYER')?.x || 0,
                  z: minimapEntities.find((e) => e.type === 'PLAYER')?.z || 0,
                }}
                playerYaw={minimapEntities.find((e) => e.type === 'PLAYER')?.yaw || 0}
                entities={minimapEntities}
                flagPoints={flagWaypoints}
                playerFaction={faction}
                size={144}
                mapRange={65}
              />
            </div>
          )}

          {/* Killfeed */}
          <div className="hidden sm:flex flex-col gap-1 max-w-xs items-end">
            {killFeed.slice(-3).map((kf) => (
              <div
                key={kf.id}
                className="bg-[#0a0806]/90 border border-[#3d2b1f] rounded px-2 py-0.5 text-[10px] font-mono shadow flex items-center gap-1.5"
              >
                <span className={`font-bold ${kf.killerFaction === 'NORTH' ? 'text-[#7ba4db]' : 'text-[#a0a0a0]'}`}>
                  {kf.killer}
                </span>
                <span className="text-[#8b7355]">[{kf.weapon}]</span>
                <span className={`font-bold ${kf.victimFaction === 'NORTH' ? 'text-[#7ba4db]' : 'text-[#a0a0a0]'}`}>
                  {kf.victim}
                </span>
                {kf.isHeadshot && <span className="text-[#d4af37]">🎯</span>}
                {kf.isMelee && <span className="text-red-400">🗡️</span>}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* Floating Score Popups */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {scorePopups.map((popup) => (
          <div
            key={popup.id}
            style={{
              left: `${popup.x}px`,
              top: `${popup.y}px`,
              color: popup.color,
              transform: `scale(${popup.scale})`,
              opacity: popup.opacity,
            }}
            className="absolute font-vintage font-black text-xs sm:text-sm drop-shadow-[0_2px_4px_rgba(0,0,0,1)] transition-all duration-500 ease-out"
          >
            {popup.text}
          </div>
        ))}
      </div>

      {/* Mobile Touch Floating Action Buttons */}
      {isTouchDevice && (
        <div className="absolute inset-0 pointer-events-none flex justify-between items-end p-4 pb-28">
          {/* Left Virtual Pad Area */}
          <div className="w-32 h-32 rounded-full border-2 border-stone-600/30 bg-stone-900/20 pointer-events-none flex items-center justify-center text-[10px] text-stone-400 font-mono">
            TOUCH MOVE
          </div>

          {/* Right Touch Action Cluster */}
          <div className="flex flex-col gap-2 pointer-events-auto items-end">
            <div className="flex gap-2">
              <button
                onClick={onToggleADS}
                className="w-12 h-12 rounded-full bg-[#3d2b1f]/80 border border-[#d4af37] text-white font-bold text-xs flex items-center justify-center active:scale-95"
              >
                ADS
              </button>
              <button
                onClick={onMelee}
                className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500 text-white font-bold text-xs flex items-center justify-center active:scale-95"
              >
                🗡️
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onReload}
                className="w-12 h-12 rounded-full bg-[#3d2b1f]/80 border border-amber-500 text-amber-300 font-bold text-[10px] flex items-center justify-center active:scale-95"
              >
                RELOAD
              </button>
              <button
                onClick={onShoot}
                className="w-16 h-16 rounded-full bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] border-2 border-[#d4af37] text-[#0a0806] font-black text-sm flex items-center justify-center shadow-lg active:scale-95"
              >
                FIRE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM BAR: Health, Class Ability, Artillery, Weapon Status */}
      <footer id="hud-bottom-bar" className="flex flex-wrap items-end justify-between w-full gap-2">
        {/* Bottom Left: Health Bar, Stamina & Canteen */}
        <div className="flex flex-col gap-1.5 bg-[#0a0806]/90 backdrop-blur-md border border-[#3d2b1f] rounded-lg p-2.5 shadow-2xl min-w-[180px] sm:min-w-[220px]">
          <div className="flex items-center justify-between text-[11px] font-bold font-vintage">
            <span className="flex items-center gap-1 text-[#f4ecd8]">
              <Shield className="w-3.5 h-3.5 text-red-500" /> HEALTH
            </span>
            <span className={healthPct < 30 ? 'text-red-400 font-mono font-bold' : 'text-[#8b7355] font-mono'}>
              {Math.round(health)}/{maxHealth}
            </span>
          </div>

          {/* Health Gauge */}
          <div className="w-full h-2.5 sm:h-3 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden relative">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                healthPct > 50
                  ? 'bg-gradient-to-r from-emerald-700 to-emerald-500'
                  : healthPct > 25
                  ? 'bg-gradient-to-r from-amber-700 to-[#d4af37]'
                  : 'bg-gradient-to-r from-red-800 to-red-500 animate-pulse'
              }`}
              style={{ width: `${healthPct}%` }}
            />
          </div>

          {/* Stamina Gauge */}
          <div className="w-full h-1 bg-[#0a0806] rounded-full overflow-hidden border border-[#3d2b1f]">
            <div
              className="h-full bg-blue-600 transition-all duration-100"
              style={{ width: `${stamina}%` }}
            />
          </div>

          {/* Canteen Recovery Button */}
          <div className="flex items-center justify-between pt-1 border-t border-[#3d2b1f] text-[10px]">
            <div className="font-mono text-[#8b7355]">
              CANTEEN [Q]: <span className="font-bold text-[#d4af37]">{canteenCharges}💧</span>
            </div>
            <button
              id="btn-use-canteen"
              onClick={onCanteen}
              disabled={canteenCharges <= 0 || health >= maxHealth}
              className="pointer-events-auto px-2 py-0.5 bg-[#3d2b1f]/60 hover:bg-[#3d2b1f] disabled:opacity-40 text-[9px] font-bold text-[#d4af37] rounded border border-[#3d2b1f] cursor-pointer"
            >
              DRINK (+45)
            </button>
          </div>
        </div>

        {/* Bottom Center: Role Special Ability & Artillery Battery */}
        <div className="flex flex-col items-center gap-1.5">
          {/* Class Special Ability Card */}
          <div className="bg-[#0a0806]/95 border border-[#3d2b1f] rounded-lg p-2 shadow-2xl flex items-center gap-2 min-w-[200px] sm:min-w-[220px]">
            <button
              id="btn-class-ability"
              onClick={onAbility}
              disabled={!abilityReady}
              className={`pointer-events-auto flex-1 py-1.5 px-2 rounded font-vintage font-bold text-[10px] sm:text-xs transition-all flex items-center justify-center gap-1.5 ${
                isAbilityActive
                  ? 'bg-blue-600 border border-blue-300 text-white animate-pulse shadow-md'
                  : abilityReady
                  ? 'bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] border border-[#d4af37] cursor-pointer'
                  : 'bg-[#3d2b1f]/40 text-[#8b7355] opacity-60 border border-[#3d2b1f] cursor-not-allowed'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isAbilityActive
                ? `ACTIVE (${Math.ceil(abilityActiveTimer)}s)`
                : abilityReady
                ? `${currentClassDef.abilityName} [G]`
                : `COOLDOWN (${Math.ceil(abilityCooldown)}s)`}
            </button>
          </div>

          {/* Napoleon 12-Pounder Artillery Call-in */}
          <div className="bg-[#0a0806]/95 border border-[#3d2b1f] rounded-lg p-2 shadow-2xl flex flex-col items-center min-w-[200px] sm:min-w-[220px]">
            <div className="flex items-center justify-between w-full text-[9px] font-vintage font-bold text-[#d4af37] mb-1">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3 text-[#d4af37]" /> NAPOLEON 12-PDR CANNON
              </span>
              <span className="font-mono">{Math.round(artilleryCharge)}%</span>
            </div>

            <div className="w-full h-1.5 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden mb-1.5">
              <div
                className="h-full bg-gradient-to-r from-[#8b7355] via-[#d4af37] to-[#f4ecd8] transition-all duration-300"
                style={{ width: `${artilleryCharge}%` }}
              />
            </div>

            <button
              id="btn-call-artillery"
              onClick={onArtillery}
              disabled={artilleryCharge < 100}
              className={`pointer-events-auto w-full py-1 px-2 rounded font-vintage font-bold text-[10px] transition-all ${
                artilleryCharge >= 100
                  ? 'bg-gradient-to-b from-[#f4ecd8] via-[#8b7355] to-[#3d2b1f] hover:brightness-110 text-[#0a0806] border border-[#d4af37] shadow animate-bounce cursor-pointer'
                  : 'bg-[#3d2b1f]/40 text-[#8b7355] opacity-50 cursor-not-allowed border border-[#3d2b1f]'
              }`}
            >
              {artilleryCharge >= 100 ? '💣 FIRE ARTILLERY VOLLEY [E]' : 'CHARGING CANNONS...'}
            </button>
          </div>
        </div>

        {/* Bottom Right: Weapon & Paper Cartridge Ammo Status */}
        <div className="flex flex-col gap-1.5 bg-[#0a0806]/90 backdrop-blur-md border border-[#3d2b1f] rounded-lg p-2.5 shadow-2xl min-w-[180px] sm:min-w-[220px]">
          <div className="flex items-center justify-between">
            <span className="font-vintage font-bold text-xs sm:text-sm text-[#f4ecd8] truncate">{currentWeapon.name}</span>
            <span className="text-[9px] font-mono text-[#8b7355]">{currentWeapon.caliber}</span>
          </div>

          {/* Ammo Count */}
          <div className="flex items-baseline justify-between">
            <div className="text-2xl sm:text-3xl font-arcade text-[#f4ecd8]">
              {currentAmmo} <span className="text-xs font-mono text-[#8b7355]">/ {reserveAmmo}</span>
            </div>
            <button
              id="btn-hud-reload"
              onClick={onReload}
              disabled={isReloading || currentAmmo >= currentWeapon.magazineSize || reserveAmmo <= 0}
              className="pointer-events-auto px-2.5 py-1 bg-[#3d2b1f] hover:bg-[#8b7355]/50 text-[#d4af37] border border-[#d4af37]/50 rounded text-[10px] font-mono disabled:opacity-40 cursor-pointer"
            >
              {isReloading ? 'RELOADING...' : 'RELOAD [R]'}
            </button>
          </div>

          {/* Ramrod Reload Progress Bar */}
          {isReloading && (
            <div className="flex flex-col gap-0.5 mt-0.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-[#d4af37]">
                <span>RAMROD & POWDER:</span>
                <span>{Math.round(reloadProgress * 100)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#0a0806] rounded-full border border-[#3d2b1f] overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-[#8b7355] to-[#d4af37] transition-all duration-75"
                  style={{ width: `${reloadProgress * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};
