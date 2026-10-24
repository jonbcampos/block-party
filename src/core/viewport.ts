import { MAX_DPR, MAX_VIRTUAL_H, MIN_VIRTUAL_H, SCREEN, VIRTUAL_W } from '../game/config';

/**
 * Maps the virtual game frame onto whatever the real device screen is.
 *
 * The siblings' viewport turned inside out: they are landscape games that
 * rotate themselves when a phone is held upright; this is a portrait game, and
 * it doesn't rotate at all. A tall well on a sideways phone or a desktop window
 * is simply letterboxed, with the board as big as the height allows. Rotating
 * a portrait game onto a landscape screen would make her hold the phone
 * sideways to play a game about things falling DOWN.
 *
 * Width is fixed and height adapts to the aspect ratio within the clamps, so a
 * tall phone gets bigger cells rather than bars.
 */
export class Viewport {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;

  /** Virtual px -> CSS px. */
  scale = 1;
  /** Letterbox offsets in CSS px. */
  offsetX = 0;
  offsetY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;

    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('orientationchange', this.resize);
  }

  resize = (): void => {
    // Floored at 1px: a zero-sized window divides to NaN, and a NaN SCREEN.h
    // poisons every coordinate until the next resize.
    const cssW = Math.max(1, window.innerWidth);
    const cssH = Math.max(1, window.innerHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);

    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;

    SCREEN.rotated = false;
    SCREEN.w = VIRTUAL_W;
    SCREEN.h = Math.round(clamp((VIRTUAL_W * cssH) / cssW, MIN_VIRTUAL_H, MAX_VIRTUAL_H));
    this.scale = Math.min(cssW / SCREEN.w, cssH / SCREEN.h);
    this.offsetX = (cssW - SCREEN.w * this.scale) / 2;
    this.offsetY = (cssH - SCREEN.h * this.scale) / 2;

    const s = this.scale * dpr;
    this.ctx.setTransform(s, 0, 0, s, this.offsetX * dpr, this.offsetY * dpr);
    this.ctx.imageSmoothingEnabled = false;
  };

  /** A pointer event's CSS-pixel position in virtual coordinates. */
  toVirtual(clientX: number, clientY: number): { x: number; y: number } {
    return {
      x: (clientX - this.offsetX) / this.scale,
      y: (clientY - this.offsetY) / this.scale,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
