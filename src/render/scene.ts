import { COLS, HIDDEN_ROWS, SCREEN, TEASE_HEIGHT, TOTAL_ROWS } from '../game/config';
import { EMPTY, TNT, colourOf, minoAt } from '../game/pieces';
import { TNT_ARMED, type GameState } from '../game/state';
import { drawCell, drawGhost } from './blocks';
import type { Cast } from './cast';
import { L, layout } from './layout';
import { PALETTE, alpha } from './palette';
import type { Particles } from './particles';
import { sprite } from './sprites';

/**
 * Draws a frame of play: the room behind, the well, the blocks, the falling
 * piece and its ghost, the characters, and everything flying about on top.
 *
 * `camera` holds the two screen-wide effects, shake and flash, which main.ts
 * kicks on explosions. They decay here, in real time.
 */
export const camera = { shake: 0, flash: 0, time: 0 };

export function kick(shake: number, flash = 0): void {
  camera.shake = Math.min(1.4, camera.shake + shake);
  camera.flash = Math.max(camera.flash, flash);
}

export function updateCamera(dt: number): void {
  camera.time += dt;
  camera.shake = Math.max(0, camera.shake - dt * 2.4);
  camera.flash = Math.max(0, camera.flash - dt * 3.5);
}

const m = { x: 0, y: 0 };

/** Draw a full-bleed picture so it covers the frame, cropping the excess. */
export function drawCover(ctx: CanvasRenderingContext2D, image: HTMLCanvasElement, dim = 0): void {
  const scale = Math.max(SCREEN.w / image.width, SCREEN.h / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  const smoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, (SCREEN.w - w) / 2, (SCREEN.h - h) / 2, w, h);
  ctx.imageSmoothingEnabled = smoothing;
  if (dim > 0) {
    ctx.fillStyle = `rgba(10, 6, 24, ${dim})`;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }
}

