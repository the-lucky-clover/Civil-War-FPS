export type Faction = 'NORTH' | 'SOUTH';
export type CharacterClass = 'INFANTRY' | 'SHARPSHOOTER' | 'MEDIC' | 'OFFICER';
export type GameMode = 'TITLE' | 'CAMPAIGN' | 'MULTIPLAYER' | 'ARMORY' | 'LEADERBOARD' | 'VICTORY' | 'DEFEAT';
export type WeaponBehaviorMode = 'ARCADE' | 'AUTHENTIC';
export type WeatherType = 'CLEAR' | 'LIGHT_RAIN' | 'HEAVY_FOG';

export interface HistoricalSettings {
  weaponBehavior: WeaponBehaviorMode; // ARCADE: fast reload, AUTHENTIC: 12s 9-step paper cartridge drill + smoke
  authenticUniforms: boolean;         // Iron Brigade Hardee hats, butternut homespun, regimental colors
  historicalEvents: boolean;          // In-game historical dispatches & situational battle triggers
  crtScanlines: boolean;              // Retro CRT scanline filter
}

export interface WeaponData {
  id: string;
  name: string;
  shortName: string;
  caliber: string;
  damage: number;
  fireRate: number; // shots per sec
  reloadTime: number; // seconds (arcade)
  authenticReloadTime?: number; // seconds (authentic drill)
  magazineSize: number;
  currentAmmo: number;
  reserveAmmo: number;
  accuracy: number; // spread
  range: number;
  description: string;
  historicalNote: string;
  isMelee?: boolean;
  hasBayonet?: boolean;
}

export interface ClassDefinition {
  id: CharacterClass;
  title: string;
  role: string;
  description: string;
  primaryWeaponUnion: string;
  primaryWeaponConfed: string;
  passiveDescription: string;
  abilityName: string;
  abilityKey: string;
  abilityDescription: string;
  abilityCooldown: number; // seconds
  abilityDuration: number; // seconds
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  canteenCharges: number;
  stamina: number;
  score: number;
  combo: number;
  comboTimer: number;
  kills: number;
  headshots: number;
  bayonetKills: number;
  artilleryCalls: number;
  artilleryCharge: number; // 0 to 100%
  faction: Faction;
  charClass: CharacterClass;
  abilityCooldown: number;
  abilityActiveTimer: number;
}

export interface CampaignMission {
  id: string;
  day: number;
  date: string;
  title: string;
  subtitle: string;
  location: string;
  briefing: string;
  unionObjective: string;
  confederateObjective: string;
  environmentType: 'MACPHERSON' | 'ROUND_TOP' | 'WHEATFIELD_NIGHT' | 'THE_ANGLE';
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  sunPosition: [number, number, number];
  waves: number;
  bossName?: string;
  estimatedTime: string;
  parTimeSeconds: number; // For speed bonus scoring!
  historicalDispatches: { wave: number; title: string; text: string }[];
}

export interface EnemyNPC {
  id: string;
  name: string;
  faction: Faction;
  x: number;
  y: number;
  z: number;
  rotY: number;
  health: number;
  maxHealth: number;
  isDead: boolean;
  state: 'PATROL' | 'CHARGE' | 'AIM' | 'SHOOT' | 'RELOAD' | 'RETREAT';
  targetPos: { x: number; y: number; z: number };
  shootCooldown: number;
  reloadTimer: number;
  moveSpeed: number;
  accuracy: number;
  isBoss?: boolean;
  charType: 'PRIVATE' | 'SHARPSHOOTER' | 'SERGEANT' | 'OFFICER_BOSS';
}

export interface ScorePopup {
  id: string;
  text: string;
  x: number;
  y: number;
  color: string;
  scale: number;
  opacity: number;
  time: number;
}

export interface KillFeedItem {
  id: string;
  killer: string;
  victim: string;
  killerFaction: Faction;
  victimFaction: Faction;
  weapon: string;
  isHeadshot: boolean;
  isMelee: boolean;
  time: number;
}

export interface HistoricalDispatch {
  id: string;
  title: string;
  text: string;
  time: number;
}

export interface LeaderboardEntry {
  name: string;
  score: number;
  faction: Faction;
  charClass: CharacterClass;
  rank: string;
  kills: number;
  headshots: number;
  maxStreak: number;
  date: string;
}

export interface AudioSettings {
  masterVolume: number; // 0 to 1
  sfxVolume: number;    // 0 to 1
  musicVolume: number;  // 0 to 1
}

export interface LastStandState {
  isActive: boolean;
  timeLeft: number;
  maxTime: number;
  hasUsed: boolean;
}

export interface FlagWaypoint {
  id: string;
  name: string;
  x: number;
  z: number;
  controllingFaction: Faction | 'NEUTRAL';
  captureProgress: number; // -100 (Confed) to +100 (Union)
  contested: boolean;
}

export interface TicketState {
  unionTickets: number;
  confedTickets: number;
  maxTickets: number;
}

export interface MinimapEntity {
  id: string;
  type: 'player' | 'enemy' | 'ally' | 'flag' | 'cannon' | 'door';
  x: number;
  z: number;
  rotY?: number;
  faction?: Faction;
  isBoss?: boolean;
}

export interface CannonState {
  isMounted: boolean;
  isReady: boolean;
  reloadProgress: number;
  shotsFired: number;
}

export interface InteractivePrompt {
  type: 'CANNON' | 'DOOR' | 'FLAG' | 'NONE';
  text: string;
}

export interface OfficerOrder {
  id: string;
  speaker: string;
  text: string;
  callSign: string;
  timestamp: number;
}
