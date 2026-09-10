import { Faction, CharacterClass } from '../types/game';

export interface MultiplayerCallbacks {
  onRoomJoined: (data: any) => void;
  onPlayerJoined: (player: any) => void;
  onPlayerLeft: (playerId: string) => void;
  onPlayerMoved: (data: any) => void;
  onWeaponFired: (data: any) => void;
  onDamageEvent: (data: any) => void;
  onPlayerRespawned: (data: any) => void;
  onArtilleryBarrage: (data: any) => void;
  onChatMessage: (data: any) => void;
  onConnectionChange: (connected: boolean) => void;
}

export class MultiplayerService {
  private ws: WebSocket | null = null;
  private callbacks: MultiplayerCallbacks;
  public isConnected: boolean = false;
  public selfId: string = '';
  public ping: number = 0;
  private pingInterval: number | null = null;
  private lastPingTime: number = 0;

  constructor(callbacks: MultiplayerCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(roomId: string, playerName: string, faction: Faction, charClass: CharacterClass, roomName = 'The Angle') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.callbacks.onConnectionChange(true);

        this.ws?.send(JSON.stringify({
          type: 'join_room',
          roomId,
          roomName,
          name: playerName,
          faction,
          charClass,
        }));

        this.startPingCheck();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case 'room_joined':
              this.selfId = data.selfId;
              this.callbacks.onRoomJoined(data);
              break;
            case 'player_joined':
              this.callbacks.onPlayerJoined(data.player);
              break;
            case 'player_left':
              this.callbacks.onPlayerLeft(data.playerId);
              break;
            case 'player_moved':
              this.callbacks.onPlayerMoved(data);
              break;
            case 'weapon_fired':
              this.callbacks.onWeaponFired(data);
              break;
            case 'damage_event':
              this.callbacks.onDamageEvent(data);
              break;
            case 'player_respawned':
              this.callbacks.onPlayerRespawned(data);
              break;
            case 'artillery_barrage':
              this.callbacks.onArtilleryBarrage(data);
              break;
            case 'chat_broadcast':
              this.callbacks.onChatMessage(data);
              break;
            case 'pong':
              this.ping = Math.round(Date.now() - this.lastPingTime);
              break;
          }
        } catch (e) {
          console.error('WS Parse Error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.callbacks.onConnectionChange(false);
        this.stopPingCheck();
      };

      this.ws.onerror = (err) => {
        console.error('WS Error:', err);
      };
    } catch (e) {
      console.error('Failed to connect to WS:', e);
    }
  }

  public sendPlayerUpdate(x: number, y: number, z: number, rotY: number, pitch: number, isRunning: boolean, isReloading: boolean, isFiring: boolean, isMelee: boolean, weapon: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'player_update',
      x,
      y,
      z,
      rotY,
      pitch,
      isRunning,
      isReloading,
      isFiring,
      isMelee,
      weapon,
    }));
  }

  public sendWeaponFire(weapon: string, origin: number[], direction: number[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'weapon_fire',
      weapon,
      origin,
      direction,
    }));
  }

  public sendHit(targetId: string, damage: number, weapon: string, isHeadshot: boolean, isMelee: boolean) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'hit_registered',
      targetId,
      damage,
      weapon,
      isHeadshot,
      isMelee,
    }));
  }

  public sendArtillery(targetPos: number[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'artillery_call',
      targetPos,
    }));
  }

  public sendChat(text: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'chat_message',
      text,
    }));
  }

  private startPingCheck() {
    this.pingInterval = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 3000);
  }

  private stopPingCheck() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect() {
    this.stopPingCheck();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}
