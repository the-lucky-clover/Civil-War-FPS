/**
 * bots.ts — Server-side AI soldiers that fill multiplayer rooms.
 *
 * Each room keeps a standing force of AI bots per faction so the field is
 * alive even with one human on it. Bots are full PlayerData citizens: they
 * join/leave/move/fire/die/respawn through the same broadcasts as humans,
 * so clients render them with zero special-casing (isBot: true marks them).
 *
 * Brains are deliberately simple and honest: advance on the enemy, engage
 * inside musket range with period-appropriate inaccuracy, reload, and keep
 * a little spacing so they don't stack. No aimbots — hit chance falls off
 * hard past 35 meters, the way smoothbore-era fire actually behaved.
 */
import { Room, PlayerData, BotBrain, BroadcastFn, DamageOpts } from './types';
import { regimentsForFaction, PERIOD_SURNAMES } from '../src/game/regiments';

export type DealDamageFn = (
  room: Room,
  attackerId: string,
  targetId: string,
  opts: DamageOpts
) => void;

const TICK_MS = 250;
const ENGAGE_RANGE = 58; // meters — inside historical musket killing range
const BOT_RESPAWN_MS = 5000;

const BOT_RANKS = ['Pvt.', 'Pvt.', 'Pvt.', 'Cpl.', 'Sgt.'];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function botName(faction: 'NORTH' | 'SOUTH'): { name: string; regiment: string } {
  const regs = regimentsForFaction(faction);
  const reg = pick(regs);
  const rank = pick(BOT_RANKS);
  const surname = pick(PERIOD_SURNAMES);
  return { name: `${rank} ${surname}`, regiment: reg.short };
}

function spawnPoint(faction: 'NORTH' | 'SOUTH'): { x: number; z: number; rotY: number } {
  return {
    x: Math.random() * 24 - 12,
    z: faction === 'NORTH' ? -(42 + Math.random() * 14) : 42 + Math.random() * 14,
    rotY: faction === 'NORTH' ? 0 : Math.PI,
  };
}

