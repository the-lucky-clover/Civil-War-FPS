import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';

interface PlayerData {
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
}

interface Room {
  id: string;
  name: string;
  map: string;
  mode: 'TDM' | 'FFA' | 'HIGH_WATER_MARK';
  scores: { NORTH: number; SOUTH: number };
  maxScore: number;
  timeRemaining: number;
  players: Map<string, PlayerData>;
  sockets: Map<string, WebSocket>;
  bots: Map<string, PlayerData>;
}

const app = express();
const PORT = 3000;
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const rooms = new Map<string, Room>();

// High scores / Leaderboard in-memory persistence
let arcadeLeaderboard = [
  { name: 'Col. Chamberlain', score: 18630, faction: 'NORTH', rank: 'Hero of Little Round Top' },
  { name: 'Gen. Armistead', score: 15400, faction: 'SOUTH', rank: 'High Water Mark Raider' },
  { name: 'Sgt. O\'Rorke', score: 12200, faction: 'NORTH', rank: 'Gettysburg Veteran' },
  { name: 'Pvt. Watkins', score: 9850, faction: 'SOUTH', rank: 'Sharpshooter' },
  { name: 'Capt. Custer', score: 8700, faction: 'NORTH', rank: 'Cavalry Raider' },
  { name: 'Maj. Pelham', score: 7600, faction: 'SOUTH', rank: 'Artillery Gunner' },
];

function getOrCreateRoom(roomId: string, roomName = 'The Angle', map = 'the_angle', mode: 'TDM' | 'FFA' | 'HIGH_WATER_MARK' = 'TDM'): Room {
  if (!rooms.has(roomId)) {
    const room: Room = {
      id: roomId,
      name: roomName,
      map: map,
      mode: mode,
      scores: { NORTH: 0, SOUTH: 0 },
      maxScore: 25,
      timeRemaining: 600, // 10 mins
      players: new Map(),
      sockets: new Map(),
      bots: new Map(),
    };
    rooms.set(roomId, room);
  }
  return rooms.get(roomId)!;
}

// Prepopulate initial public rooms
getOrCreateRoom('angle_public', 'The Angle & Copse of Trees', 'the_angle', 'TDM');
getOrCreateRoom('roundtop_public', "Little Round Top & Devil's Den", 'round_top', 'TDM');
getOrCreateRoom('wheatfield_public', 'The Wheatfield (Night Skirmish)', 'wheatfield', 'TDM');

// Express REST API
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    map: r.map,
    mode: r.mode,
    playerCount: r.players.size,
    scores: r.scores,
  }));
  res.json(roomList);
});

app.get('/api/leaderboard', (req, res) => {
  res.json(arcadeLeaderboard);
});

app.post('/api/leaderboard', (req, res) => {
  const { name, score, faction, rank } = req.body;
  if (name && typeof score === 'number') {
    arcadeLeaderboard.push({
      name: String(name).slice(0, 20),
      score,
      faction: faction === 'SOUTH' ? 'SOUTH' : 'NORTH',
      rank: rank || 'Infantryman',
    });
    arcadeLeaderboard.sort((a, b) => b.score - a.score);
    arcadeLeaderboard = arcadeLeaderboard.slice(0, 15);
  }
  res.json(arcadeLeaderboard);
});

