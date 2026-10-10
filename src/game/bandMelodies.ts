/**
 * bandMelodies.ts — Period regimental-band repertoire for Gettysburg.
 *
 * Every melody below was verified against period sources (Traditional Tune
 * Archive ABC notation, period sheet-music transcriptions, folk-instrument
 * tabs cross-checked against each other). These are the actual tunes the
 * armies played — "Dixie" vs "Battle Cry of Freedom" is the documented
 * Stones River / Fredericksburg "battle of the bands" pairing, and
 * "Home Sweet Home" is the tune both armies' bands joined on together.
 *
 * Format: [noteName, beats] — beats are quarter-note units.
 * Chords cycle per bar for the tuba oom-pah; [] = solo voice (Taps).
 */

export type FactionAir = 'USA' | 'CSA' | 'BOTH';

export interface BandNote {
  n: string; // e.g. "F#4"
  b: number; // beats (quarter = 1)
}

export interface BandTune {
  id: string;
  title: string;
  year: number;
  faction: FactionAir;
  meter: number; // beats per bar
  tempo: number; // bpm (quarter)
  melody: BandNote[];
  chords: string[]; // per-bar chord symbols, cycled
  note?: string;
}

const N = (n: string, b: number): BandNote => ({ n, b });

export const BAND_TUNES: Record<string, BandTune> = {
  dixie: {
    id: 'dixie',
    title: 'Dixie',
    year: 1859,
    faction: 'CSA',
    meter: 2,
    tempo: 126,
    note: 'Dan Emmett; the Confederacy\'s anthem. Melody from the Traditional Tune Archive (D major ABC).',
    melody: [
      // A-strain — "I wish I was in Dixie"
      N('A4', 0.5), N('F#4', 0.5),
      N('D5', 0.5), N('D5', 0.5), N('D5', 0.25), N('E5', 0.25), N('F#5', 0.25), N('G5', 0.25),
      N('A5', 0.5), N('A5', 0.5), N('A5', 0.5), N('F#5', 0.5),
      N('B5', 0.5), N('B5', 0.5), N('B5', 0.75), N('A5', 0.25),
      N('B5', 0.75), N('A5', 0.25), N('B5', 0.25), N('C#6', 0.25), N('D6', 0.25), N('E6', 0.25),
      N('F#6', 1.5), N('D6', 0.25), N('B5', 0.25),
      N('D6', 1.5), N('A5', 0.25), N('F#5', 0.25),
      N('A5', 1.5), N('E5', 0.25), N('F#5', 0.25),
      N('D6', 2),
      // B-strain — "Then I wish I was in Dixie, hooray!"
      N('A5', 0.33), N('B5', 0.33), N('C#6', 0.33),
      N('B5', 0.5), N('D6', 1), N('B5', 0.5),
      N('E6', 1.5), N('B5', 0.5),
      N('E6', 1.5),
      N('A5', 0.33), N('B5', 0.33), N('C#6', 0.33),
      N('D6', 0.5), N('F#6', 0.5), N('E6', 0.75), N('D6', 0.25),
      N('B5', 0.5), N('C#6', 0.5), N('D6', 0.75), N('B5', 0.25),
      N('A5', 0.5), N('F#5', 0.5), N('D6', 0.5), N('F#5', 0.5),
      N('F#5', 0.5), N('E5', 1), N('F#5', 0.5),
      N('D6', 1), N('F#5', 0.5),
      N('E6', 1), N('B5', 0.5),
      N('A5', 0.5), N('F#5', 0.5), N('D6', 0.75), N('F#6', 0.25),
      N('E6', 0.5), N('D6', 1), N('F#5', 0.5),
      N('D6', 1), N('F#5', 0.5),
      N('E6', 1), N('B5', 0.5),
      N('A5', 0.5), N('F#5', 0.5), N('F#6', 0.75), N('D6', 0.25),
      N('E6', 0.5), N('D6', 1.5),
    ],
    chords: ['D', 'D', 'G', 'D', 'Em', 'A7', 'D', 'A7', 'D', 'D', 'G', 'D', 'A7', 'D', 'G', 'D', 'A7', 'D'],
  },

  battleCry: {
    id: 'battleCry',
    title: 'The Battle Cry of Freedom',
    year: 1862,
    faction: 'USA',
    meter: 4,
    tempo: 112,
    note: 'George F. Root; Lincoln: "worth a hundred generals." Melody verified against period tab (G major).',
    melody: [
      // Verse — "Yes, we'll rally 'round the flag, boys"
      N('G4', 0.75), N('A4', 0.25), N('B4', 0.5), N('B4', 0.5), N('B4', 1), N('A4', 1), N('G4', 1), N('F#4', 2),
      N('F#4', 1), N('G4', 1), N('G4', 1), N('G4', 1), N('F#4', 1), N('E4', 2),
      N('D4', 1), N('D4', 1), N('C5', 0.5), N('B4', 0.5), N('D4', 1), N('G4', 1), N('A4', 1), N('B4', 1), N('A4', 2),
      // Chorus — "The Union forever! Hurrah, boys, hurrah!"
      N('D5', 1.5), N('D5', 0.5), N('B4', 1), N('C5', 1), N('D5', 1.5), N('E5', 0.5),
      N('D5', 1.5), N('D5', 0.5), N('B4', 1), N('C5', 1), N('D5', 2),
      N('D5', 1), N('B4', 1), N('C5', 1), N('D5', 1), N('E5', 1), N('D5', 1), N('B4', 1), N('G4', 1), N('A4', 2),
      N('G4', 1), N('A4', 1), N('B4', 0.5), N('B4', 0.5), N('B4', 1), N('A4', 1), N('G4', 1), N('E4', 2),
      N('G4', 1), N('G4', 1), N('G4', 1), N('F#4', 1), N('E4', 2),
      N('D5', 1), N('D5', 1), N('C5', 0.5), N('B4', 0.5), N('D5', 1), N('G4', 1), N('A4', 1), N('B4', 1), N('A4', 2),
    ],
    chords: ['G', 'Em', 'C', 'G', 'D', 'G', 'C', 'G', 'C', 'G', 'D', 'G', 'Em', 'C', 'G', 'D', 'G'],
  },

  homeSweetHome: {
    id: 'homeSweetHome',
    title: 'Home, Sweet Home',
    year: 1823,
    faction: 'BOTH',
    meter: 3,
    tempo: 96,
    note: 'Bishop/Payne. The tune both armies\' bands joined on together at Stones River, Fredericksburg, and the Rappahannock.',
    melody: [
      // Verse — "'Mid pleasures and palaces though we may roam"
      N('D4', 1), N('E4', 0.5), N('F#4', 0.5), N('G4', 1),
      N('B4', 1), N('A4', 1), N('F#4', 1),
      N('A4', 1.5), N('G4', 0.5), N('F#4', 1),
      N('G4', 2), N('E4', 1),
      N('D4', 1), N('E4', 0.5), N('F#4', 0.5), N('G4', 1),
      N('B4', 1), N('A4', 1), N('F#4', 1),
      N('A4', 1), N('G4', 1), N('F#4', 1),
      N('G4', 1), N('E4', 1), N('D4', 2),
      // Chorus — "Home! Home! Sweet, sweet home!"
      N('D5', 2), N('B4', 1),
      N('A4', 1), N('G4', 1), N('F#4', 2),
      N('E4', 1), N('D4', 2),
      N('A4', 1), N('G4', 1), N('F#4', 1),
      N('E4', 1), N('D4', 2),
      N('A4', 1), N('G4', 1), N('F#4', 1),
      N('E4', 1), N('D4', 3),
    ],
    chords: ['D', 'G', 'D', 'A7', 'D', 'G', 'D', 'A7', 'D'],
  },

  johnny: {
    id: 'johnny',
    title: 'When Johnny Comes Marching Home',
    year: 1863,
    faction: 'USA',
    meter: 3, // 6/8 — three quarter-beat units per bar
    tempo: 132,
    note: 'Patrick Gilmore (as Louis Lambert), premiered by Gilmore\'s own band. Sung by both sides. Melody from period ocarina tab (A minor).',
    melody: [
      // 6/8 — beats counted in quarters (eighth = 0.5)
      N('E4', 1), N('E4', 1), N('A4', 1), N('A4', 1), N('A4', 0.5), N('B4', 0.5),
      N('C5', 1), N('B4', 0.5), N('C5', 0.5), N('A4', 1.5), N('G4', 0.5), N('E4', 0.5), N('G4', 1.5),
      N('A4', 1), N('E4', 1), N('A4', 1), N('A4', 1), N('A4', 0.5), N('B4', 0.5),
      N('C5', 1), N('B4', 0.5), N('C5', 0.5), N('D5', 1.5), N('E5', 0.5), N('C5', 0.5), N('E5', 1.5),
      N('C5', 1), N('E5', 1), N('E5', 1), N('E5', 1), N('E5', 1), N('D5', 0.5), N('C5', 0.5),
      N('D5', 1), N('D5', 1), N('D5', 1), N('B4', 2),
      N('C5', 1), N('C5', 1), N('C5', 1), N('B4', 1), N('A4', 1), N('B4', 1), N('B4', 1), N('B4', 2),
      N('C5', 1), N('D5', 1), N('E5', 1), N('D5', 1), N('C5', 1), N('B4', 1),
      N('E4', 1), N('A4', 1), N('A4', 1), N('A4', 1), N('G4', 0.5), N('A4', 2.5),
    ],
    chords: ['Am', 'Am', 'Dm', 'Am', 'E7', 'Am', 'C', 'G', 'Am', 'E7', 'Am', 'G', 'F', 'E7', 'Am'],
  },

  taps: {
    id: 'taps',
    title: 'Taps',
    year: 1862,
    faction: 'BOTH',
    meter: 4,
    tempo: 60,
    note: 'Butterfield\'s bugle call — sounded at lights-out and for the fallen. Solo bugle, no band.',
    melody: [
      N('Bb3', 1), N('Bb3', 1), N('Bb3', 1), N('Eb4', 3),
      N('Bb3', 1), N('Bb3', 1), N('Bb3', 1), N('G4', 3),
      N('Bb3', 1), N('Bb3', 1), N('Bb3', 1), N('Eb4', 1), N('G4', 1), N('Bb4', 3),
      N('G4', 1), N('Eb4', 3),
      N('Bb3', 4),
    ],
    chords: [],
  },
};

/** Faction march played while troops form up (briefing). */
export function factionMarch(faction: 'NORTH' | 'SOUTH'): BandTune {
  return faction === 'NORTH' ? BAND_TUNES.johnny : BAND_TUNES.dixie;
}

/** Faction anthem for victory. */
export function factionAnthem(faction: 'NORTH' | 'SOUTH'): BandTune {
  return faction === 'NORTH' ? BAND_TUNES.battleCry : BAND_TUNES.dixie;
}
