/**
 * Every colour the procedural art uses.
 *
 * The blocks are toy blocks: one bright colour each, a lighter face, a darker
 * rim, and a little embossed shape so pieces can be told apart by more than
 * colour alone (a heart, a star, a moon...). The palette follows the classic
 * game's assignments loosely, so anyone who has played it reads them at once.
 */

export interface BlockLook {
  face: string;
  light: string;
  dark: string;
  /** The embossed shape on its face. */
  shape: 'ring' | 'star' | 'heart' | 'diamond' | 'moon' | 'flower' | 'dot';
}

/** Indexed by cell value (1-7). Index 0 is unused. */
export const BLOCKS: readonly BlockLook[] = [
  { face: '#000000', light: '#000000', dark: '#000000', shape: 'dot' },
  { face: '#3fc6f0', light: '#9fe6ff', dark: '#1d7fb3', shape: 'ring' }, // I
  { face: '#ffd23f', light: '#fff09a', dark: '#c99a12', shape: 'star' }, // O
  { face: '#a66cf0', light: '#d2b2ff', dark: '#6a3db3', shape: 'moon' }, // T
  { face: '#6fd85a', light: '#bdf5a8', dark: '#3c9a2c', shape: 'flower' }, // S
  { face: '#ff5c6c', light: '#ffadb5', dark: '#c02d42', shape: 'heart' }, // Z
  { face: '#4f7cff', light: '#a9c0ff', dark: '#2a48b8', shape: 'diamond' }, // J
  { face: '#ff9a3c', light: '#ffd0a0', dark: '#c5641a', shape: 'dot' }, // L
];

export const PALETTE = {
  overlay: '#140f26',
  skyTop: '#2b2152',
  skyBottom: '#5a3c7d',
  boomTop: '#3a1630',
  boomBottom: '#8a3a3a',
  well: 'rgba(14, 10, 30, 0.78)',
  wellEdge: '#f4d9ff',
  grid: 'rgba(255, 255, 255, 0.06)',
  ghost: 'rgba(255, 255, 255, 0.55)',
  hudText: '#fff6e0',
  hudShadow: '#2a1840',
  gold: '#ffd23f',
  pink: '#ff7eb6',
  panel: 'rgba(28, 18, 52, 0.88)',
  panelEdge: '#ffb8e0',
  button: '#ff7eb6',
  buttonDark: '#c2447f',
  boomButton: '#ff8c42',
  boomButtonDark: '#b8501a',
  tntRed: '#c8352b',
  tntDark: '#7a1c16',
  tntLetters: '#ffd23f',
  flash: '#ffffff',
} as const;

/** `#rrggbb` with an alpha, as an rgba() string. */
export function alpha(hex: string, a: number): string {
  if (!hex.startsWith('#') || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
