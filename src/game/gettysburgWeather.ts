/**
 * Historical weather for the Battle of Gettysburg, July 1–3, 1863.
 *
 * Recorded conditions (per the user's specification):
 *   July 1: Cloudy, gentle southern breeze 12 mph. 72°F at 7AM, 76°F at 2PM, 74°F at 9PM.
 *   July 2: Clouds cleared in the afternoon, same wind. 74°F at 7AM, 81°F at 2PM, 76°F at 9PM.
 *   July 3: Storm rolled through in the afternoon. 73°F at 7AM, 87°F at 2PM, 76°F at 9PM.
 *
 * The timeline below interpolates between those recorded readings. The engine
 * samples it by battle day + hour and drives sky, sun, fog, wind, temperature
 * and precipitation from the result.
 */
import type { WeatherType } from '../types/game';

export interface GettysburgKeyframe {
  hour: number; // 24h local time
  tempF: number;
  cloudCover: number; // 0 = clear … 1 = overcast
  precip: 'none' | 'rain' | 'storm';
  label: string;
}

export const WIND_SOUTH_MPH = 12; // gentle southern breeze, all three days

const DAY1: GettysburgKeyframe[] = [
  { hour: 5.5, tempF: 70, cloudCover: 0.85, precip: 'none', label: 'Overcast dawn' },
  { hour: 7.0, tempF: 72, cloudCover: 0.9, precip: 'none', label: 'Cloudy' },
  { hour: 12.0, tempF: 75, cloudCover: 0.85, precip: 'none', label: 'Cloudy' },
  { hour: 14.0, tempF: 76, cloudCover: 0.8, precip: 'none', label: 'Cloudy' },
  { hour: 18.0, tempF: 75, cloudCover: 0.85, precip: 'none', label: 'Cloudy evening' },
  { hour: 21.0, tempF: 74, cloudCover: 0.9, precip: 'none', label: 'Cloudy night' },
];

const DAY2: GettysburgKeyframe[] = [
  { hour: 5.5, tempF: 72, cloudCover: 0.7, precip: 'none', label: 'Morning clouds' },
  { hour: 7.0, tempF: 74, cloudCover: 0.75, precip: 'none', label: 'Morning clouds' },
  { hour: 11.0, tempF: 79, cloudCover: 0.5, precip: 'none', label: 'Clouds breaking' },
  { hour: 14.0, tempF: 81, cloudCover: 0.25, precip: 'none', label: 'Clearing' },
  { hour: 16.0, tempF: 82, cloudCover: 0.1, precip: 'none', label: 'Clear afternoon' },
  { hour: 19.0, tempF: 79, cloudCover: 0.15, precip: 'none', label: 'Clear evening' },
  { hour: 21.0, tempF: 76, cloudCover: 0.2, precip: 'none', label: 'Clear night' },
];

const DAY3: GettysburgKeyframe[] = [
  { hour: 5.5, tempF: 71, cloudCover: 0.4, precip: 'none', label: 'Hazy morning' },
  { hour: 7.0, tempF: 73, cloudCover: 0.45, precip: 'none', label: 'Hazy, building heat' },
  { hour: 11.0, tempF: 83, cloudCover: 0.55, precip: 'none', label: 'Oppressive heat' },
  { hour: 13.0, tempF: 86, cloudCover: 0.8, precip: 'none', label: 'Storm gathering' },
  { hour: 15.0, tempF: 87, cloudCover: 1.0, precip: 'storm', label: 'Afternoon storm' },
  { hour: 17.0, tempF: 80, cloudCover: 0.85, precip: 'rain', label: 'Storm passing' },
  { hour: 19.0, tempF: 77, cloudCover: 0.45, precip: 'none', label: 'Clearing' },
  { hour: 21.0, tempF: 76, cloudCover: 0.3, precip: 'none', label: 'Clear night' },
];

const TIMELINES: Record<number, GettysburgKeyframe[]> = { 1: DAY1, 2: DAY2, 3: DAY3 };

export interface SampledWeather {
  tempF: number;
  cloudCover: number;
  precip: 'none' | 'rain' | 'storm';
  label: string;
  weather: WeatherType;
  windMph: number;
}

function precipSeverity(p: 'none' | 'rain' | 'storm'): number {
  return p === 'storm' ? 2 : p === 'rain' ? 1 : 0;
}

export function sampleGettysburgWeather(day: number, hour: number): SampledWeather {
  const tl = TIMELINES[day] || TIMELINES[1];
  let a = tl[0];
  let b = tl[tl.length - 1];
  for (let i = 0; i < tl.length - 1; i++) {
    if (hour >= tl[i].hour && hour <= tl[i + 1].hour) {
      a = tl[i];
      b = tl[i + 1];
      break;
    }
  }
  const span = Math.max(0.001, b.hour - a.hour);
  const t = Math.min(1, Math.max(0, (hour - a.hour) / span));
  const s = t * t * (3 - 2 * t);
  const tempF = a.tempF + (b.tempF - a.tempF) * s;
  const cloudCover = a.cloudCover + (b.cloudCover - a.cloudCover) * s;
  // Precipitation follows the heavier of the two bracketing readings.
  const precip = precipSeverity(b.precip) >= precipSeverity(a.precip) ? b.precip : a.precip;
  const label = s < 0.5 ? a.label : b.label;
  const weather: WeatherType =
    precip === 'storm' ? 'STORM' : precip === 'rain' ? 'LIGHT_RAIN' : cloudCover > 0.6 ? 'OVERCAST' : 'CLEAR';
  return { tempF, cloudCover, precip, label, weather, windMph: WIND_SOUTH_MPH };
}

/** Sun position for a Gettysburg July day: rises ~5:30A in the east, sets ~8:30P in the west. */
export function sunPositionForHour(hour: number): { elevation: number; azimuth: number } {
  const dayT = Math.min(1, Math.max(0, (hour - 5.5) / 15)); // 5:30A → 8:30P
  const elevation = Math.sin(dayT * Math.PI); // 0 at rise/set, 1 at ~1P
  const azimuth = Math.PI * (1 - dayT); // east (+x) → west (−x) through south
  return { elevation, azimuth };
}

export function formatBattleHour(hour: number): string {
  const h24 = Math.floor(hour) % 24;
  const m = Math.floor((hour % 1) * 60);
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${String(h12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${suffix}`;
}
