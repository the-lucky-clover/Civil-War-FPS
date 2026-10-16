import * as THREE from 'three';
import {
  Faction,
  CharacterClass,
  EnemyNPC,
  ScorePopup,
  KillFeedItem,
  HistoricalSettings,
  WeatherType,
  FlagWaypoint,
  MinimapEntity,
  OfficerOrder,
} from '../types/game';
import { audio } from '../services/audioService';
import { voiceEngine } from '../services/voiceEngine';
import { HISTORICAL_WEAPONS } from './weapons';
import { CHARACTER_CLASSES } from './classesData';
import {
  DrillState,
  DrillStationId,
  CannonAmmoId,
  CANNON_AMMO,
  AMMO_ORDER,
  DRILL_STATIONS,
  stationDef,
  nextStation,
  freshDrillState,
  COOKOFF_CHANCE,
  COOKOFF_DAMAGE,
} from './cannonDrill';
import {
  sampleGettysburgWeather,
  sunPositionForHour,
  formatBattleHour,
} from './gettysburgWeather';

export interface GameEngineCallbacks {
  onHealthChange: (health: number, maxHealth: number) => void;
  onAmmoChange: (current: number, reserve: number, isReloading: boolean, reloadProgress: number) => void;
  onScoreChange: (score: number, combo: number) => void;
  onRankChange?: (rankIndex: number, rankName: string, xp: number) => void;
  onKill: (killItem: KillFeedItem) => void;
  onWaveComplete: (wave: number, totalWaves: number, speedBonus?: number) => void;
  onMissionWon: (stats: any) => void;
  onMissionFailed: () => void;
  onMissionSuccess?: () => void;
  onAddScorePopup: (popup: ScorePopup) => void;
  onArtilleryChargeChange: (charge: number) => void;
  onCanteenChange: (canteen: number) => void;
  onStaminaChange: (stamina: number) => void;
  onAbilityChange: (cooldown: number, maxCooldown: number, activeTimer: number, maxDuration: number) => void;
  onHistoricalDispatch?: (title: string, text: string) => void;
  onHitEnemy?: (isHeadshot: boolean, damage: number) => void;
  onAtmosphereChange?: (timeOfDay: string, weather: WeatherType) => void;
  onLastStandChange?: (isActive: boolean, timeLeft: number) => void;
  onInteractivePrompt?: (prompt: { action: string; key: string; distance: number } | null) => void;
  onCannonStateChange?: (mounted: boolean, reloadProgress: number) => void;
  /** Crew-drill state for the manned piece (station, progress, ammo). */
  onCannonDrillState?: (drill: DrillState) => void;
  /** A remote multiplayer soldier was caught by our cannon fire. */
  onRemotePlayerCannonHit?: (playerId: string, damage: number, weaponLabel: string) => void;
  onLocalCannonFire?: (data: {
    cannonId: string;
    muzzlePos: number[];
    direction: number[];
    rotY: number;
    pitch: number;
    ammo: CannonAmmoId;
    /** Impact point for shell/solid shot (computed by the firer). */
    impactPos?: number[];
  }) => void;
  onTicketChange?: (union: number, confed: number) => void;
  onMinimapUpdate?: (entities: MinimapEntity[], flags: FlagWaypoint[]) => void;
  onOfficerOrder?: (order: OfficerOrder) => void;
}

export const VETERAN_RANKS: { name: string; xp: number }[] = [
  { name: 'Private', xp: 0 },
  { name: 'Corporal', xp: 300 },
  { name: 'Sergeant', xp: 800 },
  { name: 'First Sergeant', xp: 1500 },
  { name: 'Sergeant Major', xp: 2500 },
  { name: 'Second Lieutenant', xp: 3800 },
  { name: 'First Lieutenant', xp: 5400 },
  { name: 'Captain', xp: 7500 },
  { name: 'Major', xp: 10000 },
  { name: 'Colonel', xp: 13000 },
];
const VETERAN_SAVE_KEY = 'gettysburg-veteran-v1';

