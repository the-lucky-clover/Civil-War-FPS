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

export interface GameEngineCallbacks {
  onHealthChange: (health: number, maxHealth: number) => void;
  onAmmoChange: (current: number, reserve: number, isReloading: boolean, reloadProgress: number) => void;
  onScoreChange: (score: number, combo: number) => void;
  onKill: (killItem: KillFeedItem) => void;
  onWaveComplete: (wave: number, totalWaves: number, speedBonus?: number) => void;
  onMissionWon: (stats: any) => void;
  onMissionFailed: () => void;
  onAddScorePopup: (popup: ScorePopup) => void;
  onArtilleryChargeChange: (charge: number) => void;
  onCanteenChange: (canteen: number) => void;
  onStaminaChange: (stamina: number) => void;
  onAbilityChange: (cooldown: number, maxCooldown: number, activeTimer: number, maxDuration: number) => void;
  onHistoricalDispatch?: (title: string, text: string) => void;
  onHitEnemy?: (isHeadshot: boolean, damage: number) => void;
  onAtmosphereChange?: (timeOfDay: string, weather: WeatherType) => void;
  onLastStandChange?: (isActive: boolean, timeLeft: number) => void;
  onInteractivePrompt?: (prompt: { type: 'CANNON' | 'DOOR' | 'NONE'; text: string }) => void;
  onCannonStateChange?: (mounted: boolean, reloadProgress: number) => void;
  onTicketChange?: (union: number, confed: number) => void;
  onMinimapUpdate?: (entities: MinimapEntity[], flags: FlagWaypoint[]) => void;
  onOfficerOrder?: (order: OfficerOrder) => void;
}

