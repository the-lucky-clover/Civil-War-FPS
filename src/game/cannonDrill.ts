/**
 * cannonDrill.ts — Full field-artillery crew drill for the 12-pounder Napoleon.
 *
 * Follows the U.S. Army's 1861 "Instruction for Field Artillery" (French
 * system): after every shot the piece must be SPONGED with a damp sponge to
 * kill embers, then LOADED with cartridge, RAMMED home, PRICKED and PRIMED
 * through the vent, LAID (aimed) by the gunner, and FIRED by lanyard.
 *
 * Crew roles shown per station:
 *   #1 — sponges and rams
 *   #2 — loads the cartridge, tends the vent
 *   Gunner — pricks, primes, and lays the piece
 *   #4 — fires (pulls the lanyard)
 *
 * Skip the sponge and you gamble: a live ember can set the charge off in
 * the bore while ramming (premature discharge — a real killer of gun crews).
 */

export type DrillStationId =
  | 'SPONGE'
  | 'LOAD'
  | 'RAM'
  | 'PRIME'
  | 'AIM'
  | 'READY'
  | 'FIRE';

export interface DrillStationDef {
  id: DrillStationId;
  /** Crew position working this station, per the 1861 drill. */
  crewRole: string;
  /** The shouted order. */
  order: string;
  /** Period-correct detail shown in the drill panel. */
  detail: string;
  /** Seconds the station takes to perform. */
  duration: number;
}

export const DRILL_STATIONS: DrillStationDef[] = [
  {
    id: 'SPONGE',
    crewRole: '#1 (Spongeman)',
    order: 'Sponge the piece!',
    detail:
      'No. 1 rams the damp sponge home and twists it — the wet wool hisses ' +
      'against the hot bronze, drowning every ember. A dry bore is a loaded gun.',
    duration: 3.0,
  },
  {
    id: 'LOAD',
    crewRole: '#2 (Loader)',
    order: 'Load!',
    detail:
      'No. 2 thumbs the vent shut and drops the flannel cartridge — powder ' +
      'charge first — into the muzzle. Seam of the bag to the vent.',
    duration: 2.0,
  },
  {
    id: 'RAM',
    crewRole: '#1 (Spongeman)',
    order: 'Ram home!',
    detail:
      'Two strokes of the rammer drive the charge hard against the breech. ' +
      'No. 2 keeps his thumb stall pressed on the vent the whole time.',
    duration: 3.0,
  },
  {
    id: 'PRIME',
    crewRole: 'Gunner',
    order: 'Prick and prime!',
    detail:
      'The gunner pricks the cartridge through the vent with his priming ' +
      'wire, then seats a friction primer — its lanyard loop uppermost.',
    duration: 2.5,
  },
  {
    id: 'AIM',
    crewRole: 'Gunner',
    order: 'Lay the piece!',
    detail:
      'Handspike for traverse, elevating screw for range. Lay for elevation ' +
      'with the gunner’s quadrant, then step clear and call it.',
    duration: 0, // player-aimed; press E when satisfied
  },
  {
    id: 'READY',
    crewRole: 'Gunner',
    order: 'Ready!',
    detail: 'The piece is laid and primed. No. 4 takes the lanyard, steps to the rear, and waits on the word.',
    duration: 1.0,
  },
  {
    id: 'FIRE',
    crewRole: '#4 (Lanyard)',
    order: 'FIRE!',
    detail: 'No. 4 gives a sharp, steady pull — the friction primer sparks, and twelve pounds of iron are on their way.',
    duration: 0, // instant on trigger
  },
];

export const DRILL_ORDER: DrillStationId[] = [
  'SPONGE',
  'LOAD',
  'RAM',
  'PRIME',
  'AIM',
  'READY',
  'FIRE',
];

export function stationDef(id: DrillStationId): DrillStationDef {
  return DRILL_STATIONS.find((s) => s.id === id)!;
}

export function nextStation(id: DrillStationId): DrillStationId {
  const i = DRILL_ORDER.indexOf(id);
  return DRILL_ORDER[(i + 1) % DRILL_ORDER.length];
}

/** Probability of a premature discharge when ramming a charge into an unsponged bore. */
export const COOKOFF_CHANCE = 0.12;
/** Damage (HP) dealt to the gunner by a premature discharge. Survivable, but it ruins your day. */
export const COOKOFF_DAMAGE = 30;

// ---------------------------------------------------------------------------
// Ammunition — 12-pounder Napoleon, fixed ammunition per the Ordnance Manual
// ---------------------------------------------------------------------------

export type CannonAmmoId = 'SOLID_SHOT' | 'SHELL' | 'CANISTER';

export interface CannonAmmoDef {
  id: CannonAmmoId;
  name: string;
  short: string;
  /** Historical muzzle velocity, ft/s (12-pdr Napoleon). Shown for authenticity. */
  muzzleVelocityFps: number;
  /** In-game muzzle velocity, m/s (scaled for the battlefield). */
  gameVelocity: number;
  /** Blast / lethality radius in meters. */
  killRadius: number;
  /** Direct-hit damage. */
  damage: number;
  maxRange: number;
  historicalNote: string;
  /** Short tactical guidance. */
  use: string;
}

export const CANNON_AMMO: Record<CannonAmmoId, CannonAmmoDef> = {
  SOLID_SHOT: {
    id: 'SOLID_SHOT',
    name: 'Solid Shot',
    short: 'Shot',
    muzzleVelocityFps: 1440,
    gameVelocity: 120,
    killRadius: 3,
    damage: 300,
    maxRange: 1600,
    historicalNote:
      'A 12.3 lb solid iron ball. Gunners skipped it low so it ricocheted ' +
      'through ranks — “mowing swaths” was the phrase of the day.',
    use: 'Long range. Aim low and let it bounce through the line.',
  },
  SHELL: {
    id: 'SHELL',
    name: 'Common Shell',
    short: 'Shell',
    muzzleVelocityFps: 1440,
    gameVelocity: 105,
    killRadius: 9,
    damage: 220,
    maxRange: 1400,
    historicalNote:
      'Hollow iron sphere filled with powder, burst by a paper time fuze cut ' +
      'to the range. The great cannonade of July 3 was fought with shell.',
    use: 'Air-burst over troops. Forgiving aim, wide ruin.',
  },
  CANISTER: {
    id: 'CANISTER',
    name: 'Canister',
    short: 'Canister',
    muzzleVelocityFps: 1440,
    gameVelocity: 90,
    killRadius: 0, // handled as a cone, not a radius
    damage: 300,
    maxRange: 400,
    historicalNote:
      'A tin can packed with 27 iron balls that shredded apart at the muzzle — ' +
      'a giant shotgun. Double-shotted canister stopped Pickett’s Charge at 200 yards.',
    use: 'Point-blank only. Nothing survives the cone.',
  },
};

export const AMMO_ORDER: CannonAmmoId[] = ['SOLID_SHOT', 'SHELL', 'CANISTER'];

/** Traverse / elevation limits of a Napoleon on its carriage, degrees. */
export const GUN_LIMITS = {
  traverseDeg: 14,
  elevationMinDeg: -2,
  elevationMaxDeg: 10,
};

export interface DrillState {
  station: DrillStationId;
  /** 0..1 progress within the current station. */
  progress: number;
  /** Whether the bore has been sponged since the last shot. */
  sponged: boolean;
  ammo: CannonAmmoId;
  /** Counts consecutive drill cycles (for crew banter / scoring). */
  roundsServed: number;
}

export function freshDrillState(): DrillState {
  return { station: 'SPONGE', progress: 0, sponged: false, ammo: 'CANISTER', roundsServed: 0 };
}
