/**
 * The seven pieces, and the bag they come out of.
 *
 * Each piece is four minos given as (x, y) inside an n x n box, in its spawn
 * rotation. Rotating is the same formula for all of them, (x, y) -> (n-1-y, x),
 * which keeps every mino's IDENTITY through a turn. That matters here and not
 * in an ordinary falling-block game: in BOOM mode one particular mino is a TNT
 * crate, and it has to stay the same mino however the piece is turned.
 */

export interface PieceDef {
  readonly name: string;
  /** Box size the rotation turns within. */
  readonly n: number;
  readonly minos: readonly (readonly [number, number])[];
}

export const PIECES: readonly PieceDef[] = [
  { name: 'I', n: 4, minos: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  { name: 'O', n: 2, minos: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  { name: 'T', n: 3, minos: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'S', n: 3, minos: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  { name: 'Z', n: 3, minos: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  { name: 'J', n: 3, minos: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  { name: 'L', n: 3, minos: [[2, 0], [0, 1], [1, 1], [2, 1]] },
];

/** Board cell values. 0 is empty, 1-7 are the pieces' colours, TNT is its own. */
export const EMPTY = 0;
export const TNT = 8;

/** Cell value for a piece kind. */
export function colourOf(kind: number): number {
  return kind + 1;
}

/**
 * The (x, y) of mino `i` of `kind` in rotation `rot`, relative to the box.
 * Written into `out` so the hot paths allocate nothing.
 */
export function minoAt(kind: number, rot: number, i: number, out: { x: number; y: number }): void {
  const def = PIECES[kind]!;
  let [x, y] = def.minos[i]!;
  const r = ((rot % 4) + 4) % 4;
  for (let k = 0; k < r; k++) {
    const nx = def.n - 1 - y;
    y = x;
    x = nx;
  }
  out.x = x;
  out.y = y;
}

/**
 * Where a rotation that doesn't fit tries next. Many more kicks than the
 * standard tables, all small: for a child "I pressed turn and it didn't turn"
 * reads as broken, and a piece that hops one cell to make room never does.
 */
export const KICKS: readonly (readonly [number, number])[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [-2, 0],
  [2, 0],
  [0, 1],
];