export class GettysburgEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;

  // Lights
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;

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
  public isSprinting: boolean = false;
  public isCrouching: boolean = false;

  // Environment & Enemies
  private enemies: EnemyNPC[] = [];
  private enemyMeshes: Map<string, THREE.Group> = new Map();
  private remotePlayerMeshes: Map<string, THREE.Group> = new Map();
  private particles: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number; maxLife: number; scaleRate: number }[] = [];
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
  }[] = [];
  public mountedCannon: {
    id: string;
    group: THREE.Group;
    barrel: THREE.Mesh;
    position: THREE.Vector3;
    rotY: number;
    pitch: number;
    cooldown: number;
  } | null = null;
  public cannonReloadProgress: number = 1;

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
    this.muzzleFlashMesh.position.set(0.12, -0.05, -1.2);
    this.gunPivot.add(this.muzzleFlashMesh);

    this.muzzleFlashLight = new THREE.PointLight(0xFF8822, 0, 15);
    this.muzzleFlashLight.position.set(0.12, -0.05, -1.2);
    this.gunPivot.add(this.muzzleFlashLight);

    // Bayonet Mesh
    const bayonetGeo = new THREE.ConeGeometry(0.02, 0.45, 4);
    const bayonetMat = new THREE.MeshStandardMaterial({ color: 0xCCCCCC, metalness: 0.9, roughness: 0.2 });
    this.bayonetMesh = new THREE.Mesh(bayonetGeo, bayonetMat);
    this.bayonetMesh.rotation.x = Math.PI / 2;
    this.bayonetMesh.position.set(0.04, -0.02, -1.35);
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

    // Ramrod underneath
    const ramrodGeo = new THREE.CylinderGeometry(0.008, 0.008, 1.2, 8);
    const ramrodMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.9, roughness: 0.2 });
    const ramrod = new THREE.Mesh(ramrodGeo, ramrodMat);
    ramrod.rotation.x = Math.PI / 2;
    ramrod.position.set(0, -0.035, -0.7);
    gun.add(ramrod);

    // Whitworth Brass Scope if sniper
    if (this.currentWeaponKey.includes('whitworth')) {
      const scopeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.7, 12);
      const scopeMat = new THREE.MeshStandardMaterial({ color: 0xB58838, metalness: 0.9, roughness: 0.2 });
      const scope = new THREE.Mesh(scopeGeo, scopeMat);
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.04, -0.5);
      gun.add(scope);
    }

    gun.position.set(0.24, -0.22, -0.45);
    return gun;
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

    this.hemiLight = new THREE.HemisphereLight(skyHex, 0x3d352a, 0.75);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(lightColor, 1.2);
    this.dirLight.position.set(50, 80, -40);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.scene.add(this.dirLight);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(350, 350, 64, 64);
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vy = posAttr.getY(i);
      const ridgeHeight = Math.sin(vx * 0.03) * 2.5 + Math.cos(vy * 0.02) * 2.0;
      posAttr.setZ(i, ridgeHeight);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: this.currentMissionId === 'day2_wheatfield_night' ? 0x2A3520 : 0x4A5D23,
      roughness: 0.9,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    this.buildGettysburgScenery();
    this.setupWeatherSystem();
    this.applyTimeOfDayForWave(1);
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
    this.weatherType = weather;
    if (weather === 'LIGHT_RAIN') {
      if (this.rainPoints) this.rainPoints.visible = true;
      audio.startRainAmbience();
      this.targetFogDensity = Math.max(0.018, this.targetFogDensity * 1.3);
    } else if (weather === 'HEAVY_FOG') {
      if (this.rainPoints) this.rainPoints.visible = false;
      audio.stopRainAmbience();
      this.targetFogDensity = 0.040;
    } else {
      if (this.rainPoints) this.rainPoints.visible = false;
      audio.stopRainAmbience();
      this.targetFogDensity = 0.012;
    }
    this.callbacks.onAtmosphereChange?.(this.timeOfDayTitle, this.weatherType);
  }

  public setManualWeather(weather: WeatherType) {
    this.setWeather(weather);
  }

  public applyTimeOfDayForWave(waveNumber: number) {
    if (this.currentMissionId === 'day1_mcpherson') {
      if (waveNumber === 1) {
        this.timeOfDayTitle = '09:30 AM • Morning Mist';
        this.targetSkyColor.setHex(0x8EC3EB);
        this.targetFogColor.setHex(0xD8CBB5);
        this.targetFogDensity = 0.014;
        this.targetSunColor.setHex(0xFFF2D0);
        this.targetSunIntensity = 1.1;
        this.targetSunPosition.set(80, 60, -60);
        this.targetHemiSkyColor.setHex(0x8EC3EB);
        this.targetHemiGroundColor.setHex(0x3d352a);
        this.setWeather('CLEAR');
      } else if (waveNumber === 2) {
        this.timeOfDayTitle = '10:15 AM • Light Rain Squall';
        this.targetSkyColor.setHex(0x768EA0);
        this.targetFogColor.setHex(0xA8B4BC);
        this.targetFogDensity = 0.020;
        this.targetSunColor.setHex(0xE0DED6);
        this.targetSunIntensity = 0.85;
        this.targetSunPosition.set(50, 90, -40);
        this.targetHemiSkyColor.setHex(0x768EA0);
        this.targetHemiGroundColor.setHex(0x2E2A25);
        this.setWeather('LIGHT_RAIN');
      } else {
        this.timeOfDayTitle = '11:00 AM • High Noon Skirmish';
        this.targetSkyColor.setHex(0x64A6E0);
        this.targetFogColor.setHex(0xD2C0A5);
        this.targetFogDensity = 0.011;
        this.targetSunColor.setHex(0xFFF9E6);
        this.targetSunIntensity = 1.45;
        this.targetSunPosition.set(10, 140, -20);
        this.targetHemiSkyColor.setHex(0x64A6E0);
        this.targetHemiGroundColor.setHex(0x3E382A);
        this.setWeather('CLEAR');
      }
    } else if (this.currentMissionId === 'day2_roundtop') {
      if (waveNumber === 1) {
        this.timeOfDayTitle = '04:30 PM • Warm Afternoon Sun';
        this.targetSkyColor.setHex(0xF4A261);
        this.targetFogColor.setHex(0xD99B82);
        this.targetFogDensity = 0.014;
        this.targetSunColor.setHex(0xFFD6A5);
        this.targetSunIntensity = 1.25;
        this.targetSunPosition.set(-90, 80, 70);
        this.setWeather('CLEAR');
      } else if (waveNumber === 2) {
        this.timeOfDayTitle = '05:15 PM • Amber Golden Hour';
        this.targetSkyColor.setHex(0xE76F51);
        this.targetFogColor.setHex(0xC27664);
        this.targetFogDensity = 0.016;
        this.targetSunColor.setHex(0xFFA552);
        this.targetSunIntensity = 1.15;
        this.targetSunPosition.set(-110, 50, 85);
        this.setWeather('CLEAR');
      } else if (waveNumber === 3) {
        this.timeOfDayTitle = '06:00 PM • Heavy Cannonade Fog';
        this.targetSkyColor.setHex(0xB85741);
        this.targetFogColor.setHex(0x8C5042);
        this.targetFogDensity = 0.038;
        this.targetSunColor.setHex(0xFF6B4A);
        this.targetSunIntensity = 0.95;
        this.targetSunPosition.set(-125, 30, 95);
        this.setWeather('HEAVY_FOG');
      } else {
        this.timeOfDayTitle = '06:30 PM • Twilight Bayonet Charge';
        this.targetSkyColor.setHex(0x3D2645);
        this.targetFogColor.setHex(0x281A32);
        this.targetFogDensity = 0.024;
        this.targetSunColor.setHex(0xDD5555);
        this.targetSunIntensity = 0.65;
        this.targetSunPosition.set(-140, 10, 110);
        this.setWeather('CLEAR');
      }
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
    } else {
      // Day 3 Pickett's Charge / The Angle
      if (waveNumber === 1) {
        this.timeOfDayTitle = '01:00 PM • Blazing Summer Heat';
        this.targetSkyColor.setHex(0xD4AF37);
        this.targetFogColor.setHex(0xBA9F72);
        this.targetFogDensity = 0.014;
        this.targetSunColor.setHex(0xFFF5DD);
        this.targetSunIntensity = 1.4;
        this.targetSunPosition.set(0, 180, 80);
        this.setWeather('CLEAR');
      } else if (waveNumber === 2) {
        this.timeOfDayTitle = '02:45 PM • 150 Cannon Gunsmoke';
        this.targetSkyColor.setHex(0xC29845);
        this.targetFogColor.setHex(0x9E7E52);
        this.targetFogDensity = 0.026;
        this.targetSunColor.setHex(0xFFDCA8);
        this.targetSunIntensity = 1.2;
        this.targetSunPosition.set(-20, 150, 70);
        this.setWeather('HEAVY_FOG');
      } else if (waveNumber === 3) {
        this.timeOfDayTitle = '03:15 PM • Dense Canister Smoke';
        this.targetSkyColor.setHex(0x9E6F32);
        this.targetFogColor.setHex(0x7D5C3A);
        this.targetFogDensity = 0.038;
        this.targetSunColor.setHex(0xFFA055);
        this.targetSunIntensity = 1.0;
        this.targetSunPosition.set(-40, 120, 60);
        this.setWeather('HEAVY_FOG');
      } else if (waveNumber === 4) {
        this.timeOfDayTitle = '03:30 PM • Armistead Breaches The Wall';
        this.targetSkyColor.setHex(0x784420);
        this.targetFogColor.setHex(0x5A351D);
        this.targetFogDensity = 0.044;
        this.targetSunColor.setHex(0xFF7040);
        this.targetSunIntensity = 0.85;
        this.targetSunPosition.set(-60, 90, 50);
        this.setWeather('HEAVY_FOG');
      } else {
        this.timeOfDayTitle = '03:45 PM • High Water Mark Climax';
        this.targetSkyColor.setHex(0x603018);
        this.targetFogColor.setHex(0x402010);
        this.targetFogDensity = 0.036;
        this.targetSunColor.setHex(0xFFAA33);
        this.targetSunIntensity = 1.1;
        this.targetSunPosition.set(-80, 65, 45);
        this.setWeather('CLEAR');
      }
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
    const lerpFactor = dt * 1.4;
    this.currentSkyColor.lerp(this.targetSkyColor, lerpFactor);
    this.scene.background = this.currentSkyColor;

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

    // Rain particles update
    if (this.weatherType === 'LIGHT_RAIN' && this.rainPoints && this.rainPositions) {
      const pCount = this.rainPositions.length / 3;
      const px = this.playerPos.x;
      const pz = this.playerPos.z;

      for (let i = 0; i < pCount; i++) {
        this.rainPositions[i * 3 + 1] -= 36 * dt; // Fall fast
        this.rainPositions[i * 3] += 3.5 * dt;    // Wind drift

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
    // 1. Stone Wall at The Angle
    const stoneWallMat = new THREE.MeshStandardMaterial({ color: 0x777571, roughness: 0.95 });
    for (let x = -40; x <= 40; x += 3.8) {
      const stoneMesh = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.9, 0.8), stoneWallMat);
      stoneMesh.position.set(x, 0.45, 0);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      this.scene.add(stoneMesh);
    }

    // 2. The 90-degree Angle section
    for (let z = 0; z <= 30; z += 3.8) {
      const stoneMesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.9, 3.6), stoneWallMat);
      stoneMesh.position.set(40, 0.45, z);
      stoneMesh.castShadow = true;
      stoneMesh.receiveShadow = true;
      this.scene.add(stoneMesh);
    }

    // 3. Worm Fences
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6E543C, roughness: 0.85 });
    for (let z = -50; z >= -120; z -= 8) {
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 8.5), woodMat);
      rail1.position.set(-25, 0.7, z);
      rail1.rotation.y = (z % 16 === 0 ? 0.3 : -0.3);
      rail1.castShadow = true;
      this.scene.add(rail1);
    }

    // 4. Granite Boulders
    const boulderMat = new THREE.MeshStandardMaterial({ color: 0x55585E, roughness: 0.9 });
    for (let i = 0; i < 28; i++) {
      const radius = 1.5 + Math.random() * 2.8;
      const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), boulderMat);
      const bx = (Math.random() - 0.5) * 140;
      const bz = (Math.random() - 0.5) * 140;
      boulder.position.set(bx, radius * 0.7, bz);
      boulder.castShadow = true;
      boulder.receiveShadow = true;
      this.scene.add(boulder);
      this.boulderLocations.push({ x: bx, z: bz, radius });
    }

    // 5. Trees (Copse & Woods)
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4A3525, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({
      color: this.currentMissionId === 'day2_roundtop' ? 0x2E4A1F : 0x385E26,
      roughness: 0.8,
    });

    for (let i = 0; i < 45; i++) {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 4.5, 8), trunkMat);
      trunk.position.y = 2.25;
      trunk.castShadow = true;
      const foliage = new THREE.Mesh(new THREE.DodecahedronGeometry(2.4 + Math.random() * 1.2, 1), foliageMat);
      foliage.position.y = 4.8;
      foliage.castShadow = true;
      tree.add(trunk, foliage);

      const tx = (Math.random() - 0.5) * 180;
      const tz = (Math.random() - 0.5) * 180;
      if (Math.abs(tx) > 8 || Math.abs(tz) > 8) {
        tree.position.set(tx, 0, tz);
        this.scene.add(tree);
      }
    }

    // 6. Interactive Artillery Cannons
    this.createArtilleryCannon(-15, 0, -10, 0, 'cannon_north_1');
    this.createArtilleryCannon(15, 0, -10, 0, 'cannon_north_2');
    this.createArtilleryCannon(-30, 0, 45, Math.PI, 'cannon_south_1');
    this.createArtilleryCannon(30, 0, 45, Math.PI, 'cannon_south_2');

    // 7. Interactive Barn & Pennsylvania Farmhouse with Swinging Doors
    this.createBarnAndDoors(22, -18);

    // 8. Military Camps, Field Hospital, Mess Hall & POW Enclosure
    this.createMilitaryCampsAndHospital();

    // 9. Capture The Flag Waypoints (The Angle, Seminary Ridge, Copse of Trees)
    this.createFlagPole(0, 0, 0, 'The Angle', 'NORTH', 'flag_angle');
    this.createFlagPole(-25, 0, 18, 'Copse of Trees', 'NEUTRAL', 'flag_copse');
    this.createFlagPole(28, 0, 45, 'Seminary Ridge', 'SOUTH', 'flag_seminary');

    // 10. Ambient 50/50 Skirmish Lines
    this.createAmbientSkirmishers();
  }

  private createArtilleryCannon(x: number, y: number, z: number, rotY: number, id: string) {
    const cannonGroup = new THREE.Group();
    const barrelPivot = new THREE.Group();
    barrelPivot.position.set(0, 1.2, 0.4);

    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.28, 2.6, 16),
      new THREE.MeshStandardMaterial({ color: 0xBF8040, metalness: 0.9, roughness: 0.25 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0, 0.8);
    barrel.castShadow = true;
    barrelPivot.add(barrel);

    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x553C28, roughness: 0.8 });
    const wheelGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.15, 16);
    const leftWheel = new THREE.Mesh(wheelGeo, wheelMat);
    leftWheel.rotation.z = Math.PI / 2;
    leftWheel.position.set(-0.7, 0.8, 0);

    const rightWheel = new THREE.Mesh(wheelGeo, wheelMat);
    rightWheel.rotation.z = Math.PI / 2;
    rightWheel.position.set(0.7, 0.8, 0);

    const trail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 2.2), wheelMat);
    trail.position.set(0, 0.5, -0.9);
    trail.rotation.x = -0.2;

    cannonGroup.add(barrelPivot, leftWheel, rightWheel, trail);
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

    barnGroup.position.set(x, 0, z);
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

      tent.position.set(-20 - i * 4.5, 0, -32 - (i % 2) * 3);
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
    campfire.position.set(-26, 0, -28);
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

    hospitalGroup.position.set(32, 0, -32);
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

    wagonGroup.position.set(-18, 0, -18);
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

    powPen.position.set(26, 0, -12);
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
    // 12 Union soldiers along stone wall
    for (let i = 0; i < 12; i++) {
      const soldier = this.createSoldierMesh('NORTH', 'PRIVATE');
      const sx = -35 + i * 6.5;
      const sz = -1.8;
      soldier.position.set(sx, 0, sz);
      soldier.rotation.y = 0; // facing forward South
      this.scene.add(soldier);
      this.ambientSoldiers.push({
        group: soldier,
        faction: 'NORTH',
        fireCooldown: 2.0 + Math.random() * 6.0,
        x: sx,
        z: sz,
      });
    }

    // 12 Confederate skirmishers across the open field
    for (let i = 0; i < 12; i++) {
      const soldier = this.createSoldierMesh('SOUTH', 'PRIVATE');
      const sx = -36 + i * 6.8;
      const sz = 55 + (Math.random() - 0.5) * 8;
      soldier.position.set(sx, 0, sz);
      soldier.rotation.y = Math.PI; // facing North towards wall
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

    // Torso
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3), coatMat);
    torso.position.y = 1.25;
    torso.castShadow = true;

    // Belt & Buckle
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.08, 0.32), leatherMat);
    belt.position.y = 1.0;
    const buckle = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.09, 0.02),
      new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2 })
    );
    buckle.position.set(0, 1.0, 0.17);

    // Blanket Bedroll
    const roll = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.75, 8),
      new THREE.MeshStandardMaterial({ color: faction === 'NORTH' ? 0x2E2E2E : 0x998877, roughness: 0.9 })
    );
    roll.rotation.z = Math.PI / 4;
    roll.position.set(0, 1.28, -0.05);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 12), skinMat);
    head.position.y = 1.72;
    head.castShadow = true;

    // Hat: Forage Cap or Iron Brigade Hardee Black Hat
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.12, 12), hatMat);
    cap.position.set(0, 1.82, -0.02);
    cap.rotation.x = -0.15;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.14), leatherMat);
    visor.position.set(0, 1.76, 0.14);

    // Legs
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), pantsMat);
    leftLeg.position.set(-0.14, 0.5, 0);
    leftLeg.name = 'leftLeg';

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.75, 0.2), pantsMat);
    rightLeg.position.set(0.14, 0.5, 0);
    rightLeg.name = 'rightLeg';

    const leftBoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.26), leatherMat);
    leftBoot.position.set(-0.14, 0.09, 0.03);
    const rightBoot = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.18, 0.26), leatherMat);
    rightBoot.position.set(0.14, 0.09, 0.03);

    // Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), coatMat);
    leftArm.position.set(-0.32, 1.25, 0.1);
    leftArm.rotation.x = 0.5;

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.14), coatMat);
    rightArm.position.set(0.32, 1.25, 0.1);
    rightArm.rotation.x = 0.5;

    // Musket prop in hands
    const rifleProp = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.06, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x3B281B, roughness: 0.8 })
    );
    rifleProp.position.set(0.2, 1.15, 0.4);
    rifleProp.rotation.x = 0.3;

    soldier.add(torso, belt, buckle, roll, head, cap, visor, leftLeg, rightLeg, leftBoot, rightBoot, leftArm, rightArm, rifleProp);

    if (charType === 'OFFICER_BOSS') {
      const sash = new THREE.Mesh(
        new THREE.BoxGeometry(0.53, 0.1, 0.33),
        new THREE.MeshStandardMaterial({ color: 0xAA2222, roughness: 0.4 })
      );
      sash.position.y = 0.95;
      soldier.add(sash);
      soldier.scale.set(1.15, 1.15, 1.15);
    }

    return soldier;
  }

  private setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

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
      if (e.code === 'Digit1' && !this.mountedCannon) this.switchWeapon(this.playerFaction === 'NORTH' ? 'springfield_1861' : 'enfield_1853');
      if (e.code === 'Digit2' && !this.mountedCannon) this.switchWeapon(this.playerFaction === 'NORTH' ? 'colt_navy_1851' : 'lemat_revolver');
      if (e.code === 'Digit3' && !this.mountedCannon) this.switchWeapon(this.playerFaction === 'NORTH' ? 'spencer_repeater' : 'whitworth_sharpshooter');
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    this.container.addEventListener('click', () => {
      if (!this.isLocked) {
        this.container.requestPointerLock();
      } else {
        if (this.mountedCannon) {
          this.fireMountedCannon();
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
      // Position player at breech of cannon
      const backOffset = new THREE.Vector3(0, 0, -1.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), closestCannon.rotY);
      this.playerPos.set(closestCannon.position.x + backOffset.x, 1.6, closestCannon.position.z + backOffset.z);
      this.yaw = closestCannon.rotY;
      this.pitch = closestCannon.pitch;
      this.callbacks.onCannonStateChange?.(true, this.cannonReloadProgress);
      audio.playCannonAim();
      this.callbacks.onAddScorePopup({
        id: `mount_${Date.now()}`,
        text: 'MANNING NAPOLEON 12-POUNDER [LEFT-CLICK TO FIRE]',
        x: window.innerWidth / 2 - 170,
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

  public fireMountedCannon() {
    if (!this.mountedCannon || this.mountedCannon.cooldown > 0) return;

    this.mountedCannon.cooldown = 4.5;
    this.cannonReloadProgress = 0;
    this.callbacks.onCannonStateChange?.(true, 0);

    audio.playCannonBlast();
    this.addCameraShake(1.0);

    // Muzzle position of mounted cannon
    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.mountedCannon.rotY);
    const muzzlePos = this.mountedCannon.position.clone().add(forward.clone().multiplyScalar(2.0)).add(new THREE.Vector3(0, 1.2, 0));

    // Heavy canister explosion smoke
    this.spawnArtilleryExplosion(muzzlePos);
    for (let i = 0; i < 10; i++) {
      this.spawnSmokeParticle(muzzlePos, forward);
    }

    // Huge canister tracer barrage in a forward fan
    for (let i = 0; i < 8; i++) {
      const fanDir = forward.clone().add(
        new THREE.Vector3((Math.random() - 0.5) * 0.35, (Math.random() - 0.2) * 0.2, (Math.random() - 0.5) * 0.35)
      ).normalize();
      const tracerEnd = muzzlePos.clone().add(fanDir.multiplyScalar(60));
      this.spawnBulletTracer(muzzlePos, tracerEnd, false);
    }

    // Cone damage to enemies within 60m and 40-degree angle
    let hitCount = 0;
    this.enemies.forEach((enemy) => {
      if (enemy.isDead) return;
      const toEnemy = new THREE.Vector3(enemy.x - this.mountedCannon!.position.x, 0, enemy.z - this.mountedCannon!.position.z);
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

    if (hitCount > 0) {
      voiceEngine.playRandomCommanderOrder(this.playerFaction, "Direct hit with the 12-pounder! Keep pouring canister into them!");
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

      const enemy: EnemyNPC = {
        id: `npc_${waveNumber}_${i}`,
        name: isBoss ? (enemyFaction === 'SOUTH' ? 'Gen. Armistead' : 'Col. Chamberlain') : (enemyFaction === 'SOUTH' ? `Rebel Pvt. #${i + 1}` : `Union Pvt. #${i + 1}`),
        faction: enemyFaction,
        x: (Math.random() - 0.5) * 80,
        y: 0,
        z: spawnZ + (Math.random() - 0.5) * 20,
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
    
    // Accuracy spread calculation
    let spread = (1 - wData.accuracy) * (this.isAimingADS ? 0.25 : 1.0);
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

  public startReload() {
    if (this.isReloading || this.reserveAmmo <= 0) return;
    const wData = HISTORICAL_WEAPONS[this.currentWeaponKey] || HISTORICAL_WEAPONS['springfield_1861'];
    if (this.currentAmmo >= wData.magazineSize) return;

    this.isReloading = true;
    this.reloadProgress = 0;
    audio.playReloadStage('POWDER');

    const isAuthentic = this.historicalSettings.weaponBehavior === 'AUTHENTIC';
    const totalTime = isAuthentic ? (wData.authenticReloadTime || 12.0) : wData.reloadTime;
    const interval = 50;
    let elapsed = 0;

    const reloadTimer = setInterval(() => {
      if (this.isDisposed) {
        clearInterval(reloadTimer);
        return;
      }
      elapsed += interval / 1000;
      this.reloadProgress = Math.min(1, elapsed / totalTime);

      if (this.reloadProgress > 0.35 && this.reloadProgress < 0.4) {
        audio.playReloadStage('RAMROD');
      }
      if (this.reloadProgress > 0.75 && this.reloadProgress < 0.8) {
        audio.playReloadStage('PRIMER');
      }

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

    const targetEyeY = this.isCrouching ? 1.0 : 1.7;
    this.playerPos.y += (targetEyeY - this.playerPos.y) * 10 * dt;

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

    const adsTargetPos = new THREE.Vector3(0.0, -0.16, -0.42);
    const hipTargetPos = new THREE.Vector3(0.24, -0.22, -0.45);
    const targetPos = this.isAimingADS ? adsTargetPos : hipTargetPos;

    const bobMultiplier = (this.playerClass === 'SHARPSHOOTER' && this.isAimingADS) ? 0 : 1;
    const bobX = Math.cos(this.bobTimer * 0.5) * (this.isAimingADS ? 0.002 : 0.015) * bobMultiplier;
    const bobY = Math.sin(this.bobTimer) * (this.isAimingADS ? 0.002 : 0.012) * bobMultiplier;

    this.gunPivot.position.set(
      targetPos.x + bobX,
      targetPos.y + bobY,
      targetPos.z + this.recoilOffsetZ
    );
    this.gunPivot.rotation.x = this.recoilPitch;

    // Bayonet affixing entry slide animation
    if (this.isAffixingBayonet) {
      this.bayonetIntroProgress += dt * 1.5;
      if (this.bayonetIntroProgress >= 1) {
        this.bayonetIntroProgress = 1;
        this.isAffixingBayonet = false;
      }
      if (this.bayonetMesh) {
        this.bayonetMesh.position.z = -0.95 - (this.bayonetIntroProgress * 0.4);
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
        else this.callbacks.onMissionSuccess();
      } else if (this.confedTickets <= 0) {
        if (this.playerFaction === 'SOUTH') this.callbacks.onMissionFailed();
        else this.callbacks.onMissionSuccess();
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

  private minimapBroadcastTimer = 0;
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
        type: 'PLAYER',
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
          type: 'ENEMY',
          faction: enemy.faction,
          x: enemy.x,
          z: enemy.z,
        });
      }

      // Cannons
      for (const cannon of this.artilleryPieces) {
        entities.push({
          id: cannon.id,
          type: 'CANNON',
          x: cannon.position.x,
          z: cannon.position.z,
        });
      }

      // Doors
      for (const door of this.interactiveDoors) {
        entities.push({
          id: door.id,
          type: 'DOOR',
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
      p.vel.y -= 3.5 * dt;
      p.mesh.scale.addScalar(p.scaleRate * dt);
      if (p.mesh.material instanceof THREE.Material && 'opacity' in p.mesh.material) {
        (p.mesh.material as any).opacity = p.life / p.maxLife;
      }
    }
  }

  private updateFlags(dt: number) {
    this.flags.forEach((f) => {
      f.waveOffset += dt * 4;
      const pos = (f.mesh.geometry as THREE.PlaneGeometry).attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const u = pos.getX(i);
        pos.setZ(i, Math.sin(u * 2 + f.waveOffset) * 0.18);
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