export function drawBackdrop(ctx: CanvasRenderingContext2D, boom: boolean): void {
  const art = sprite(boom ? 'room.boom' : 'room');
  if (art) {
    drawCover(ctx, art, 0.25);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, 0, SCREEN.h);
  g.addColorStop(0, boom ? PALETTE.boomTop : PALETTE.skyTop);
  g.addColorStop(1, boom ? PALETTE.boomBottom : PALETTE.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  // A sprinkle of twinkling stars, fixed positions.
  for (let i = 0; i < 40; i++) {
    const x = (i * 97.3) % SCREEN.w;
    const y = (i * 53.7) % SCREEN.h;
    ctx.globalAlpha = 0.25 + 0.25 * Math.sin(camera.time * 1.5 + i);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.globalAlpha = 1;
}

export function drawScene(ctx: CanvasRenderingContext2D, state: GameState, particles: Particles, cast: Cast): void {
  layout();
  const s = L.cell;

  drawBackdrop(ctx, state.mode === 'boom');

  ctx.save();
  if (camera.shake > 0) {
    const k = camera.shake * camera.shake * 7;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
  }

  // The well.
  const pad = 4;
  ctx.fillStyle = PALETTE.well;
  roundRect(ctx, L.boardX - pad, L.boardY - pad, L.boardW + pad * 2, L.boardH + pad * 2, 8);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.wellEdge, 0.85);
  ctx.lineWidth = 2;
  ctx.stroke();

  // Danger: the top of the well glows red when the stack is tall.
  const height = state.stackHeight();
  if (height >= TEASE_HEIGHT && state.phase === 'playing') {
    const k = (0.5 + 0.5 * Math.sin(camera.time * 6)) * Math.min(1, (height - TEASE_HEIGHT + 1) / 4);
    const g = ctx.createLinearGradient(0, L.boardY, 0, L.boardY + s * 4);
    g.addColorStop(0, `rgba(255, 70, 90, ${0.35 * k})`);
    g.addColorStop(1, 'rgba(255, 70, 90, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(L.boardX, L.boardY, L.boardW, s * 4);
  }

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < COLS; x++) {
    ctx.moveTo(L.boardX + x * s + 0.5, L.boardY);
    ctx.lineTo(L.boardX + x * s + 0.5, L.boardY + L.boardH);
  }
  for (let y = 1; y < TOTAL_ROWS - HIDDEN_ROWS; y++) {
    ctx.moveTo(L.boardX, L.boardY + y * s + 0.5);
    ctx.lineTo(L.boardX + L.boardW, L.boardY + y * s + 0.5);
  }
  ctx.stroke();

  // Locked blocks.
  const flashing = state.step === 'flash';
  const pulse = 0.5 + 0.5 * Math.sin(camera.time * 30);
  for (let y = HIDDEN_ROWS; y < TOTAL_ROWS; y++) {
    const rowFlash = flashing && state.flashRows.includes(y);
    for (let x = 0; x < COLS; x++) {
      const v = state.cell(x, y);
      if (v === EMPTY) continue;
      const px = L.boardX + x * s;
      const py = L.boardY + (y - HIDDEN_ROWS) * s;
      const armed = v === TNT_ARMED || (rowFlash && v === TNT);
      drawCell(ctx, v, px, py, s, armed ? 0.55 + 0.45 * pulse : 0);
    }
    if (rowFlash) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.45 * pulse})`;
      ctx.fillRect(L.boardX, L.boardY + (y - HIDDEN_ROWS) * s, L.boardW, s);
    }
  }

  // The falling piece, and where it'll land.
  if (state.active && state.step === 'falling') {
    const p = state.piece;
    const drop = state.dropDistance();
    for (let i = 0; i < 4; i++) {
      minoAt(p.kind, p.rot, i, m);
      const gx = p.x + m.x;
      const gy = p.y + m.y + drop;
      if (drop > 0 && gy >= HIDDEN_ROWS) {
        drawGhost(ctx, L.boardX + gx * s, L.boardY + (gy - HIDDEN_ROWS) * s, s, i === p.tnt ? '#ffb27a' : PALETTE.ghost);
      }
    }
    for (let i = 0; i < 4; i++) {
      minoAt(p.kind, p.rot, i, m);
      const cy = p.y + m.y;
      if (cy < HIDDEN_ROWS) continue;
      drawCell(ctx, i === p.tnt ? TNT : colourOf(p.kind), L.boardX + (p.x + m.x) * s, L.boardY + (cy - HIDDEN_ROWS) * s, s);
    }
  }

  drawHudBand(ctx, state);
  cast.draw(ctx, L);
  particles.draw(ctx);
  ctx.restore();

  if (camera.flash > 0) {
    ctx.fillStyle = `rgba(255, 246, 220, ${camera.flash * 0.55})`;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }
}

/** The next piece, shown in a little box in the middle of the top band. */
function drawHudBand(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cx = SCREEN.w / 2;
  const boxW = 54;
  const boxH = 44;
  const boxY = L.hudH - boxH - 10;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, cx - boxW / 2, boxY, boxW, boxH, 8);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.panelEdge, 0.7);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const n = state.next;
  const cs = 11;
  let minX = 9;
  let maxX = -9;
  let minY = 9;
  let maxY = -9;
  for (let i = 0; i < 4; i++) {
    minoAt(n.kind, 0, i, m);
    minX = Math.min(minX, m.x);
    maxX = Math.max(maxX, m.x);
    minY = Math.min(minY, m.y);
    maxY = Math.max(maxY, m.y);
  }
  const ox = cx - ((maxX - minX + 1) * cs) / 2 - minX * cs;
  const oy = boxY + boxH / 2 - ((maxY - minY + 1) * cs) / 2 - minY * cs;
  for (let i = 0; i < 4; i++) {
    minoAt(n.kind, 0, i, m);
    drawCell(ctx, i === n.tnt ? TNT : colourOf(n.kind), ox + m.x * cs, oy + m.y * cs, cs);
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
