/**
 * Contracts the game must keep, run by hand in the browser console:
 *
 *     __game.verify()
 *
 * Each check builds its own GameState, so running them never disturbs the game
 * on screen (or the saved best scores). They cover the rules that would be
 * miserable to discover from play: a piece that can't turn back to where it
 * started, a blast that leaves a block hanging in mid-air, a top-out that
 * doesn't come back, a flick that drops two pieces, a board that doesn't fit
 * on a short phone.
 */

import { COLS, HIDDEN_ROWS, MAX_VIRTUAL_H, MIN_VIRTUAL_H, ROWS, SCREEN, TOTAL_ROWS } from '../game/config';
import { EMPTY, PIECES, TNT, minoAt } from '../game/pieces';
import { GameState, TNT_ARMED, type GameEvent, type Mode } from '../game/state';
import { layout } from '../render/layout';
import { Gestures, type GestureTarget } from '../ui/gestures';

interface Result {
  check: string;
  ok: boolean;
  note: string;
}

const DT = 1 / 120;

/** Run the simulation until the next piece is falling (or `limit` seconds pass). */
function settle(s: GameState, events: GameEvent[] = [], limit = 20): boolean {
  for (let t = 0; t < limit; t += DT) {
    s.update(DT);
    s.drainEvents((e) => events.push({ ...e }));
    if (s.step === 'falling' && s.active) return true;
  }
  return false;
}

function floating(s: GameState): number {
  let n = 0;
  for (let y = 0; y < TOTAL_ROWS - 1; y++) {
    for (let x = 0; x < COLS; x++) {
      if (s.cell(x, y) !== EMPTY && s.cell(x, y + 1) === EMPTY) n++;
    }
  }
  return n;
}

function count(s: GameState, pred: (v: number) => boolean): number {
  let n = 0;
  for (const v of s.cells) if (pred(v)) n++;
  return n;
}

/** A plain greedy bot: tries every turn and column, keeps the flattest result. */
function bestMove(s: GameState): { rot: number; x: number } {
  const p = s.piece;
  let best = { rot: p.rot, x: p.x, score: -Infinity };
  const m = { x: 0, y: 0 };
  for (let rot = 0; rot < 4; rot++) {
    for (let x = -3; x < COLS + 1; x++) {
      if (!s.fits(p.kind, rot, x, p.y)) continue;
      let y = p.y;
      while (s.fits(p.kind, rot, x, y + 1)) y++;
      let low = 0;
      for (let i = 0; i < 4; i++) {
        minoAt(p.kind, rot, i, m);
        low += y + m.y;
      }
      const score = low + Math.random() * 0.5;
      if (score > best.score) best = { rot, x, score };
    }
  }
  return best;
}

function botPlays(mode: Mode, pieces: number): Result {
  const s = new GameState();
  s.start(mode, 1234);
  let placed = 0;
  let problems = '';
  let booms = 0;
  let topouts = 0;
  const events: GameEvent[] = [];
  for (let i = 0; i < pieces && !problems; i++) {
    if (!settle(s, events)) {
      problems = `stuck in step "${s.step}" after ${placed} pieces`;
      break;
    }
    const target = bestMove(s);
    for (let k = 0; k < 4 && s.piece.rot !== target.rot; k++) s.rotate(1);
    for (let k = 0; k < 12 && s.piece.x !== target.x; k++) if (!s.move(Math.sign(target.x - s.piece.x))) break;
    s.hardDrop();
    placed++;
    for (const v of s.cells) if (v > TNT_ARMED) problems = `bad cell value ${v}`;
    if (mode === 'classic' && count(s, (v) => v === TNT || v === TNT_ARMED) > 0) problems = 'TNT in Classic';
  }
  for (const e of events) {
    if (e.kind === 'boom' && e.tag === 0) booms++;
    if (e.kind === 'topout') topouts++;
  }
  return {
    check: `bot plays ${pieces} pieces (${mode})`,
    ok: !problems && placed === pieces && (mode === 'classic' || booms > 0),
    note: problems || `${placed} placed, ${s.lines} lines, ${booms} booms, ${topouts} top-outs, score ${s.score}`,
  };
}

