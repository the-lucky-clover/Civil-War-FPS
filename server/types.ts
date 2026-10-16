import { WebSocket } from 'ws';

export interface PlayerData {
  id: string;
  name: string;
  faction: 'NORTH' | 'SOUTH';
  charClass: 'INFANTRY' | 'SHARPSHOOTER' | 'OFFICER';
  x: number;
  y: number;
  z: number;
  rotY: number;
  pitch: number;
  health: number;
  maxHealth: number;
  kills: number;
  deaths: number;
  score: number;
  weapon: string;
  isFiring: boolean;
  isReloading: boolean;
  isRunning: boolean;
  isMelee: boolean;
  ping: number;
  lastSeen: number;
  isBot?: boolean;
  /** Real Gettysburg regiment, e.g. "20th Maine" (bots + players). */
  regiment?: string;
}

export interface Room {
  id: string;
  name: string;
  map: string;
  mode: 'TDM' | 'FFA' | 'HIGH_WATER_MARK';
  scores: { NORTH: number; SOUTH: number };
  maxScore: number;
  timeRemaining: number;
  players: Map<string, PlayerData>;
  sockets: Map<string, WebSocket>;
  /** AI bot brains, keyed by bot player id. */
  botBrains: Map<string, BotBrain>;
}

export type BotState = 'ADVANCE' | 'ENGAGE' | 'RELOADING' | 'DEAD';

export interface BotBrain {
  id: string;
  state: BotState;
  targetId: string | null;
  nextShotAt: number;
  reloadUntil: number;
  wanderAngle: number;
  nextWanderAt: number;
  respawnAt: number | null;
  speed: number;
}

export type BroadcastFn = (room: Room, msg: any, excludeId?: string) => void;

export interface DamageOpts {
  damage: number;
  isHeadshot?: boolean;
  isMelee?: boolean;
  weapon?: string;
}
