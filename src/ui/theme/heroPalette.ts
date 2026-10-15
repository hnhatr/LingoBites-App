/**
 * Colours of the bright mint-to-sky cards: Home's "Hôm nay" card, a word
 * pack's hero, the study flash card and the other screens' main cards.
 * The cards keep these colours in every theme, so they live here once
 * instead of in each card.
 */
export const HERO_PALETTE = {
  faceFrom: '#34dcc3',
  faceTo: '#5fc8ff',
  shelf: '#1fa597',
  ink: '#1c1c10',
  tealInk: '#00413a',
  teal: '#006b5f',
  white: '#ffffff',
  chip: 'rgba(255,255,255,0.88)',
  chipStrong: 'rgba(255,255,255,0.92)',
  strip: 'rgba(255,255,255,0.88)',
  dash: 'rgba(0,0,0,0.18)',
  track: '#dfeee9',
  coral: '#fe7488',
  coralShelf: '#e2506a',
  coralRing: 'rgba(254,116,136,0.25)',
  sun: '#ffd166',
  sunShelf: '#e0a92e',
  ghostShelf: 'rgba(0,74,65,0.25)',
  /** Light sky chips, e.g. the lesson player's "Loại một phương án sai". */
  skySoft: '#e3f4ff',
  skyInk: '#14507a',
  skyShelf: '#bfe0f5',
} as const;
