import React, { useState, useEffect, useRef } from 'react';
import {
  Faction,
  CharacterClass,
  GameMode,
  CampaignMission,
  ScorePopup,
  KillFeedItem,
  HistoricalSettings,
  WeatherType,
  InteractivePrompt,
  MinimapEntity,
  FlagWaypoint,
  TicketState,
} from './types/game';
import { CAMPAIGN_MISSIONS } from './game/campaignData';
import { GettysburgEngine } from './game/threeEngine';
import { MultiplayerService } from './services/multiplayerService';
import { TitleScreen } from './components/TitleScreen';
import { GameHUD } from './components/GameHUD';
import { MultiplayerLobby } from './components/MultiplayerLobby';
import { ArmoryModal } from './components/ArmoryModal';
import { LeaderboardModal } from './components/LeaderboardModal';
import { PauseMenu } from './components/PauseMenu';
import { GameOverModal } from './components/GameOverModal';
import { MissionBriefingModal } from './components/MissionBriefingModal';
import { audio } from './services/audioService';

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('TITLE');
  const [faction, setFaction] = useState<Faction>('NORTH');
  const [charClass, setCharClass] = useState<CharacterClass>('INFANTRY');
  const [selectedMission, setSelectedMission] = useState<CampaignMission>(CAMPAIGN_MISSIONS[0]);

  // Mission Briefing & Cinematic Transition States
  const [showBriefingModal, setShowBriefingModal] = useState(false);
  const [screenTransitionFade, setScreenTransitionFade] = useState(false);

  // Sub-System States (Last Stand, Cannons, CTF, Minimap, Prompts)
  const [lastStandState, setLastStandState] = useState<{ active: boolean; remaining: number }>({ active: false, remaining: 0 });
  const [interactivePrompt, setInteractivePrompt] = useState<InteractivePrompt | null>(null);
  const [cannonState, setCannonState] = useState<{ isMounted: boolean; reloadProgress: number }>({ isMounted: false, reloadProgress: 1 });
  const [ticketState, setTicketState] = useState<TicketState>({ unionTickets: 500, confedTickets: 500 });
  const [minimapEntities, setMinimapEntities] = useState<MinimapEntity[]>([]);
  const [flagWaypoints, setFlagWaypoints] = useState<FlagWaypoint[]>([]);

  // Historical Accuracy Settings
  const [historicalSettings, setHistoricalSettings] = useState<HistoricalSettings>({
    weaponBehavior: 'ARCADE',
    authenticUniforms: true,
    historicalEvents: true,
    crtScanlines: true,
  });

  // HUD & Combat States
  const [health, setHealth] = useState(100);
  const [maxHealth, setMaxHealth] = useState(100);
  const [stamina, setStamina] = useState(100);
  const [canteenCharges, setCanteenCharges] = useState(3);
  const [weaponKey, setWeaponKey] = useState('springfield_1861');
  const [currentAmmo, setCurrentAmmo] = useState(1);
  const [reserveAmmo, setReserveAmmo] = useState(40);
  const [isReloading, setIsReloading] = useState(false);
  const [reloadProgress, setReloadProgress] = useState(0);
  const [isAimingADS, setIsAimingADS] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [kills, setKills] = useState(0);
  const [headshots, setHeadshots] = useState(0);
  const [bayonetKills, setBayonetKills] = useState(0);
  const [artilleryCharge, setArtilleryCharge] = useState(0);
  const [wave, setWave] = useState(1);
  const [totalWaves, setTotalWaves] = useState(3);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [killFeed, setKillFeed] = useState<KillFeedItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showArmory, setShowArmory] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Ability state
  const [abilityCooldown, setAbilityCooldown] = useState(0);
  const [abilityMaxCooldown, setAbilityMaxCooldown] = useState(18);
  const [abilityActiveTimer, setAbilityActiveTimer] = useState(0);
  const [abilityMaxDuration, setAbilityMaxDuration] = useState(6);

  // Dynamic Hit Marker & Atmosphere States
  const [hitMarker, setHitMarker] = useState<{ isHeadshot: boolean; damage: number; timestamp: number } | null>(null);
  const [atmosphere, setAtmosphere] = useState<{ timeOfDay: string; weather: WeatherType }>({
    timeOfDay: '09:30 AM • Morning Mist',
    weather: 'CLEAR',
  });

  // Engine & Container Refs
  const gameContainerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GettysburgEngine | null>(null);
  const mpServiceRef = useRef<MultiplayerService | null>(null);

  // Clean up score popups over time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      setScorePopups((prev) => prev.filter((p) => now - p.time < 1200));
    }, 200);
    return () => clearInterval(timer);
  }, []);

  const addScorePopup = (popup: ScorePopup) => {
    setScorePopups((prev) => [...prev.slice(-6), popup]);
  };

  const addKillFeedItem = (item: KillFeedItem) => {
    setKillFeed((prev) => [...prev.slice(-5), item]);
  };

  // Start Campaign Mode - communicate objectives first via MissionBriefingModal
  const handleStartCampaign = (chosenFaction: Faction, chosenClass: CharacterClass, mission: CampaignMission) => {
    setFaction(chosenFaction);
    setCharClass(chosenClass);
    setSelectedMission(mission);
    setWave(1);
    setTotalWaves(mission.waves);
    setScore(0);
    setKills(0);
    setHeadshots(0);
    setBayonetKills(0);
    setLastStandState({ active: false, remaining: 0 });
    setInteractivePrompt(null);
    setCannonState({ isMounted: false, reloadProgress: 1 });
    setTicketState({ unionTickets: 500, confedTickets: 500 });
    // Open the cadet mission briefing with objectives & win conditions!
    setShowBriefingModal(true);
  };

  // Commence battle from briefing modal with dramatic cinematic fade-to-black
  const handleCommenceBattle = () => {
    setScreenTransitionFade(true);
    setTimeout(() => {
      setShowBriefingModal(false);
      setGameMode('CAMPAIGN');
      setIsPaused(false);
      setTimeout(() => {
        setScreenTransitionFade(false);
      }, 350);
    }, 400);
  };

  // Open Multiplayer Lobby
  const handleOpenMultiplayer = (chosenFaction: Faction, chosenClass: CharacterClass) => {
    setFaction(chosenFaction);
    setCharClass(chosenClass);
    setGameMode('MULTIPLAYER');
  };

  // Join or Create Multiplayer Room
  const handleJoinMultiplayerRoom = (roomId: string, roomName: string, map: string, mode: 'TDM' | 'FFA') => {
    setGameMode('CAMPAIGN');
    setIsPaused(false);

    const mpService = new MultiplayerService({
      onRoomJoined: (data) => {
        console.log('Joined room:', data);
      },
      onPlayerJoined: (player) => {
        addKillFeedItem({
          id: `jf_${Date.now()}`,
          killer: player.name,
          victim: 'joined the line',
          killerFaction: player.faction,
          victimFaction: player.faction,
          weapon: 'Reinforcement',
          isHeadshot: false,
          isMelee: false,
          time: Date.now(),
        });
      },
      onPlayerLeft: (playerId) => {
        console.log('Player left:', playerId);
      },
      onPlayerMoved: (data) => {
        // MP delta
      },
      onWeaponFired: (data) => {
        audio.playMusketFire();
      },
      onDamageEvent: (data) => {
        if (data.isKill) {
          addKillFeedItem({
            id: `k_${Date.now()}`,
            killer: data.attackerId,
            victim: data.victimId,
            killerFaction: faction,
            victimFaction: faction === 'NORTH' ? 'SOUTH' : 'NORTH',
            weapon: data.weapon,
            isHeadshot: data.isHeadshot,
            isMelee: data.isMelee,
            time: Date.now(),
          });
        }
      },
      onPlayerRespawned: (data) => {},
      onArtilleryBarrage: (data) => {
        audio.playCannonBlast();
      },
      onChatMessage: (data) => {},
      onConnectionChange: (conn) => {
        console.log('MP Connection:', conn);
      },
    });

    mpService.connect(roomId, faction === 'NORTH' ? 'Union Soldier' : 'Rebel Soldier', faction, charClass, roomName);
    mpServiceRef.current = mpService;
  };

  // Initialize 3D Engine whenever entering active battle
  useEffect(() => {
    if (gameMode === 'CAMPAIGN' && gameContainerRef.current) {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }

      const engine = new GettysburgEngine(
        gameContainerRef.current,
        faction,
        charClass,
        selectedMission.id,
        true,
        historicalSettings,
        {
          onHealthChange: (h, mh) => {
            setHealth(h);
            setMaxHealth(mh);
          },
          onAmmoChange: (curr, res, reloading, prog) => {
            setCurrentAmmo(curr);
            setReserveAmmo(res);
            setIsReloading(reloading);
            setReloadProgress(prog);
          },
          onScoreChange: (s, c) => {
            setScore(s);
            setCombo(c);
          },
          onKill: (kfItem) => {
            addKillFeedItem(kfItem);
            setKills((k) => k + 1);
            if (kfItem.isHeadshot) setHeadshots((h) => h + 1);
            if (kfItem.isMelee) setBayonetKills((b) => b + 1);
          },
          onWaveComplete: (w, tw, speedBonus) => {
            setWave(w + 1);
            addScorePopup({
              id: `wave_${Date.now()}`,
              text: speedBonus ? `★ WAVE ${w} REPULSED! (+${speedBonus} SWIFT SPEED BONUS) ★` : `★ WAVE ${w} REPULSED! ★`,
              x: window.innerWidth / 2 - 120,
              y: window.innerHeight / 3,
              color: '#F59E0B',
              scale: 1.6,
              opacity: 1,
              time: Date.now(),
            });
          },
          onMissionWon: (stats) => {
            setGameMode('VICTORY');
          },
          onMissionFailed: () => {
            setGameMode('DEFEAT');
          },
          onAddScorePopup: (popup) => {
            addScorePopup(popup);
          },
          onArtilleryChargeChange: (charge) => {
            setArtilleryCharge(charge);
          },
          onCanteenChange: (cant) => {
            setCanteenCharges(cant);
          },
          onStaminaChange: (st) => {
            setStamina(st);
          },
          onAbilityChange: (cd, maxCd, activeTimer, maxDuration) => {
            setAbilityCooldown(cd);
            setAbilityMaxCooldown(maxCd);
            setAbilityActiveTimer(activeTimer);
            setAbilityMaxDuration(maxDuration);
          },
          onHitEnemy: (isHeadshot, dmg) => {
            setHitMarker({ isHeadshot, damage: dmg, timestamp: Date.now() });
          },
          onAtmosphereChange: (timeOfDay, weather) => {
            setAtmosphere({ timeOfDay, weather });
          },
          onLastStandChange: (active, remaining) => {
            setLastStandState({ active, remaining });
          },
          onInteractivePrompt: (prompt) => {
            setInteractivePrompt(prompt);
          },
          onCannonStateChange: (isMounted, reloadProgress) => {
            setCannonState({ isMounted, reloadProgress });
          },
          onTicketChange: (union, confed) => {
            setTicketState({ unionTickets: union, confedTickets: confed });
          },
          onMinimapUpdate: (entities, flags) => {
            setMinimapEntities(entities);
            setFlagWaypoints(flags);
          },
        }
      );

      engineRef.current = engine;
      setWeaponKey(engine.currentWeaponKey);

      const checkLock = () => {
        setIsLocked(document.pointerLockElement === gameContainerRef.current);
      };
      document.addEventListener('pointerlockchange', checkLock);

      return () => {
        document.removeEventListener('pointerlockchange', checkLock);
        if (engineRef.current) {
          engineRef.current.dispose();
          engineRef.current = null;
        }
        if (mpServiceRef.current) {
          mpServiceRef.current.disconnect();
          mpServiceRef.current = null;
        }
      };
    }
  }, [gameMode, faction, charClass, selectedMission, historicalSettings]);

  // Request pointer lock
  const handlePointerLockRequest = () => {
    if (gameContainerRef.current) {
      gameContainerRef.current.requestPointerLock();
      audio.init();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  };

  const handleResume = () => {
    setIsPaused(false);
    handlePointerLockRequest();
  };

  const handleRestart = () => {
    setScreenTransitionFade(true);
    setTimeout(() => {
      setIsPaused(false);
      setGameMode('CAMPAIGN');
      setLastStandState({ active: false, remaining: 0 });
      setInteractivePrompt(null);
      if (engineRef.current) {
        engineRef.current.startMission();
        handlePointerLockRequest();
      }
      setTimeout(() => {
        setScreenTransitionFade(false);
      }, 350);
    }, 400);
  };

  const handleQuitToTitle = () => {
    setScreenTransitionFade(true);
    setTimeout(() => {
      setIsPaused(false);
      setGameMode('TITLE');
      setShowBriefingModal(false);
      setLastStandState({ active: false, remaining: 0 });
      setInteractivePrompt(null);
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
      if (mpServiceRef.current) {
        mpServiceRef.current.disconnect();
        mpServiceRef.current = null;
      }
      setTimeout(() => {
        setScreenTransitionFade(false);
      }, 350);
    }, 400);
  };

  return (
    <div
      id="gettysburg-app-root"
      className={`relative w-full ${
        gameMode === 'CAMPAIGN' ? 'h-screen overflow-hidden' : 'min-h-screen overflow-y-auto'
      } bg-[#0a0806] text-stone-100 font-sans`}
    >
      {/* Retro Arcade CRT Scanline Overlay Filter */}
      {historicalSettings.crtScanlines && <div className="crt-overlay fixed inset-0 z-50 pointer-events-none" />}

      {/* Cinematic Screen Fade Transition (Fade to black in between screens) */}
      <div
        id="cinematic-fade-overlay"
        className={`fixed inset-0 z-50 bg-black pointer-events-none transition-opacity duration-300 ease-in-out ${
          screenTransitionFade ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* 1. Title Screen */}
      {gameMode === 'TITLE' && !showBriefingModal && (
        <TitleScreen
          onStartCampaign={handleStartCampaign}
          onOpenMultiplayer={handleOpenMultiplayer}
          onOpenArmory={() => setShowArmory(true)}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          historicalSettings={historicalSettings}
          onUpdateHistoricalSettings={setHistoricalSettings}
          crtScanlines={historicalSettings.crtScanlines}
          onToggleCrt={() => setHistoricalSettings({ ...historicalSettings, crtScanlines: !historicalSettings.crtScanlines })}
        />
      )}

      {/* 2. Cadet War Department Mission Briefing & Orders Dispatch Modal */}
      {showBriefingModal && (
        <MissionBriefingModal
          mission={selectedMission}
          faction={faction}
          charClass={charClass}
          onCommence={handleCommenceBattle}
        />
      )}

      {/* 3. Multiplayer Room Browser */}
      {gameMode === 'MULTIPLAYER' && (
        <MultiplayerLobby
          faction={faction}
          charClass={charClass}
          onJoinRoom={handleJoinMultiplayerRoom}
          onBack={() => setGameMode('TITLE')}
        />
      )}

      {/* 4. 3D Battlefield Engine Canvas */}
      {gameMode === 'CAMPAIGN' && (
        <div className="relative w-full h-full">
          <div
            id="three-game-container"
            ref={gameContainerRef}
            className="w-full h-full cursor-crosshair"
          />

          {/* First Person Arcade HUD Overlay */}
          <GameHUD
            faction={faction}
            charClass={charClass}
            health={health}
            maxHealth={maxHealth}
            stamina={stamina}
            canteenCharges={canteenCharges}
            weaponKey={weaponKey}
            currentAmmo={currentAmmo}
            reserveAmmo={reserveAmmo}
            isReloading={isReloading}
            reloadProgress={reloadProgress}
            isAimingADS={isAimingADS}
            score={score}
            combo={combo}
            artilleryCharge={artilleryCharge}
            wave={wave}
            totalWaves={totalWaves}
            scorePopups={scorePopups}
            killFeed={killFeed}
            isLocked={isLocked}
            abilityCooldown={abilityCooldown}
            abilityMaxCooldown={abilityMaxCooldown}
            abilityActiveTimer={abilityActiveTimer}
            abilityMaxDuration={abilityMaxDuration}
            hitMarker={hitMarker}
            atmosphere={atmosphere}
            lastStandState={lastStandState}
            interactivePrompt={interactivePrompt}
            cannonState={cannonState}
            ticketState={ticketState}
            minimapEntities={minimapEntities}
            flagWaypoints={flagWaypoints}
            campaignMission={selectedMission}
            onWeatherChange={(w) => engineRef.current?.setManualWeather(w)}
            onPointerLockRequest={handlePointerLockRequest}
            onPause={handlePause}
            onMelee={() => engineRef.current?.performMeleeAttack()}
            onReload={() => engineRef.current?.startReload()}
            onCanteen={() => engineRef.current?.drinkCanteen()}
            onArtillery={() => engineRef.current?.callArtilleryStrike()}
            onShoot={() => engineRef.current?.shootWeapon()}
            onAbility={() => engineRef.current?.triggerClassAbility()}
            onInteract={() => engineRef.current?.handleInteractKey()}
            onToggleADS={() => {
              if (engineRef.current) {
                engineRef.current.isAimingADS = !engineRef.current.isAimingADS;
                setIsAimingADS(engineRef.current.isAimingADS);
              }
            }}
            onTouchMove={(dx, dy) => engineRef.current?.handleTouchMove(dx, dy)}
            onTouchLook={(dx, dy) => engineRef.current?.handleTouchLook(dx, dy)}
          />

          {/* In-Game Pause Menu */}
          {isPaused && (
            <PauseMenu
              onResume={handleResume}
              onRestart={handleRestart}
              onQuitToTitle={handleQuitToTitle}
              crtScanlines={historicalSettings.crtScanlines}
              onToggleCrt={() => setHistoricalSettings({ ...historicalSettings, crtScanlines: !historicalSettings.crtScanlines })}
            />
          )}
        </div>
      )}

      {/* 5. Victory / Defeat Modal */}
      {(gameMode === 'VICTORY' || gameMode === 'DEFEAT') && (
        <GameOverModal
          isVictory={gameMode === 'VICTORY'}
          score={score}
          kills={kills}
          headshots={headshots}
          bayonetKills={bayonetKills}
          faction={faction}
          missionTitle={selectedMission.title}
          onRestart={handleRestart}
          onQuitToTitle={handleQuitToTitle}
        />
      )}

      {/* 6. Weapons Armory Modal */}
      {showArmory && (
        <ArmoryModal onClose={() => setShowArmory(false)} />
      )}

      {/* 7. High Scores Leaderboard Modal */}
      {showLeaderboard && (
        <LeaderboardModal onClose={() => setShowLeaderboard(false)} />
      )}
    </div>
  );
}