export function verify(): Result[] {
  const results: Result[] = [];
  const add = (check: string, ok: boolean, note: string): void => {
    results.push({ check, ok, note });
  };
  const m = { x: 0, y: 0 };

  // --- Pieces ---------------------------------------------------------------
  {
    let bad = '';
    for (let k = 0; k < PIECES.length; k++) {
      for (let i = 0; i < 4; i++) {
        const [x0, y0] = PIECES[k]!.minos[i]!;
        minoAt(k, 4, i, m);
        if (m.x !== x0 || m.y !== y0) bad += `${PIECES[k]!.name}#${i} `;
        for (let r = 0; r < 4; r++) {
          minoAt(k, r, i, m);
          const n = PIECES[k]!.n;
          if (m.x < 0 || m.y < 0 || m.x >= n || m.y >= n) bad += `${PIECES[k]!.name}r${r} `;
        }
      }
    }
    add('four turns bring every piece back, inside its box', !bad, bad || '7 pieces x 4 minos');
  }
  {
    const s = new GameState();
    s.start('classic', 7);
    const seen: number[] = [];
    let ok = true;
    for (let i = 0; i < 14; i++) {
      if (!settle(s)) ok = false;
      seen.push(s.piece.kind);
      s.hardDrop();
    }
    const counts = PIECES.map((_, k) => seen.filter((v) => v === k).length);
    add('seven-bag: every piece twice in 14', ok && counts.every((c) => c === 2), counts.join(','));
  }
  {
    let bad = '';
    const s = new GameState();
    for (let k = 0; k < PIECES.length; k++) {
      s.start('classic', k);
      s.cells.fill(EMPTY);
      const def = PIECES[k]!;
      const x = Math.floor((COLS - def.n) / 2);
      let minY = 9;
      for (const [, my] of def.minos) minY = Math.min(minY, my);
      if (!s.fits(k, 0, x, HIDDEN_ROWS - minY)) bad += def.name;
    }
    add('every piece spawns on the top visible row', !bad, bad || 'all fit');
  }

  // --- Classic clearing ---------------------------------------------------------
  {
    const s = new GameState();
    s.start('classic', 1);
    s.loadBoard(['1.......', '2222222.', '3333333.', '4444444.']);
    // An upright I in the last column completes the bottom three rows.
    s.placePiece(0, 1, COLS - 3, TOTAL_ROWS - 4);
    s.forceLock();
    const ok = settle(s);
    const left = count(s, (v) => v !== EMPTY);
    add('classic: an I completes three rows, the rest shifts down', ok && s.lines === 3 && left === 2 && s.cell(0, TOTAL_ROWS - 1) === 1, `lines ${s.lines}, blocks left ${left}`);
  }

  // --- BOOM ----------------------------------------------------------------------------
  {
    const s = new GameState();
    s.start('boom', 1);
    // Blocks on a ledge above, a crate in the bottom row.
    s.loadBoard(['..55....', '..5.....', '.66.....', '11T1111.']);
    s.placePiece(0, 1, COLS - 3, TOTAL_ROWS - 4);
    s.forceLock();
    const events: GameEvent[] = [];
    const ok = settle(s, events);
    const booms = events.filter((e) => e.kind === 'boom').length;
    const tnt = count(s, (v) => v === TNT || v === TNT_ARMED);
    add('boom: a crate in a cleared row goes off and nothing floats', ok && booms === 1 && tnt === 0 && floating(s) === 0, `booms ${booms}, crates left ${tnt}, floating ${floating(s)}`);
  }
  {
    const s = new GameState();
    s.start('boom', 1);
    // A second crate within reach of the first: it must chain.
    s.loadBoard(['.....T..', '333T333.']);
    s.placePiece(0, 1, COLS - 3, TOTAL_ROWS - 4);
    s.forceLock();
    const events: GameEvent[] = [];
    const ok = settle(s, events);
    const booms = events.filter((e) => e.kind === 'boom');
    const delayed = booms.length === 2;
    add('boom: a crate caught in a blast goes off too', ok && delayed && count(s, (v) => v === TNT) === 0, `booms ${booms.length}`);
  }
  {
    const s = new GameState();
    s.start('boom', 1);
    // The blast and the cleared row leave a gap that the row above falls into,
    // and the block above its hole falls in with it: a second row, a combo.
    s.loadBoard(['5.......', '.4444444', '........', '........', '........', 'T111111.']);
    s.placePiece(0, 1, COLS - 3, TOTAL_ROWS - 4);
    s.forceLock();
    const events: GameEvent[] = [];
    const ok = settle(s, events);
    const combos = events.filter((e) => e.kind === 'combo').length;
    add('boom: blocks falling into the holes can clear more rows', ok && s.lines >= 2 && combos >= 1 && floating(s) === 0, `lines ${s.lines}, combos ${combos}, floating ${floating(s)}`);
  }

  // --- Topping out --------------------------------------------------------------------
  {
    const s = new GameState();
    s.start('boom', 3);
    const rows: string[] = [];
    for (let y = 0; y < TOTAL_ROWS; y++) rows.push(y % 2 ? '1111111.' : '.2222222');
    s.loadBoard(rows);
    const events: GameEvent[] = [];
    // The next spawn can't fit: dance, the big bang, an empty board, carry on.
    const ok = settle(s, events, 12);
    const kinds = new Set(events.map((e) => e.kind));
    add(
      'a top-out blows up the board and play carries on',
      ok && s.rounds === 1 && kinds.has('dance') && kinds.has('topout') && kinds.has('fresh') && count(s, (v) => v !== EMPTY) <= 4,
      `rounds ${s.rounds}, blocks after ${count(s, (v) => v !== EMPTY)}`,
    );
  }

  // --- Bots ----------------------------------------------------------------------------
  results.push(botPlays('classic', 400), botPlays('boom', 400));

  // --- Gestures ------------------------------------------------------------------------
  {
    const log: string[] = [];
    const target: GestureTarget = {
      move: (dx) => (log.push(dx > 0 ? 'R' : 'L'), true),
      softDrop: () => (log.push('S'), true),
      hardDrop: () => void log.push('H'),
      rotate: () => (log.push('T'), true),
    };
    const g = new Gestures();
    g.cell = 26;
    const run = (pts: [string, number, number, number][]): string => {
      log.length = 0;
      for (const [kind, x, y, t] of pts) g.handle({ kind: kind as 'down', x, y, t }, target);
      return log.join('');
    };
    const tap = run([['down', 100, 300, 0], ['up', 102, 301, 0.1]]);
    const drag = run([['down', 100, 300, 0], ['move', 140, 302, 0.2], ['move', 170, 303, 0.4], ['up', 170, 303, 0.5]]);
    const flick = run([['down', 100, 300, 0], ['move', 101, 340, 0.08], ['up', 102, 380, 0.15]]);
    const slow = run([['down', 100, 300, 0], ['move', 100, 340, 0.4], ['move', 100, 380, 0.8], ['up', 100, 380, 1]]);
    // A piece changing mid-drag: the rest of the drag does nothing.
    log.length = 0;
    g.handle({ kind: 'down', x: 100, y: 300, t: 0 }, target);
    g.pieceChanged();
    g.handle({ kind: 'move', x: 200, y: 300, t: 0.2 }, target);
    g.handle({ kind: 'up', x: 200, y: 380, t: 0.25 }, target);
    const stale = log.join('');
    add(
      'gestures: tap turns, drag slides, flick drops, slow drag soft-drops',
      tap === 'T' && drag === 'RRR' && flick.endsWith('H') && !slow.includes('H') && slow.includes('S') && stale === '',
      `tap "${tap}", drag "${drag}", flick "${flick}", slow "${slow}", stale "${stale}"`,
    );
  }

  // --- Layout ----------------------------------------------------------------------------
  {
    const saved = SCREEN.h;
    let bad = '';
    for (let h = MIN_VIRTUAL_H; h <= MAX_VIRTUAL_H; h += 20) {
      SCREEN.h = h;
      const L = layout();
      if (L.boardY + L.boardH > h - 4 || L.boardX < 4 || L.boardX + L.boardW > SCREEN.w - 4 || L.cell < 22 || L.hudH < 96) {
        bad += `${h} `;
      }
    }
    SCREEN.h = saved;
    layout();
    add(`the board fits every frame height ${MIN_VIRTUAL_H}-${MAX_VIRTUAL_H}`, !bad, bad || `${ROWS} rows, cells >= 22 px`);
  }

  console.table(results);
  const failed = results.filter((r) => !r.ok);
  if (failed.length === 0) console.log(`%c${results.length} contracts hold`, 'color:#2a2');
  else console.error(`${failed.length} of ${results.length} contracts FAILED`);
  return results;
}