// WebSocket Handling
wss.on('connection', (ws: WebSocket) => {
  let currentRoomId: string | null = null;
  let currentPlayerId: string | null = null;

  ws.on('message', (message: string) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'join_room': {
          const roomId = data.roomId || 'angle_public';
          const room = getOrCreateRoom(roomId, data.roomName, data.map, data.mode);
          
          currentRoomId = roomId;
          currentPlayerId = data.id || `p_${Math.random().toString(36).substr(2, 9)}`;

          const spawnX = data.faction === 'NORTH' ? (Math.random() * 20 - 10) : (Math.random() * 20 - 10);
          const spawnZ = data.faction === 'NORTH' ? -(40 + Math.random() * 15) : (40 + Math.random() * 15);

          const player: PlayerData = {
            id: currentPlayerId,
            name: data.name || (data.faction === 'NORTH' ? 'Union Soldier' : 'Rebel Soldier'),
            faction: data.faction || 'NORTH',
            charClass: data.charClass || 'INFANTRY',
            x: spawnX,
            y: 0,
            z: spawnZ,
            rotY: data.faction === 'NORTH' ? 0 : Math.PI,
            pitch: 0,
            health: 100,
            maxHealth: 100,
            kills: 0,
            deaths: 0,
            score: 0,
            weapon: data.charClass === 'OFFICER' ? 'officer_revolver' : data.charClass === 'SHARPSHOOTER' ? 'sharpshooter_rifle' : 'rifled_musket',
            isFiring: false,
            isReloading: false,
            isRunning: false,
            isMelee: false,
            ping: 0,
            lastSeen: Date.now(),
          };

          room.players.set(currentPlayerId, player);
          room.sockets.set(currentPlayerId, ws);

          // Send current room state to newly joined player
          const allPlayers = Array.from(room.players.values());
          ws.send(JSON.stringify({
            type: 'room_joined',
            roomId: room.id,
            selfId: currentPlayerId,
            map: room.map,
            mode: room.mode,
            scores: room.scores,
            players: allPlayers,
            timeRemaining: room.timeRemaining,
          }));

          // Broadcast to everyone else in the room
          broadcastToRoom(room, {
            type: 'player_joined',
            player: player,
          }, currentPlayerId);
          break;
        }

        case 'player_update': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const player = room.players.get(currentPlayerId);
          if (!player) return;

          player.x = data.x ?? player.x;
          player.y = data.y ?? player.y;
          player.z = data.z ?? player.z;
          player.rotY = data.rotY ?? player.rotY;
          player.pitch = data.pitch ?? player.pitch;
          player.weapon = data.weapon ?? player.weapon;
          player.isRunning = data.isRunning ?? player.isRunning;
          player.isReloading = data.isReloading ?? player.isReloading;
          player.isFiring = data.isFiring ?? player.isFiring;
          player.isMelee = data.isMelee ?? player.isMelee;
          player.lastSeen = Date.now();

          // Broadcast delta to room
          broadcastToRoom(room, {
            type: 'player_moved',
            id: currentPlayerId,
            x: player.x,
            y: player.y,
            z: player.z,
            rotY: player.rotY,
            pitch: player.pitch,
            weapon: player.weapon,
            isRunning: player.isRunning,
            isReloading: player.isReloading,
            isFiring: player.isFiring,
            isMelee: player.isMelee,
          }, currentPlayerId);
          break;
        }

        case 'weapon_fire': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;

          broadcastToRoom(room, {
            type: 'weapon_fired',
            playerId: currentPlayerId,
            weapon: data.weapon,
            origin: data.origin,
            direction: data.direction,
          }, currentPlayerId);
          break;
        }

        case 'hit_registered': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const attacker = room.players.get(currentPlayerId);
          const victim = room.players.get(data.targetId);
          if (!attacker || !victim) return;

          const damage = Math.min(100, Math.max(10, data.damage || 45));
          victim.health = Math.max(0, victim.health - damage);

          const isKill = victim.health <= 0;
          if (isKill) {
            victim.deaths += 1;
            attacker.kills += 1;
            attacker.score += data.isHeadshot ? 150 : 100;
            if (data.isMelee) attacker.score += 75;

            if (attacker.faction === 'NORTH') room.scores.NORTH += 1;
            else room.scores.SOUTH += 1;
          }

          broadcastToRoom(room, {
            type: 'damage_event',
            victimId: victim.id,
            attackerId: attacker.id,
            damage,
            remainingHealth: victim.health,
            isHeadshot: !!data.isHeadshot,
            isMelee: !!data.isMelee,
            isKill,
            weapon: data.weapon || 'musket',
            scores: room.scores,
          });

          // If kill, handle respawn
          if (isKill) {
            setTimeout(() => {
              if (room.players.has(victim.id)) {
                victim.health = victim.maxHealth;
                victim.x = victim.faction === 'NORTH' ? (Math.random() * 20 - 10) : (Math.random() * 20 - 10);
                victim.z = victim.faction === 'NORTH' ? -(40 + Math.random() * 15) : (40 + Math.random() * 15);
                broadcastToRoom(room, {
                  type: 'player_respawned',
                  playerId: victim.id,
                  x: victim.x,
                  y: victim.y,
                  z: victim.z,
                  health: victim.health,
                });
              }
            }, 3000);
          }
          break;
        }

        case 'artillery_call': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const caller = room.players.get(currentPlayerId);
          if (!caller) return;

          broadcastToRoom(room, {
            type: 'artillery_barrage',
            callerId: caller.id,
            callerFaction: caller.faction,
            targetPos: data.targetPos,
          });
          break;
        }

        case 'chat_message': {
          if (!currentRoomId || !currentPlayerId) return;
          const room = rooms.get(currentRoomId);
          if (!room) return;
          const sender = room.players.get(currentPlayerId);
          if (!sender) return;

          broadcastToRoom(room, {
            type: 'chat_broadcast',
            senderName: sender.name,
            faction: sender.faction,
            text: String(data.text || '').slice(0, 120),
            time: Date.now(),
          });
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
          break;
        }
      }
    } catch (err) {
      console.error('WebSocket parse error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && currentPlayerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.players.delete(currentPlayerId);
        room.sockets.delete(currentPlayerId);
        broadcastToRoom(room, {
          type: 'player_left',
          playerId: currentPlayerId,
        });
      }
    }
  });
});

function broadcastToRoom(room: Room, msg: any, excludeId?: string) {
  const payload = JSON.stringify(msg);
  room.sockets.forEach((ws, id) => {
    if (id !== excludeId && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  });
}

// Room Game Loop (Room Timer & Periodic Sync)
setInterval(() => {
  rooms.forEach((room) => {
    if (room.players.size > 0) {
      if (room.timeRemaining > 0) {
        room.timeRemaining -= 1;
      }
    }
  });
}, 1000);

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Gettysburg Arcade FPS Server running on port ${PORT}`);
  });
}

startServer();
