import { TNT } from '../game/pieces';
import { BLOCKS, PALETTE } from './palette';
import { drawFitted, spriteFrames } from './sprites';

/**
 * The toy blocks and the TNT crate, at whatever size a cell is today.
 *
 * Blocks are painted by code, not by the image model, on purpose: at 23-31 px
 * a painted texture is mush, and what reads at that size is a bold flat
 * colour, a rim, a shine and a shape. Each look is drawn once per cell size
 * into a little canvas and stamped from then on, because 128 cells of rounded
 * rectangles and gradients every frame is real work on an old phone.
 *
 * The TNT crate uses the slingshot's painted crate when it is there (same
 * crate, same raccoons) and a drawn one when it isn't.
 */

const cache = new Map<string, HTMLCanvasElement>();

function stamp(key: string, size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void): HTMLCanvasElement {
  const hit = cache.get(key);
  if (hit) return hit;
  // Drawn at 2x so it stays crisp on a retina screen.
  const k = 2;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.ceil(size * k);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(k, k);
  paint(ctx, size);
  cache.set(key, canvas);
  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paintBlock(ctx: CanvasRenderingContext2D, s: number, value: number): void {
  const look = BLOCKS[value] ?? BLOCKS[1]!;
  const r = s * 0.2;
  // Rim.
  ctx.fillStyle = look.dark;
  roundRect(ctx, 0.5, 0.5, s - 1, s - 1, r);
  ctx.fill();
  // Face, lit from the top-left.
  const g = ctx.createLinearGradient(0, 0, s, s);
  g.addColorStop(0, look.light);
  g.addColorStop(0.45, look.face);
  g.addColorStop(1, look.face);
  ctx.fillStyle = g;
  roundRect(ctx, s * 0.09, s * 0.07, s * 0.82, s * 0.8, r * 0.8);
  ctx.fill();
  // Shine.
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  roundRect(ctx, s * 0.18, s * 0.13, s * 0.36, s * 0.12, s * 0.06);
  ctx.fill();
  // The embossed shape: a lighter fill with a darker edge.
  ctx.save();
  ctx.translate(s / 2, s * 0.52);
  ctx.fillStyle = look.light;
  ctx.strokeStyle = look.dark;
  ctx.lineWidth = Math.max(1, s * 0.05);
  shapePath(ctx, look.shape, s * 0.2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function shapePath(ctx: CanvasRenderingContext2D, shape: string, r: number): void {
  ctx.beginPath();
  switch (shape) {
    case 'ring':
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.moveTo(r * 0.45, 0);
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2, true);
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? r * 1.15 : r * 0.5;
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'heart':
      ctx.moveTo(0, r * 0.9);
      ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.4);
      ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
      ctx.closePath();
      break;
    case 'diamond':
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(0, r * 1.1);
      ctx.lineTo(-r * 0.85, 0);
      ctx.closePath();
      break;
    case 'moon':
      ctx.arc(0, 0, r, Math.PI * 0.25, Math.PI * 1.75);
      ctx.arc(r * 0.55, 0, r * 0.75, Math.PI * 1.5, Math.PI * 0.5, true);
      ctx.closePath();
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
        ctx.moveTo(Math.cos(a) * r * 0.6 + r * 0.42, Math.sin(a) * r * 0.6);
        ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, r * 0.42, 0, Math.PI * 2);
      }
      break;
    default:
      ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
  }
}

/** The hand-drawn crate, for when the painted one isn't there. */
function paintTnt(ctx: CanvasRenderingContext2D, s: number): void {
  ctx.fillStyle = PALETTE.tntDark;
  roundRect(ctx, 0.5, 0.5, s - 1, s - 1, s * 0.12);
  ctx.fill();
  ctx.fillStyle = PALETTE.tntRed;
  roundRect(ctx, s * 0.1, s * 0.1, s * 0.8, s * 0.8, s * 0.06);
  ctx.fill();
  ctx.strokeStyle = PALETTE.tntDark;
  ctx.lineWidth = Math.max(1, s * 0.04);
  for (const fx of [0.37, 0.63]) {
    ctx.beginPath();
    ctx.moveTo(s * fx, s * 0.12);
    ctx.lineTo(s * fx, s * 0.88);
    ctx.stroke();
  }
  ctx.fillStyle = PALETTE.tntLetters;
  ctx.font = `bold ${Math.round(s * 0.36)}px "SF Mono", ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('TNT', s / 2, s * 0.54);
}

/**
 * Draw one cell at (x, y), its top-left, `s` px square. `glow` 0..1 makes a
 * crate glow (it's about to go off) and is ignored for blocks.
 */
export function drawCell(ctx: CanvasRenderingContext2D, value: number, x: number, y: number, s: number, glow = 0): void {
  if (value === TNT || value > 8) {
    const frames = spriteFrames('tnt.damage');
    if (frames) {
      // Frame 3 is the cracked, glowing "about to blow" crate.
      const frame = frames[glow > 0.5 ? 3 : 0]!;
      drawFitted(ctx, frame, x, y, s, s);
    } else {
      ctx.drawImage(stamp(`tnt:${s}`, s, paintTnt), x, y, s, s);
    }
    if (glow > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = glow * 0.6;
      ctx.fillStyle = '#ff8c2a';
      ctx.fillRect(x, y, s, s);
      ctx.restore();
    }
    return;
  }
  ctx.drawImage(stamp(`b${value}:${s}`, s, (c, size) => paintBlock(c, size, value)), x, y, s, s);
}

/** The outline a piece will land in. */
export function drawGhost(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  roundRect(ctx, x + 2, y + 2, s - 4, s - 4, s * 0.18);
  ctx.stroke();
  ctx.setLineDash([]);
}