export class BotManager {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private rooms: Map<string, Room>,
    private broadcast: BroadcastFn,
    private dealDamage: DealDamageFn,
    private botsPerSide: number = 3
  ) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** How many AI soldiers this room wants per faction. */
  setBotsPerSide(n: number) {
    this.botsPerSide = Math.max(0, Math.min(8, n));
  }

  getBotsPerSide(): number {
    return this.botsPerSide;
  }

  private tick() {
    const now = Date.now();
    this.rooms.forEach((room) => this.tickRoom(room, now));
  }

  private botCount(room: Room, faction: 'NORTH' | 'SOUTH'): number {
    let n = 0;
    room.players.forEach((p) => {
      if (p.isBot && p.faction === faction) n++;
    });
    return n;
  }

  private addBot(room: Room, faction: 'NORTH' | 'SOUTH') {
    const { name, regiment } = botName(faction);
    const spawn = spawnPoint(faction);
    const id = `bot_${Math.random().toString(36).slice(2, 10)}`;
    const isSharpshooter = Math.random() < 0.18;
    const player: PlayerData = {
      id,
      name,
      faction,
      charClass: isSharpshooter ? 'SHARPSHOOTER' : 'INFANTRY',
      x: spawn.x,
      y: 0,
      z: spawn.z,
      rotY: spawn.rotY,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      kills: 0,
      deaths: 0,
      score: 0,
      weapon: isSharpshooter ? 'whitworth_sharpshooter' : faction === 'NORTH' ? 'springfield_1861' : 'enfield_1853',
      isFiring: false,
      isReloading: false,
      isRunning: true,
      isMelee: false,
      ping: 8 + Math.floor(Math.random() * 20),
      lastSeen: Date.now(),
      isBot: true,
      regiment,
    };
    room.players.set(id, player);
    const brain: BotBrain = {
      id,
      state: 'ADVANCE',
      targetId: null,
      nextShotAt: 0,
      reloadUntil: 0,
      wanderAngle: Math.random() * Math.PI * 2,
      nextWanderAt: 0,
      respawnAt: null,
      speed: 2.4 + Math.random() * 1.2,
    };
    room.botBrains.set(id, brain);
    this.broadcast(room, { type: 'player_joined', player });
  }

  private removeBot(room: Room, id: string) {
    room.players.delete(id);
    room.botBrains.delete(id);
    this.broadcast(room, { type: 'player_left', playerId: id });
  }

  private tickRoom(room: Room, now: number) {
    // Maintain standing force per faction
    for (const faction of ['NORTH', 'SOUTH'] as const) {
      const want = this.botsPerSide;
      const have = this.botCount(room, faction);
      if (have < want) {
        // reinforce gradually — one per tick max per faction
        this.addBot(room, faction);
      } else if (have > want) {
        const victim = [...room.players.values()].find((p) => p.isBot && p.faction === faction);
        if (victim) this.removeBot(room, victim.id);
      }
    }

    // Think for every bot
    room.botBrains.forEach((brain, id) => {
      const bot = room.players.get(id);
      if (!bot) {
        room.botBrains.delete(id);
        return;
      }
      // Respawn timer
      if (brain.state === 'DEAD') {
        if (brain.respawnAt !== null && now >= brain.respawnAt) {
          const spawn = spawnPoint(bot.faction);
          bot.health = bot.maxHealth;
          bot.x = spawn.x;
          bot.z = spawn.z;
          bot.rotY = spawn.rotY;
          brain.state = 'ADVANCE';
          brain.targetId = null;
          brain.respawnAt = null;
          this.broadcast(room, {
            type: 'player_respawned',
            playerId: bot.id,
            x: bot.x,
            y: bot.y,
            z: bot.z,
            health: bot.health,
          });
        }
        return;
      }
      if (bot.health <= 0) {
        brain.state = 'DEAD';
        brain.respawnAt = now + BOT_RESPAWN_MS;
        return;
      }

      const target = this.acquireTarget(room, bot, brain);
      if (!target) {
        // No enemy left standing — drift toward the enemy side
        this.moveBot(room, bot, brain, bot.faction === 'NORTH' ? 1 : -1, now);
        return;
      }

      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const dist = Math.hypot(dx, dz);

      if (dist <= ENGAGE_RANGE) {
        brain.state = now < brain.reloadUntil ? 'RELOADING' : 'ENGAGE';
        // Face the enemy
        bot.rotY = Math.atan2(dx, dz);
        bot.isRunning = false;
        // Small sidestep so lines don't stand perfectly still
        if (now >= brain.nextWanderAt) {
          brain.wanderAngle = Math.random() * Math.PI * 2;
          brain.nextWanderAt = now + 1800 + Math.random() * 2500;
        }
        if (brain.state === 'ENGAGE' && now >= brain.nextShotAt) {
          this.botFire(room, bot, target, dist, now, brain);
        }
        this.sendMove(room, bot);
      } else {
        brain.state = 'ADVANCE';
        brain.targetId = target.id;
        // Advance with a slight weave; keep spacing from friendlies
        if (now >= brain.nextWanderAt) {
          brain.wanderAngle = (Math.random() - 0.5) * 0.9;
          brain.nextWanderAt = now + 2200 + Math.random() * 2000;
        }
        const baseAngle = Math.atan2(dx, dz);
        const moveAngle = baseAngle + brain.wanderAngle * 0.35;
        const sep = this.separation(room, bot);
        const step = brain.speed * (TICK_MS / 1000);
        bot.x += Math.sin(moveAngle) * step + sep.x;
        bot.z += Math.cos(moveAngle) * step + sep.z;
        bot.rotY = moveAngle;
        bot.isRunning = true;
        this.sendMove(room, bot);
      }
      bot.lastSeen = now;
    });
  }

  private acquireTarget(room: Room, bot: PlayerData, brain: BotBrain): PlayerData | null {
    // Keep current target if still valid
    if (brain.targetId) {
      const t = room.players.get(brain.targetId);
      if (t && t.health > 0 && t.faction !== bot.faction) return t;
      brain.targetId = null;
    }
    let best: PlayerData | null = null;
    let bestDist = Infinity;
    room.players.forEach((p) => {
      if (p.id === bot.id || p.health <= 0 || p.faction === bot.faction) return;
      const d = Math.hypot(p.x - bot.x, p.z - bot.z);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    });
    if (best) brain.targetId = (best as PlayerData).id;
    return best;
  }

  /** Push away from nearby friendlies so bots don't stack. */
  private separation(room: Room, bot: PlayerData): { x: number; z: number } {
    let sx = 0;
    let sz = 0;
    room.players.forEach((p) => {
      if (p.id === bot.id || p.faction !== bot.faction || p.health <= 0) return;
      const dx = bot.x - p.x;
      const dz = bot.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01 && d < 3.5) {
        sx += (dx / d) * (3.5 - d) * 0.25;
        sz += (dz / d) * (3.5 - d) * 0.25;
      }
    });
    return { x: sx, z: sz };
  }

  private moveBot(room: Room, bot: PlayerData, _brain: BotBrain, dirZ: 1 | -1, _now: number) {
    const step = 2.2 * (TICK_MS / 1000);
    bot.z += dirZ * step;
    bot.rotY = dirZ === 1 ? 0 : Math.PI;
    bot.isRunning = true;
    this.sendMove(room, bot);
  }

  private sendMove(room: Room, bot: PlayerData) {
    this.broadcast(room, {
      type: 'player_moved',
      id: bot.id,
      x: bot.x,
      y: bot.y,
      z: bot.z,
      rotY: bot.rotY,
      pitch: bot.pitch,
      weapon: bot.weapon,
      isRunning: bot.isRunning,
      isReloading: bot.isReloading,
      isFiring: bot.isFiring,
      isMelee: bot.isMelee,
    });
  }

  private botFire(room: Room, bot: PlayerData, target: PlayerData, dist: number, now: number, brain: BotBrain) {
    bot.isFiring = true;
    const dirX = (target.x - bot.x) / (dist || 1);
    const dirZ = (target.z - bot.z) / (dist || 1);
    this.broadcast(room, {
      type: 'weapon_fired',
      playerId: bot.id,
      weapon: bot.weapon,
      origin: [bot.x, 1.5, bot.z],
      direction: [dirX, 0, dirZ],
    });
    // Period inaccuracy: ~65% hits inside 25m, falling off hard with range
    const hitChance = Math.max(0.08, 0.68 - (dist / ENGAGE_RANGE) * 0.6);
    if (Math.random() < hitChance) {
      const headshot = Math.random() < 0.06;
      const damage = Math.round((headshot ? 95 : 34 + Math.random() * 30) * (1 - (dist / ENGAGE_RANGE) * 0.35));
      this.dealDamage(room, bot.id, target.id, {
        damage,
        isHeadshot: headshot,
        weapon: bot.charClass === 'SHARPSHOOTER' ? 'Whitworth rifle' : 'Rifled musket',
      });
    }
    brain.nextShotAt = now + 2600 + Math.random() * 3200;
    brain.reloadUntil = now + 1200 + Math.random() * 800;
    bot.isFiring = false;
    bot.isReloading = true;
    setTimeout(() => {
      bot.isReloading = false;
    }, 1400);
  }
}
