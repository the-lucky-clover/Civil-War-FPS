import { Faction, OfficerOrder } from '../types/game';
import { audio } from './audioService';

class VoiceEngineService {
  private hasSpeech: boolean = false;
  private voices: SpeechSynthesisVoice[] = [];
  private orderListeners: ((order: OfficerOrder) => void)[] = [];
  private lastSpokenTime: number = 0;
  private cooldownSeconds: number = 7;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.hasSpeech = true;
      this.initVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = () => this.initVoices();
      }
    }
  }

  private initVoices() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
  }

  public onOrder(listener: (order: OfficerOrder) => void) {
    this.orderListeners.push(listener);
    return () => {
      this.orderListeners = this.orderListeners.filter((l) => l !== listener);
    };
  }

  private broadcastOrder(order: OfficerOrder) {
    this.orderListeners.forEach((fn) => fn(order));
  }

  public speakOrder(
    speaker: string,
    text: string,
    faction: Faction = 'NORTH',
    type: 'COMMAND' | 'SHOUT' | 'URGENT' = 'COMMAND'
  ) {
    const now = Date.now();
    // Allow urgent shouts to bypass standard cooldown
    if (type !== 'URGENT' && now - this.lastSpokenTime < this.cooldownSeconds * 1000) {
      return;
    }
    this.lastSpokenTime = now;

    // Play subtle bugle or field call for commander orders
    if (type === 'COMMAND') {
      audio.playBugleCall('assembly');
    } else if (type === 'URGENT') {
      audio.playBugleCall('charge');
    }

    const orderObj: OfficerOrder = {
      id: 'ord_' + Math.random().toString(36).slice(2, 9),
      speaker,
      text,
      callSign: faction === 'NORTH' ? 'UNION HQ' : 'CONFEDERATE HQ',
      timestamp: now,
    };
    this.broadcastOrder(orderObj);

    if (!this.hasSpeech) return;

    try {
      window.speechSynthesis.cancel(); // Don't queue up long speech backlog
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = type === 'URGENT' ? 1.15 : 0.95;
      utterance.pitch = faction === 'NORTH' ? 0.9 : 0.82;
      utterance.volume = audio.getMasterVolume() * 0.9;

      // Prefer English voice
      const enVoice = this.voices.find(
        (v) => v.lang.startsWith('en') && (v.name.includes('Male') || v.name.includes('Natural') || v.name.includes('David'))
      ) || this.voices.find((v) => v.lang.startsWith('en')) || this.voices[0];

      if (enVoice) {
        utterance.voice = enVoice;
      }

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }

  public playRandomCommanderOrder(faction: Faction, objectiveText?: string) {
    const unionOrders = [
      "Hold the Angle at all hazards! 69th Pennsylvania, stand fast!",
      "Pour in your volley fire, boys! Aim at their belt plates!",
      "Fix bayonets! Prepare to repel their assault with cold steel!",
      "Artillery, double canister on the advancing ranks!",
      "Rally on the regimental colors! Don't give an inch!",
      "Skirmishers, hold the rail fence and timber line!",
      "Give them three cheers and a rolling volley!",
    ];

    const confedOrders = [
      "Forward Virginia! Forward to the stone crest!",
      "Give 'em the Rebel Yell, boys! Take that artillery battery!",
      "General Lee expects every man to do his duty this day!",
      "Close up the ranks! Press the Angle without flinching!",
      "Sharpshooters, pick off the enemy battery commanders!",
      "Charge with the cold iron! Sweep their line!",
    ];

    const list = faction === 'NORTH' ? unionOrders : confedOrders;
    const speaker = faction === 'NORTH' ? 'Col. Joshua Chamberlain' : 'Gen. Lewis Armistead';
    const text = objectiveText || list[Math.floor(Math.random() * list.length)];
    this.speakOrder(speaker, text, faction, 'COMMAND');
  }

  public playLastStandShout(faction: Faction) {
    const speaker = faction === 'NORTH' ? 'Sergeant' : 'Color Bearer';
    const text = faction === 'NORTH'
      ? "Last Stand! Pour it into 'em, boys! Take down one more!"
      : "Last Stand! Never surrender the colors! Fight to the last breath!";
    this.speakOrder(speaker, text, faction, 'URGENT');
  }

  public playNpcShout(faction: Faction) {
    const unionShouts = [
      "They're coming across the wheatfield!",
      "Hold steady, Iron Brigade!",
      "Cushing's guns are firing canister!",
      "Look out on the left flank!",
    ];
    const confedShouts = [
      "Yeeee-haw! For Virginia!",
      "Over the wall, boys!",
      "Break their center!",
      "Forward, 15th Alabama!",
    ];
    const list = faction === 'NORTH' ? unionShouts : confedShouts;
    const text = list[Math.floor(Math.random() * list.length)];
    const speaker = faction === 'NORTH' ? 'Union Soldier' : 'Rebel Soldier';
    this.speakOrder(speaker, text, faction, 'SHOUT');
  }
}

export const voiceEngine = new VoiceEngineService();
