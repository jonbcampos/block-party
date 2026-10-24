import { Rng } from '../core/rng';
import {
  BLAST_POINTS,
  BLAST_R2,
  BOOM_HOLD,
  CHAIN_DELAY,
  COLS,
  FALL_DECAY,
  FALL_MIN,
  FALL_START,
  FLASH_TIME,
  HIDDEN_ROWS,
  LINES_PER_LEVEL,
  LINE_POINTS,
  LOCK_DELAY,
  LOCK_RESETS,
  MAX_LEVEL,
  ROW_TNT_STAGGER,
  SETTLE_STEP,
  SPAWN_DELAY,
  TEASE_HEIGHT,
  TNT_CHANCE,
  TNT_PITY,
  TOPOUT_BLASTS,
  TOPOUT_DANCE,
  TOPOUT_LEVEL_DROP,
  TOPOUT_REST,
  TOPOUT_SWEEP,
  TOTAL_ROWS,
} from './config';
import { EMPTY, KICKS, PIECES, TNT, colourOf, minoAt } from './pieces';

/**
 * The whole simulation: the board, the falling piece, and the resolution that
 * follows a lock (flash, blasts, falling, more flashes).
 *
 * It never touches the screen or the speakers. Everything worth seeing or
 * hearing goes out as a GameEvent, which main.ts drains into particles, sound
 * and the two characters, exactly as in the siblings.
 *
 * ## What happens after a piece locks
 *
 * In Classic it's the game everyone knows: full rows flash, vanish, and the
 * rows above shift down.
 *
 * In BOOM mode a full row with a TNT crate in it doesn't just vanish. The crate
 * goes off and clears a blob of the board around it; any crate caught in that
 * blob goes off a beat later; and when the smoke clears, every loose block
 * falls straight down into the holes. Falling blocks can complete new rows,
 * which can hold more crates, so one good drop can set off a chain. That loop
 * is `resolve` -> `finishFlash` -> `updateBoom` -> `updateSettle` -> `resolve`.
 */

export type Mode = 'classic' | 'boom';
export type Phase = 'title' | 'playing' | 'paused';
export type Step = 'spawn' | 'falling' | 'flash' | 'boom' | 'settle' | 'dance' | 'topout' | 'rest';

export type EventKind =
  | 'move'
  | 'rotate'
  | 'turn-fail'
  | 'soft'
  | 'drop'
  | 'land'
  | 'lock'
  | 'clear'
  | 'pop'
  | 'boom'
  | 'shatter'
  | 'combo'
  | 'level'
  | 'spawn'
  | 'danger'
  | 'dance'
  | 'topout'
  | 'fresh';

export interface GameEvent {
  kind: EventKind;
  /** Board cell, where the event has a place. */
  x: number;
  y: number;
  /** Count, level, cell value: whatever the event is about. */
  value: number;
  /** A second number: hasTnt for a clear, 1 for a top-out blast. */
  tag: number;
}

export interface Piece {
  kind: number;
  rot: number;
  /** Top-left of the piece's box, in board cells. */
  x: number;
  y: number;
  /** Which of the four minos is a TNT crate, or -1. */
  tnt: number;
}

interface Blast {
  active: boolean;
  x: number;
  y: number;
  at: number;
  r2: number;
  wipe: boolean;
}

/** An armed crate: caught in a blast and about to go. Drawn glowing; never falls. */
export const TNT_ARMED = 9;

const EVENTS = 512;
const BLASTS = 96;

export class GameState {
  phase: Phase = 'title';
  mode: Mode = 'classic';
  step: Step = 'spawn';
  /** Seconds left in the current step, for the timed ones. */
  stepTime = 0;

  /** Row-major, row 0 at the top of the HIDDEN rows. */
  readonly cells = new Uint8Array(COLS * TOTAL_ROWS);
  readonly piece: Piece = { kind: 0, rot: 0, x: 0, y: 0, tnt: -1 };
  /** False between a lock and the next spawn. */
  active = false;
  readonly next: Piece = { kind: 0, rot: 0, x: 0, y: 0, tnt: -1 };