export class GettysburgEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private skyDome!: THREE.Mesh;
  private skyDomeMat!: THREE.ShaderMaterial;

  // Viewmodels & Arms
  private gunPivot: THREE.Group;
  private musketMesh: THREE.Group;
  private muzzleFlashMesh: THREE.Mesh;
  private muzzleFlashLight: THREE.PointLight;
  private bayonetMesh: THREE.Mesh;

  // Atmosphere, Dynamic Time of Day & Weather System
  public weatherType: WeatherType = 'CLEAR';
  public timeOfDayTitle: string = '09:30 AM';
  private currentSkyColor: THREE.Color = new THREE.Color(0x87CEEB);
  private targetSkyColor: THREE.Color = new THREE.Color(0x87CEEB);
  private currentFogColor: THREE.Color = new THREE.Color(0xD8CBB5);
  private targetFogColor: THREE.Color = new THREE.Color(0xD8CBB5);
  private currentFogDensity: number = 0.012;
  private targetFogDensity: number = 0.012;
  private currentSunColor: THREE.Color = new THREE.Color(0xFFF8E7);
  private targetSunColor: THREE.Color = new THREE.Color(0xFFF8E7);
  private currentSunIntensity: number = 1.2;
  private targetSunIntensity: number = 1.2;
  private currentSunPosition: THREE.Vector3 = new THREE.Vector3(50, 80, -40);
  private targetSunPosition: THREE.Vector3 = new THREE.Vector3(50, 80, -40);
  private currentHemiSkyColor: THREE.Color = new THREE.Color(0x87CEEB);
  private targetHemiSkyColor: THREE.Color = new THREE.Color(0x87CEEB);
  private currentHemiGroundColor: THREE.Color = new THREE.Color(0x3d352a);
  private targetHemiGroundColor: THREE.Color = new THREE.Color(0x3d352a);
  private currentHemiIntensity: number = 0.75;
  private targetHemiIntensity: number = 0.75;

  // Weather System
  private rainPoints: THREE.Points | null = null;
  private rainPositions: Float32Array | null = null;
  private thunderTimer: number = 20;

  // Historical Gettysburg weather — battle day, hour, temperature, wind
  public battleDay: number = 1;
  public battleHour: number = 9.5;
  public tempF: number = 72;
  public windMph: number = 2;
  public windVec: THREE.Vector3 = new THREE.Vector3(0, 0, -1); // southerly breeze → drifts north (−z)
  private battleHaze: number = 0; // extra fog density from cannon smoke, set per wave
  private battleTitle: string = '';
  private stormAnnounced: boolean = false;
  private useHistoricalWeather: boolean = true;

  // Camera Shake & Trauma System
  public cameraTrauma: number = 0;
  private cameraShakeOffset: THREE.Vector3 = new THREE.Vector3();
  private cameraShakePitch: number = 0;
  private cameraShakeYaw: number = 0;
  private cameraShakeRoll: number = 0;

  // Footstep Audio System
  private stepTimer: number = 0;
  private boulderLocations: { x: number; z: number; radius: number }[] = [];

  // Player & Controls State
  public playerFaction: Faction = 'NORTH';
  public playerClass: CharacterClass = 'INFANTRY';
  public isLocked: boolean = false;
  public health: number = 100;
  public maxHealth: number = 100;
  public stamina: number = 100;
  public canteenCharges: number = 3;
  public score: number = 0;
  public combo: number = 1;
  public comboTimer: number = 0;
  public maxCombo: number = 1;
  public kills: number = 0;
  public headshots: number = 0;
  public bayonetKills: number = 0;
  public veteranXP: number = 0;
  public veteranRank: number = 0;

  /** Load persisted veteran progress (local to this browser). */
  public loadVeteranProgress(): void {
    try {
      const raw = localStorage.getItem(VETERAN_SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { xp?: number };
      this.veteranXP = Math.max(0, data.xp || 0);
      this.veteranRank = this.rankIndexForXP(this.veteranXP);
    } catch { /* corrupted save — start fresh as a green private */ }
  }

  private rankIndexForXP(xp: number): number {
    let idx = 0;
    for (let i = 0; i < VETERAN_RANKS.length; i++) {
      if (xp >= VETERAN_RANKS[i].xp) idx = i;
    }
    return idx;
  }

  /** Drill speed of a veteran: green privates fumble, old hands load 3 rounds a minute. */
  public veteranReloadScale(): number {
    return 1 - this.veteranRank * 0.03;
  }

  private awardVeteranXP(amount: number): void {
    const before = this.veteranRank;
    this.veteranXP += amount;
    this.veteranRank = this.rankIndexForXP(this.veteranXP);
    try {
      localStorage.setItem(VETERAN_SAVE_KEY, JSON.stringify({ xp: this.veteranXP }));
    } catch { /* storage unavailable — rank still applies this session */ }
    if (this.veteranRank > before) {
      audio.playStreakFanfare(5);
      this.callbacks.onRankChange?.(this.veteranRank, VETERAN_RANKS[this.veteranRank].name, this.veteranXP);
    }
  }
  public artilleryCharge: number = 0; // 0 - 100

  // Class Ability State
  public abilityCooldown: number = 0;
  public abilityMaxCooldown: number = 18;
  public abilityActiveTimer: number = 0;
  public abilityMaxDuration: number = 6;
  public damageResistance: number = 0; // 0.0 to 1.0 (Medic aura)
  public isSlowMoActive: boolean = false;

  // Settings
  public historicalSettings: HistoricalSettings = {
    weaponBehavior: 'ARCADE',
    authenticUniforms: true,
    historicalEvents: true,
    crtScanlines: true,
  };

  // Weapon State
  public currentWeaponKey: string = 'springfield_1861';
  public currentAmmo: number = 1;
  public reserveAmmo: number = 40;
  public isReloading: boolean = false;
  public reloadProgress: number = 0;
  public isAimingADS: boolean = false;
  public isMeleeing: boolean = false;
  private meleeTimer: number = 0;
  private recoilPitch: number = 0;
  private recoilOffsetZ: number = 0;
  private shootCooldown: number = 0;

  // Movement State
  private keys: Record<string, boolean> = {};
  public playerPos: THREE.Vector3 = new THREE.Vector3(0, 1.7, 0);
  public playerVelocity: THREE.Vector3 = new THREE.Vector3();
  public yaw: number = 0;
  public pitch: number = 0;
  public isGrounded: boolean = true;
  private verticalVel: number = 0;   // jump / fall velocity (m/s)
  private jumpY: number = 0;        // airborne height above terrain
  private jumpQueued: boolean = false;
  private eyeHeightSm: number = 1.7; // smoothed eye height (crouch transitions)
  private treeColliders: { x: number; z: number; r: number }[] = [];
  private ramrodMesh: THREE.Mesh | null = null;
  private hammerMesh: THREE.Mesh | null = null;
  private cartridgeMesh: THREE.Mesh | null = null;
  private pourPuffMesh: THREE.Mesh | null = null;
  public isSprinting: boolean = false;
  public isCrouching: boolean = false;

  // Environment & Enemies
  private enemies: EnemyNPC[] = [];
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private remotePlayerMeshes: Map<string, THREE.Group> = new Map();
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; scaleRate: number; gravityScale?: number }[] = [];
  private flags: { mesh: THREE.Mesh; waveOffset: number }[] = [];

  // Visual Bullet Tracers
  private bulletTracers: { mesh: THREE.Line; life: number; maxLife: number }[] = [];

  // Dynamic Blood Splatter Decal System
  private bloodDecals: { mesh: THREE.Mesh; life: number }[] = [];

  // Last Stand Mechanic
  public isLastStandActive: boolean = false;
  public lastStandTimer: number = 0;
  public hasUsedLastStand: boolean = false;

  // Interactive Field Cannons
  private artilleryPieces: {
    id: string;
    group: THREE.Group;
    barrel: THREE.Mesh;
    position: THREE.Vector3;
    rotY: number;
    pitch: number;
    cooldown: number;
    /** Full crew drill state (1861 field artillery drill). */
    drill: DrillState;
    /** Seconds remaining in the current timed drill station; -1 = awaiting crew action. */
    drillTimer: number;
  }[] = [];
  public mountedCannon: {
    id: string;
    group: THREE.Group;
    barrel: THREE.Mesh;
    position: THREE.Vector3;
    rotY: number;
    pitch: number;
    cooldown: number;
    drill: DrillState;
    drillTimer: number;
  } | null = null;
  public cannonReloadProgress: number = 1;
  /** Live cannon projectiles (solid shot / shell) with ballistic arcs. */
  private cannonProjectiles: {
    mesh: THREE.Mesh;
    vel: THREE.Vector3;
    ammo: CannonAmmoId;
    life: number;
  }[] = [];

  // Interactive Barn / Farm Doors
  private interactiveDoors: {
    id: string;
    group: THREE.Group;
    position: THREE.Vector3;
    isOpen: boolean;
    currentAngle: number;
    targetAngle: number;
  }[] = [];

  // Capture The Flag & Waypoints Modality
  private flagWaypoints: {
    id: string;
    name: string;
    x: number;
    z: number;
    controllingFaction: Faction | 'NEUTRAL';
    captureProgress: number; // -100 to 100
    flagMesh: THREE.Mesh;
    contested: boolean;
  }[] = [];
  public unionTickets: number = 500;
  public confedTickets: number = 500;
  private ticketBleedTimer: number = 1.0;

  // Ambient 50/50 Bot Skirmish Lines
  private ambientSoldiers: {
    group: THREE.Group;
    faction: Faction;
    fireCooldown: number;
    x: number;
    z: number;
  }[] = [];

  // Bayonet Affix Intro Animation
  private bayonetIntroProgress: number = 1;
  private isAffixingBayonet: boolean = false;

  // Minimap Broadcast Timer
  private minimapBroadcastTimer: number = 0;

  // Wave & Mission
  public currentWave: number = 1;
  public totalWaves: number = 3;
  public currentMissionId: string = 'day1_mcpherson';
  public isCampaign: boolean = true;
  private waveStartTime: number = performance.now();
  private waveEnemiesRemaining: number = 0;
  private callbacks: GameEngineCallbacks;

  private isDisposed: boolean = false;
  private lastTime: number = performance.now();
  private animFrameId: number | null = null;
  private bobTimer: number = 0;

  constructor(
    container: HTMLElement,
    faction: Faction,
    charClass: CharacterClass,
    missionId: string,
    isCampaign: boolean,
    historicalSettings: HistoricalSettings,
    callbacks: GameEngineCallbacks
  ) {
    this.container = container;
    this.playerFaction = faction;
    this.playerClass = charClass;
    this.currentMissionId = missionId;
    this.isCampaign = isCampaign;
    this.historicalSettings = historicalSettings;
    this.callbacks = callbacks;
    this.loadVeteranProgress();

    // Apply class parameters
    const classDef = CHARACTER_CLASSES.find((c) => c.id === charClass) || CHARACTER_CLASSES[0];
    this.abilityMaxCooldown = classDef.abilityCooldown;
    this.abilityMaxDuration = classDef.abilityDuration;

    if (charClass === 'MEDIC') {
      this.canteenCharges = 5;
    } else {
      this.canteenCharges = 3;
    }

    if (charClass === 'INFANTRY') {
      this.currentWeaponKey = faction === 'NORTH' ? 'springfield_1861' : 'enfield_1853';
    } else if (charClass === 'SHARPSHOOTER') {
      this.currentWeaponKey = faction === 'NORTH' ? 'spencer_repeater' : 'whitworth_sharpshooter';
    } else if (charClass === 'MEDIC') {
      this.currentWeaponKey = faction === 'NORTH' ? 'colt_navy_1851' : 'lemat_revolver';
    } else if (charClass === 'OFFICER') {
      this.currentWeaponKey = faction === 'NORTH' ? 'colt_navy_1851' : 'lemat_revolver';
    }

    const wData = HISTORICAL_WEAPONS[this.currentWeaponKey] || HISTORICAL_WEAPONS['springfield_1861'];
    this.currentAmmo = wData.magazineSize;
    this.reserveAmmo = wData.reserveAmmo;

    // Setup Three.js Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.05, 1000);
    this.camera.position.set(0, 1.7, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Build Viewmodel Gun
    this.gunPivot = new THREE.Group();
    this.musketMesh = this.createViewmodelGun();
    this.gunPivot.add(this.musketMesh);
    this.camera.add(this.gunPivot);
    this.scene.add(this.camera);

    // Create Muzzle Flash
    const flashGeo = new THREE.DodecahedronGeometry(0.12, 1);
    const flashMat = new THREE.MeshBasicMaterial({ color: 0xFFDD44, transparent: true, opacity: 0 });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0, 0.03, -1.35);
    this.gunPivot.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xFF8822, 0, 15);
    this.muzzleFlashLight.position.set(0, 0.03, -1.35);
    this.gunPivot.add(this.muzzleFlashLight);

    // Paper cartridge prop — travels cartridge box → teeth → muzzle during the loading drill
    const cartGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.10, 8);
    const cartMat = new THREE.MeshStandardMaterial({ color: 0xC9A86A, roughness: 0.9 });
    this.cartridgeMesh = new THREE.Mesh(cartGeo, cartMat);
    this.cartridgeMesh.visible = false;
    this.camera.add(this.cartridgeMesh);

    // Powder pour puff — brief gray bloom at the muzzle while charging
    const puffGeo = new THREE.SphereGeometry(0.035, 8, 8);
    const puffMat = new THREE.MeshBasicMaterial({ color: 0xBBBBBB, transparent: true, opacity: 0 });
    this.pourPuffMesh = new THREE.Mesh(puffGeo, puffMat);
    this.pourPuffMesh.visible = false;
    this.camera.add(this.pourPuffMesh);

    // Bayonet Mesh
    const bayonetGeo = new THREE.ConeGeometry(0.02, 0.45, 4);
    const bayonetMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 });
    this.bayonetMesh = new THREE.Mesh(bayonetGeo, bayonetMat);
    this.bayonetMesh.rotation.x = -Math.PI / 2; // tip forward
    this.bayonetMesh.position.set(0, 0.02, -1.52);
    this.musketMesh.add(this.bayonetMesh);

    this.setupEnvironment();
    this.setupInputListeners();
    this.startMission();
    this.animate();
  }

  private createViewmodelGun(): THREE.Group {
    const gun = new THREE.Group();

    // Wooden Stock
    const stockGeo = new THREE.BoxGeometry(0.07, 0.12, 0.95);
    const stockMat = new THREE.MeshStandardMaterial({ color: 0x5C3A21, roughness: 0.7 });
    const stock = new THREE.Mesh(stockGeo, stockMat);
    stock.position.set(0, -0.08, -0.3);
    gun.add(stock);

    // Steel Barrel
    const barrelGeo = new THREE.CylinderGeometry(0.025, 0.028, 1.25, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.85, roughness: 0.3 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, -0.7);
    gun.add(barrel);

    // Brass Barrel Bands
    const bandGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.04, 12);
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.3 });
    const band1 = new THREE.Mesh(bandGeo, bandMat);
    band1.rotation.x = Math.PI / 2;
    band1.position.set(0, 0, -0.45);
    const band2 = new THREE.Mesh(bandGeo, bandMat);
    band2.rotation.x = Math.PI / 2;
    band2.position.set(0, 0, -0.85);
    gun.add(band1, band2);

    // Hammer & Lockplate
    const hammerGeo = new THREE.BoxGeometry(0.02, 0.07, 0.04);
    const hammerMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.3 });
    const hammer = new THREE.Mesh(hammerGeo, hammerMat);
    hammer.position.set(0.04, 0.04, -0.15);
    gun.add(hammer);
    this.hammerMesh = hammer;

    // Lock plate on the right of the breech
    const lockPlate = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.16), hammerMat);
    lockPlate.position.set(0.042, -0.02, -0.15);
    gun.add(lockPlate);

    // Trigger guard + trigger blade below the breech
    const guard = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.007, 6, 12, Math.PI), hammerMat);
    guard.rotation.y = Math.PI / 2;
    guard.rotation.x = Math.PI;
    guard.position.set(0, -0.125, -0.10);
    gun.add(guard);
    const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.032, 0.012), hammerMat);
    trigger.position.set(0, -0.115, -0.10);
    trigger.rotation.x = 0.25;
    gun.add(trigger);

    // Nose cap at the fore-end tip + steel buttplate
    const noseCap = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.05, 10), hammerMat);
    noseCap.rotation.x = Math.PI / 2;
    noseCap.position.set(0, -0.08, -0.755);
    gun.add(noseCap);
    const buttplate = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.13, 0.015), hammerMat);
    buttplate.position.set(0, -0.08, 0.178);
    gun.add(buttplate);

    // Ramrod underneath
    const ramrodGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.2, 8);
    const ramrodMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
    const ramrod = new THREE.Mesh(ramrodGeo, ramrodMat);
    ramrod.rotation.x = Math.PI / 2;
    ramrod.position.set(0, -0.035, -0.7);
    gun.add(ramrod);
    this.ramrodMesh = ramrod;

    // Iron sights — front blade + rear notch, aligned to the bore
    const sightMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.4 });
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.055, 0.014), sightMat);
    frontSight.position.set(0, 0.05, -1.18);
    gun.add(frontSight);
    const rearL = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.03), sightMat);
    rearL.position.set(-0.024, 0.05, -0.3);
    const rearR = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.03), sightMat);
    rearR.position.set(0.024, 0.05, -0.3);
    gun.add(rearL, rearR);

    // Whitworth Brass Scope if sniper
    if (this.currentWeaponKey.includes('whitworth')) {
      const scopeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.7, 12);
      const scopeMat = new THREE.MeshStandardMaterial({ color: 0xB58838, metalness: 0.9, roughness: 0.2 });
      const scope = new THREE.Mesh(scopeGeo, scopeMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.04, -0.5);
      gun.add(scope);
    }

    gun.position.set(0, 0, 0); // pivot carries all positioning — no double offset
    return gun;
  }

  /**
   * Gettysburg, July 1863 — compressed but faithful heightfield.
   * 1 unit ≈ 8 m. Ridges run N-S; the Angle sits on Cemetery Ridge.
   */
  private gettysburgHeight(x: number, z: number): number {
    const gauss = (cx: number, cz: number, sx: number, sz: number) => {
      const dx = (x - cx) / sx, dz = (z - cz) / sz;
      return Math.exp(-(dx * dx + dz * dz));
    };
    // Rolling Adams County farmland base
    let h = Math.sin(x * 0.021) * 1.1 + Math.cos(z * 0.026) * 0.9 + Math.sin(x * 0.09 + z * 0.06) * 0.35;
    h += 5.5 * gauss(20, -10, 17, 95);    // Cemetery Ridge — Union main line
    h += 4.5 * gauss(-58, 0, 15, 90);     // Seminary Ridge — Confederate line
    h += 7.0 * gauss(18, -78, 24, 26);    // Cemetery Hill — north anchor, crowns the ridge crest
    h += 9.0 * gauss(72, -38, 21, 24);    // Culp's Hill
    h += 13.0 * gauss(14, 96, 17, 19);   // Little Round Top — just west of the Cemetery Ridge crest
    h += 19.0 * gauss(0, 130, 22, 24);   // Big Round Top — WEST of Little Round Top (was wrongly east)
    h += 3.5 * gauss(-7, 100, 12, 10);     // Devil's Den — base of LRT's western slope (was wrongly east)
    h += 5.0 * gauss(92, 52, 14, 12);    // Powers Hill — ESE on the Baltimore Pike (was wrongly NNE)
    h += 3.0 * gauss(-78, -48, 16, 30);   // McPherson Ridge (Day 1)
    h -= 1.6 * gauss(-14, 92, 22, 26);     // Plum Run valley — runs WEST of Devil's Den / LRT
    return h;
  }

  /** World-space terrain height — the single source of truth for grounding. */
  public getTerrainHeight(x: number, z: number): number {
    return this.gettysburgHeight(x, z);
  }

  /** Snap any scenery object onto the terrain. */
  private placeOnTerrain(obj: THREE.Object3D, x: number, z: number, yOff = 0) {
    obj.position.set(x, this.getTerrainHeight(x, z) + yOff, z);
  }

  private setupEnvironment() {
    let skyHex = 0x87CEEB;
    let fogHex = 0xD8CBB5;
    let fogDens = 0.012;
    let lightColor = 0xFFF8E7;

    if (this.currentMissionId === 'day2_roundtop') {
      skyHex = 0xFFA07A;
      fogHex = 0xDDA0DD;
      fogDens = 0.014;
      lightColor = 0xFFD1A4;
    } else if (this.currentMissionId === 'day2_wheatfield_night') {
      skyHex = 0x0A0F1D;
      fogHex = 0x182035;
      fogDens = 0.026;
      lightColor = 0x6688AA;
    } else if (this.currentMissionId === 'day3_pickett') {
      skyHex = 0xEDC9AF;
      fogHex = 0xC8B08A;
      fogDens = 0.016;
      lightColor = 0xFFE5B4;
    }

    this.currentSkyColor.setHex(skyHex);
    this.targetSkyColor.setHex(skyHex);
    this.currentFogColor.setHex(fogHex);
    this.targetFogColor.setHex(fogHex);
    this.currentFogDensity = fogDens;
    this.targetFogDensity = fogDens;
    this.currentSunColor.setHex(lightColor);
    this.targetSunColor.setHex(lightColor);

    this.scene.background = this.currentSkyColor;
    this.scene.fog = new THREE.FogExp2(fogHex, fogDens);

    // Gradient sky dome with sun disc — replaces the flat background color
    this.skyDomeMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(skyHex) },
        horizonColor: { value: new THREE.Color(fogHex) },
        sunDirection: { value: new THREE.Vector3(50, 80, -40).normalize() },
        sunColor: { value: new THREE.Color(lightColor) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform vec3 sunDirection;
        uniform vec3 sunColor;
        varying vec3 vWorldPos;
        void main() {
          vec3 dir = normalize(vWorldPos - cameraPosition);
          float h = clamp(dir.y, 0.0, 1.0);
          vec3 col = mix(horizonColor, topColor, pow(h, 0.55));
          float sunAmt = max(dot(dir, normalize(sunDirection)), 0.0);
          col += sunColor * (pow(sunAmt, 900.0) * 1.4 + pow(sunAmt, 10.0) * 0.22);
          col = mix(col, horizonColor * 0.94, smoothstep(0.0, -0.15, dir.y));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(1400, 24, 16), this.skyDomeMat);
    this.skyDome.frustumCulled = false;
    this.skyDome.renderOrder = -10;
    this.scene.add(this.skyDome);

    this.hemiLight = new THREE.HemisphereLight(skyHex, 0x3d352a, 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(lightColor, 1.2);
    this.dirLight.position.set(50, 80, -40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.scene.add(this.dirLight);

    // Ground — Gettysburg 1863 heightfield with painted vertex colors
    const groundGeo = new THREE.PlaneGeometry(350, 350, 110, 110);
    const posAttr = groundGeo.attributes.position;
    const colorAttr = new Float32Array(posAttr.count * 3);
    const cGrass = new THREE.Color(0x55682a);
    const cGrassDry = new THREE.Color(0x6f7a36);
    const cDirt = new THREE.Color(0x6b5136);
    const cRock = new THREE.Color(0x6e6a63);
    const cWheat = new THREE.Color(0xb59a4a);
    const cOrchard = new THREE.Color(0x4a6b2a);
    const tmpC = new THREE.Color();
    const hash2 = (x: number, z: number) => {
      const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    for (let i = 0; i < posAttr.count; i++) {
      const wx = posAttr.getX(i);
      const wz = -posAttr.getY(i); // plane Y maps to world -Z after rotation
      const h = this.getTerrainHeight(wx, wz);
      posAttr.setZ(i, h);
      // slope for rock exposure
      const e = 1.6;
      const sx = (this.getTerrainHeight(wx + e, wz) - this.getTerrainHeight(wx - e, wz)) / (2 * e);
      const sz = (this.getTerrainHeight(wx, wz + e) - this.getTerrainHeight(wx, wz - e)) / (2 * e);
      const slope = Math.sqrt(sx * sx + sz * sz);
      tmpC.copy(cGrass).lerp(cGrassDry, hash2(wx * 0.7, wz * 0.7) * 0.8);
      if (h > 8) tmpC.lerp(cRock, Math.min(1, (h - 8) / 9) * 0.65); // rocky hilltops
      if (slope > 0.5) tmpC.lerp(cRock, Math.min(1, (slope - 0.5) * 1.6) * 0.7); // steep = rock
      // Devil's Den rock field
      const dd = ((wx + 7) / 14) ** 2 + ((wz - 100) / 12) ** 2;
      if (dd < 1) tmpC.lerp(cRock, 0.75 * (1 - dd));
      // Emmitsburg Road — dirt pike running N-S between the ridges
      if (Math.abs(wx + 14) < 2.6 && wz > -115 && wz < 115) {
        tmpC.lerp(cDirt, Math.abs(wx + 14) < 1.1 ? 0.9 : 0.55);
      }
      // The Wheatfield — golden (sits SE of the Peach Orchard, north of Devil's Den)
      const wf = ((wx - 2) / 17) ** 2 + ((wz - 66) / 14) ** 2;
      if (wf < 1) tmpC.lerp(cWheat, 0.85 * (1 - wf));
      // Peach Orchard
      const po = ((wx + 28) / 15) ** 2 + ((wz - 58) / 11) ** 2;
      if (po < 1) tmpC.lerp(cOrchard, 0.7 * (1 - po));
      colorAttr[i * 3] = tmpC.r; colorAttr[i * 3 + 1] = tmpC.g; colorAttr[i * 3 + 2] = tmpC.b;
    }
    groundGeo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
    groundGeo.computeVertexNormals();

    const groundDetail = this.makeGroundDetailTexture();
    const groundMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      map: groundDetail,
      roughness: 0.95,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildGettysburgScenery();
    this.setupWeatherSystem();
    this.applyTimeOfDayForWave(1);
  }

  /** Procedural close-range ground detail: near-white noise so it multiplies cleanly over vertex colors. */
  private makeGroundDetailTexture(): THREE.CanvasTexture {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const hash = (x: number, y: number) => {
      const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
      return v - Math.floor(v);
    };
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const valueNoise = (x: number, y: number) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x - xi, yf = y - yi;
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      const u = smooth(xf), v = smooth(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // Two octaves of blotch + fine grain speckle
        const n = valueNoise(x / 24, y / 24) * 0.6 + valueNoise(x / 6, y / 6) * 0.4;
        const speckle = hash(x * 3.1, y * 2.7);
        let v = 244 - n * 34 - (speckle > 0.93 ? 26 : 0);
        v = Math.max(150, Math.min(250, v));
        const i = (y * size + x) * 4;
        img.data[i] = v; img.data[i + 1] = v - 2; img.data[i + 2] = v - 6; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(48, 48);
    tex.anisotropy = 4;
    return tex;
  }

  private setupWeatherSystem() {
    const dropCount = 2800;
    const rainGeo = new THREE.BufferGeometry();
    const posArray = new Float32Array(dropCount * 3);
    for (let i = 0; i < dropCount; i++) {
      posArray[i * 3] = (Math.random() - 0.5) * 90;
      posArray[i * 3 + 1] = Math.random() * 35;
      posArray[i * 3 + 2] = (Math.random() - 0.5) * 90;
    }
    this.rainPositions = posArray;
    rainGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const rainMat = new THREE.PointsMaterial({
      color: 0x9EC0E0,
      size: 0.18,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.rainPoints = new THREE.Points(rainGeo, rainMat);
    this.rainPoints.visible = false;
    this.scene.add(this.rainPoints);
  }

  public setWeather(weather: WeatherType) {
    const prev = this.weatherType;
    this.weatherType = weather;
    const raining = weather === 'LIGHT_RAIN' || weather === 'STORM';
    if (this.rainPoints) this.rainPoints.visible = raining;
    if (raining) audio.startRainAmbience();
    else audio.stopRainAmbience();
    // Fog density is owned by the historical timeline (plus battle haze),
    // not by the weather switch — it no longer stomps targetFogDensity.
    if (weather === 'STORM' && prev !== 'STORM' && !this.stormAnnounced) {
      this.stormAnnounced = true;
      this.callbacks.onAddScorePopup?.({
        id: `storm_${Date.now()}`,
        text: '⛈ THE SKY BREAKS — "the thunder seemed tame, after the artillery firing of the afternoon."',
        x: window.innerWidth / 2 - 260,
        y: window.innerHeight / 3,
        color: '#9EC0E0',
        scale: 1.25,
        opacity: 1,
        time: Date.now(),
      });
    }
    this.callbacks.onAtmosphereChange?.(this.timeOfDayTitle, this.weatherType);
  }

  public setManualWeather(weather: WeatherType) {
    // Manual override from the HUD picker: HEAVY_FOG explicitly thickens the air.
    if (weather === 'HEAVY_FOG') this.targetFogDensity = 0.040;
    this.setWeather(weather);
  }

  /** Begin the recorded Gettysburg weather for a battle day at a given hour. */
  public startHistoricalWeather(day: number, hour: number, title: string, haze: number = 0) {
    this.battleDay = day;
    this.battleHour = hour;
    this.battleTitle = title;
    this.battleHaze = haze;
    this.stormAnnounced = false;
    this.useHistoricalWeather = true;
    this.applyHistoricalSample();
  }

  private applyHistoricalSample() {
    const s = sampleGettysburgWeather(this.battleDay, this.battleHour);
    const cloud = s.cloudCover;
    const stormy = s.precip === 'storm';

    // Sky + fog palettes interpolate clear → overcast → storm-dark
    const clearSky = new THREE.Color(0x6fa8dc);
    const overSky = new THREE.Color(0x8a97a3);
    const stormSky = new THREE.Color(0x39434e);
    const sky = clearSky.lerp(overSky, cloud);
    if (stormy) sky.lerp(stormSky, 0.65);
    this.targetSkyColor.copy(sky);

    const clearFog = new THREE.Color(0xd8cbb5);
    const overFog = new THREE.Color(0xa8b0b8);
    const fog = clearFog.lerp(overFog, cloud);
    if (stormy) fog.lerp(new THREE.Color(0x5a6672), 0.6);
    this.targetFogColor.copy(fog);
    this.targetFogDensity = 0.010 + cloud * 0.010 + (stormy ? 0.010 : 0) + this.battleHaze;

    // Sun tracks the real hour; clouds throttle it
    const { elevation, azimuth } = sunPositionForHour(this.battleHour);
    const dayCurve = Math.min(1, Math.max(0.05, elevation * 3));
    this.targetSunIntensity = (1.5 - cloud * 1.05) * dayCurve;
    const clearSun = new THREE.Color(0xfff5dd);
    const overSun = new THREE.Color(0xe8e4da);
    const sunCol = clearSun.lerp(overSun, cloud);
    if (stormy) sunCol.lerp(new THREE.Color(0xb9c4ce), 0.5);
    this.targetSunColor.copy(sunCol);
    this.targetSunPosition.set(
      -Math.cos(azimuth) * 140,
      15 + Math.max(0, elevation) * 150,
      -30 + Math.sin(azimuth) * 40
    );

    this.targetHemiSkyColor.setHex(0x87ceeb).lerp(new THREE.Color(0x9aa5b1), cloud);
    this.targetHemiGroundColor.setHex(0x3d352a);
    this.targetHemiIntensity = 0.75 - cloud * 0.25;

    // Wind: the recorded southerly breeze (gusts in the storm), drifting north (−z)
    this.windMph = stormy ? 22 : s.windMph;
    this.windVec.set(0, 0, -1).multiplyScalar(this.windMph * 0.35);

    this.tempF = s.tempF;
    this.timeOfDayTitle =
      `July ${this.battleDay} • ${formatBattleHour(this.battleHour)} • ${Math.round(this.tempF)}°F • ${this.battleTitle || s.label}`;

    if (s.weather !== this.weatherType) this.setWeather(s.weather);
    else this.callbacks.onAtmosphereChange?.(this.timeOfDayTitle, this.weatherType);
  }

  /** Advance the battle clock and drift the weather along the recorded timeline. */
  private updateHistoricalWeather(dt: number) {
    // 1 game-hour per 4 real minutes — a full battle sees the sky change.
    this.battleHour += dt / 240;
    if (this.battleHour >= 21.5) this.battleHour = 21.5; // hold at last light
    this.applyHistoricalSample();
  }

  public applyTimeOfDayForWave(waveNumber: number) {
    // Daytime battles ride the recorded July 1–3 Gettysburg weather timeline;
    // each wave picks up the battle clock at the historical hour (plus gunsmoke haze).
    // The night mission keeps its bespoke moonlit look.
    if (this.currentMissionId === 'day1_mcpherson') {
      // July 1 — overcast all day, very gentle 2 mph southerly breeze (Jacobs), 72→76°F
      if (waveNumber === 1) this.startHistoricalWeather(1, 9.5, 'Morning Mist', 0.004);
      else if (waveNumber === 2) this.startHistoricalWeather(1, 10.5, 'Mid-Morning Skirmish', 0.004);
      else this.startHistoricalWeather(1, 11.5, 'High Noon Skirmish', 0.002);
    } else if (this.currentMissionId === 'day2_roundtop') {
      // July 2 — morning clouds clear through the afternoon, 74→81°F
      if (waveNumber === 1) this.startHistoricalWeather(2, 16.0, 'Warm Afternoon Sun', 0);
      else if (waveNumber === 2) this.startHistoricalWeather(2, 17.25, 'Amber Golden Hour', 0.004);
      else if (waveNumber === 3) this.startHistoricalWeather(2, 18.0, 'Heavy Cannonade Fog', 0.016);
      else this.startHistoricalWeather(2, 18.5, 'Twilight Bayonet Charge', 0.008);
    } else if (this.currentMissionId === 'day2_wheatfield_night') {
      if (waveNumber === 1) {
        this.timeOfDayTitle = '09:00 PM • Twilight Gloom & Fog';
        this.targetSkyColor.setHex(0x1B263B);
        this.targetFogColor.setHex(0x162032);
        this.targetFogDensity = 0.028;
        this.targetSunColor.setHex(0x6080A0);
        this.targetSunIntensity = 0.45;
        this.targetSunPosition.set(40, 30, -40);
        this.setWeather('HEAVY_FOG');
      } else if (waveNumber === 2) {
        this.timeOfDayTitle = '09:45 PM • Torrential Midnight Rain';
        this.targetSkyColor.setHex(0x0C1524);
        this.targetFogColor.setHex(0x101827);
        this.targetFogDensity = 0.034;
        this.targetSunColor.setHex(0x406080);
        this.targetSunIntensity = 0.30;
        this.targetSunPosition.set(20, 20, -30);
        this.setWeather('LIGHT_RAIN');
      } else {
        this.timeOfDayTitle = '10:30 PM • Ghostly Moonlight Fog';
        this.targetSkyColor.setHex(0x080E18);
        this.targetFogColor.setHex(0x0F1722);
        this.targetFogDensity = 0.042;
        this.targetSunColor.setHex(0x7090B0);
        this.targetSunIntensity = 0.40;
        this.targetSunPosition.set(10, 45, -20);
        this.setWeather('HEAVY_FOG');
      }
      this.useHistoricalWeather = false;
      this.tempF = 76; // recorded 9 PM reading, July 2
    } else {
      // July 3 — blazing heat, the great cannonade, then the storm breaks
      if (waveNumber === 1) this.startHistoricalWeather(3, 13.0, 'Blazing Summer Heat', 0);
      else if (waveNumber === 2) this.startHistoricalWeather(3, 14.0, '150 Cannon Gunsmoke', 0.014);
      else if (waveNumber === 3) this.startHistoricalWeather(3, 15.0, 'Dense Canister Smoke', 0.022);
      else if (waveNumber === 4) this.startHistoricalWeather(3, 15.5, 'Armistead Breaches The Wall', 0.026);
      else this.startHistoricalWeather(3, 16.0, 'High Water Mark \u2014 Storm Breaking', 0.012);
    }

    this.callbacks.onAtmosphereChange?.(this.timeOfDayTitle, this.weatherType);
  }

  public addCameraShake(amount: number) {
    this.cameraTrauma = Math.min(1.0, this.cameraTrauma + amount);
  }

  private updateCameraShake(dt: number) {
    if (this.cameraTrauma > 0) {
      const shake = this.cameraTrauma * this.cameraTrauma;
      const t = performance.now() * 0.001;
      this.cameraShakePitch = (Math.sin(t * 45) * 0.05 + (Math.random() - 0.5) * 0.035) * shake;
      this.cameraShakeYaw = (Math.cos(t * 38) * 0.05 + (Math.random() - 0.5) * 0.035) * shake;
      this.cameraShakeRoll = (Math.sin(t * 32) * 0.04 + (Math.random() - 0.5) * 0.025) * shake;
      this.cameraShakeOffset.set(
        (Math.random() - 0.5) * 0.22 * shake,
        Math.sin(t * 50) * 0.14 * shake,
        (Math.random() - 0.5) * 0.22 * shake
      );
      this.cameraTrauma = Math.max(0, this.cameraTrauma - dt * 1.5);
    } else {
      this.cameraShakePitch = 0;
      this.cameraShakeYaw = 0;
      this.cameraShakeRoll = 0;
      this.cameraShakeOffset.set(0, 0, 0);
    }
  }

  private updateAtmosphereAndWeather(dt: number) {
    // The recorded July 1–3 weather drifts underneath everything (except the night mission).
    if (this.useHistoricalWeather) this.updateHistoricalWeather(dt);

    const lerpFactor = dt * 1.4;
    this.currentSkyColor.lerp(this.targetSkyColor, lerpFactor);
    this.scene.background = this.currentSkyColor;
    if (this.skyDomeMat) {
      (this.skyDomeMat.uniforms.topColor.value as THREE.Color).copy(this.currentSkyColor);
      (this.skyDomeMat.uniforms.horizonColor.value as THREE.Color).copy(this.currentFogColor);
      (this.skyDomeMat.uniforms.sunColor.value as THREE.Color).copy(this.currentSunColor);
      (this.skyDomeMat.uniforms.sunDirection.value as THREE.Vector3)
        .copy(this.dirLight.position).normalize();
    }
    if (this.skyDome && this.camera) {
      this.skyDome.position.copy(this.camera.position);
    }

    this.currentFogColor.lerp(this.targetFogColor, lerpFactor);
    this.currentFogDensity += (this.targetFogDensity - this.currentFogDensity) * lerpFactor;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.currentFogColor);
      this.scene.fog.density = this.currentFogDensity;
    }

    this.currentSunColor.lerp(this.targetSunColor, lerpFactor);
    this.dirLight.color.copy(this.currentSunColor);
    this.currentSunIntensity += (this.targetSunIntensity - this.currentSunIntensity) * lerpFactor;
    this.dirLight.intensity = this.currentSunIntensity;

    this.currentSunPosition.lerp(this.targetSunPosition, lerpFactor);
    this.dirLight.position.copy(this.currentSunPosition);

    this.currentHemiSkyColor.lerp(this.targetHemiSkyColor, lerpFactor);
    this.hemiLight.color.copy(this.currentHemiSkyColor);
    this.currentHemiGroundColor.lerp(this.targetHemiGroundColor, lerpFactor);
    this.hemiLight.groundColor.copy(this.currentHemiGroundColor);
    this.currentHemiIntensity += (this.targetHemiIntensity - this.currentHemiIntensity) * lerpFactor;
    this.hemiLight.intensity = this.currentHemiIntensity;

    // Rain particles update (storm cells ride the same southerly breeze)
    const isRaining = this.weatherType === 'LIGHT_RAIN' || this.weatherType === 'STORM';
    if (isRaining && this.rainPoints && this.rainPositions) {
      const pCount = this.rainPositions.length / 3;
      const px = this.playerPos.x;
      const pz = this.playerPos.z;

      for (let i = 0; i < pCount; i++) {
        this.rainPositions[i * 3 + 1] -= 36 * dt; // Fall fast
        // Recorded southerly breeze drives the rain northward (−z)
        this.rainPositions[i * 3] += this.windVec.x * dt;
        this.rainPositions[i * 3 + 2] += this.windVec.z * dt;

        if (this.rainPositions[i * 3 + 1] < 0) {
          this.rainPositions[i * 3 + 1] = 28 + Math.random() * 8;
          this.rainPositions[i * 3] = px + (Math.random() - 0.5) * 70;
          this.rainPositions[i * 3 + 2] = pz + (Math.random() - 0.5) * 70;
        }

        if (Math.abs(this.rainPositions[i * 3] - px) > 40) {
          this.rainPositions[i * 3] = px + (Math.random() - 0.5) * 40;
        }
        if (Math.abs(this.rainPositions[i * 3 + 2] - pz) > 40) {
          this.rainPositions[i * 3 + 2] = pz + (Math.random() - 0.5) * 40;
        }
      }

      const posAttr = (this.rainPoints.geometry as THREE.BufferGeometry).getAttribute('position');
      posAttr.needsUpdate = true;

      // Distant Thunder loop during rain
      this.thunderTimer -= dt;
      if (this.thunderTimer <= 0) {
        this.thunderTimer = 16 + Math.random() * 18;
        audio.playThunderRumble();
        this.addCameraShake(0.22);

        // Lightning illumination flash
        const origIntensity = this.dirLight.intensity;
        this.dirLight.intensity = origIntensity * 2.8;
        setTimeout(() => {
          if (!this.isDisposed && this.dirLight) {
            this.dirLight.intensity = origIntensity;
          }
        }, 90);
      }
    }
  }

  private getPlayerSurface(): 'grass' | 'dirt' | 'stone' | 'wood' {
    const px = this.playerPos.x;
    const pz = this.playerPos.z;

    // 1. Stone Wall at The Angle (x: -42 to 42, z: -3 to 3) or 90-degree Angle section (x: 37 to 43, z: -2 to 32)
    if ((Math.abs(px) <= 42 && Math.abs(pz) <= 3.2) || (Math.abs(px - 40) <= 3.2 && pz >= -1 && pz <= 32)) {
      return 'stone';
    }

    // 2. Near Granite Boulders
    for (let i = 0; i < this.boulderLocations.length; i++) {
      const b = this.boulderLocations[i];
      const dx = px - b.x;
      const dz = pz - b.z;
      if (dx * dx + dz * dz <= (b.radius + 2.0) * (b.radius + 2.0)) {
        return 'stone';
      }
    }

    // 3. Near Worm Fences (x: -28 to -22, z: -125 to -45)
    if (Math.abs(px - (-25)) <= 3.5 && pz <= -45 && pz >= -125) {
      return 'wood';
    }

    // 4. Wheatfield Night or muddy low ground
    if (this.currentMissionId === 'day2_wheatfield_night') {
      return 'dirt';
    }

    return 'grass';
  }

  private buildGettysburgScenery() {
    // 1. Stone Wall at The Angle — hand-laid irregular courses on the Cemetery Ridge crest
    const stoneMats = [0x777571, 0x6e6c68, 0x7f7d79, 0x716f6b].map(
      (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 })
    );
    const layWallSection = (cx: number, cz: number, alongX: boolean) => {
      const section = new THREE.Group();
      const courses = 3;
      const stonesPerCourse = 4;
      for (let c = 0; c < courses; c++) {
        const y = 0.16 + c * 0.29;
        for (let i = 0; i < stonesPerCourse; i++) {
          const courseLen = 3.8 / stonesPerCourse;
          const w = 0.55 + Math.random() * 0.25;
          const h = 0.24 + Math.random() * 0.10;
          const l = courseLen * (0.92 + Math.random() * 0.12);
          const stone = new THREE.Mesh(
            new THREE.BoxGeometry(alongX ? l : w, h, alongX ? w : l),
            stoneMats[Math.floor(Math.random() * stoneMats.length)]
          );
          const off = (i - (stonesPerCourse - 1) / 2) * courseLen + (Math.random() - 0.5) * 0.08;
          stone.position.set(
            alongX ? off : (Math.random() - 0.5) * 0.10,
            y + (Math.random() - 0.5) * 0.03,
            alongX ? (Math.random() - 0.5) * 0.10 : off
          );
          stone.rotation.y = (Math.random() - 0.5) * 0.12;
          stone.castShadow = true;
          stone.receiveShadow = true;
          section.add(stone);
        }
      }
      this.placeOnTerrain(section, cx, cz, 0);
      this.scene.add(section);
    };
    for (let z = -32; z <= 24; z += 3.8) layWallSection(20, z, false);

    // 2. The 90-degree Angle section — wall jogs east at the Copse
    for (let x = 20; x <= 44; x += 3.8) layWallSection(x, 24, true);

    // 3. Worm Fences — west of Emmitsburg Road
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6E543C, roughness: 0.85 });
    for (let z = -50; z >= -120; z -= 8) {
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 8.5), woodMat);
      rail1.rotation.y = (z % 16 === 0 ? 0.3 : -0.3);
      rail1.castShadow = true;
      this.placeOnTerrain(rail1, -24, z, 0.7);
      this.scene.add(rail1);
    }

    // 4. Granite Boulders — scattered + the Devil's Den rock field
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x55585E, roughness: 0.9 });
    const dropBoulder = (bx: number, bz: number, radius: number) => {
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), boulderMat);
      boulder.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.placeOnTerrain(boulder, bx, bz, radius * 0.45);
      this.scene.add(boulder);
      this.boulderLocations.push({ x: bx, z: bz, radius });
      this.treeColliders.push({ x: bx, z: bz, r: radius * 0.8 });
    };
    for (let i = 0; i < 24; i++) {
      const radius = 1.5 + Math.random() * 2.8;
      dropBoulder((Math.random() - 0.5) * 140, (Math.random() - 0.5) * 140, radius);
    }
    for (let i = 0; i < 14; i++) { // Devil's Den — massive jumbled granite
      const a = Math.random() * Math.PI * 2, r = Math.random() * 11;
      dropBoulder(-7 + Math.cos(a) * r, 100 + Math.sin(a) * r * 0.8, 2.5 + Math.random() * 3.5);
    }

    // 5. Forests — instanced organic stands (see createForests)
    this.createForests();
    this.createUndergrowth();

    // 6. Interactive Artillery Cannons
    this.createArtilleryCannon(-15, this.getTerrainHeight(-15, -10), -10, 0, 'cannon_north_1');
    this.createArtilleryCannon(15, this.getTerrainHeight(15, -10), -10, 0, 'cannon_north_2');
    this.createArtilleryCannon(-30, this.getTerrainHeight(-30, 45), 45, Math.PI, 'cannon_south_1');
    this.createArtilleryCannon(30, this.getTerrainHeight(30, 45), 45, Math.PI, 'cannon_south_2');

    // 7. Interactive Barn & Pennsylvania Farmhouse with Swinging Doors
    this.createBarnAndDoors(22, -18);

    // 8. Military Camps, Field Hospital, Mess Hall & POW Enclosure
    this.createMilitaryCampsAndHospital();

    // 9. Capture The Flag Waypoints (The Angle, Copse of Trees, Seminary Ridge)
    this.createFlagPole(20, this.getTerrainHeight(20, 6), 6, 'The Angle', 'NORTH', 'flag_angle');
    this.createFlagPole(17, this.getTerrainHeight(17, 20), 20, 'Copse of Trees', 'NEUTRAL', 'flag_copse');
    this.createFlagPole(-58, this.getTerrainHeight(-58, 10), 10, 'Seminary Ridge', 'SOUTH', 'flag_seminary');

    // 10. Ambient 50/50 Skirmish Lines
    this.createAmbientSkirmishers();
  }

  /**
   * Lush organic forests of Gettysburg — instanced trunks + two canopy layers
   * (3 draw calls for ~900 trees) with per-instance color variation, plus
   * instanced grass tufts. Trees are grounded to the terrain and registered
   * as collision cylinders.
   */
  private createForests() {
    interface Stand { cx: number; cz: number; rx: number; rz: number; d: number; n: number }
    const stands: Stand[] = [
      { cx: -72, cz: -55, rx: 26, rz: 30, d: 0.85, n: 300 },  // Herbst Woods (McPherson Ridge)
      { cx: -38, cz: 78, rx: 20, rz: 24, d: 0.8, n: 280 },    // Rose Woods
      { cx: 0, cz: 128, rx: 26, rz: 26, d: 0.9, n: 300 },    // Big Round Top woods
      { cx: 14, cz: 94, rx: 18, rz: 18, d: 0.5, n: 200 },     // Little Round Top (rocky, sparser)
      { cx: 76, cz: -20, rx: 26, rz: 24, d: 0.85, n: 280 },   // Culp's Hill / Spangler's Spring — due east of the Angle
      { cx: -62, cz: 30, rx: 22, rz: 26, d: 0.75, n: 260 },   // Pitzer Woods
      { cx: 30, cz: -62, rx: 14, rz: 12, d: 0.5, n: 140 },    // Ziegler's Grove
      { cx: 17, cz: 22, rx: 9, rz: 11, d: 1.0, n: 110 },       // THE COPSE OF TREES — at the wall's 90-degree jog
    ];
    const hash = (x: number, z: number) => {
      const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };
    // Pronounced clumping — low-frequency noise gates growth
    const clump = (x: number, z: number) =>
      Math.sin(x * 0.05) * Math.cos(z * 0.043) + Math.sin(x * 0.13 + z * 0.11) * 0.5 > -0.3;

    const spots: { x: number; z: number; s: number }[] = [];
    for (const st of stands) {
      for (let i = 0; i < st.n; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random());
        const x = st.cx + Math.cos(a) * st.rx * r;
        const z = st.cz + Math.sin(a) * st.rz * r;
        if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
        if (hash(x * 3.1, z * 3.7) > st.d) continue;
        if (!clump(x, z)) continue;
        spots.push({ x, z, s: 0.75 + Math.random() * 0.75 });
      }
    }
    // Sparse field trees between the woodlots
    for (let i = 0; i < 300; i++) {
      const x = (Math.random() - 0.5) * 330, z = (Math.random() - 0.5) * 330;
      if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
      if (hash(x * 1.7, z * 2.3) > 0.05) continue;
      spots.push({ x, z, s: 0.7 + Math.random() * 0.6 });
    }

    const count = spots.length;
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();

    // Trunks — tapered, slight random lean
    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.36, 4.6, 7);
    trunkGeo.translate(0, 2.3, 0);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.95 });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    trunks.castShadow = true;

    // Canopy — two organic layers
    const canopyGeo = new THREE.IcosahedronGeometry(2.3, 1);
    const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const canopyLow = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const canopyTop = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    canopyLow.castShadow = true; canopyTop.castShadow = true;

    for (let i = 0; i < count; i++) {
      const t = spots[i];
      const gy = this.getTerrainHeight(t.x, t.z);
      const yaw = Math.random() * Math.PI * 2;
      const lean = (Math.random() - 0.5) * 0.09;
      const hScale = t.s * (0.9 + Math.random() * 0.35);

      dummy.position.set(t.x, gy - 0.15, t.z);
      dummy.rotation.set(lean, yaw, (Math.random() - 0.5) * 0.09);
      dummy.scale.set(t.s, hScale, t.s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      // Lower canopy — wide, asymmetric
      dummy.position.set(t.x + (Math.random() - 0.5) * 0.8, gy + 3.9 * hScale, t.z + (Math.random() - 0.5) * 0.8);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(t.s * (1.0 + Math.random() * 0.45), t.s * (0.72 + Math.random() * 0.3), t.s * (1.0 + Math.random() * 0.45));
      dummy.updateMatrix();
      canopyLow.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.24 + Math.random() * 0.09, 0.38 + Math.random() * 0.16, 0.2 + Math.random() * 0.11);
      canopyLow.setColorAt(i, col);

      // Crown — smaller, offset for organic silhouette
      dummy.position.set(t.x + (Math.random() - 0.5) * 1.4, gy + 5.4 * hScale, t.z + (Math.random() - 0.5) * 1.4);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(t.s * (0.62 + Math.random() * 0.3), t.s * (0.6 + Math.random() * 0.28), t.s * (0.62 + Math.random() * 0.3));
      dummy.updateMatrix();
      canopyTop.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.25 + Math.random() * 0.08, 0.4 + Math.random() * 0.14, 0.23 + Math.random() * 0.1);
      canopyTop.setColorAt(i, col);

      this.treeColliders.push({ x: t.x, z: t.z, r: 0.55 * t.s });
    }
    trunks.instanceMatrix.needsUpdate = true;
    canopyLow.instanceMatrix.needsUpdate = true;
    canopyTop.instanceMatrix.needsUpdate = true;
    if (canopyLow.instanceColor) canopyLow.instanceColor.needsUpdate = true;
    if (canopyTop.instanceColor) canopyTop.instanceColor.needsUpdate = true;
    this.scene.add(trunks, canopyLow, canopyTop);

    // Grass tufts — one instanced draw call, dense in open ground
    const grassGeo = new THREE.ConeGeometry(0.09, 0.55, 5);
    grassGeo.translate(0, 0.27, 0);
    const grassMat = new THREE.MeshStandardMaterial({ roughness: 0.9 });
    const grassCount = 1600;
    const grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    let gi = 0;
    for (let i = 0; i < grassCount * 3 && gi < grassCount; i++) {
      const x = (Math.random() - 0.5) * 330, z = (Math.random() - 0.5) * 330;
      if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
      if (hash(x * 5.3, z * 4.1) > 0.45) continue; // patchy
      const s = 0.7 + Math.random() * 1.1;
      dummy.position.set(x, this.getTerrainHeight(x, z), z);
      dummy.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.35);
      dummy.scale.set(s, s * (0.8 + Math.random() * 0.7), s);
      dummy.updateMatrix();
      grass.setMatrixAt(gi, dummy.matrix);
      col.setHSL(0.19 + Math.random() * 0.1, 0.42 + Math.random() * 0.2, 0.24 + Math.random() * 0.12);
      grass.setColorAt(gi, col);
      gi++;
    }
    grass.count = gi;
    grass.instanceMatrix.needsUpdate = true;
    if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
    this.scene.add(grass);
  }

  /**
   * Hedgerows, shrubbery, and underbrush — Gettysburg's fence-line vegetation.
   * Hedgerows get collision (real obstacles); shrubs/underbrush are soft cover you can push through.
   */
  private createUndergrowth() {
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    const hash = (x: number, z: number) => {
      const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
      return s - Math.floor(s);
    };

    // Organic bush geometry — jittered icosahedron reads as foliage, not a ball
    const bushGeo = new THREE.IcosahedronGeometry(1, 1);
    const bp = bushGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const j = 0.82 + hash(i * 3.7, i * 9.1) * 0.36;
      bp.setXYZ(i, bp.getX(i) * j, bp.getY(i) * j * 0.75, bp.getZ(i) * j);
    }
    bushGeo.computeVertexNormals();
    const bushMat = new THREE.MeshStandardMaterial({ roughness: 0.92, flatShading: true });

    // --- Hedgerow runs: [x1,z1,x2,z2] field-boundary lines ---
    const hedgeRuns: [number, number, number, number][] = [
      [-16, 50, 20, 54],     // Wheatfield north edge
      [-10, -42, -10, 18],   // Emmitsburg Road east side
      [-42, 67, -14, 70],    // Peach Orchard south edge
      [8, -78, 34, -72],     // Farm lane on Cemetery Hill's south slope
      [44, 30, 52, 58],      // Lane up toward Little Round Top
    ];
    const hedgeSpots: { x: number; z: number; s: number }[] = [];
    for (const [x1, z1, x2, z2] of hedgeRuns) {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const n = Math.floor(len / 1.6);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = x1 + (x2 - x1) * t + (hash(i * 7.3, x1) - 0.5) * 1.4;
        const z = z1 + (z2 - z1) * t + (hash(i * 3.9, z1) - 0.5) * 1.4;
        if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
        hedgeSpots.push({ x, z, s: 0.9 + Math.random() * 0.7 });
      }
    }
    const hedges = new THREE.InstancedMesh(bushGeo, bushMat, hedgeSpots.length);
    hedges.castShadow = true;
    hedgeSpots.forEach((h, i) => {
      dummy.position.set(h.x, this.getTerrainHeight(h.x, h.z) + 0.55 * h.s, h.z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(h.s * 1.25, h.s * 0.85, h.s * 1.25);
      dummy.updateMatrix();
      hedges.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.24 + Math.random() * 0.05, 0.4 + Math.random() * 0.2, 0.2 + Math.random() * 0.09);
      hedges.setColorAt(i, col);
      this.treeColliders.push({ x: h.x, z: h.z, r: 0.75 * h.s });
    });
    hedges.instanceMatrix.needsUpdate = true;
    if (hedges.instanceColor) hedges.instanceColor.needsUpdate = true;
    this.scene.add(hedges);

    // --- Shrubs: scattered, thicker near woodlot edges ---
    const stands = [
      { cx: -72, cz: -55, rx: 30, rz: 34 }, { cx: -38, cz: 78, rx: 24, rz: 28 },
      { cx: 0, cz: 128, rx: 30, rz: 30 }, { cx: 76, cz: -20, rx: 28, rz: 26 },
      { cx: -62, cz: 30, rx: 26, rz: 30 }, { cx: 17, cz: 22, rx: 13, rz: 15 },
    ];
    const shrubCount = 450;
    const shrubs = new THREE.InstancedMesh(bushGeo, bushMat, shrubCount);
    let si = 0;
    for (let i = 0; i < shrubCount * 4 && si < shrubCount; i++) {
      const x = (Math.random() - 0.5) * 330, z = (Math.random() - 0.5) * 330;
      if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
      if (Math.abs(x + 14) < 3.4 && z > -115 && z < 115) continue; // keep the pike clear
      // density gate: near woods or patchy open ground
      const nearWoods = stands.some(st => ((x - st.cx) / st.rx) ** 2 + ((z - st.cz) / st.rz) ** 2 < 1.6);
      if (!nearWoods && hash(x * 5.3, z * 4.1) > 0.28) continue;
      const s = 0.35 + Math.random() * 0.55;
      dummy.position.set(x, this.getTerrainHeight(x, z) + 0.3 * s, z);
      dummy.rotation.set(0, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(s * 1.3, s * 0.8, s * 1.3);
      dummy.updateMatrix();
      shrubs.setMatrixAt(si, dummy.matrix);
      col.setHSL(0.22 + Math.random() * 0.08, 0.38 + Math.random() * 0.22, 0.18 + Math.random() * 0.1);
      shrubs.setColorAt(si, col);
      si++;
    }
    shrubs.count = si;
    shrubs.instanceMatrix.needsUpdate = true;
    if (shrubs.instanceColor) shrubs.instanceColor.needsUpdate = true;
    this.scene.add(shrubs);

    // --- Underbrush: low dark clumps deep inside the woodlots ---
    const underCount = 700;
    const underGeo = new THREE.ConeGeometry(0.32, 0.5, 6);
    underGeo.translate(0, 0.22, 0);
    const underMat = new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true });
    const under = new THREE.InstancedMesh(underGeo, underMat, underCount);
    let ui = 0;
    for (let i = 0; i < underCount * 4 && ui < underCount; i++) {
      const st = stands[(Math.random() * stands.length) | 0];
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random());
      const x = st.cx + Math.cos(a) * st.rx * r;
      const z = st.cz + Math.sin(a) * st.rz * r;
      if (Math.abs(x) > 168 || Math.abs(z) > 168) continue;
      const s = 0.7 + Math.random() * 1.3;
      dummy.position.set(x, this.getTerrainHeight(x, z), z);
      dummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI * 2, 0);
      dummy.scale.set(s, s * (0.7 + Math.random() * 0.6), s);
      dummy.updateMatrix();
      under.setMatrixAt(ui, dummy.matrix);
      col.setHSL(0.25 + Math.random() * 0.05, 0.32, 0.1 + Math.random() * 0.08);
      under.setColorAt(ui, col);
      ui++;
    }
    under.count = ui;
    under.instanceMatrix.needsUpdate = true;
    if (under.instanceColor) under.instanceColor.needsUpdate = true;
    this.scene.add(under);
  }

  private createArtilleryCannon(x: number, y: number, z: number, rotY: number, id: string) {
    // 12-pounder Napoleon — bronze smoothbore profile, spoked wheels, split trail
    const cannonGroup = new THREE.Group();
    const barrelPivot = new THREE.Group();
    barrelPivot.position.set(0, 1.2, 0.4);

    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x9a7b2d, metalness: 0.9, roughness: 0.3 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2b2b2b, metalness: 0.8, roughness: 0.4 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x553C28, roughness: 0.8 });

    // Barrel from the breech: cascabel, breech, reinforces, chase, muzzle swell
    const barrelSegs: [number, number, number][] = [
      [0.24, 0.45, -0.85],  // breech
      [0.215, 0.55, -0.35], // first reinforce
      [0.19, 0.55, 0.20],   // second reinforce
      [0.165, 1.0, 0.95],   // chase
      [0.20, 0.18, 1.50],   // muzzle swell
    ];
    for (const [r, len, zc] of barrelSegs) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), bronzeMat);
      seg.rotation.x = Math.PI / 2;
      seg.position.set(0, 0, zc);
      seg.castShadow = true;
      barrelPivot.add(seg);
    }
    for (const zc of [-0.62, -0.08, 0.47]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.028, 8, 18), bronzeMat);
      ring.position.set(0, 0, zc);
      barrelPivot.add(ring);
    }
    const cascabel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 12), bronzeMat);
    cascabel.position.set(0, 0, -1.14);
    barrelPivot.add(cascabel);
    const cascabelNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), bronzeMat);
    cascabelNeck.rotation.x = Math.PI / 2;
    cascabelNeck.position.set(0, 0, -1.05);
    barrelPivot.add(cascabelNeck);
    for (const sx of [-0.24, 0.24]) {
      const trunnion = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 10), bronzeMat);
      trunnion.rotation.z = Math.PI / 2;
      trunnion.position.set(sx, 0, -0.35);
      barrelPivot.add(trunnion);
    }

    // Spoked wheels — iron tire in the YZ plane, wooden spokes, hub on the X axle
    const makeWheel = (sx: number) => {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.05, 8, 24), ironMat);
      tire.rotation.y = Math.PI / 2;
      wheel.add(tire);
      const spokeGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.62, 6);
      for (let i = 0; i < 10; i++) {
        const holder = new THREE.Group();
        holder.rotation.x = (i / 10) * Math.PI * 2;
        const spoke = new THREE.Mesh(spokeGeo, woodMat);
        spoke.position.y = 0.41;
        holder.add(spoke);
        wheel.add(holder);
      }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), woodMat);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      const hubBand = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.02, 6, 14), ironMat);
      hubBand.rotation.y = Math.PI / 2;
      wheel.add(hubBand);
      wheel.position.set(sx, 0.77, 0);
      wheel.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      return wheel;
    };

    const axle = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.16, 0.16), woodMat);
    axle.position.set(0, 0.77, 0);
    axle.castShadow = true;

    // Split trail arms sweeping back to the ground, joined by a transom
    const trailArmGeo = new THREE.BoxGeometry(0.16, 0.22, 2.4);
    const trailL = new THREE.Mesh(trailArmGeo, woodMat);
    trailL.position.set(-0.28, 0.55, -1.15);
    trailL.rotation.x = -0.18;
    trailL.rotation.y = 0.10;
    trailL.castShadow = true;
    const trailR = new THREE.Mesh(trailArmGeo, woodMat);
    trailR.position.set(0.28, 0.55, -1.15);
    trailR.rotation.x = -0.18;
    trailR.rotation.y = -0.10;
    trailR.castShadow = true;
    const transom = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.2), woodMat);
    transom.position.set(0, 0.62, -0.55);

    // Elevating screw under the breech
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), ironMat);
    screw.position.set(0, 0.95, -0.35);

    // Ammunition chest, shot pyramid, sponge bucket
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 0.4), woodMat);
    chest.position.set(0, 0.95, -1.5);
    chest.castShadow = true;
    const shotMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.7, roughness: 0.5 });
    const shotGeo = new THREE.SphereGeometry(0.11, 10, 10);
    for (const [ox, oz] of [[-0.14, 0], [0.14, 0], [0, 0.24]] as [number, number][]) {
      const ball = new THREE.Mesh(shotGeo, shotMat);
      ball.position.set(ox, 0.11, -2.15 + oz);
      ball.castShadow = true;
      cannonGroup.add(ball);
    }
    const topBall = new THREE.Mesh(shotGeo, shotMat);
    topBall.position.set(0, 0.28, -2.07);
    cannonGroup.add(topBall);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.11, 0.3, 10), woodMat);
    bucket.position.set(0.55, 0.15, -1.9);

    cannonGroup.add(barrelPivot, makeWheel(-0.78), makeWheel(0.78), axle,
      trailL, trailR, transom, screw, chest, bucket);
    cannonGroup.position.set(x, y, z);
    cannonGroup.rotation.y = rotY;
    this.scene.add(cannonGroup);

    this.artilleryPieces.push({
      id,
      group: cannonGroup,
      barrel: barrelPivot as any,
      position: new THREE.Vector3(x, y, z),
      rotY,
      pitch: 0.08,
      cooldown: 0,
      drill: freshDrillState(),
      drillTimer: -1,
    });
  }

  private createBarnAndDoors(x: number, z: number) {
    const barnGroup = new THREE.Group();
    const barnMat = new THREE.MeshStandardMaterial({ color: 0x7A1E1E, roughness: 0.85 }); // Pennsylvania Red
    const stoneFoundationMat = new THREE.MeshStandardMaterial({ color: 0x6E6C68, roughness: 0.95 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x3A3A3A, roughness: 0.8 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0xE8E6DF, roughness: 0.8 });

    // Foundation
    const foundation = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 10), stoneFoundationMat);
    foundation.position.y = 0.6;
    barnGroup.add(foundation);

    // Walls
    const mainWalls = new THREE.Mesh(new THREE.BoxGeometry(13.8, 4.5, 9.8), barnMat);
    mainWalls.position.y = 3.4;
    barnGroup.add(mainWalls);

    // Roof Gable
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.2, 4), roofMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.y = 7.2;
    roof.scale.set(1.1, 1, 0.85);
    barnGroup.add(roof);

    // White Trim Accents
    const trimTop = new THREE.Mesh(new THREE.BoxGeometry(14.1, 0.2, 10.1), trimMat);
    trimTop.position.y = 5.65;
    barnGroup.add(trimTop);

    barnGroup.position.set(x, this.getTerrainHeight(x, z), z);
    this.scene.add(barnGroup);

    // Two Interactive Barn Doors
    const doorMat = new THREE.MeshStandardMaterial({ color: 0x4A2E18, roughness: 0.8 });
    const doorGeo = new THREE.BoxGeometry(1.6, 3.2, 0.12);

    // Left Door (hinge at x - 1.6)
    const leftDoorHinge = new THREE.Group();
    leftDoorHinge.position.set(x - 1.6, 1.6, z + 5.0);
    const leftDoorMesh = new THREE.Mesh(doorGeo, doorMat);
    leftDoorMesh.position.set(0.8, 0, 0);
    leftDoorMesh.castShadow = true;
    leftDoorHinge.add(leftDoorMesh);
    this.scene.add(leftDoorHinge);

    this.interactiveDoors.push({
      id: 'barn_door_left',
      group: leftDoorHinge,
      position: new THREE.Vector3(x - 1.6, 1.6, z + 5.0),
      isOpen: false,
      currentAngle: 0,
      targetAngle: 0,
    });

    // Right Door (hinge at x + 1.6)
    const rightDoorHinge = new THREE.Group();
    rightDoorHinge.position.set(x + 1.6, 1.6, z + 5.0);
    const rightDoorMesh = new THREE.Mesh(doorGeo, doorMat);
    rightDoorMesh.position.set(-0.8, 0, 0);
    rightDoorMesh.castShadow = true;
    rightDoorHinge.add(rightDoorMesh);
    this.scene.add(rightDoorHinge);

    this.interactiveDoors.push({
      id: 'barn_door_right',
      group: rightDoorHinge,
      position: new THREE.Vector3(x + 1.6, 1.6, z + 5.0),
      isOpen: false,
      currentAngle: 0,
      targetAngle: 0,
    });
  }

  private createMilitaryCampsAndHospital() {
    const tentMat = new THREE.MeshStandardMaterial({ color: 0xE8E5D8, roughness: 0.9, side: THREE.DoubleSide });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5C4033, roughness: 0.8 });

    // 1. Union Campsite (A-frame canvas wedge tents along ridge)
    for (let i = 0; i < 5; i++) {
      const tent = new THREE.Group();
      const tentMesh = new THREE.Mesh(new THREE.ConeGeometry(2.2, 2.5, 4), tentMat);
      tentMesh.rotation.y = Math.PI / 4;
      tentMesh.position.y = 1.25;
      tentMesh.scale.set(1, 1, 1.5);
      tentMesh.castShadow = true;
      tent.add(tentMesh);

      // Bedroll / wooden stool outside
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.7), woodMat);
      crate.position.set(1.4, 0.25, 0);
      tent.add(crate);

      this.placeOnTerrain(tent, -20 - i * 4.5, -32 - (i % 2) * 3, 0);
      this.scene.add(tent);
    }

    // Campfire ring with glowing embers
    const campfire = new THREE.Group();
    const stoneRingMat = new THREE.MeshStandardMaterial({ color: 0x3A3A3A, roughness: 0.95 });
    for (let a = 0; a < 8; a++) {
      const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), stoneRingMat);
      const ang = (a / 8) * Math.PI * 2;
      stone.position.set(Math.cos(ang) * 0.7, 0.1, Math.sin(ang) * 0.7);
      campfire.add(stone);
    }
    const ember = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 0.15, 8),
      new THREE.MeshStandardMaterial({ color: 0xFF5722, roughness: 0.3 })
    );
    ember.position.y = 0.08;
    campfire.add(ember);
    const fireLight = new THREE.PointLight(0xFFA726, 1.8, 12);
    fireLight.position.y = 0.5;
    campfire.add(fireLight);
    this.placeOnTerrain(campfire, -26, -28, 0);
    this.scene.add(campfire);

    // 2. Field Hospital (Large tent with Red Cross Geneva banner)
    const hospitalGroup = new THREE.Group();
    const hospTent = new THREE.Mesh(new THREE.ConeGeometry(4.5, 4.0, 4), tentMat);
    hospTent.rotation.y = Math.PI / 4;
    hospTent.position.y = 2.0;
    hospTent.scale.set(1.2, 1, 1.8);
    hospTent.castShadow = true;
    hospitalGroup.add(hospTent);

    // Red Cross Geneva Flag on pole
    const hospPole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 5, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888 })
    );
    hospPole.position.set(0, 2.5, 3.2);
    const redCrossBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(1.8, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide })
    );
    redCrossBanner.position.set(0.9, 4.2, 3.2);
    const crossBar1 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.8, 0.25),
      new THREE.MeshStandardMaterial({ color: 0xCC0000, side: THREE.DoubleSide })
    );
    crossBar1.position.set(0.9, 4.2, 3.21);
    const crossBar2 = new THREE.Mesh(
      new THREE.PlaneGeometry(0.25, 0.8),
      new THREE.MeshStandardMaterial({ color: 0xCC0000, side: THREE.DoubleSide })
    );
    crossBar2.position.set(0.9, 4.2, 3.21);
    hospitalGroup.add(hospPole, redCrossBanner, crossBar1, crossBar2);

    // Hospital Stretcher
    const stretcher = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.15, 2.0), woodMat);
    stretcher.position.set(3.2, 0.15, 1.5);
    const blanket = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.2, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x4A5568 })
    );
    blanket.position.set(3.2, 0.28, 1.4);
    hospitalGroup.add(stretcher, blanket);

    this.placeOnTerrain(hospitalGroup, 32, -32, 0);
    this.scene.add(hospitalGroup);

    // 3. Mess Hall (Supply Wagon & Hardtack Barrels)
    const wagonGroup = new THREE.Group();
    const wagonBody = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.0, 3.8), woodMat);
    wagonBody.position.y = 1.2;
    wagonBody.castShadow = true;
    const canvasTop = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.8, 8, 1, false, 0, Math.PI), tentMat);
    canvasTop.rotation.z = Math.PI;
    canvasTop.rotation.y = Math.PI / 2;
    canvasTop.position.y = 2.0;
    wagonGroup.add(wagonBody, canvasTop);

    // 4 Wagon Wheels
    const wWheelMat = new THREE.MeshStandardMaterial({ color: 0x3E2723 });
    const wWheelGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.12, 12);
    [-1.1, 1.1].forEach((wx) => {
      [-1.3, 1.3].forEach((wz) => {
        const wh = new THREE.Mesh(wWheelGeo, wWheelMat);
        wh.rotation.z = Math.PI / 2;
        wh.position.set(wx, 0.6, wz);
        wagonGroup.add(wh);
      });
    });

    // Hardtack and Flour Barrels
    const barrelGeo = new THREE.CylinderGeometry(0.35, 0.4, 0.9, 12);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x6D4C41 });
    const b1 = new THREE.Mesh(barrelGeo, barrelMat);
    b1.position.set(1.8, 0.45, 0.8);
    const b2 = new THREE.Mesh(barrelGeo, barrelMat);
    b2.position.set(2.4, 0.45, 1.2);
    wagonGroup.add(b1, b2);

    this.placeOnTerrain(wagonGroup, -18, -18, 0);
    this.scene.add(wagonGroup);

    // 4. Confederate POW Pen Enclosure
    const powPen = new THREE.Group();
    const railFenceMat = new THREE.MeshStandardMaterial({ color: 0x4E3629, roughness: 0.9 });
    for (let r = 0; r < 4; r++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.2, 0.15), railFenceMat);
      p.position.set((r % 2 === 0 ? -3 : 3), 0.6, (r < 2 ? -3 : 3));
      powPen.add(p);
    }
    const fTop = new THREE.Mesh(new THREE.BoxGeometry(6, 0.12, 0.15), railFenceMat);
    fTop.position.set(0, 0.9, 3);
    const fSide = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 6), railFenceMat);
    fSide.position.set(3, 0.9, 0);
    powPen.add(fTop, fSide);

    // Union sentry guarding POW pen
    const sentry = this.createSoldierMesh('NORTH', 'PRIVATE');
    sentry.position.set(3.8, 0, 1.5);
    sentry.rotation.y = -Math.PI / 2;
    powPen.add(sentry);

    this.placeOnTerrain(powPen, 26, -12, 0);
    this.scene.add(powPen);
  }

  private createFlagPole(x: number, y: number, z: number, name: string, defaultFaction: Faction | 'NEUTRAL', id: string) {
    const poleGroup = new THREE.Group();
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 9.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 })
    );
    pole.position.set(0, 4.75, 0);
    pole.castShadow = true;
    poleGroup.add(pole);

    // Stone base for waypoint
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.4, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.9 })
    );
    base.position.y = 0.2;
    poleGroup.add(base);

    const flagGeo = new THREE.PlaneGeometry(2.4, 1.5, 8, 4);
    const flagColor = defaultFaction === 'NORTH' ? 0x1E3F66 : (defaultFaction === 'SOUTH' ? 0x8B0000 : 0x777777);
    const flagMat = new THREE.MeshStandardMaterial({
      color: flagColor,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
    const flag = new THREE.Mesh(flagGeo, flagMat);
    flag.position.set(1.2, 7.8, 0);
    flag.castShadow = true;
    poleGroup.add(flag);

    poleGroup.position.set(x, y, z);
    this.scene.add(poleGroup);
    this.flags.push({ mesh: flag, waveOffset: Math.random() * 10 });

    this.flagWaypoints.push({
      id,
      name,
      x,
      z,
      controllingFaction: defaultFaction,
      captureProgress: defaultFaction === 'NORTH' ? 100 : (defaultFaction === 'SOUTH' ? -100 : 0),
      flagMesh: flag,
      contested: false,
    });
  }

  private createAmbientSkirmishers() {
    // 12 Union soldiers along the stone wall on Cemetery Ridge, facing west
    for (let i = 0; i < 12; i++) {
      const soldier = this.createSoldierMesh('NORTH', 'PRIVATE');
      const sx = 18.4;
      const sz = -28 + i * 4.6;
      this.placeOnTerrain(soldier, sx, sz, 0);
      soldier.rotation.y = -Math.PI / 2; // facing west, toward Seminary Ridge
      this.scene.add(soldier);
      this.ambientSoldiers.push({
        group: soldier,
        faction: 'NORTH',
        fireCooldown: 2.0 + Math.random() * 6.0,
        x: sx,
        z: sz,
      });
    }

    // 12 Confederate skirmishers advancing across the fields, facing east
    for (let i = 0; i < 12; i++) {
      const soldier = this.createSoldierMesh('SOUTH', 'PRIVATE');
      const sx = -34 + (i % 2) * 5;
      const sz = -25 + i * 4.5 + (Math.random() - 0.5) * 3;
      this.placeOnTerrain(soldier, sx, sz, 0);
      soldier.rotation.y = Math.PI / 2; // facing east, toward the Angle
      this.scene.add(soldier);
      this.ambientSoldiers.push({
        group: soldier,
        faction: 'SOUTH',
        fireCooldown: 3.0 + Math.random() * 6.0,
        x: sx,
        z: sz,
      });
    }
  }

  public createSoldierMesh(faction: Faction, charType: 'PRIVATE' | 'SHARPSHOOTER' | 'SERGEANT' | 'OFFICER_BOSS'): THREE.Group {
    const soldier = new THREE.Group();

    // Authentic Uniform Colors & Regimental distinctions
    const isAuthentic = this.historicalSettings.authenticUniforms;
    const coatColor = faction === 'NORTH'
      ? (isAuthentic ? 0x14213d : 0x1d3c61) // 20th Maine Dark Indigo Wool
      : (charType === 'OFFICER_BOSS' ? 0x707070 : (isAuthentic ? 0x7D6C56 : 0x666666)); // 15th Alabama Butternut Homespun
    const pantsColor = faction === 'NORTH' ? 0x4A6B82 : (isAuthentic ? 0x635747 : 0x555555);
    const hatColor = faction === 'NORTH' ? (isAuthentic ? 0x0a0f18 : 0x121C2D) : 0x57483B;

    const coatMat = new THREE.MeshStandardMaterial({ color: coatColor, roughness: 0.8 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.85 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xD4A373, roughness: 0.6 });
    const leatherMat = new THREE.MeshStandardMaterial({ color: 0x2B1810, roughness: 0.5 });
    const hatMat = new THREE.MeshStandardMaterial({ color: hatColor, roughness: 0.7 });
    const brassMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, metalness: 0.85, roughness: 0.35 });

    // Torso — sack coat tapered at the waist, skirt below the belt
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.235, 0.68, 10), coatMat);
    torso.position.y = 1.26;
    torso.castShadow = true;
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.245, 0.28, 0.22, 10), coatMat);
    skirt.position.y = 0.86;

    // Belt, buckle and keeper
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.252, 0.252, 0.09, 10), leatherMat);
    belt.position.y = 1.0;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.03), brassMat);
    buckle.position.set(0, 1.0, 0.25);

    // Cartridge box on the right hip with brass breastplate
    const cartBox = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.12), leatherMat);
    cartBox.position.set(0.30, 0.98, -0.08);
    const cartPlate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.02), brassMat);
    cartPlate.position.set(0.30, 0.98, -0.015);

    // Cap pouch at the belt, front right
    const capPouch = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.10, 0.07), leatherMat);
    capPouch.position.set(0.16, 1.02, 0.24);

    // Canteen slung on the left hip
    const canteen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.10, 0.10, 0.05, 12),
      new THREE.MeshStandardMaterial({ color: 0x8a9a5b, roughness: 0.7 })
    );
    canteen.rotation.z = Math.PI / 2;
    canteen.position.set(-0.32, 1.02, 0);

    // Blanket bedroll across the chest
    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.78, 8),
      new THREE.MeshStandardMaterial({ color: faction === 'NORTH' ? 0x2E2E2E : 0x998877, roughness: 0.9 })
    );
    roll.rotation.z = Math.PI / 4;
    roll.position.set(0, 1.30, -0.02);
    roll.castShadow = true;

    // Head and kepi forage cap — flared crown, leather visor
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 12, 12), skinMat);
    head.position.y = 1.72;
    head.castShadow = true;
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.155, 0.13, 12), hatMat);
    crown.position.set(0, 1.84, -0.02);
    crown.rotation.x = -0.12;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.02, 0.13), leatherMat);
    visor.position.set(0, 1.775, 0.15);
    visor.rotation.x = 0.1;

    // Legs and brogans (legs are walk-animated by name)
    const legGeo = new THREE.BoxGeometry(0.17, 0.72, 0.19);
    const leftLeg = new THREE.Mesh(legGeo, pantsMat);
    leftLeg.position.set(-0.13, 0.48, 0);
    leftLeg.name = 'leftLeg';
    leftLeg.castShadow = true;
    const rightLeg = new THREE.Mesh(legGeo, pantsMat);
    rightLeg.position.set(0.13, 0.48, 0);
    rightLeg.name = 'rightLeg';
    rightLeg.castShadow = true;
    const bootGeo = new THREE.BoxGeometry(0.18, 0.16, 0.27);
    const leftBoot = new THREE.Mesh(bootGeo, leatherMat);
    leftBoot.position.set(-0.13, 0.08, 0.04);
    const rightBoot = new THREE.Mesh(bootGeo, leatherMat);
    rightBoot.position.set(0.13, 0.08, 0.04);

    // Arms angled forward, hands closed on the piece
    const armGeo = new THREE.BoxGeometry(0.13, 0.52, 0.13);
    const leftArm = new THREE.Mesh(armGeo, coatMat);
    leftArm.position.set(-0.31, 1.24, 0.12);
    leftArm.rotation.x = 0.55;
    const rightArm = new THREE.Mesh(armGeo, coatMat);
    rightArm.position.set(0.31, 1.24, 0.12);
    rightArm.rotation.x = 0.55;
    const handGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const leftHand = new THREE.Mesh(handGeo, skinMat);
    leftHand.position.set(-0.31, 1.02, 0.26);
    const rightHand = new THREE.Mesh(handGeo, skinMat);
    rightHand.position.set(0.31, 1.02, 0.26);

    // Musket prop — walnut stock, steel barrel, brass bands
    const musketProp = new THREE.Group();
    const pStock = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.09, 0.85),
      new THREE.MeshStandardMaterial({ color: 0x3B281B, roughness: 0.8 })
    );
    pStock.position.z = 0.28;
    const pBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 1.15, 8), steelMat);
    pBarrel.rotation.x = Math.PI / 2;
    pBarrel.position.z = -0.35;
    const pBandGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.035, 8);
    const pBand1 = new THREE.Mesh(pBandGeo, brassMat);
    pBand1.rotation.x = Math.PI / 2;
    pBand1.position.z = -0.15;
    const pBand2 = new THREE.Mesh(pBandGeo, brassMat);
    pBand2.rotation.x = Math.PI / 2;
    pBand2.position.z = -0.55;
    musketProp.add(pStock, pBarrel, pBand1, pBand2);
    musketProp.position.set(0.18, 1.12, 0.42);
    musketProp.rotation.x = 0.35;

    soldier.add(torso, skirt, belt, buckle, cartBox, cartPlate, capPouch, canteen, roll,
      head, crown, visor, leftLeg, rightLeg, leftBoot, rightBoot,
      leftArm, rightArm, leftHand, rightHand, musketProp);

    // Sergeant's chevrons — sky-blue infantry trim on both sleeves
    if (charType === 'SERGEANT') {
      const chevMat = new THREE.MeshStandardMaterial({ color: 0x7ba4db, roughness: 0.6 });
      for (const sx of [-0.31, 0.31]) {
        for (let r = 0; r < 3; r++) {
          const chev = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.035, 0.02), chevMat);
          chev.position.set(sx, 1.32 - r * 0.055, 0.145);
          chev.rotation.x = 0.55;
          soldier.add(chev);
        }
      }
    }

    if (charType === 'OFFICER_BOSS') {
      // Crimson sash, gilt shoulder straps, sword
      const sash = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.27, 0.11, 10),
        new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.4 })
      );
      sash.position.y = 0.95;
      soldier.add(sash);
      for (const sx of [-0.26, 0.26]) {
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.22), brassMat);
        strap.position.set(sx, 1.60, 0);
        soldier.add(strap);
      }
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.85, 0.06), steelMat);
      sword.position.set(-0.36, 0.75, 0.05);
      sword.rotation.z = 0.15;
      soldier.add(sword);
      soldier.scale.set(1.15, 1.15, 1.15);
    }

    return soldier;
  }

  private setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Space') {
        e.preventDefault();
        this.jumpQueued = true;
      }
      if (e.code === 'KeyR' && !this.isReloading && !this.mountedCannon) {
        this.startReload();
      }
      if (e.code === 'KeyV' || e.code === 'KeyF') {
        if (!this.mountedCannon) {
          this.performMeleeAttack();
        }
      }
      if (e.code === 'KeyQ') {
        this.drinkCanteen();
      }
      if (e.code === 'KeyE') {
        this.handleInteractKey();
      }
      if (e.code === 'KeyG') {
        this.triggerClassAbility();
      }
      if (e.code === 'Digit1') {
        if (this.mountedCannon) this.selectCannonAmmo('SOLID_SHOT');
        else this.switchWeapon(this.playerFaction === 'NORTH' ? 'springfield_1861' : 'enfield_1853');
      }
      if (e.code === 'Digit2') {
        if (this.mountedCannon) this.selectCannonAmmo('SHELL');
        else this.switchWeapon(this.playerFaction === 'NORTH' ? 'colt_navy_1851' : 'lemat_revolver');
      }
      if (e.code === 'Digit3') {
        if (this.mountedCannon) this.selectCannonAmmo('CANISTER');
        else this.switchWeapon(this.playerFaction === 'NORTH' ? 'spencer_repeater' : 'whitworth_sharpshooter');
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.container.addEventListener('click', () => {
      if (!this.isLocked) {
        this.container.requestPointerLock();
      } else {
        if (this.mountedCannon) {
          this.performDrillAction();
        } else {
          this.shootWeapon();
        }
      }
    });

    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    this.container.addEventListener('mousedown', (e) => {
      if (e.button === 2 && !this.mountedCannon) {
        this.isAimingADS = true;
      }
    });

    this.container.addEventListener('mouseup', (e) => {
      if (e.button === 2) {
        this.isAimingADS = false;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.container;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        if (this.mountedCannon) {
          this.mountedCannon.rotY -= e.movementX * 0.0012;
          this.mountedCannon.pitch -= e.movementY * 0.0012;
          this.mountedCannon.pitch = Math.max(-0.15, Math.min(0.4, this.mountedCannon.pitch));
          this.mountedCannon.group.rotation.y = this.mountedCannon.rotY;
          if (this.mountedCannon.barrel) {
            this.mountedCannon.barrel.rotation.x = -this.mountedCannon.pitch;
          }
          this.yaw = this.mountedCannon.rotY;
          this.pitch = this.mountedCannon.pitch;
        } else {
          const sensitivity = this.isAimingADS ? 0.0012 : 0.0022;
          this.yaw -= e.movementX * sensitivity;
          this.pitch -= e.movementY * sensitivity;
          this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
        }
      }
    });

    window.addEventListener('resize', () => {
      if (this.isDisposed || !this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    });
  }

  public handleInteractKey() {
    // 1. If currently mounted on a cannon, dismount!
    if (this.mountedCannon) {
      this.mountedCannon = null;
      this.callbacks.onCannonStateChange?.(false, 1);
      audio.playCannonAim();
      this.callbacks.onAddScorePopup({
        id: `dismount_${Date.now()}`,
        text: 'DISMOUNTED ARTILLERY',
        x: window.innerWidth / 2 - 80,
        y: window.innerHeight / 2 - 30,
        color: '#F1FAEE',
        scale: 1.1,
        opacity: 1,
        time: Date.now(),
      });
      return;
    }

    // 2. Check if near any artillery cannon (within 3.8m)
    let closestCannon: (typeof this.artilleryPieces)[0] | null = null;
    let closestCannonDist = 3.8;
    for (const cannon of this.artilleryPieces) {
      const dist = this.playerPos.distanceTo(cannon.position);
      if (dist < closestCannonDist) {
        closestCannonDist = dist;
        closestCannon = cannon;
      }
    }

    if (closestCannon) {
      this.mountedCannon = closestCannon;
      // Fresh crew drill every time the piece is manned
      closestCannon.drill = freshDrillState();
      closestCannon.drillTimer = -1;
      // Position player at breech of cannon
      const backOffset = new THREE.Vector3(0, 0, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), closestCannon.rotY);
      this.playerPos.set(closestCannon.position.x + backOffset.x, 1.6, closestCannon.position.z + backOffset.z);
      this.yaw = closestCannon.rotY;
      this.pitch = closestCannon.pitch;
      this.callbacks.onCannonStateChange?.(true, this.cannonReloadProgress);
      this.callbacks.onCannonDrillState?.(closestCannon.drill);
      audio.playCannonAim();
      this.callbacks.onAddScorePopup({
        id: `mount_${Date.now()}`,
        text: 'MANNING NAPOLEON 12-POUNDER — WORK THE DRILL [CLICK = CREW ACTION]',
        x: window.innerWidth / 2 - 220,
        y: window.innerHeight / 2 - 40,
        color: '#F59E0B',
        scale: 1.3,
        opacity: 1,
        time: Date.now(),
      });
      return;
    }

    // 3. Check if near interactive doors (within 3.2m)
    let closestDoor: (typeof this.interactiveDoors)[0] | null = null;
    let closestDoorDist = 3.2;
    for (const door of this.interactiveDoors) {
      const dist = this.playerPos.distanceTo(door.position);
      if (dist < closestDoorDist) {
        closestDoorDist = dist;
        closestDoor = door;
      }
    }

    if (closestDoor) {
      closestDoor.isOpen = !closestDoor.isOpen;
      const swingSign = closestDoor.id.includes('left') ? -1 : 1;
      closestDoor.targetAngle = closestDoor.isOpen ? swingSign * Math.PI * 0.48 : 0;
      audio.playDoorToggle();
      this.callbacks.onAddScorePopup({
        id: `door_${Date.now()}`,
        text: closestDoor.isOpen ? 'DOOR OPENED' : 'DOOR CLOSED',
        x: window.innerWidth / 2 - 60,
        y: window.innerHeight / 2 - 30,
        color: '#D4AF37',
        scale: 1.1,
        opacity: 1,
        time: Date.now(),
      });
      return;
    }

    // 4. Fallback: call off-map artillery strike if charged
    if (this.artilleryCharge >= 100) {
      this.callArtilleryStrike();
    }
  }

  /**
   * Crew drill action (left-click while manning the piece).
   * Walks the 1861 gun drill: SPONGE → LOAD → RAM → PRIME → AIM → READY → FIRE.
   */
  public performDrillAction() {
    const cannon = this.mountedCannon;
    if (!cannon || cannon.drillTimer > 0) return; // station already being worked
    const drill = cannon.drill;

    switch (drill.station) {
      case 'SPONGE':
      case 'LOAD':
      case 'RAM':
      case 'PRIME': {
        const def = stationDef(drill.station);
        drill.progress = 0;
        cannon.drillTimer = def.duration;
        // Station sounds at the start of the work
        if (drill.station === 'SPONGE') audio.playSpongeHiss();
        if (drill.station === 'RAM') audio.playRamThud();
        if (drill.station === 'PRIME') audio.playPrimerClick();
        this.callbacks.onCannonDrillState?.(drill);
        break;
      }
      case 'AIM':
        // Gunner is satisfied with the lay — crew stands clear
        drill.station = 'READY';
        drill.progress = 0;
        cannon.drillTimer = stationDef('READY').duration;
        voiceEngine.playRandomCommanderOrder(this.playerFaction, 'Ready! Stand clear of the piece!');
        this.callbacks.onCannonDrillState?.(drill);
        break;
      case 'READY':
        break; // crew is standing clear; the gun fires itself in a moment
      case 'FIRE':
        this.fireMountedCannon();
        break;
    }
  }

  /** Choose the ammunition nature while manning the piece (keys 1/2/3). */
  public selectCannonAmmo(ammo: CannonAmmoId) {
    const cannon = this.mountedCannon;
    if (!cannon) return;
    if (cannon.drill.ammo === ammo) return;
    cannon.drill.ammo = ammo;
    audio.playCannonAim();
    const def = CANNON_AMMO[ammo];
    this.callbacks.onAddScorePopup({
      id: `ammo_${Date.now()}`,
      text: `AMMUNITION: ${def.name.toUpperCase()} — ${def.use}`,
      x: window.innerWidth / 2 - 200,
      y: window.innerHeight / 2 + 60,
      color: '#F5D547',
      scale: 1.1,
      opacity: 1,
      time: Date.now(),
    });
    this.callbacks.onCannonDrillState?.(cannon.drill);
  }

  /** Advance the drill when a timed station completes. */
  private completeDrillStation() {
    const cannon = this.mountedCannon;
    if (!cannon) return;
    const drill = cannon.drill;

    switch (drill.station) {
      case 'SPONGE':
        drill.sponged = true;
        drill.station = 'LOAD';
        break;
      case 'LOAD':
        drill.station = 'RAM';
        break;
      case 'RAM': {
        // Ramming a charge into an unsponged bore gambles with a live ember
        if (!drill.sponged && Math.random() < COOKOFF_CHANCE) {
          this.prematureDischarge();
          return;
        }
        drill.station = 'PRIME';
        break;
      }
      case 'PRIME':
        drill.station = 'AIM';
        voiceEngine.playRandomCommanderOrder(this.playerFaction, 'Lay the piece, gunner!');
        break;
      case 'READY':
        drill.station = 'FIRE';
        break;
      default:
        break;
    }
    drill.progress = 0;
    cannon.drillTimer = -1;
    this.callbacks.onCannonDrillState?.(drill);
  }

  /** A live ember sets the charge off in the bore while ramming — the gunner's nightmare. */
  private prematureDischarge() {
    const cannon = this.mountedCannon;
    if (!cannon) return;
    audio.playCookoff();
    this.addCameraShake(0.7);
    const muzzlePos = this.cannonMuzzlePos(cannon);
    this.spawnArtilleryExplosion(muzzlePos);
    // The gunner takes the flash; the drill is ruined and starts over
    this.health = Math.max(1, this.health - COOKOFF_DAMAGE);
    this.callbacks.onHealthChange(this.health, this.maxHealth);
    cannon.drill = freshDrillState();
    cannon.drillTimer = -1;
    this.callbacks.onCannonDrillState?.(cannon.drill);
    voiceEngine.playRandomCommanderOrder(this.playerFaction, 'Premature discharge! Sponge her out and start over, damn it!');
    this.callbacks.onAddScorePopup({
      id: `cookoff_${Date.now()}`,
      text: '⚠ PREMATURE DISCHARGE — SPONGE THE PIECE NEXT TIME',
      x: window.innerWidth / 2 - 210,
      y: window.innerHeight / 2 - 60,
      color: '#FF4444',
      scale: 1.4,
      opacity: 1,
      time: Date.now(),
    });
  }

  private cannonMuzzlePos(cannon: NonNullable<GettysburgEngine['mountedCannon']>): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cannon.rotY);
    // pitch the forward vector for elevation
    forward.y = Math.tan(cannon.pitch);
    forward.normalize();
    return cannon.position.clone().add(forward.clone().multiplyScalar(2.0)).add(new THREE.Vector3(0, 1.2, 0));
  }

  private cannonForward(cannon: NonNullable<GettysburgEngine['mountedCannon']>): THREE.Vector3 {
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), cannon.rotY);
    forward.y = Math.tan(cannon.pitch);
    return forward.normalize();
  }

  /** White steam curling from the muzzle while the wet sponge does its work. */
  private spawnSteamParticle(pos: THREE.Vector3) {
    const geo = new THREE.SphereGeometry(0.12 + Math.random() * 0.12, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf2f4f4, transparent: true, opacity: 0.55 });
    const puff = new THREE.Mesh(geo, mat);
    puff.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.4, Math.random() * 0.3, (Math.random() - 0.5) * 0.4));
    this.scene.add(puff);
    const life = { t: 0 };
    const rise = () => {
      if (this.isDisposed) { this.scene.remove(puff); return; }
      life.t += 0.05;
      puff.position.y += 0.09;
      puff.scale.multiplyScalar(1.04);
      (puff.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.55 - life.t * 0.35);
      if (life.t < 1.6) requestAnimationFrame(rise);
      else { this.scene.remove(puff); puff.geometry.dispose(); (puff.material as THREE.Material).dispose(); }
    };
    rise();
  }

  /** Launch a solid shot or shell on its ballistic arc. */
  private launchCannonProjectile(muzzlePos: THREE.Vector3, dir: THREE.Vector3, ammo: CannonAmmoId) {
    const def = CANNON_AMMO[ammo];
    const geo = new THREE.SphereGeometry(ammo === 'SHELL' ? 0.16 : 0.13, 10, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.8, roughness: 0.4 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(muzzlePos);
    mesh.castShadow = true;
    this.scene.add(mesh);
    this.cannonProjectiles.push({
      mesh,
      vel: dir.clone().multiplyScalar(def.gameVelocity),
      ammo,
      life: 14,
    });
  }

  /** Resolve a projectile impact: blast, crater smoke, and damage. */
  private resolveCannonImpact(pos: THREE.Vector3, ammo: CannonAmmoId) {
    const def = CANNON_AMMO[ammo];
    this.spawnArtilleryExplosion(pos);
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Vector3((Math.random() - 0.5), 0.6, (Math.random() - 0.5)).normalize();
      this.spawnSmokeParticle(pos, d);
    }
    audio.playCannonBlast(0.7);

    // Local campaign enemies caught in the burst
    let hitCount = 0;
    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const d = Math.hypot(enemy.x - pos.x, enemy.z - pos.z);
      if (d < def.killRadius) {
        const dmg = Math.round(def.damage * (1 - (d / def.killRadius) * 0.6));
        enemy.health -= dmg;
        this.spawnBloodSplatter(new THREE.Vector3(enemy.x, 0.5, enemy.z));
        this.callbacks.onHitEnemy?.(false, dmg);
        hitCount++;
        if (enemy.health <= 0) {
          this.handleEnemyKill(enemy, `Napoleon 12-Pounder ${def.name}`, false, false);
        }
      }
    });

    // Multiplayer soldiers caught in the burst
    this.remotePlayerMeshes.forEach((mesh, playerId) => {
      const d = Math.hypot(mesh.position.x - pos.x, mesh.position.z - pos.z);
      if (d < def.killRadius) {
        const dmg = Math.round(def.damage * (1 - (d / def.killRadius) * 0.6));
        this.callbacks.onRemotePlayerCannonHit?.(playerId, dmg, `Napoleon 12-Pounder ${def.name}`);
        hitCount++;
      }
    });

    if (hitCount > 0) {
      voiceEngine.playRandomCommanderOrder(this.playerFaction, `Direct hit with the 12-pounder! Keep pouring ${def.short.toLowerCase()} into them!`);
      this.callbacks.onAddScorePopup({
        id: `cannon_hit_${Date.now()}`,
        text: `💥 ${def.name.toUpperCase()} DEVASTATION! (${hitCount} CASUALTIES)`,
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 2 - 60,
        color: '#F59E0B',
        scale: 1.6,
        opacity: 1,
        time: Date.now(),
      });
    }
  }

  public fireMountedCannon() {
    const cannon = this.mountedCannon;
    // The piece only fires when the crew drill has been fully worked
    if (!cannon || cannon.drill.station !== 'FIRE') return;

    const ammo = cannon.drill.ammo;
    const def = CANNON_AMMO[ammo];
    cannon.drill.roundsServed += 1;

    audio.playLanyardSnap();
    // Slight beat before the main charge — the primer's whisper before the roar
    setTimeout(() => audio.playCannonBlast(), 90);
    this.addCameraShake(1.0);

    const forward = this.cannonForward(cannon);
    const muzzlePos = this.cannonMuzzlePos(cannon);

    // Heavy muzzle smoke
    this.spawnArtilleryExplosion(muzzlePos);
    for (let i = 0; i < 10; i++) {
      this.spawnSmokeParticle(muzzlePos, forward);
    }

    let impactPos: number[] | undefined;
    if (ammo === 'CANISTER') {
      // 27 iron balls shredding apart at the muzzle — the giant shotgun
      for (let i = 0; i < 12; i++) {
        const fanDir = forward.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.15) * 0.22, (Math.random() - 0.5) * 0.4)
        ).normalize();
        const tracerEnd = muzzlePos.clone().add(fanDir.multiplyScalar(60));
        this.spawnBulletTracer(muzzlePos, tracerEnd, false);
      }

      // Cone damage to local enemies within 65m and ~40-degree arc
      let hitCount = 0;
      this.enemies.forEach((enemy) => {
        if (enemy.isDead) return;
        const toEnemy = new THREE.Vector3(enemy.x - cannon.position.x, 0, enemy.z - cannon.position.z);
        const dist = toEnemy.length();
        if (dist < 65) {
          const dot = toEnemy.normalize().dot(forward);
          if (dot > 0.65) {
            hitCount++;
            const dmg = Math.round(250 + Math.random() * 100);
            enemy.health -= dmg;
            this.spawnBloodSplatter(new THREE.Vector3(enemy.x, 0.5, enemy.z));
            this.callbacks.onHitEnemy?.(false, dmg);
            if (enemy.health <= 0) {
              this.handleEnemyKill(enemy, 'Napoleon 12-Pounder Canister', false, false);
            }
          }
        }
      });

      // Cone damage to multiplayer soldiers
      this.remotePlayerMeshes.forEach((mesh, playerId) => {
        const toP = new THREE.Vector3(mesh.position.x - cannon.position.x, 0, mesh.position.z - cannon.position.z);
        const dist = toP.length();
        if (dist < 65 && toP.normalize().dot(forward) > 0.65) {
          const dmg = Math.round(250 + Math.random() * 100);
          this.callbacks.onRemotePlayerCannonHit?.(playerId, dmg, 'Napoleon 12-Pounder Canister');
          hitCount++;
        }
      });

      if (hitCount > 0) {
        voiceEngine.playRandomCommanderOrder(this.playerFaction, "Double-shotted canister! Mow them down!");
        this.callbacks.onAddScorePopup({
          id: `cannon_hit_${Date.now()}`,
          text: `💥 CANISTER DEVASTATION! (${hitCount} CASUALTIES)`,
          x: window.innerWidth / 2 - 140,
          y: window.innerHeight / 2 - 60,
          color: '#F59E0B',
          scale: 1.6,
          opacity: 1,
          time: Date.now(),
        });
      }
    } else {
      // Solid shot and shell fly a true ballistic arc
      this.launchCannonProjectile(muzzlePos, forward, ammo);
      // Estimate the impact point for remote clients so they see the burst land
      const v = def.gameVelocity;
      const g = 9.8;
      const vy = forward.y * v;
      const vh = Math.hypot(forward.x * v, forward.z * v);
      const tFlight = (vy + Math.sqrt(vy * vy + 2 * g * muzzlePos.y)) / g;
      const range = Math.min(vh * tFlight, def.maxRange);
      const impact = muzzlePos.clone().add(new THREE.Vector3(forward.x, 0, forward.z).normalize().multiplyScalar(range));
      impact.y = this.getTerrainHeight(impact.x, impact.z);
      impactPos = [impact.x, impact.y, impact.z];
    }

    // Share the shot with the room — everyone sees and hears the piece fire
    this.callbacks.onLocalCannonFire?.({
      cannonId: cannon.id,
      muzzlePos: [muzzlePos.x, muzzlePos.y, muzzlePos.z],
      direction: [forward.x, forward.y, forward.z],
      rotY: cannon.rotY,
      pitch: cannon.pitch,
      ammo,
      impactPos,
    });

    // The drill begins anew — sponge the piece!
    const served = cannon.drill.roundsServed;
    cannon.drill = freshDrillState();
    cannon.drill.ammo = ammo; // keep the gunner's ammunition nature
    cannon.drill.roundsServed = served;
    cannon.drillTimer = -1;
    this.cannonReloadProgress = 0;
    this.callbacks.onCannonStateChange?.(true, 0);
    this.callbacks.onCannonDrillState?.(cannon.drill);
    voiceEngine.playRandomCommanderOrder(this.playerFaction, 'Sponge the piece! Serve her again!');
  }

  /** Another player fired a field piece — render the shared spectacle locally. */
  public handleRemoteCannonFire(data: {
    shooterId: string;
    cannonId: string;
    muzzlePos: number[];
    direction: number[];
    rotY: number;
    pitch: number;
    ammo?: CannonAmmoId;
    impactPos?: number[];
  }) {
    const muzzle = new THREE.Vector3(data.muzzlePos[0], data.muzzlePos[1], data.muzzlePos[2]);
    const dir = new THREE.Vector3(data.direction[0], data.direction[1], data.direction[2]);

    // Swing the piece to the firing lay so everyone sees where it points
    const cannon = this.artilleryPieces.find((c) => c.id === data.cannonId);
    if (cannon && cannon !== this.mountedCannon) {
      cannon.rotY = data.rotY;
      cannon.pitch = data.pitch;
      cannon.group.rotation.y = data.rotY;
      if (cannon.barrel) cannon.barrel.rotation.x = -data.pitch;
    }

    // Muzzle smoke + blast, scaled by distance
    this.spawnArtilleryExplosion(muzzle);
    for (let i = 0; i < 6; i++) this.spawnSmokeParticle(muzzle, dir);
    const dist = this.playerPos.distanceTo(muzzle);
    const vol = Math.max(0.12, 1 - dist / 140);
    audio.playCannonBlast(vol);
    if (dist < 45) this.addCameraShake(0.55 * (1 - dist / 45));

    const ammo = data.ammo || 'CANISTER';
    if (ammo === 'CANISTER') {
      // Canister fan tracers so the cone reads at a distance
      for (let i = 0; i < 6; i++) {
        const fanDir = dir.clone().add(
          new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.15) * 0.22, (Math.random() - 0.5) * 0.4)
        ).normalize();
        this.spawnBulletTracer(muzzle, muzzle.clone().add(fanDir.multiplyScalar(55)), false);
      }
    } else if (data.impactPos) {
      // Solid shot / shell bursting where the firer's ballistics say it landed
      const impact = new THREE.Vector3(data.impactPos[0], data.impactPos[1], data.impactPos[2]);
      const impactDist = this.playerPos.distanceTo(impact);
      if (impactDist < 220) {
        this.spawnArtilleryExplosion(impact);
        for (let i = 0; i < 5; i++) {
          this.spawnSmokeParticle(impact, new THREE.Vector3((Math.random() - 0.5), 0.7, (Math.random() - 0.5)).normalize());
        }
        if (impactDist < 60) this.addCameraShake(0.4 * (1 - impactDist / 60));
      }
    }
  }

  // Mobile / Virtual Controller API
  public handleTouchLook(deltaX: number, deltaY: number) {
    const sensitivity = this.isAimingADS ? 0.002 : 0.004;
    this.yaw -= deltaX * sensitivity;
    this.pitch -= deltaY * sensitivity;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
  }

  public handleTouchMove(moveX: number, moveY: number) {
    this.keys['KeyW'] = moveY < -0.25;
    this.keys['KeyS'] = moveY > 0.25;
    this.keys['KeyA'] = moveX < -0.25;
    this.keys['KeyD'] = moveX > 0.25;
  }

  public startMission() {
    this.currentWave = 1;
    this.health = 100;
    this.maxHealth = 100;
    this.score = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.kills = 0;
    this.headshots = 0;
    this.bayonetKills = 0;
    this.artilleryCharge = 0;
    this.abilityCooldown = 0;
    this.abilityActiveTimer = 0;
    this.damageResistance = 0;
    this.isSlowMoActive = false;
    this.waveStartTime = performance.now();

    // Reset Last Stand State
    this.hasUsedLastStand = false;
    this.isLastStandActive = false;
    this.lastStandTimer = 0;
    this.callbacks.onLastStandChange?.(false, 0);

    // Reset Cannon State
    this.mountedCannon = null;
    this.cannonReloadProgress = 1;
    this.callbacks.onCannonStateChange?.(false, 1);

    // Reset Capture The Flag Tickets
    this.unionTickets = 500;
    this.confedTickets = 500;
    this.ticketBleedTimer = 1.0;
    this.callbacks.onTicketChange?.(500, 500);

    // Trigger Bayonet Affix Intro Animation & Voice Order
    this.isAffixingBayonet = true;
    this.bayonetIntroProgress = 0;
    if (this.bayonetMesh) {
      this.bayonetMesh.position.z = -0.95;
    }
    audio.playBayonetAffix();
    voiceEngine.playRandomCommanderOrder(this.playerFaction, "Fix bayonets and prepare to hold the line!");

    this.playerPos.set(0, 1.7, this.playerFaction === 'NORTH' ? -35 : 35);
    this.yaw = this.playerFaction === 'NORTH' ? 0 : Math.PI;
    this.pitch = 0;

    audio.startBattlefieldDrums();
    audio.playBugleCharge();

    if (this.isCampaign) {
      this.spawnWave(this.currentWave);
    }
  }

  // Class Special Ability Trigger
  public triggerClassAbility() {
    if (this.abilityCooldown > 0) return;

    this.abilityCooldown = this.abilityMaxCooldown;
    this.abilityActiveTimer = this.abilityMaxDuration;
    audio.playAbilityActivate();

    if (this.playerClass === 'INFANTRY') {
      // Bayonet Charge Surge
      this.stamina = 100;
      this.callbacks.onAddScorePopup({
        id: `ab_${Date.now()}`,
        text: '⚔️ BAYONET CHARGE SURGE ACTIVE! (+70% SPRINT)',
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 3,
        color: '#D4AF37',
        scale: 1.5,
        opacity: 1,
        time: Date.now(),
      });
      audio.playBugleCharge();
    } else if (this.playerClass === 'SHARPSHOOTER') {
      // Eagle Eye Bullet-Time
      this.isSlowMoActive = true;
      audio.playSlowMotionSound();
      this.callbacks.onAddScorePopup({
        id: `ab_${Date.now()}`,
        text: '🎯 EAGLE EYE BULLET-TIME ACTIVE! (SLOW-MO FOCUS)',
        x: window.innerWidth / 2 - 150,
        y: window.innerHeight / 3,
        color: '#38BDF8',
        scale: 1.5,
        opacity: 1,
        time: Date.now(),
      });
    } else if (this.playerClass === 'MEDIC') {
      // Field Triage & Bandage
      this.health = Math.min(this.maxHealth, this.health + 70);
      this.stamina = 100;
      this.canteenCharges = Math.min(5, this.canteenCharges + 2);
      this.damageResistance = 0.35; // 35% damage reduction
      audio.playHealSound();
      this.callbacks.onHealthChange(this.health, this.maxHealth);
      this.callbacks.onCanteenChange(this.canteenCharges);
      this.callbacks.onAddScorePopup({
        id: `ab_${Date.now()}`,
        text: '🩹 FIELD TRIAGE HEAL (+70 HP & 35% RESIST)',
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 3,
        color: '#34D399',
        scale: 1.5,
        opacity: 1,
        time: Date.now(),
      });
    } else if (this.playerClass === 'OFFICER') {
      // Battery Canister Salvo
      this.artilleryCharge = Math.min(100, this.artilleryCharge + 40);
      this.callbacks.onArtilleryChargeChange(this.artilleryCharge);
      audio.playCannonBlast();
      audio.playHuzzahCheer(this.playerFaction);
      this.callbacks.onAddScorePopup({
        id: `ab_${Date.now()}`,
        text: '💣 BATTERY CANISTER SALVO DELIVERED! (+40% ARTILLERY)',
        x: window.innerWidth / 2 - 160,
        y: window.innerHeight / 3,
        color: '#F97316',
        scale: 1.5,
        opacity: 1,
        time: Date.now(),
      });

      // Frontline blast damage
      this.addCameraShake(0.55);
      this.enemies.forEach((enemy) => {
        if (!enemy.isDead && Math.abs(enemy.z - this.playerPos.z) < 40) {
          enemy.health -= 150;
          this.callbacks.onHitEnemy?.(false, 150);
          if (enemy.health <= 0) {
            this.handleEnemyKill(enemy, 'Canister Salvo', false, false);
          }
        }
      });
    }

    this.callbacks.onAbilityChange(this.abilityCooldown, this.abilityMaxCooldown, this.abilityActiveTimer, this.abilityMaxDuration);
  }

  private spawnWave(waveNumber: number) {
    this.currentWave = waveNumber;
    this.waveStartTime = performance.now();
    this.applyTimeOfDayForWave(waveNumber);
    const enemyFaction: Faction = this.playerFaction === 'NORTH' ? 'SOUTH' : 'NORTH';
    const enemyCount = 5 + waveNumber * 4;
    this.waveEnemiesRemaining = enemyCount;

    this.enemies.forEach((e) => {
      const m = this.enemyMeshes.get(e.id);
      if (m) this.scene.remove(m);
    });
    this.enemies = [];
    this.enemyMeshes.clear();

    const spawnZ = enemyFaction === 'SOUTH' ? (45 + Math.random() * 15) : -(45 + Math.random() * 15);

    for (let i = 0; i < enemyCount; i++) {
      const isBoss = (waveNumber === this.totalWaves && i === 0);
      const isSharpshooter = (i % 3 === 0);
      const charType = isBoss ? 'OFFICER_BOSS' : (isSharpshooter ? 'SHARPSHOOTER' : 'PRIVATE');
      const spawnX = (Math.random() - 0.5) * 80;
      const spawnZPos = spawnZ + (Math.random() - 0.5) * 20;

      const enemy: EnemyNPC = {
        id: `npc_${waveNumber}_${i}`,
        name: isBoss ? (enemyFaction === 'SOUTH' ? 'Gen. Armistead' : 'Col. Chamberlain') : (enemyFaction === 'SOUTH' ? `Rebel Pvt. #${i + 1}` : `Union Pvt. #${i + 1}`),
        faction: enemyFaction,
        x: spawnX,
        y: this.getTerrainHeight(spawnX, spawnZPos),
        z: spawnZPos,
        rotY: enemyFaction === 'SOUTH' ? Math.PI : 0,
        health: isBoss ? 350 : (isSharpshooter ? 75 : 100),
        maxHealth: isBoss ? 350 : (isSharpshooter ? 75 : 100),
        isDead: false,
        state: 'ADVANCE' as any,
        targetPos: { x: this.playerPos.x, y: 0, z: this.playerPos.z },
        shootCooldown: 2 + Math.random() * 3,
        reloadTimer: 0,
        moveSpeed: isBoss ? 3.2 : (2.0 + Math.random() * 1.5),
        accuracy: isSharpshooter ? 0.85 : 0.6,
        isBoss,
        charType,
      };

      const mesh = this.createSoldierMesh(enemyFaction, charType);
      mesh.position.set(enemy.x, enemy.y, enemy.z);
      mesh.rotation.y = enemy.rotY;
      this.scene.add(mesh);
      this.enemyMeshes.set(enemy.id, mesh);
      this.enemies.push(enemy);
    }
  }

  public shootWeapon() {
    if (this.shootCooldown > 0 || this.isReloading || this.isMeleeing) return;
    const wData = HISTORICAL_WEAPONS[this.currentWeaponKey] || HISTORICAL_WEAPONS['springfield_1861'];

    if (this.currentAmmo <= 0) {
      this.startReload();
      return;
    }

    this.currentAmmo -= 1;
    this.shootCooldown = 1 / wData.fireRate;
    this.callbacks.onAmmoChange(this.currentAmmo, this.reserveAmmo, this.isReloading, this.reloadProgress);

    if (this.currentWeaponKey.includes('colt') || this.currentWeaponKey.includes('lemat')) {
      audio.playRevolverFire();
    } else {
      audio.playMusketFire();
    }

    this.recoilPitch = this.isAimingADS ? 0.08 : 0.15;
    this.recoilOffsetZ = 0.18;
    this.addCameraShake(0.08);
    this.showMuzzleFlash();

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const muzzlePos = this.playerPos.clone().add(new THREE.Vector3(0.2, -0.1, -0.6).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')));
    this.spawnSmokeParticle(muzzlePos, forward);

    this.performHitScan(forward, wData);
  }

  private showMuzzleFlash() {
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 1;
    this.muzzleFlashLight.intensity = 8;
    setTimeout(() => {
      if (this.muzzleFlashMesh) {
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
        this.muzzleFlashLight.intensity = 0;
      }
    }, 60);
  }

  private spawnSmokeParticle(pos: THREE.Vector3, dir: THREE.Vector3) {
    const isAuthentic = this.historicalSettings.weaponBehavior === 'AUTHENTIC';
    const smokeCount = isAuthentic ? 8 : 4;

    for (let i = 0; i < smokeCount; i++) {
      const smokeGeo = new THREE.DodecahedronGeometry(0.18 + Math.random() * 0.15, 0);
      const smokeMat = new THREE.MeshStandardMaterial({
        color: 0xE2E0D8,
        transparent: true,
        opacity: isAuthentic ? 0.9 : 0.7,
        roughness: 1.0,
      });
      const smoke = new THREE.Mesh(smokeGeo, smokeMat);
      smoke.position.copy(pos);
      this.scene.add(smoke);

      const vel = dir.clone().multiplyScalar(1.5 + Math.random() * 2).add(
        new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.5 + 0.2, (Math.random() - 0.5) * 0.8)
      );

      this.particles.push({
        mesh: smoke,
        vel,
        life: (isAuthentic ? 3.0 : 1.5) + Math.random() * 1.0,
        maxLife: isAuthentic ? 3.8 : 2.5,
        scaleRate: isAuthentic ? 3.0 : 2.2,
      });
    }
  }

  private performHitScan(forward: THREE.Vector3, wData: any) {
    const raycaster = new THREE.Raycaster();
    const rayOrigin = this.playerPos.clone();
    
    // Accuracy spread — tight in ADS where the sights do the talking
    let spread = (1 - wData.accuracy) * (this.isAimingADS ? 0.12 : 0.55);
    if (this.playerClass === 'SHARPSHOOTER') {
      spread *= 0.5; // Precision perk
    }
    if (this.isSlowMoActive) {
      spread = 0.001; // Pinpoint
    }

    const spreadDir = forward.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)
    ).normalize();

    raycaster.set(rayOrigin, spreadDir);

    let closestEnemy: EnemyNPC | null = null;
    let closestDist = Infinity;
    let isHeadshot = false;

    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const enemyMesh = this.enemyMeshes.get(enemy.id);
      if (!enemyMesh) return;

      const intersects = raycaster.intersectObjects(enemyMesh.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.distance < closestDist && hit.distance <= wData.range) {
          closestDist = hit.distance;
          closestEnemy = enemy;
          isHeadshot = hit.point.y > (enemy.y + 1.6);
        }
      }
    });

    const muzzlePos = this.playerPos.clone().add(new THREE.Vector3(0.2, -0.1, -0.6).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')));
    const tracerEndPos = closestEnemy 
      ? rayOrigin.clone().add(spreadDir.clone().multiplyScalar(closestDist))
      : rayOrigin.clone().add(spreadDir.clone().multiplyScalar(Math.min(wData.range, 90)));

    // Visible bullet tracer line
    this.spawnBulletTracer(muzzlePos, tracerEndPos, false);

    if (closestEnemy) {
      const enemy = closestEnemy as EnemyNPC;
      let headshotMultiplier = 2.2;
      if (this.playerClass === 'SHARPSHOOTER') {
        headshotMultiplier = this.isSlowMoActive ? 3.5 : 2.8;
      }

      const damage = isHeadshot ? (wData.damage * headshotMultiplier) : wData.damage;
      enemy.health -= damage;

      audio.playHitMarker(isHeadshot);
      this.callbacks.onHitEnemy?.(isHeadshot, Math.round(damage));
      this.spawnImpactParticles(tracerEndPos, isHeadshot);
      this.spawnBloodSplatter(tracerEndPos);

      if (enemy.health <= 0) {
        this.handleEnemyKill(enemy, wData.name, isHeadshot, false);
      } else {
        this.callbacks.onAddScorePopup({
          id: `pop_${Date.now()}_${Math.random()}`,
          text: isHeadshot ? `HEADSHOT! -${Math.round(damage)}` : `-${Math.round(damage)}`,
          x: window.innerWidth / 2 + (Math.random() - 0.5) * 60,
          y: window.innerHeight / 2 - 40,
          color: isHeadshot ? '#FFD700' : '#FF4444',
          scale: isHeadshot ? 1.4 : 1.0,
          opacity: 1,
          time: Date.now(),
        });
      }
    }
  }

  public performMeleeAttack() {
    if (this.isMeleeing) return;
    this.isMeleeing = true;
    this.meleeTimer = 0.45;
    audio.playBayonetSwing();

    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    const isChargeSurge = this.playerClass === 'INFANTRY' && this.abilityActiveTimer > 0;
    const meleeRange = isChargeSurge ? 4.2 : 2.8;

    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const enemyVec = new THREE.Vector3(enemy.x, 0, enemy.z);
      const playerVec = new THREE.Vector3(this.playerPos.x, 0, this.playerPos.z);
      const dist = enemyVec.distanceTo(playerVec);

      if (dist <= meleeRange) {
        const toEnemy = enemyVec.clone().sub(playerVec).normalize();
        const dot = forward.dot(toEnemy);
        if (dot > 0.35 || isChargeSurge) {
          const dmg = isChargeSurge ? 250 : 130;
          enemy.health -= dmg;
          audio.playHitMarker(false);
          this.callbacks.onHitEnemy?.(false, dmg);
          const impactPos = new THREE.Vector3(enemy.x, 1.2, enemy.z);
          this.spawnImpactParticles(impactPos, false);
          this.spawnBloodSplatter(impactPos);

          if (enemy.health <= 0) {
            this.handleEnemyKill(enemy, isChargeSurge ? 'Bayonet Charge Surge' : 'Bayonet Thrust', false, true);
            // Instant musket reload on charge kill
            if (isChargeSurge) {
              const wData = HISTORICAL_WEAPONS[this.currentWeaponKey] || HISTORICAL_WEAPONS['springfield_1861'];
              this.currentAmmo = wData.magazineSize;
              this.callbacks.onAmmoChange(this.currentAmmo, this.reserveAmmo, false, 1);
            }
          }
        }
      }
    });
  }

  private handleEnemyKill(enemy: EnemyNPC, weaponName: string, isHeadshot: boolean, isMelee: boolean) {
    enemy.isDead = true;
    this.kills += 1;
    if (isHeadshot) this.headshots += 1;
    if (isMelee) this.bayonetKills += 1;

    // Blood splatter on ground below fallen enemy
    this.spawnBloodSplatter(new THREE.Vector3(enemy.x, 0.05, enemy.z));

    // Check Last Stand Heroic Revive
    if (this.isLastStandActive) {
      this.isLastStandActive = false;
      this.lastStandTimer = 0;
      this.health = 50;
      this.callbacks.onHealthChange(this.health, this.maxHealth);
      this.callbacks.onLastStandChange?.(false, 0);
      audio.playLastStandRevive();
      voiceEngine.playRandomCommanderOrder(this.playerFaction, "He rallied! Back in the fight, soldier!");
      this.callbacks.onAddScorePopup({
        id: `revive_${Date.now()}`,
        text: '⚡ LAST STAND SURVIVED! (+50 HP & 500 PTS)',
        x: window.innerWidth / 2 - 160,
        y: window.innerHeight / 2 - 50,
        color: '#10B981',
        scale: 1.8,
        opacity: 1,
        time: Date.now(),
      });
      this.score += 500;
    }

    // Combo multiplier system
    this.combo += 1;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 4.5;

    // Streak announcements
    if (this.combo === 2) audio.playStreakFanfare(2);
    if (this.combo === 3) audio.playStreakFanfare(3);
    if (this.combo === 5) audio.playStreakFanfare(5);

    // Veteran experience — the drill gets faster as the soldier seasons
    this.awardVeteranXP((isHeadshot ? 150 : 100) + (isMelee ? 150 : 0) + (enemy.isBoss ? 500 : 0));

    const basePoints = (isHeadshot ? 150 : 100) + (isMelee ? 150 : 0) + (enemy.isBoss ? 500 : 0);
    const multiplier = Math.min(5, this.combo);
    const totalPoints = basePoints * multiplier;
    this.score += totalPoints;

    // Artillery Charge meter gain
    const artGain = (isHeadshot ? 25 : 15) * (this.playerClass === 'OFFICER' ? 2 : 1);
    this.artilleryCharge = Math.min(100, this.artilleryCharge + artGain);
    this.callbacks.onArtilleryChargeChange(this.artilleryCharge);

    this.callbacks.onScoreChange(this.score, this.combo);

    let streakBadge = '';
    if (this.combo === 2) streakBadge = 'DOUBLE KILL! ';
    if (this.combo === 3) streakBadge = 'TRIPLE KILL! ';
    if (this.combo === 4) streakBadge = 'QUAD KILL! ';
    if (this.combo >= 5) streakBadge = 'HIGH WATER HERO (x5)! ';

    this.callbacks.onAddScorePopup({
      id: `kill_${Date.now()}_${Math.random()}`,
      text: `${streakBadge}+${totalPoints}${isHeadshot ? ' [HEADSHOT]' : isMelee ? ' [BAYONET]' : ''}`,
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 80,
      y: window.innerHeight / 2 - 80,
      color: this.combo >= 5 ? '#F59E0B' : isMelee ? '#E63946' : isHeadshot ? '#FFD700' : '#F1FAEE',
      scale: this.combo >= 3 ? 1.6 : 1.2,
      opacity: 1,
      time: Date.now(),
    });

    this.callbacks.onKill({
      id: `kf_${Date.now()}_${Math.random()}`,
      killer: this.playerFaction === 'NORTH' ? 'Union Soldier (You)' : 'Confederate Soldier (You)',
      victim: enemy.name,
      killerFaction: this.playerFaction,
      victimFaction: enemy.faction,
      weapon: weaponName,
      isHeadshot,
      isMelee,
      time: Date.now(),
    });

    const mesh = this.enemyMeshes.get(enemy.id);
    if (mesh) {
      mesh.rotation.x = -Math.PI / 2.2;
      mesh.position.y = 0.2;
    }

    this.waveEnemiesRemaining -= 1;

    // Check if wave cleared
    if (this.waveEnemiesRemaining <= 0) {
      const waveElapsed = (performance.now() - this.waveStartTime) / 1000;
      let speedBonus = 0;
      if (waveElapsed < 40) {
        speedBonus = 1000;
        this.score += speedBonus;
        this.callbacks.onScoreChange(this.score, this.combo);
      }

      if (this.currentWave < this.totalWaves) {
        audio.playObjectiveComplete();
        this.callbacks.onWaveComplete(this.currentWave, this.totalWaves, speedBonus);
        setTimeout(() => {
          this.spawnWave(this.currentWave + 1);
        }, 3000);
      } else {
        audio.playHuzzahCheer(this.playerFaction);
        audio.playBugleCharge();
        this.callbacks.onMissionWon({
          score: this.score,
          kills: this.kills,
          headshots: this.headshots,
          bayonetKills: this.bayonetKills,
          maxStreak: this.maxCombo,
        });
      }
    }
  }

  private spawnImpactParticles(pos: THREE.Vector3, isHeadshot: boolean) {
    for (let i = 0; i < 8; i++) {
      const pGeo = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const pMat = new THREE.MeshBasicMaterial({ color: isHeadshot ? 0xCC0000 : 0xAA1111 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.copy(pos);
      this.scene.add(p);

      this.particles.push({
        mesh: p,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 1, (Math.random() - 0.5) * 3),
        life: 0.6,
        maxLife: 0.6,
        scaleRate: 0.5,
      });
    }
  }

  private spawnBulletTracer(from: THREE.Vector3, to: THREE.Vector3, isEnemy: boolean) {
    const geo = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color: isEnemy ? 0xff6a3d : 0xffe9a8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.bulletTracers.push({ mesh: line, life: 0.09, maxLife: 0.09 });
  }

  private spawnBloodSplatter(pos: THREE.Vector3) {
    // A .58 Minie ball makes a grievous wound — arterial spray, mist, and a spreading pool
    const bloodMat = (op: number) => new THREE.MeshBasicMaterial({
      color: 0x7a0d0d, transparent: true, opacity: op, depthWrite: false,
    });
    // Heavy droplets
    for (let i = 0; i < 16; i++) {
      const s = 0.03 + Math.random() * 0.05;
      const drop = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), bloodMat(1));
      drop.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3
      ));
      this.scene.add(drop);
      const out = new THREE.Vector3(
        (Math.random() - 0.5), Math.random() * 0.9 + 0.15, (Math.random() - 0.5)
      ).normalize().multiplyScalar(1.5 + Math.random() * 3.5);
      this.particles.push({ mesh: drop, vel: out, life: 0.7 + Math.random() * 0.5, maxLife: 1.2, scaleRate: 0.02 });
    }
    // Fine mist
    for (let i = 0; i < 7; i++) {
      const mist = new THREE.Mesh(new THREE.SphereGeometry(0.09 + Math.random() * 0.08, 6, 5), bloodMat(0.55));
      mist.position.copy(pos);
      this.scene.add(mist);
      this.particles.push({
        mesh: mist,
        vel: new THREE.Vector3((Math.random() - 0.5) * 1.6, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 1.6),
        life: 0.45 + Math.random() * 0.25, maxLife: 0.7, scaleRate: 1.6,
      });
    }
    // Ground pool — spreads slowly, lingers, then soaks away
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(0.35 + Math.random() * 0.25, 12),
      new THREE.MeshBasicMaterial({ color: 0x5c0909, transparent: true, opacity: 0.85, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2;
    pool.rotation.z = Math.random() * Math.PI * 2;
    pool.position.set(
      pos.x + (Math.random() - 0.5) * 0.6,
      this.getTerrainHeight(pos.x, pos.z) + 0.03,
      pos.z + (Math.random() - 0.5) * 0.6
    );
    this.scene.add(pool);
    this.particles.push({ mesh: pool, vel: new THREE.Vector3(0, 0, 0), life: 22, maxLife: 22, scaleRate: 0.03, gravityScale: 0 });
  }

  public startReload() {
    if (this.isReloading || this.reserveAmmo <= 0) return;
    const wData = HISTORICAL_WEAPONS[this.currentWeaponKey] || HISTORICAL_WEAPONS['springfield_1861'];
    if (this.currentAmmo >= wData.magazineSize) return;

    this.isReloading = true;
    this.reloadProgress = 0;
    this.isAimingADS = false; // drill is performed from the hip
    audio.playReloadStage('POWDER');

    const isAuthentic = this.historicalSettings.weaponBehavior === 'AUTHENTIC';
    const totalTime = (isAuthentic ? (wData.authenticReloadTime || 12.0) : wData.reloadTime) * this.veteranReloadScale();
    const interval = 50;
    let elapsed = 0;
    const firedStages = new Set<string>();
    const stageAt = (mark: number, stage: 'TEAR' | 'BALL' | 'RAMROD' | 'CAP' | 'PRIMER') => {
      if (this.reloadProgress >= mark && !firedStages.has(stage)) {
        firedStages.add(stage);
        audio.playReloadStage(stage);
      }
    };

    const reloadTimer = setInterval(() => {
      if (this.isDisposed) {
        clearInterval(reloadTimer);
        return;
      }
      elapsed += interval / 1000;
      this.reloadProgress = Math.min(1, elapsed / totalTime);

      // Drill foley, fired once as each stage of the manual of arms is reached
      stageAt(0.24, 'TEAR');    // cartridge bitten open at the teeth
      stageAt(0.38, 'BALL');    // Minié ball thumbed into the muzzle
      stageAt(0.45, 'RAMROD');  // rammer drawn from the pipes
      stageAt(0.78, 'CAP');     // percussion cap pressed on the nipple
      stageAt(0.88, 'PRIMER');  // hammer drawn to full cock

      this.callbacks.onAmmoChange(this.currentAmmo, this.reserveAmmo, this.isReloading, this.reloadProgress);

      if (this.reloadProgress >= 1) {
        clearInterval(reloadTimer);
        this.isReloading = false;
        const needed = wData.magazineSize - this.currentAmmo;
        const taken = Math.min(needed, this.reserveAmmo);
        this.currentAmmo += taken;
        this.reserveAmmo -= taken;
        audio.playReloadStage('SUCCESS');
        this.callbacks.onAmmoChange(this.currentAmmo, this.reserveAmmo, false, 1);
      }
    }, interval);
  }

  public drinkCanteen() {
    if (this.canteenCharges <= 0 || this.health >= this.maxHealth) return;
    this.canteenCharges -= 1;
    this.health = Math.min(this.maxHealth, this.health + 45);
    this.stamina = 100;
    audio.playCanteenDrink();
    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.callbacks.onCanteenChange(this.canteenCharges);
  }

  public callArtilleryStrike() {
    if (this.artilleryCharge < 100) return;
    this.artilleryCharge = 0;
    this.callbacks.onArtilleryChargeChange(0);

    audio.playCannonBlast();
    audio.playHuzzahCheer(this.playerFaction);

    for (let i = 0; i < 5; i++) {
      setTimeout(() => {
        if (this.isDisposed) return;
        const impactX = (Math.random() - 0.5) * 50;
        const impactZ = this.playerFaction === 'NORTH' ? (15 + Math.random() * 40) : (-15 - Math.random() * 40);

        audio.playCannonBlast();
        this.addCameraShake(0.65);
        this.spawnArtilleryExplosion(new THREE.Vector3(impactX, 0, impactZ));

        this.enemies.forEach((enemy) => {
          if (enemy.isDead) return;
          const dist = new THREE.Vector3(enemy.x, 0, enemy.z).distanceTo(new THREE.Vector3(impactX, 0, impactZ));
          if (dist < 14) {
            enemy.health -= 250;
            if (enemy.health <= 0) {
              this.handleEnemyKill(enemy, '12-Pounder Napoleon Artillery', false, false);
            }
          }
        });
      }, i * 600);
    }
  }

  private spawnArtilleryExplosion(pos: THREE.Vector3) {
    for (let i = 0; i < 16; i++) {
      const dirtGeo = new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.4, 0);
      const dirtMat = new THREE.MeshStandardMaterial({ color: 0x332211, roughness: 1.0 });
      const dirt = new THREE.Mesh(dirtGeo, dirtMat);
      dirt.position.copy(pos);
      this.scene.add(dirt);

      this.particles.push({
        mesh: dirt,
        vel: new THREE.Vector3((Math.random() - 0.5) * 12, Math.random() * 10 + 6, (Math.random() - 0.5) * 12),
        life: 2.0,
        maxLife: 2.0,
        scaleRate: 0.9,
      });
    }
  }

  public switchWeapon(weaponKey: string) {
    if (!HISTORICAL_WEAPONS[weaponKey] || this.isReloading) return;
    this.currentWeaponKey = weaponKey;
    const wData = HISTORICAL_WEAPONS[weaponKey];
    this.currentAmmo = wData.magazineSize;
    this.reserveAmmo = wData.reserveAmmo;
    this.callbacks.onAmmoChange(this.currentAmmo, this.reserveAmmo, false, 0);
  }

  // Main Engine Loop
  private animate = () => {
    if (this.isDisposed) return;
    this.animFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    let dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    // Ability timers
    if (this.abilityCooldown > 0) {
      this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    }
    if (this.abilityActiveTimer > 0) {
      this.abilityActiveTimer = Math.max(0, this.abilityActiveTimer - dt);
      if (this.abilityActiveTimer <= 0) {
        this.isSlowMoActive = false;
        this.damageResistance = 0;
      }
    }
    this.callbacks.onAbilityChange(this.abilityCooldown, this.abilityMaxCooldown, this.abilityActiveTimer, this.abilityMaxDuration);

    // Medic passive health regeneration
    if (this.playerClass === 'MEDIC' && this.health < this.maxHealth && !this.isLastStandActive) {
      this.health = Math.min(this.maxHealth, this.health + dt * 2);
      this.callbacks.onHealthChange(this.health, this.maxHealth);
    }

    // Last Stand Countdown
    if (this.isLastStandActive) {
      this.lastStandTimer -= dt;
      this.callbacks.onLastStandChange?.(true, Math.max(0, this.lastStandTimer));
      if (this.lastStandTimer <= 0) {
        this.isLastStandActive = false;
        this.health = 0;
        this.callbacks.onHealthChange(0, this.maxHealth);
        this.callbacks.onLastStandChange?.(false, 0);
        this.callbacks.onMissionFailed();
      }
    }

    // World time dilation if Sharpshooter slow-motion is active
    const enemyDt = this.isSlowMoActive ? (dt * 0.35) : dt;

    this.updateCameraShake(dt);
    this.updateAtmosphereAndWeather(dt);
    this.updatePlayerMovement(dt);
    this.updateGunAnimation(dt);
    this.updateCannons(dt);
    this.updateDoors(dt);
    this.updateCaptureTheFlag(dt);
    this.updateAmbientSkirmishers(dt);
    this.updateTracers(dt);
    this.updateInteractivePromptsAndMinimap(dt);
    this.updateEnemies(enemyDt);
    this.updateParticles(dt);
    this.updateFlags(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
        this.callbacks.onScoreChange(this.score, this.combo);
      }
    }

    if (this.shootCooldown > 0) {
      this.shootCooldown -= dt;
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updatePlayerMovement(dt: number) {
    if (this.mountedCannon) {
      const backOffset = new THREE.Vector3(0, 0, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mountedCannon.rotY);
      this.playerPos.set(this.mountedCannon.position.x + backOffset.x, 1.6, this.mountedCannon.position.z + backOffset.z);
      this.camera.position.copy(this.playerPos).add(this.cameraShakeOffset);
      this.camera.rotation.set(0, 0, 0);
      this.camera.rotation.y = this.yaw + this.cameraShakeYaw;
      this.camera.rotation.x = this.pitch + this.cameraShakePitch;
      this.camera.rotation.z = this.cameraShakeRoll;
      return;
    }

    const isSurging = this.playerClass === 'INFANTRY' && this.abilityActiveTimer > 0;
    const baseSpeed = this.isSprinting ? (isSurging ? 12.0 : 7.8) : (this.isCrouching ? 2.5 : 4.8);
    const moveSpeed = this.playerClass === 'INFANTRY' ? baseSpeed * 1.12 : baseSpeed;
    const moveDir = new THREE.Vector3();

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveDir.z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveDir.z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveDir.x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveDir.x += 1;

    this.isSprinting = (!!(this.keys['ShiftLeft'] || this.keys['ShiftRight']) || isSurging) && this.stamina > 5 && moveDir.lengthSq() > 0;
    this.isCrouching = !!(this.keys['KeyC'] || this.keys['ControlLeft']);

    if (this.isSprinting && !isSurging) {
      this.stamina = Math.max(0, this.stamina - dt * 25);
    } else {
      this.stamina = Math.min(100, this.stamina + dt * 18);
    }
    this.callbacks.onStaminaChange(this.stamina);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.playerPos.x += moveDir.x * moveSpeed * dt;
      this.playerPos.z += moveDir.z * moveSpeed * dt;
      this.bobTimer += dt * (this.isSprinting ? 14 : 9);

      // Footstep audio system based on surface material
      this.stepTimer += dt;
      const stepInterval = this.isSprinting ? 0.30 : (this.isCrouching ? 0.65 : 0.46);
      if (this.stepTimer >= stepInterval) {
        const surface = this.getPlayerSurface();
        audio.playFootstep(surface, this.isSprinting);
        this.stepTimer = 0;
      }
    } else {
      this.bobTimer += dt * 2;
      this.stepTimer = 0.2;
    }

    this.playerPos.x = Math.max(-150, Math.min(150, this.playerPos.x));
    this.playerPos.z = Math.max(-150, Math.min(150, this.playerPos.z));

    // Trunk & boulder collision — slide around, never through
    for (const c of this.treeColliders) {
      const dx = this.playerPos.x - c.x;
      const dz = this.playerPos.z - c.z;
      const rr = c.r + 0.45;
      const d2 = dx * dx + dz * dz;
      if (d2 < rr * rr && d2 > 1e-6) {
        const d = Math.sqrt(d2);
        this.playerPos.x = c.x + (dx / d) * rr;
        this.playerPos.z = c.z + (dz / d) * rr;
      }
    }

    // Terrain grounding + jump physics — boots stay on Gettysburg soil
    const groundY = this.getTerrainHeight(this.playerPos.x, this.playerPos.z);
    if (this.jumpQueued) {
      if (this.isGrounded && !this.isCrouching) {
        this.verticalVel = 6.4;
        this.isGrounded = false;
      }
      this.jumpQueued = false;
    }
    if (!this.isGrounded) {
      this.verticalVel -= 21 * dt;
      this.jumpY += this.verticalVel * dt;
      if (this.jumpY <= 0) { this.jumpY = 0; this.verticalVel = 0; this.isGrounded = true; }
    }
    const eyeTarget = this.isCrouching ? 1.05 : 1.7;
    this.eyeHeightSm += (eyeTarget - this.eyeHeightSm) * Math.min(1, 12 * dt);
    this.playerPos.y = groundY + this.eyeHeightSm + this.jumpY;

    this.camera.position.copy(this.playerPos).add(this.cameraShakeOffset);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.yaw + this.cameraShakeYaw;
    this.camera.rotation.x = this.pitch + this.cameraShakePitch;
    this.camera.rotation.z = this.cameraShakeRoll;
  }

  private updateGunAnimation(dt: number) {
    if (this.mountedCannon) {
      this.gunPivot.position.set(0, -2, 0);
      return;
    }

    this.recoilPitch = Math.max(0, this.recoilPitch - dt * 1.5);
    this.recoilOffsetZ = Math.max(0, this.recoilOffsetZ - dt * 1.8);

    const targetFov = this.isAimingADS ? (this.currentWeaponKey.includes('whitworth') ? 20 : 45) : 75;
    this.camera.fov += (targetFov - this.camera.fov) * 12 * dt;
    this.camera.updateProjectionMatrix();

    // ADS centers the bore on the eye — iron sights sit exactly at screen center
    const adsTargetPos = new THREE.Vector3(0.0, -0.05, -0.55);
    const hipTargetPos = new THREE.Vector3(0.24, -0.22, -0.45);
    const targetPos = this.isAimingADS ? adsTargetPos : hipTargetPos;

    const bobMultiplier = (this.playerClass === 'SHARPSHOOTER' && this.isAimingADS) ? 0 : 1;
    const bobX = Math.cos(this.bobTimer * 0.5) * (this.isAimingADS ? 0.002 : 0.015) * bobMultiplier;
    const bobY = Math.sin(this.bobTimer) * (this.isAimingADS ? 0.002 : 0.012) * bobMultiplier;

    // ---- Loading drill — Casey's "load in nine times," compressed ----
    // LOAD: piece drops muzzle-up, held perpendicular at the left of the face,
    //   hammer to half-cock. HANDLE: cartridge from the box. TEAR: bitten open
    //   at the teeth. CHARGE: powder poured, ball thumbed into the muzzle.
    //   DRAW: rammer from the pipes. RAM: two firm strokes. RETURN: rammer home.
    //   PRIME: cap pressed on the nipple (still half-cock). SHOULDER: full cock.
    if (this.isReloading) {
      const p = this.reloadProgress;
      const sstep = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
      };
      const K = [
        { p: 0.00, pos: [0.24, -0.22, -0.45], rot: [0, 0, 0] },
        { p: 0.14, pos: [-0.14, -0.34, -0.38], rot: [1.05, 0.12, 0.18] },  // LOAD — muzzle up
        { p: 0.42, pos: [-0.14, -0.34, -0.38], rot: [1.05, 0.12, 0.18] },  // HANDLE→CHARGE — pour
        { p: 0.72, pos: [-0.12, -0.32, -0.38], rot: [1.00, 0.10, 0.15] },  // DRAW→RAM→RETURN
        { p: 0.84, pos: [-0.06, -0.28, -0.40], rot: [0.55, 0.05, 0.08] },  // PRIME — cap on nipple
        { p: 1.00, pos: [0.24, -0.22, -0.45], rot: [0, 0, 0] },             // SHOULDER — full cock
      ];
      let ka = K[0], kb = K[K.length - 1];
      for (let i = 0; i < K.length - 1; i++) {
        if (p >= K[i].p && p <= K[i + 1].p) { ka = K[i]; kb = K[i + 1]; break; }
      }
      const t = sstep(ka.p, kb.p, p);
      const L = (u: number, v: number) => u + (v - u) * t;
      this.gunPivot.position.set(
        L(ka.pos[0], kb.pos[0]) + bobX * 0.4,
        L(ka.pos[1], kb.pos[1]) + bobY * 0.4,
        L(ka.pos[2], kb.pos[2]) + this.recoilOffsetZ
      );
      this.gunPivot.rotation.set(
        L(ka.rot[0], kb.rot[0]) + this.recoilPitch,
        L(ka.rot[1], kb.rot[1]),
        L(ka.rot[2], kb.rot[2])
      );
      // Paper cartridge: box → teeth (tear) → muzzle (pour) → discarded
      if (this.cartridgeMesh) {
        const cm = this.cartridgeMesh;
        if (p < 0.14 || p > 0.46) {
          cm.visible = false;
        } else {
          cm.visible = true;
          if (p < 0.24) {
            // HANDLE — right hand brings the cartridge up from the box
            const ht = sstep(0.14, 0.24, p);
            cm.position.set(0.30 - 0.21 * ht, -0.40 + 0.30 * ht, -0.35 + 0.03 * ht);
            cm.rotation.set(0.3, 0, 0.2);
          } else if (p < 0.30) {
            // TEAR — bitten open at the teeth, small rip shake
            const j = Math.sin(p * 400) * 0.008;
            cm.position.set(0.09 + j, -0.10 + j * 0.5, -0.32);
            cm.rotation.set(0.3 + j * 2, 0, 0.2);
          } else if (p < 0.40) {
            // CHARGE — tipped over the muzzle to pour the powder
            const ct = sstep(0.30, 0.36, p);
            cm.position.set(0.09 - 0.23 * ct, -0.10 + 0.88 * ct, -0.32 - 0.68 * ct);
            cm.rotation.set(0.3 + ct * 2.4, 0, 0.2);
          } else {
            // torn paper tossed aside
            const dt2 = sstep(0.40, 0.46, p);
            cm.position.set(-0.14 + 0.10 * dt2, 0.78 - 0.55 * dt2, -1.00 + 0.25 * dt2);
            cm.rotation.set(2.7 + dt2, 0, 0.2 + dt2);
          }
        }
      }
      // Powder pour bloom at the muzzle while charging
      if (this.pourPuffMesh) {
        const pm = this.pourPuffMesh;
        const pa = sstep(0.33, 0.36, p) * (1 - sstep(0.40, 0.45, p));
        pm.visible = pa > 0.01;
        (pm.material as THREE.MeshBasicMaterial).opacity = 0.45 * pa;
        pm.position.set(-0.14, 0.80, -1.02);
        const ps = 0.6 + 0.9 * sstep(0.33, 0.45, p);
        pm.scale.set(ps, ps, ps);
      }
      // Rammer drill — drawn at 0.42, two firm strokes, returned by 0.72
      if (this.ramrodMesh) {
        const drawT = sstep(0.42, 0.50, p) * (1 - sstep(0.64, 0.72, p));
        const stroke = (p > 0.50 && p < 0.64)
          ? (Math.sin((p - 0.50) / 0.14 * Math.PI * 2) * 0.5 + 0.5)
          : 0;
        this.ramrodMesh.position.set(
          0,
          -0.035 + drawT * 0.10,
          -0.7 - drawT * 1.05 + stroke * 0.38 * drawT
        );
      }
      // Hammer — half-cock at LOAD (safe while loading), full cock at SHOULDER
      if (this.hammerMesh) {
        this.hammerMesh.rotation.x = -0.45 * sstep(0.02, 0.10, p) - 0.40 * sstep(0.84, 0.96, p);
      }
    } else {
      this.gunPivot.position.set(
        targetPos.x + bobX,
        targetPos.y + bobY,
        targetPos.z + this.recoilOffsetZ
      );
      this.gunPivot.rotation.set(this.recoilPitch, 0, 0);
      // Drill reset
      if (this.ramrodMesh) this.ramrodMesh.position.set(0, -0.035, -0.7);
      if (this.hammerMesh) this.hammerMesh.rotation.x = 0;
      if (this.cartridgeMesh) this.cartridgeMesh.visible = false;
      if (this.pourPuffMesh) this.pourPuffMesh.visible = false;
    }

    // Bayonet affixing entry slide animation
    if (this.isAffixingBayonet) {
      this.bayonetIntroProgress += dt * 1.5;
      if (this.bayonetIntroProgress >= 1) {
        this.bayonetIntroProgress = 1;
        this.isAffixingBayonet = false;
      }
      if (this.bayonetMesh) {
        this.bayonetMesh.position.z = -1.12 - (this.bayonetIntroProgress * 0.4);
      }
    }

    if (this.isMeleeing) {
      this.meleeTimer -= dt;
      if (this.meleeTimer > 0.2) {
        this.gunPivot.position.z -= 0.35;
        this.gunPivot.rotation.x -= 0.2;
      } else if (this.meleeTimer <= 0) {
        this.isMeleeing = false;
      }
    }
  }

  private updateCannons(dt: number) {
    for (const cannon of this.artilleryPieces) {
      if (cannon.cooldown > 0) {
        cannon.cooldown = Math.max(0, cannon.cooldown - dt);
        if (this.mountedCannon === cannon) {
          this.cannonReloadProgress = 1 - (cannon.cooldown / 4.5);
          this.callbacks.onCannonStateChange?.(true, this.cannonReloadProgress);
        }
      }
    }

    // Crew drill progress on the manned piece
    const mounted = this.mountedCannon;
    if (mounted && mounted.drillTimer > 0) {
      const def = stationDef(mounted.drill.station);
      mounted.drillTimer = Math.max(0, mounted.drillTimer - dt);
      mounted.drill.progress = def.duration > 0 ? 1 - mounted.drillTimer / def.duration : 1;
      this.callbacks.onCannonDrillState?.(mounted.drill);
      // Wet sponge steaming while No. 1 works the bore
      if (mounted.drill.station === 'SPONGE' && Math.random() < 0.35) {
        this.spawnSteamParticle(this.cannonMuzzlePos(mounted));
      }
      if (mounted.drillTimer <= 0) {
        this.completeDrillStation();
      }
    }

    // Ballistic projectiles: solid shot and shell
    for (let i = this.cannonProjectiles.length - 1; i >= 0; i--) {
      const p = this.cannonProjectiles[i];
      p.life -= dt;
      p.vel.y -= 9.8 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      const groundY = this.getTerrainHeight(p.mesh.position.x, p.mesh.position.z);
      const hitGround = p.mesh.position.y <= groundY + 0.1;
      if (hitGround || p.life <= 0) {
        const impact = p.mesh.position.clone();
        impact.y = Math.max(impact.y, groundY);
        // Solid shot skips: a fast graze kicks up dirt and bounces onward,
        // the way round shot mowed through ranks
        if (p.ammo === 'SOLID_SHOT' && hitGround && p.vel.length() > 45 && Math.random() < 0.6) {
          this.spawnArtilleryExplosion(impact);
          p.vel.y = Math.abs(p.vel.y) * 0.35;
          p.vel.x *= 0.7;
          p.vel.z *= 0.7;
          p.mesh.position.y = groundY + 0.15;
          p.life = Math.min(p.life, 3);
          continue;
        }
        this.resolveCannonImpact(impact, p.ammo);
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.cannonProjectiles.splice(i, 1);
      }
    }
  }

  private updateDoors(dt: number) {
    for (const door of this.interactiveDoors) {
      door.currentAngle += (door.targetAngle - door.currentAngle) * 6.0 * dt;
      door.group.rotation.y = door.currentAngle;
    }
  }

  private updateCaptureTheFlag(dt: number) {
    for (const flag of this.flagWaypoints) {
      const distToPlayer = Math.hypot(this.playerPos.x - flag.x, this.playerPos.z - flag.z);
      if (distToPlayer < 14) {
        if (this.playerFaction === 'NORTH') {
          flag.captureProgress = Math.min(100, flag.captureProgress + dt * 25);
        } else {
          flag.captureProgress = Math.max(-100, flag.captureProgress - dt * 25);
        }
      }

      // Check living enemy presence in zone
      let nearbyEnemies = 0;
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        const dist = Math.hypot(enemy.x - flag.x, enemy.z - flag.z);
        if (dist < 14) {
          nearbyEnemies++;
          if (enemy.faction === 'SOUTH') {
            flag.captureProgress = Math.max(-100, flag.captureProgress - dt * 10);
          } else {
            flag.captureProgress = Math.min(100, flag.captureProgress + dt * 10);
          }
        }
      }

      flag.contested = distToPlayer < 14 && nearbyEnemies > 0;

      // Update controlling faction
      if (flag.captureProgress >= 60) {
        if (flag.controllingFaction !== 'NORTH') {
          flag.controllingFaction = 'NORTH';
          audio.playFlagCapture();
          this.callbacks.onAddScorePopup({
            id: `cap_${Date.now()}`,
            text: `🚩 UNION SECURED ${flag.name.toUpperCase()}!`,
            x: window.innerWidth / 2 - 140,
            y: window.innerHeight / 3,
            color: '#38BDF8',
            scale: 1.5,
            opacity: 1,
            time: Date.now(),
          });
          voiceEngine.playRandomCommanderOrder(this.playerFaction, `We have secured ${flag.name}! Hold fast!`);
        }
        (flag.flagMesh.material as THREE.MeshStandardMaterial).color.setHex(0x1E3F66);
      } else if (flag.captureProgress <= -60) {
        if (flag.controllingFaction !== 'SOUTH') {
          flag.controllingFaction = 'SOUTH';
          audio.playFlagCapture();
          this.callbacks.onAddScorePopup({
            id: `cap_${Date.now()}`,
            text: `🚩 REBELS SEIZED ${flag.name.toUpperCase()}!`,
            x: window.innerWidth / 2 - 140,
            y: window.innerHeight / 3,
            color: '#EF4444',
            scale: 1.5,
            opacity: 1,
            time: Date.now(),
          });
          voiceEngine.playRandomCommanderOrder(this.playerFaction, `The enemy has seized ${flag.name}! Form ranks!`);
        }
        (flag.flagMesh.material as THREE.MeshStandardMaterial).color.setHex(0x8B0000);
      }

      // Height animation based on control dominance
      const norm = Math.abs(flag.captureProgress) / 100;
      flag.flagMesh.position.y = 1.5 + norm * 5.8;
    }

    // Ticket Bleed System
    this.ticketBleedTimer -= dt;
    if (this.ticketBleedTimer <= 0) {
      this.ticketBleedTimer = 1.0;
      const northFlags = this.flagWaypoints.filter((f) => f.controllingFaction === 'NORTH').length;
      const southFlags = this.flagWaypoints.filter((f) => f.controllingFaction === 'SOUTH').length;

      if (northFlags > southFlags) {
        const bleed = (northFlags - southFlags) * 3;
        this.confedTickets = Math.max(0, this.confedTickets - bleed);
      } else if (southFlags > northFlags) {
        const bleed = (southFlags - northFlags) * 3;
        this.unionTickets = Math.max(0, this.unionTickets - bleed);
      }

      this.callbacks.onTicketChange?.(this.unionTickets, this.confedTickets);

      if (this.unionTickets <= 0) {
        if (this.playerFaction === 'NORTH') this.callbacks.onMissionFailed();
        else this.callbacks.onMissionSuccess?.();
      } else if (this.confedTickets <= 0) {
        if (this.playerFaction === 'SOUTH') this.callbacks.onMissionFailed();
        else this.callbacks.onMissionSuccess?.();
      }
    }
  }

  private updateAmbientSkirmishers(dt: number) {
    for (const soldier of this.ambientSoldiers) {
      soldier.fireCooldown -= dt;
      if (soldier.fireCooldown <= 0) {
        soldier.fireCooldown = 4.0 + Math.random() * 5.0;
        const gunPos = new THREE.Vector3(soldier.x, 1.2, soldier.z);
        const targetZ = soldier.faction === 'NORTH' ? (50 + Math.random() * 15) : (-5 + Math.random() * 10);
        const targetX = soldier.x + (Math.random() - 0.5) * 14;
        const targetPos = new THREE.Vector3(targetX, 1.1, targetZ);

        this.spawnBulletTracer(gunPos, targetPos, soldier.faction === 'SOUTH');
        this.spawnSmokeParticle(gunPos, targetPos.clone().sub(gunPos).normalize());

        if (Math.random() < 0.25) {
          audio.playMusketFire();
        }
      }
    }
  }

  private updateTracers(dt: number) {
    for (let i = this.bulletTracers.length - 1; i >= 0; i--) {
      const t = this.bulletTracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
        (t.mesh.material as THREE.Material).dispose();
        this.bulletTracers.splice(i, 1);
      } else {
        (t.mesh.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / t.maxLife);
      }
    }
  }

  private updateInteractivePromptsAndMinimap(dt: number) {
    // 1. Proximity interactive prompt
    if (this.mountedCannon) {
      this.callbacks.onInteractivePrompt?.({
        action: 'Dismount 12-Pounder Napoleon',
        key: 'E',
        distance: 0,
      });
    } else {
      let promptTarget: { action: string; key: string; distance: number } | null = null;
      let minCannonDist = 3.8;
      for (const cannon of this.artilleryPieces) {
        const dist = this.playerPos.distanceTo(cannon.position);
        if (dist < minCannonDist) {
          minCannonDist = dist;
          promptTarget = {
            action: 'Man 12-Pounder Napoleon Artillery',
            key: 'E',
            distance: Math.round(dist * 10) / 10,
          };
        }
      }

      if (!promptTarget) {
        let minDoorDist = 3.2;
        for (const door of this.interactiveDoors) {
          const dist = this.playerPos.distanceTo(door.position);
          if (dist < minDoorDist) {
            minDoorDist = dist;
            promptTarget = {
              action: door.isOpen ? 'Close Barn Door' : 'Open Barn Door',
              key: 'E',
              distance: Math.round(dist * 10) / 10,
            };
          }
        }
      }

      if (!promptTarget && this.artilleryCharge >= 100) {
        promptTarget = {
          action: 'Call Off-Map Artillery Barrage',
          key: 'E',
          distance: 0,
        };
      }

      this.callbacks.onInteractivePrompt?.(promptTarget);
    }

    // 2. Minimap entity stream
    this.minimapBroadcastTimer += dt;
    if (this.minimapBroadcastTimer >= 0.12) {
      this.minimapBroadcastTimer = 0;
      const entities: MinimapEntity[] = [];

      // Player
      entities.push({
        id: 'player',
        type: 'player',
        faction: this.playerFaction,
        x: this.playerPos.x,
        z: this.playerPos.z,
        yaw: this.yaw,
      });

      // Active enemies
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        entities.push({
          id: enemy.id,
          type: 'enemy',
          faction: enemy.faction,
          x: enemy.x,
          z: enemy.z,
        });
      }

      // Cannons
      for (const cannon of this.artilleryPieces) {
        entities.push({
          id: cannon.id,
          type: 'cannon',
          x: cannon.position.x,
          z: cannon.position.z,
        });
      }

      // Doors
      for (const door of this.interactiveDoors) {
        entities.push({
          id: door.id,
          type: 'door',
          x: door.position.x,
          z: door.position.z,
        });
      }

      this.callbacks.onMinimapUpdate?.(entities, this.flagWaypoints);
    }
  }

  public applyDamageToPlayer(damage: number, attackerName: string = 'Enemy Skirmisher') {
    if (this.isLastStandActive) {
      this.addCameraShake(0.08);
      return;
    }

    if (this.health - damage <= 0) {
      if (!this.hasUsedLastStand) {
        // Trigger Last Stand 5-second heroic survival window
        this.hasUsedLastStand = true;
        this.isLastStandActive = true;
        this.lastStandTimer = 5.0;
        this.health = 1;
        this.callbacks.onHealthChange(this.health, this.maxHealth);
        this.callbacks.onLastStandChange?.(true, 5.0);

        this.addCameraShake(0.85);
        this.spawnBloodSplatter(this.playerPos.clone());
        audio.playLastStandActivation();
        voiceEngine.playLastStandShout(this.playerFaction);

        this.callbacks.onAddScorePopup({
          id: `last_stand_${Date.now()}`,
          text: '⚡ LAST STAND! KILL AN ENEMY TO SURVIVE (5.0s)!',
          x: window.innerWidth / 2 - 180,
          y: window.innerHeight / 2 - 50,
          color: '#EF4444',
          scale: 1.7,
          opacity: 1,
          time: Date.now(),
        });
        return;
      } else {
        this.health = 0;
        this.callbacks.onHealthChange(0, this.maxHealth);
        this.spawnBloodSplatter(this.playerPos.clone());
        this.callbacks.onMissionFailed();
        return;
      }
    }

    this.health -= damage;
    this.callbacks.onHealthChange(this.health, this.maxHealth);
    this.addCameraShake(Math.min(0.85, 0.3 + damage * 0.015));
    this.spawnBloodSplatter(this.playerPos.clone());
  }

  private updateEnemies(dt: number) {
    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const mesh = this.enemyMeshes.get(enemy.id);
      if (!mesh) return;

      const toPlayer = new THREE.Vector3(this.playerPos.x - enemy.x, 0, this.playerPos.z - enemy.z);
      const dist = toPlayer.length();

      enemy.rotY = Math.atan2(toPlayer.x, toPlayer.z);
      mesh.rotation.y = enemy.rotY;

      if (dist > 8) {
        const moveStep = toPlayer.normalize().multiplyScalar(enemy.moveSpeed * dt);
        enemy.x += moveStep.x;
        enemy.z += moveStep.z;
        enemy.y = this.getTerrainHeight(enemy.x, enemy.z); // march on the ground, not through it
        mesh.position.set(enemy.x, enemy.y, enemy.z);

        const leftLeg = mesh.getObjectByName('leftLeg');
        const rightLeg = mesh.getObjectByName('rightLeg');
        if (leftLeg && rightLeg) {
          const legSwing = Math.sin(performance.now() * 0.008 * enemy.moveSpeed) * 0.4;
          leftLeg.rotation.x = legSwing;
          rightLeg.rotation.x = -legSwing;
        }
      }

      enemy.shootCooldown -= dt;
      if (enemy.shootCooldown <= 0 && dist < 70) {
        enemy.shootCooldown = 3.5 + Math.random() * 3.0;

        audio.playMusketFire();
        const gunPos = new THREE.Vector3(enemy.x, 1.2, enemy.z);
        const targetPos = this.playerPos.clone().add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 1.5
        ));

        // Enemy bullet tracer
        this.spawnBulletTracer(gunPos, targetPos, true);
        this.spawnSmokeParticle(
          gunPos,
          new THREE.Vector3(this.playerPos.x - enemy.x, 0, this.playerPos.z - enemy.z).normalize()
        );

        const hitRoll = Math.random();
        if (hitRoll < enemy.accuracy && dist < 45) {
          let damage = Math.round(15 + Math.random() * 20);
          if (this.damageResistance > 0) {
            damage = Math.round(damage * (1 - this.damageResistance));
          }
          this.applyDamageToPlayer(damage, enemy.name);
        } else {
          audio.playBulletWhiz();
          if (dist < 25) {
            this.addCameraShake(0.08);
          }
        }
      }
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      // The southerly breeze pushes lingering smoke northward
      p.mesh.position.addScaledVector(this.windVec, dt * 0.45);
      p.vel.y -= 3.5 * (p.gravityScale ?? 1) * dt;
      p.mesh.scale.addScalar(p.scaleRate * dt);
      if (p.mesh.material instanceof THREE.Material && 'opacity' in p.mesh.material) {
        (p.mesh.material as any).opacity = p.life / p.maxLife;
      }
    }
  }

  private updateFlags(dt: number) {
    // Flags hang near-limp on the recorded 2 mph breeze, streaming only when the storm gusts
    const windFactor = this.windMph / 12;
    this.flags.forEach((f) => {
      f.waveOffset += dt * 4 * windFactor;
      const pos = (f.mesh.geometry as THREE.PlaneGeometry).attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        pos.setZ(i, Math.sin(u * 2 + f.waveOffset) * 0.18 * windFactor);
      }
      pos.needsUpdate = true;
    });
  }

  public updateRemotePlayers(players: any[], selfId: string) {
    players.forEach((p) => {
      if (p.id === selfId) return;
      let mesh = this.remotePlayerMeshes.get(p.id);
      if (!mesh) {
        mesh = this.createSoldierMesh(p.faction, p.charClass);
        this.scene.add(mesh);
        this.remotePlayerMeshes.set(p.id, mesh);
      }
      mesh.position.set(p.x, p.y, p.z);
      mesh.rotation.y = p.rotY;
    });

    const activeIds = new Set(players.map((p) => p.id));
    this.remotePlayerMeshes.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.remotePlayerMeshes.delete(id);
      }
    });
  }

  public dispose() {
    this.isDisposed = true;
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
    audio.stopBattlefieldDrums();
    audio.stopRainAmbience();
    this.renderer.dispose();
    if (this.container && this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
