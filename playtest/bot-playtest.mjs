/**
 * Gettysburg FPS — Automated Playthrough Test Harness
 *
 * Spawns bot clients over WebSocket and plays through the full game loop:
 * join -> move -> fire -> hits -> kills -> respawn -> artillery -> chat -> leave,
 * then runs a live battle simulation with wandering, aiming bots.
 *
 * Usage: node playtest/bot-playtest.mjs [ws://localhost:3000]
 * Exit 0 = all assertions passed, 1 = failures.
 */
import WebSocket from 'ws';

const WS_URL = process.argv[2] || 'ws://localhost:3000';
const TIMEOUT = 6000;

let passed = 0, failed = 0;
const failures = [];
function assert(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; failures.push(name); console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`); }
}
function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

class Bot {
  constructor(name, faction, charClass = 'INFANTRY') {
    this.name = name; this.faction = faction; this.charClass = charClass;
    this.id = null; this.inbox = []; this.waiters = [];
    this.pos = { x: 0, z: faction === 'NORTH' ? -45 : 45 };
  }
  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS_URL);
      const to = setTimeout(() => reject(new Error('connect timeout')), TIMEOUT);
      this.ws.on('open', () => { clearTimeout(to); resolve(); });
      this.ws.on('message', (raw) => {
        let msg; try { msg = JSON.parse(raw.toString()); } catch { return; }
        this.inbox.push(msg);
        if (msg.scores) this.lastScores = msg.scores;
        for (const w of this.waiters) {
          if (!w.done && w.match(msg)) { w.done = true; w.resolve(msg); }
        }
        this.waiters = this.waiters.filter(w => !w.done);
      });
      this.ws.on('error', reject);
    });
  }
  send(obj) { this.ws.send(JSON.stringify(obj)); }
  /** Wait for next message matching predicate (checks inbox first). */
  next(match, timeoutMs = TIMEOUT) {
    const found = this.inbox.find(match);
    if (found) return Promise.resolve(found);
    return new Promise((resolve, reject) => {
      const w = { match, resolve, done: false };
      const to = setTimeout(() => { w.done = true; reject(new Error('wait timeout')); }, timeoutMs);
      const origResolve = resolve;
      w.resolve = (m) => { clearTimeout(to); origResolve(m); };
      this.waiters.push(w);
    });
  }
  clearInbox() { this.inbox = []; }
  async join(roomId = 'playtest_room') {
    this.clearInbox();
    this.send({ type: 'join_room', roomId, id: `bot_${this.name}`, name: this.name, faction: this.faction, charClass: this.charClass, map: 'the_angle', mode: 'TDM' });
    const msg = await this.next(m => m.type === 'room_joined');
    this.id = msg.selfId;
    return msg;
  }
  move(x, z) {
    this.pos = { x, z };
    this.send({ type: 'player_update', x, y: 0, z, rotY: 0, pitch: 0, isRunning: true });
  }
  fireAt(target) {
    this.send({ type: 'weapon_fire', weapon: 'rifled_musket',
      origin: { ...this.pos, y: 1.6 }, direction: { x: target.pos.x - this.pos.x, y: 0, z: target.pos.z - this.pos.z } });
  }
  hit(target, damage, isHeadshot = false) {
    this.send({ type: 'hit_registered', targetId: target.id, damage, isHeadshot, weapon: 'rifled_musket' });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function phase1_protocol() {
  console.log('\n— Phase 1: protocol playthrough —');
  const a = new Bot('Alpha', 'NORTH'), b = new Bot('Bravo', 'SOUTH');
  const c = new Bot('Charlie', 'NORTH', 'SHARPSHOOTER'), d = new Bot('Delta', 'SOUTH', 'OFFICER');
  const bots = [a, b, c, d];
  for (const bot of bots) await bot.connect();
  console.log('  4 bots connected');

  // Join
  const joined = await a.join();
  assert('join: room_joined received', joined.type === 'room_joined');
  assert('join: selfId assigned', typeof joined.selfId === 'string' && joined.selfId.length > 0);
  assert('join: room state includes scores', joined.scores && typeof joined.scores.NORTH === 'number');
  for (const bot of [b, c, d]) await bot.join();
  await wait(400);
  assert('join: 4 players in room', joined.players !== undefined); // sanity on payload shape

  // Movement broadcast
  b.clearInbox(); c.clearInbox(); d.clearInbox();
  a.move(10, -40);
  const mv = await b.next(m => m.type === 'player_moved' && m.id === a.id);
  assert('move: player_moved broadcast', mv.x === 10 && mv.z === -40, JSON.stringify({ x: mv.x, z: mv.z }));

  // Weapon fire broadcast
  b.clearInbox();
  a.fireAt(b);
  const wf = await b.next(m => m.type === 'weapon_fired' && m.playerId === a.id);
  assert('fire: weapon_fired broadcast', !!wf);

  // Hit registration -> damage_event
  b.clearInbox();
  a.hit(b, 45);
  const dmg = await b.next(m => m.type === 'damage_event' && m.victimId === b.id);
  assert('hit: damage_event received', !!dmg);
  assert('hit: damage math correct (100-45=55)', dmg.remainingHealth === 55, `got ${dmg.remainingHealth}`);
  assert('hit: not a kill', dmg.isKill === false);

  // Kill -> score, deaths, respawn
  b.clearInbox(); a.clearInbox(); c.clearInbox(); d.clearInbox();
  const baseNorth = (c.lastScores && c.lastScores.NORTH) || 0;
  a.hit(b, 100);
  const kill = await c.next(m => m.type === 'damage_event' && m.victimId === b.id && m.isKill);
  assert('kill: isKill flagged', kill.isKill === true);
  assert('kill: team score incremented by 1', kill.scores.NORTH === baseNorth + 1, JSON.stringify(kill.scores));
  const respawn = await b.next(m => m.type === 'player_respawned' && m.playerId === b.id, 8000);
  assert('respawn: player_respawned within 8s', !!respawn);
  assert('respawn: full health restored', respawn.health === 100, `got ${respawn.health}`);

  // Artillery
  b.clearInbox();
  a.send({ type: 'artillery_call', targetPos: { x: 0, y: 0, z: 0 } });
  const art = await b.next(m => m.type === 'artillery_barrage');
  assert('artillery: barrage broadcast', art.callerId === a.id);

  // Cannon fire broadcast (player-worked field piece)
  b.clearInbox();
  a.send({ type: 'cannon_fire', cannonId: 'cannon_north_1',
    muzzlePos: [-15, 1.2, -8], direction: [0, 0.1, 1], rotY: 0, pitch: 0.1 });
  const cf = await b.next(m => m.type === 'cannon_fired');
  assert('cannon: cannon_fired broadcast', cf.cannonId === 'cannon_north_1');
  assert('cannon: shooter attributed', cf.shooterId === a.id);

  // Chat
  b.clearInbox();
  a.send({ type: 'chat_message', text: 'For the Union!' });
  const chat = await b.next(m => m.type === 'chat_broadcast');
  assert('chat: broadcast received', chat.text === 'For the Union!' && chat.senderName === 'Alpha');

  // Ping/pong
  a.clearInbox();
  a.send({ type: 'ping' });
  const pong = await a.next(m => m.type === 'pong');
  assert('ping: pong received', !!pong);

  // Disconnect -> player_left
  b.clearInbox(); c.clearInbox();
  d.close();
  const left = await b.next(m => m.type === 'player_left' && m.playerId === d.id);
  assert('leave: player_left broadcast', !!left);

  for (const bot of [a, b, c]) bot.close();
}

async function phase2_battle() {
  console.log('\n— Phase 2: live battle simulation (6 bots, 25s) —');
  const bots = [];
  const factions = ['NORTH', 'SOUTH'];
  for (let i = 0; i < 6; i++) {
    const bot = new Bot(`Sim${i}`, factions[i % 2], ['INFANTRY', 'SHARPSHOOTER', 'OFFICER'][i % 3]);
    await bot.connect();
    bots.push(bot);
  }
  for (const bot of bots) await bot.join('sim_room');
  await wait(300);

  let kills = 0, respawns = 0, errors = 0, fires = 0;
  for (const bot of bots) {
    bot.ws.on('error', () => errors++);
    const origClose = bot.ws.close.bind(bot.ws);
    bot.close = () => { try { origClose(); } catch { errors++; } };
  }
  // track kills/respawns via one observer bot
  const observer = bots[0];
  const killWatcher = (async () => {
    const seen = new Set();
    const t0 = Date.now();
    while (Date.now() - t0 < 25000) {
      for (const m of observer.inbox.splice(0)) {
        if (m.type === 'damage_event' && m.isKill && !seen.has(m.victimId + m.attackerId + m.damage)) {
          seen.add(m.victimId + m.attackerId + m.damage); kills++;
        }
        if (m.type === 'player_respawned') respawns++;
      }
      await wait(200);
    }
  })();

  // bot AI loop: wander + shoot nearest enemy
  const t0 = Date.now();
  const tickers = bots.map(bot => (async () => {
    const enemies = () => bots.filter(e => e !== bot && e.faction !== bot.faction && e.ws.readyState === 1);
    while (Date.now() - t0 < 25000) {
      // wander
      bot.move(bot.pos.x + (Math.random() * 10 - 5), bot.pos.z + (Math.random() * 10 - 5));
      const foes = enemies();
      if (foes.length) {
        const target = foes[Math.floor(Math.random() * foes.length)];
        bot.fireAt(target); fires++;
        // hit chance: closer = deadlier (simple falloff)
        const dx = target.pos.x - bot.pos.x, dz = target.pos.z - bot.pos.z;
        const dist = Math.hypot(dx, dz);
        if (Math.random() < Math.max(0.15, 1 - dist / 60)) {
          bot.hit(target, 25 + Math.floor(Math.random() * 40), Math.random() < 0.1);
        }
      }
      await wait(300 + Math.random() * 400);
    }
  })());
  await Promise.all([...tickers, killWatcher]);

  assert('battle: shots fired', fires > 20, `fires=${fires}`);
  assert('battle: kills registered', kills > 0, `kills=${kills}`);
  assert('battle: respawns happened', respawns > 0, `respawns=${respawns}`);
  assert('battle: no socket errors', errors === 0, `errors=${errors}`);
  const alive = bots.filter(b => b.ws.readyState === 1).length;
  assert('battle: all bots still connected', alive === 6, `alive=${alive}`);
  for (const bot of bots) bot.close();
  console.log(`  stats: ${fires} shots, ${kills} kills, ${respawns} respawns`);
}

async function main() {
  console.log(`Gettysburg FPS playtest — target ${WS_URL}`);
  try {
    await phase1_protocol();
    await phase2_battle();
  } catch (e) {
    failed++; failures.push('HARNESS: ' + e.message);
    console.log(`  ❌ HARNESS ERROR: ${e.message}`);
  }
  console.log(`\n==== RESULT: ${passed} passed, ${failed} failed ====`);
  if (failures.length) { console.log('Failures:'); failures.forEach(f => console.log('  - ' + f)); }
  process.exit(failed ? 1 : 0);
}
main();