  level = 1;
  lines = 0;
  score = 0;
  /** Rounds lost to a top-out, for the HUD's "again!" count. */
  rounds = 0;
  /** How many resolutions this lock has set off; 2 or more is a combo. */
  chain = 0;
  /** Seconds since start, never paused-by-step: drives animation in the renderer. */
  clock = 0;

  /** The full rows being flashed, in ascending order. */
  readonly flashRows: number[] = [];

  private rng = new Rng(1);
  private readonly bag: number[] = [0, 1, 2, 3, 4, 5, 6];
  private bagIndex = 7;
  private sinceTnt = 0;

  private fallTimer = 0;
  private lockTimer = 0;
  private lockResets = 0;
  private landed = false;

  private readonly blasts: Blast[] = [];
  private boomClock = 0;
  private lastBlastAt = 0;
  private settleTimer = 0;
  private topoutQueued = 0;

  private readonly events: GameEvent[] = [];
  private eventCount = 0;
  private readonly m = { x: 0, y: 0 };

  constructor() {
    for (let i = 0; i < EVENTS; i++) this.events.push({ kind: 'move', x: 0, y: 0, value: 0, tag: 0 });
    for (let i = 0; i < BLASTS; i++) this.blasts.push({ active: false, x: 0, y: 0, at: 0, r2: 0, wipe: false });
  }

  // --- Lifecycle --------------------------------------------------------------

  start(mode: Mode, seed = (Math.random() * 2 ** 31) | 0): void {
    this.mode = mode;
    this.rng = new Rng(seed);
    this.cells.fill(EMPTY);
    this.bagIndex = 7;
    this.sinceTnt = 0;
    this.level = 1;
    this.lines = 0;
    this.score = 0;
    this.rounds = 0;
    this.chain = 0;
    this.active = false;
    this.flashRows.length = 0;
    for (const b of this.blasts) b.active = false;
    this.eventCount = 0;
    this.phase = 'playing';
    this.rollNext();
    this.step = 'spawn';
    this.stepTime = 0.35;
  }

  /** Seconds per row at the current level. */
  fallInterval(): number {
    return Math.max(FALL_MIN, FALL_START * FALL_DECAY ** (this.level - 1));
  }

  // --- Board helpers ------------------------------------------------------------

  cell(x: number, y: number): number {
    if (x < 0 || x >= COLS || y < 0 || y >= TOTAL_ROWS) return -1;
    return this.cells[y * COLS + x]!;
  }

  private set(x: number, y: number, v: number): void {
    this.cells[y * COLS + x] = v;
  }

  /** Could `kind` in `rot` sit with its box at (x, y)? Out of bounds is solid; above the top is not. */
  fits(kind: number, rot: number, x: number, y: number): boolean {
    for (let i = 0; i < 4; i++) {
      minoAt(kind, rot, i, this.m);
      const cx = x + this.m.x;
      const cy = y + this.m.y;
      if (cx < 0 || cx >= COLS || cy >= TOTAL_ROWS) return false;
      if (cy >= 0 && this.cells[cy * COLS + cx] !== EMPTY) return false;
    }
    return true;
  }

  /** Rows the active piece would fall if dropped now. */
  dropDistance(): number {
    const p = this.piece;
    let d = 0;
    while (this.fits(p.kind, p.rot, p.x, p.y + d + 1)) d++;
    return d;
  }

