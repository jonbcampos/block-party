/**
 * Input: one finger, and a keyboard for grown-ups.
 *
 * The finger's gestures (drag to slide, tap to turn, flick to drop) are read in
 * ui/gestures.ts from the raw stream this module queues. Presses and releases
 * are QUEUED rather than latched, as in the siblings: a fixed 1/120s step can
 * see a down and an up between two frames, and a latch would lose the tap.
 *
 * Only the first finger counts; a second one landing mid-drag is ignored.
 *
 * Keys: arrows or A/D slide, Up/W/X turns, Z turns the other way, Down/S
 * soft-drops, Space drops, Esc/P pauses. Slide and soft-drop honour key
 * repeat, so holding an arrow keeps sliding, as it does everywhere else.
 */

import type { Viewport } from './viewport';

export type PointerEventKind = 'down' | 'move' | 'up';

export interface QueuedPointer {
  kind: PointerEventKind;
  x: number;
  y: number;
  /** performance.now() / 1000 when it happened. */
  t: number;
}

export type KeyAction = 'left' | 'right' | 'turn' | 'turn-back' | 'soft' | 'drop' | 'pause' | 'confirm';

const QUEUE = 64;

export class Input {
  /** Where the tracked pointer is now, in virtual px. */
  readonly pointer = { x: 0, y: 0, down: false };

  private readonly queue: QueuedPointer[] = [];
  private count = 0;
  private readonly keys: KeyAction[] = [];
  private keyCount = 0;
  private activeId: number | null = null;
  private anyPress = false;

  constructor(private viewport: Viewport) {
    for (let i = 0; i < QUEUE; i++) {
      this.queue.push({ kind: 'down', x: 0, y: 0, t: 0 });
      this.keys.push('turn');
    }
    const canvas = viewport.canvas;
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.anyPress = true;
    if (this.activeId !== null) return;
    this.activeId = e.pointerId;
    try {
      this.viewport.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic events have no capturable pointer; harmless.
    }
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = true;
    this.push('down', x, y);
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    // Moves are queued too, but collapsed: consecutive moves overwrite the last
    // one, so a fast finger can't fill the queue and push out its own release.
    const last = this.count > 0 ? this.queue[this.count - 1]! : null;
    if (last && last.kind === 'move') {
      last.x = x;
      last.y = y;
      last.t = performance.now() / 1000;
    } else {
      this.push('move', x, y);
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.activeId = null;
    const { x, y } = this.viewport.toVirtual(e.clientX, e.clientY);
    this.pointer.x = x;
    this.pointer.y = y;
    this.pointer.down = false;
    this.push('up', x, y);
  };

  private onKey = (e: KeyboardEvent): void => {
    this.anyPress = true;
    let action: KeyAction | null = null;
    let repeats = false;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        action = 'left';
        repeats = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        action = 'right';
        repeats = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        action = 'soft';
        repeats = true;
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyX':
        action = 'turn';
        break;
      case 'KeyZ':
        action = 'turn-back';
        break;
      case 'Space':
        action = 'drop';
        break;
      case 'Escape':
      case 'KeyP':
        action = 'pause';
        break;
      case 'Enter':
        action = 'confirm';
        break;
    }
    if (!action) return;
    e.preventDefault();
    if (e.repeat && !repeats) return;
    if (this.keyCount < QUEUE) this.keys[this.keyCount++] = action;
  };

  /** A backgrounded tab never delivers pointerup. Treat leaving as letting go. */
  private releaseAll = (): void => {
    if (this.activeId === null) return;
    this.activeId = null;
    this.pointer.down = false;
    this.push('up', this.pointer.x, this.pointer.y);
  };

  private push(kind: PointerEventKind, x: number, y: number): void {
    if (this.count >= QUEUE) return;
    const q = this.queue[this.count++]!;
    q.kind = kind;
    q.x = x;
    q.y = y;
    q.t = performance.now() / 1000;
  }

  drainPointer(consume: (p: QueuedPointer) => void): void {
    for (let i = 0; i < this.count; i++) consume(this.queue[i]!);
    this.count = 0;
  }

  drainKeys(consume: (k: KeyAction) => void): void {
    for (let i = 0; i < this.keyCount; i++) consume(this.keys[i]!);
    this.keyCount = 0;
  }

  consumeAnyPress(): boolean {
    const p = this.anyPress;
    this.anyPress = false;
    return p;
  }
}
