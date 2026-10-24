import {
  DRAG_STEP,
  FLICK_MAX_TIME,
  FLICK_MIN_DY,
  FLICK_RATIO,
  SOFT_DEADZONE,
  TAP_SLOP,
  TAP_TIME,
} from '../game/config';
import type { QueuedPointer } from '../core/input';

/**
 * Turns one finger into piece commands.
 *
 *  - **Drag sideways**: the piece follows, one column per `DRAG_STEP` cells of
 *    travel, from wherever the finger went down. Relative, not absolute, so her
 *    finger never has to be on the piece (and never hides it).
 *  - **Drag down slowly**: soft drop, one row per cell of travel.
 *  - **Flick down fast**: hard drop. The bar is high on purpose (config.ts).
 *  - **Tap**: turn.
 *
 * A gesture belongs to ONE piece. When the piece locks and the next one
 * spawns, the rest of the gesture is ignored until the finger lifts. Without
 * that, a slow drag down soft-drops the first piece into place and then keeps
 * going on the next, and a flick that drops one piece drops two.
 */

export interface GestureTarget {
  move(dx: number): boolean;
  softDrop(): boolean;
  hardDrop(): void;
  rotate(dir?: number): boolean;
}

export class Gestures {
  private down = false;
  private startX = 0;
  private startY = 0;
  private startT = 0;
  private anchorX = 0;
  private anchorY = 0;
  private maxTravel = 0;
  /** Set when the piece changes mid-gesture: ignore until the finger lifts. */
  private stale = false;
  private moved = false;

  /** Board cell size in virtual px, set by the renderer's layout each frame. */
  cell = 26;

  /** The piece this gesture started on has gone. */
  pieceChanged(): void {
    if (this.down) this.stale = true;
  }

  cancel(): void {
    this.down = false;
    this.stale = false;
  }

  handle(p: QueuedPointer, target: GestureTarget): void {
    if (p.kind === 'down') {
      this.down = true;
      this.stale = false;
      this.moved = false;
      this.startX = this.anchorX = p.x;
      this.startY = this.anchorY = p.y;
      this.startT = p.t;
      this.maxTravel = 0;
      return;
    }
    if (!this.down) return;

    const dx = p.x - this.startX;
    const dy = p.y - this.startY;
    this.maxTravel = Math.max(this.maxTravel, Math.hypot(dx, dy));

    if (p.kind === 'move') {
      if (this.stale) return;
      this.track(p, target);
      return;
    }

    // Up.
    this.down = false;
    if (this.stale) {
      this.stale = false;
      return;
    }
    const dt = p.t - this.startT;
    if (dy > FLICK_MIN_DY && dt < FLICK_MAX_TIME && dy > Math.abs(dx) * FLICK_RATIO) {
      target.hardDrop();
      return;
    }
    this.track(p, target);
    if (!this.moved && this.maxTravel < TAP_SLOP && dt < TAP_TIME) target.rotate(1);
  }

  private track(p: QueuedPointer, target: GestureTarget): void {
    const step = this.cell * DRAG_STEP;
    // Sideways: one column per step of travel from the anchor, which advances
    // by exactly a step each time, so the piece stays locked to the finger.
    let guard = 0;
    while (p.x - this.anchorX >= step && guard++ < 16) {
      this.anchorX += step;
      this.moved = true;
      target.move(1);
    }
    while (this.anchorX - p.x >= step && guard++ < 16) {
      this.anchorX -= step;
      this.moved = true;
      target.move(-1);
    }
    // Down: only once clearly a downward drag, so a sloppy sideways drag
    // doesn't sink the piece too.
    const fromStart = p.y - this.startY;
    if (fromStart < SOFT_DEADZONE) {
      this.anchorY = Math.max(this.anchorY, this.startY + SOFT_DEADZONE * 0.5);
      return;
    }
    while (p.y - this.anchorY >= this.cell && guard++ < 32) {
      this.anchorY += this.cell;
      this.moved = true;
      if (!target.softDrop()) break;
    }
  }
}