  /** How many visible rows the stack fills, 0 for an empty board. */
  stackHeight(): number {
    for (let y = 0; y < TOTAL_ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const v = this.cells[y * COLS + x]!;
        if (v !== EMPTY) return TOTAL_ROWS - y;
      }
    }
    return 0;
  }

  // --- Commands ---------------------------------------------------------------------

  private canAct(): boolean {
    return this.phase === 'playing' && this.step === 'falling' && this.active;
  }

  move(dx: number): boolean {
    if (!this.canAct()) return false;
    const p = this.piece;
    if (!this.fits(p.kind, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    this.afterShift();
    this.emit('move', p.x, p.y, dx);
    return true;
  }

  rotate(dir = 1): boolean {
    if (!this.canAct()) return false;
    const p = this.piece;
    const rot = (p.rot + dir + 4) % 4;
    for (const [kx, ky] of KICKS) {
      if (this.fits(p.kind, rot, p.x + kx, p.y + ky)) {
        p.rot = rot;
        p.x += kx;
        p.y += ky;
        this.afterShift();
        this.emit('rotate', p.x, p.y, dir);
        return true;
      }
    }
    this.emit('turn-fail', p.x, p.y, dir);
    return false;
  }

  /** One row down, now. Returns false if it couldn't. */
  softDrop(): boolean {
    if (!this.canAct()) return false;
    const p = this.piece;
    if (!this.fits(p.kind, p.rot, p.x, p.y + 1)) return false;
    p.y += 1;
    this.fallTimer = 0;
    this.score += 1;
    this.emit('soft', p.x, p.y, 1);
    this.checkLanded();
    return true;
  }

  hardDrop(): void {
    if (!this.canAct()) return;
    const d = this.dropDistance();
    this.piece.y += d;
    this.score += 2 * d;
    this.emit('drop', this.piece.x, this.piece.y, d);
    this.lock();
  }

  /** A move or turn while touching down buys more time, up to a limit. */
  private afterShift(): void {
    if (this.landed && this.lockResets < LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets++;
    }
    this.checkLanded();
  }

  private checkLanded(): void {
    const p = this.piece;
    const now = !this.fits(p.kind, p.rot, p.x, p.y + 1);
    if (now && !this.landed) this.emit('land', p.x, p.y, 0);
    this.landed = now;
    if (!now) this.lockTimer = 0;
  }

  // --- Update ---------------------------------------------------------------------

  update(dt: number): void {
    if (this.phase !== 'playing') return;
    this.clock += dt;
    switch (this.step) {
      case 'spawn':
        this.stepTime -= dt;
        if (this.stepTime <= 0) this.spawn();
        break;
      case 'falling':
        this.updateFalling(dt);
        break;
      case 'flash':
        this.stepTime -= dt;
        if (this.stepTime <= 0) this.finishFlash();
        break;
      case 'boom':
        this.updateBoom(dt);
        break;
      case 'settle':
        this.updateSettle(dt);
        break;
      case 'dance':
        this.stepTime -= dt;
        if (this.stepTime <= 0) this.beginTopout();
        break;
      case 'topout':
        this.updateBoom(dt);
        break;
      case 'rest':
        this.stepTime -= dt;
        if (this.stepTime <= 0) {
          this.emit('fresh', 0, 0, this.level);
          this.step = 'spawn';
          this.stepTime = 0.1;
        }
        break;
    }
  }

  private updateFalling(dt: number): void {
    const p = this.piece;
    this.checkLanded();
    if (this.landed) {
      this.lockTimer += dt;
      if (this.lockTimer >= LOCK_DELAY) this.lock();
      return;
    }
    this.fallTimer += dt;
    const interval = this.fallInterval();
    while (this.fallTimer >= interval) {
      this.fallTimer -= interval;
      if (this.fits(p.kind, p.rot, p.x, p.y + 1)) {
        p.y += 1;
      } else {
        break;
      }
    }
    this.checkLanded();
  }

  // --- Spawning ---------------------------------------------------------------------

  private takeFromBag(): number {
    if (this.bagIndex >= 7) {
      // Seven-bag: every piece once per seven, shuffled. A child should never
      // wait twenty pieces for the long one.
      for (let i = 6; i > 0; i--) {
        const j = this.rng.int(0, i);
        const t = this.bag[i]!;
        this.bag[i] = this.bag[j]!;
        this.bag[j] = t;
      }
      this.bagIndex = 0;
    }
    return this.bag[this.bagIndex++]!;
  }

  private rollNext(): void {
    const n = this.next;
    n.kind = this.takeFromBag();
    n.rot = 0;
    n.tnt = -1;
    if (this.mode === 'boom') {
      this.sinceTnt++;
      if (this.sinceTnt >= TNT_PITY || this.rng.next() < TNT_CHANCE) {
        n.tnt = this.rng.int(0, 3);
        this.sinceTnt = 0;
      }
    }
  }

  private spawn(): void {
    const p = this.piece;
    p.kind = this.next.kind;
    p.rot = 0;
    p.tnt = this.next.tnt;
    const def = PIECES[p.kind]!;
    let minY = 9;
    for (const [, my] of def.minos) minY = Math.min(minY, my);
    p.x = Math.floor((COLS - def.n) / 2);
    // Top row of the piece on the top visible row, so it is seen at once; if
    // that's blocked, try a row or two up in the hidden rows before giving up.
    p.y = HIDDEN_ROWS - minY;
    let placed = false;
    for (let up = 0; up <= 2; up++) {
      if (this.fits(p.kind, p.rot, p.x, p.y - up)) {
        p.y -= up;
        placed = true;
        break;
      }
    }
    this.rollNext();
    this.chain = 0;
    if (!placed) {
      this.startDance();
      return;
    }
    this.active = true;
    this.landed = false;
    this.fallTimer = 0;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.step = 'falling';
    this.emit('spawn', p.x, p.y, p.tnt >= 0 ? 1 : 0);
  }

  // --- Locking and clearing -------------------------------------------------------

  private lock(): void {
    const p = this.piece;
    let above = false;
    for (let i = 0; i < 4; i++) {
      minoAt(p.kind, p.rot, i, this.m);
      const cx = p.x + this.m.x;
      const cy = p.y + this.m.y;
      if (cy < 0) {
        above = true;
        continue;
      }
      this.set(cx, cy, i === p.tnt ? TNT : colourOf(p.kind));
      if (cy < HIDDEN_ROWS) above = true;
    }
    this.active = false;
    this.emit('lock', p.x, p.y, p.tnt >= 0 ? 1 : 0);
    const h = this.stackHeight();
    if (h >= TEASE_HEIGHT) this.emit('danger', 0, 0, h);
    // Locked partly above the top: a top-out, but only once any rows it
    // completes have had their chance to clear. Clearing can bring it back down.
    this.resolve(above);
  }

  /** Look for full rows; flash them, or move on. */
  private resolve(lockedAbove = false): void {
    this.flashRows.length = 0;
    let hasTnt = 0;
    for (let y = 0; y < TOTAL_ROWS; y++) {
      let full = true;
      for (let x = 0; x < COLS; x++) {
        if (this.cells[y * COLS + x] === EMPTY) {
          full = false;
          break;
        }
      }
      if (!full) continue;
      this.flashRows.push(y);
      for (let x = 0; x < COLS; x++) if (this.cells[y * COLS + x] === TNT) hasTnt = 1;
    }
    if (this.flashRows.length === 0) {
      if (lockedAbove || this.blockedAboveTop()) {
        this.startDance();
        return;
      }
      this.step = 'spawn';
      this.stepTime = SPAWN_DELAY;
      return;
    }
    this.chain++;
    if (this.chain >= 2) this.emit('combo', 0, this.flashRows[0]!, this.chain);
    this.emit('clear', 0, this.flashRows[0]!, this.flashRows.length, hasTnt);
    this.step = 'flash';
    this.stepTime = FLASH_TIME;
  }

  private blockedAboveTop(): boolean {
    for (let i = 0; i < HIDDEN_ROWS * COLS; i++) if (this.cells[i] !== EMPTY) return true;
    return false;
  }

  private finishFlash(): void {
    const rows = this.flashRows;
    const n = rows.length;
    this.lines += n;
    this.score += LINE_POINTS[Math.min(4, n)]! * this.level * this.chain;
    const level = Math.min(MAX_LEVEL, 1 + Math.floor(this.lines / LINES_PER_LEVEL) + this.levelOffset);
    if (level > this.level) {
      this.level = level;
      this.emit('level', 0, 0, level);
    }

    // Crates in the full rows go off (one after another); everything else in
    // those rows pops now.
    this.boomClock = 0;
    this.lastBlastAt = 0;
    let crates = 0;
    for (const y of rows) {
      for (let x = 0; x < COLS; x++) {
        const v = this.cell(x, y);
        if (v === TNT) {
          this.set(x, y, TNT_ARMED);
          this.queueBlast(x, y, crates * ROW_TNT_STAGGER, BLAST_R2, false);
          crates++;
        } else if (v !== EMPTY) {
          this.emit('pop', x, y, v);
          this.set(x, y, EMPTY);
        }
      }
    }
    if (crates > 0) {
      this.step = 'boom';
      return;
    }
    // Classic collapse: each emptied row is removed and everything above it
    // shifts down one. Ascending order, so each shift only ever moves rows that
    // haven't been processed yet.
    for (const y of rows) {
      this.cells.copyWithin(COLS, 0, y * COLS);
      this.cells.fill(EMPTY, 0, COLS);
    }
    this.step = 'spawn';
    this.stepTime = SPAWN_DELAY;
  }

  /** Levels given back after top-outs; keeps `level` monotone within a round. */
  private levelOffset = 0;

  // --- Blasts -------------------------------------------------------------------------

  private queueBlast(x: number, y: number, delay: number, r2: number, wipe: boolean): void {
    const b = this.blasts.find((s) => !s.active);
    if (!b) {
      // Pool exhausted (can't happen at 96 on a 144-cell board): go off now.
      this.detonate(x, y, r2, wipe);
      return;
    }
    b.active = true;
    b.x = x;
    b.y = y;
    b.at = this.boomClock + delay;
    b.r2 = r2;
    b.wipe = wipe;
  }

  private updateBoom(dt: number): void {
    this.boomClock += dt;
    let pending = false;
    for (const b of this.blasts) {
      if (!b.active) continue;
      if (b.at <= this.boomClock) {
        b.active = false;
        this.detonate(b.x, b.y, b.r2, b.wipe);
        this.lastBlastAt = this.boomClock;
      } else {
        pending = true;
      }
    }
    if (pending) return;
    if (this.step === 'topout') {
      if (this.topoutQueued > 0) return;
      if (this.boomClock - this.lastBlastAt < BOOM_HOLD) return;
      // Whatever the sweep missed goes too: the round ends on an empty board.
      for (let y = 0; y < TOTAL_ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          const v = this.cell(x, y);
          if (v !== EMPTY) {
            this.emit('shatter', x, y, v);
            this.set(x, y, EMPTY);
          }
        }
      }
      this.step = 'rest';
      this.stepTime = TOPOUT_REST;
      return;
    }
    if (this.boomClock - this.lastBlastAt >= BOOM_HOLD) {
      this.step = 'settle';
      this.settleTimer = 0;
    }
  }

  private detonate(x: number, y: number, r2: number, wipe: boolean): void {
    if (wipe) this.topoutQueued--;
    this.emit('boom', x, y, this.chain, wipe ? 1 : 0);
    this.set(x, y, EMPTY);
    const reach = Math.ceil(Math.sqrt(r2));
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const cx = x + dx;
        const cy = y + dy;
        const v = this.cell(cx, cy);
        if (v <= EMPTY || v === TNT_ARMED) continue;
        if (v === TNT) {
          // Caught in the blast: armed now, goes off a beat later. Chains!
          this.set(cx, cy, TNT_ARMED);
          this.queueBlast(cx, cy, CHAIN_DELAY, wipe ? r2 : BLAST_R2, wipe);
          if (wipe) this.topoutQueued++;
          continue;
        }
        this.emit('shatter', cx, cy, v);
        this.set(cx, cy, EMPTY);
        if (!wipe) this.score += BLAST_POINTS;
      }
    }
  }

  // --- Falling into the holes -----------------------------------------------------------

  private updateSettle(dt: number): void {
    this.settleTimer += dt;
    while (this.settleTimer >= SETTLE_STEP) {
      this.settleTimer -= SETTLE_STEP;
      if (!this.gravityStep()) {
        this.resolve();
        return;
      }
    }
  }

  /**
   * Every loose block falls one row. Bottom-up, so a whole floating column
   * moves together rather than stretching apart.
   */
  gravityStep(): boolean {
    let moved = false;
    for (let y = TOTAL_ROWS - 2; y >= 0; y--) {
      for (let x = 0; x < COLS; x++) {
        const i = y * COLS + x;
        const v = this.cells[i]!;
        if (v === EMPTY || this.cells[i + COLS] !== EMPTY) continue;
        this.cells[i + COLS] = v;
        this.cells[i] = EMPTY;
        moved = true;
      }
    }
    return moved;
  }

  // --- Topping out -------------------------------------------------------------------------

  private startDance(): void {
    this.active = false;
    this.step = 'dance';
    this.stepTime = TOPOUT_DANCE;
    this.emit('dance', 0, 0, 0);
  }

  private beginTopout(): void {
    this.rounds++;
    this.step = 'topout';
    this.boomClock = 0;
    this.lastBlastAt = 0;
    this.topoutQueued = 0;
    this.emit('topout', 0, 0, this.rounds);
    // A sweep of big blasts from the bottom of the stack to the top.
    const top = TOTAL_ROWS - Math.max(4, this.stackHeight());
    for (let i = 0; i < TOPOUT_BLASTS; i++) {
      const t = i / (TOPOUT_BLASTS - 1);
      const y = Math.round(TOTAL_ROWS - 1 - t * (TOTAL_ROWS - 1 - top));
      const x = this.rng.int(1, COLS - 2);
      this.topoutQueued++;
      this.queueBlast(x, y, t * TOPOUT_SWEEP, 8, true);
    }
    // Next round starts a little calmer.
    const drop = Math.min(TOPOUT_LEVEL_DROP, this.level - 1);
    this.levelOffset -= drop;
    this.level -= drop;
  }

  // --- Events ---------------------------------------------------------------------------------

  private emit(kind: EventKind, x: number, y: number, value: number, tag = 0): void {
    if (this.eventCount >= EVENTS) return;
    const e = this.events[this.eventCount++]!;
    e.kind = kind;
    e.x = x;
    e.y = y;
    e.value = value;
    e.tag = tag;
  }

  drainEvents(consume: (e: GameEvent) => void): void {
    for (let i = 0; i < this.eventCount; i++) consume(this.events[i]!);
    this.eventCount = 0;
  }

  // --- Dev ---------------------------------------------------------------------------------------

  /** For verify(): put a board in a known state. Rows are strings, '.' empty, 'T' TNT, digits colours. */
  loadBoard(rows: readonly string[]): void {
    this.cells.fill(EMPTY);
    const top = TOTAL_ROWS - rows.length;
    rows.forEach((row, r) => {
      for (let x = 0; x < COLS; x++) {
        const ch = row[x] ?? '.';
        this.cells[(top + r) * COLS + x] = ch === '.' ? EMPTY : ch === 'T' ? TNT : Number(ch);
      }
    });
  }

  /** For verify(): lock the current piece where it is, as if the lock delay ran out. */
  forceLock(): void {
    if (this.active) this.lock();
  }

  /** For verify(): set the falling piece directly. */
  placePiece(kind: number, rot: number, x: number, y: number, tnt = -1): void {
    const p = this.piece;
    p.kind = kind;
    p.rot = rot;
    p.x = x;
    p.y = y;
    p.tnt = tnt;
    this.active = true;
    this.step = 'falling';
    this.landed = false;
  }
}
