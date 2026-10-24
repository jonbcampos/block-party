import { COLS, HIDDEN_ROWS, ROWS, SCREEN } from '../game/config';

/**
 * Where everything goes on screen, recomputed each frame from SCREEN.
 *
 * The board is as big as fits between the top band (the two characters and
 * the next piece) and a thin bottom margin. Cell size is a whole number of
 * virtual px so the grid lines stay crisp.
 */
export interface Layout {
  cell: number;
  /** Board's top-left corner in virtual px (top of the first VISIBLE row). */
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
  /** The band above the board. */
  hudH: number;
}

const HUD_H = 100;
const BOTTOM = 12;
const SIDE = 10;

export const L: Layout = { cell: 26, boardX: 0, boardY: 0, boardW: 0, boardH: 0, hudH: HUD_H };

export function layout(): Layout {
  const cell = Math.floor(Math.min((SCREEN.w - SIDE * 2) / COLS, (SCREEN.h - HUD_H - BOTTOM) / ROWS));
  L.cell = cell;
  L.boardW = cell * COLS;
  L.boardH = cell * ROWS;
  L.boardX = Math.round((SCREEN.w - L.boardW) / 2);
  // Any spare height goes half above the board and half below.
  const spare = SCREEN.h - HUD_H - BOTTOM - L.boardH;
  L.hudH = HUD_H + Math.floor(spare / 2);
  L.boardY = L.hudH;
  return L;
}

/** Centre of board cell (x, y) in virtual px. `y` counts the hidden rows. */
export function cellX(x: number): number {
  return L.boardX + (x + 0.5) * L.cell;
}
export function cellY(y: number): number {
  return L.boardY + (y - HIDDEN_ROWS + 0.5) * L.cell;
}
