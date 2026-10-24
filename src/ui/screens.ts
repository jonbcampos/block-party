import type { Save } from '../core/save';
import { SCREEN } from '../game/config';
import type { GameState } from '../game/state';
import { L } from '../render/layout';
import { PALETTE, alpha } from '../render/palette';
import { drawCover, roundRect } from '../render/scene';
import { drawFitted, sprite, spriteFrames } from '../render/sprites';
import { drawText } from './text';

/**
 * The title screen, the pause panel and the HUD's text and buttons.
 *
 * Buttons are big (the smallest is 44 virtual px, about 15 mm on a phone) and
 * they say what they do in a word and a picture, because the player can't
 * read yet. Each screen's button list is a pure function of state, so drawing
 * and hit-testing can never disagree about where a button is.
 */

export interface Button {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  color: string;
  dark: string;
}

export function hitTest(buttons: readonly Button[], x: number, y: number): Button | null {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

function drawButton(ctx: CanvasRenderingContext2D, b: Button, size = 18): void {
  ctx.fillStyle = b.dark;
  roundRect(ctx, b.x, b.y + 4, b.w, b.h, 14);
  ctx.fill();
  ctx.fillStyle = b.color;
  roundRect(ctx, b.x, b.y, b.w, b.h, 14);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  roundRect(ctx, b.x + 8, b.y + 5, b.w - 16, b.h * 0.28, 8);
  ctx.fill();
  drawText(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 1, { size, color: '#ffffff', align: 'center', glow: true });
}

/** A small round icon button: pause or the speaker. */
function drawIconButton(ctx: CanvasRenderingContext2D, b: Button, icon: 'pause' | 'sound' | 'muted'): void {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const r = Math.min(b.w, b.h) / 2 - 2;
  ctx.fillStyle = alpha(PALETTE.panel, 0.9);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = alpha(PALETTE.panelEdge, 0.8);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  if (icon === 'pause') {
    ctx.fillRect(cx - r * 0.38, cy - r * 0.42, r * 0.26, r * 0.84);
    ctx.fillRect(cx + r * 0.12, cy - r * 0.42, r * 0.26, r * 0.84);
    return;
  }
  // A speaker, with waves or a cross.
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.2);
  ctx.lineTo(cx - r * 0.25, cy - r * 0.2);
  ctx.lineTo(cx + r * 0.05, cy - r * 0.48);
  ctx.lineTo(cx + r * 0.05, cy + r * 0.48);
  ctx.lineTo(cx - r * 0.25, cy + r * 0.2);
  ctx.lineTo(cx - r * 0.5, cy + r * 0.2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (icon === 'muted') {
    ctx.moveTo(cx + r * 0.2, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.6, cy + r * 0.25);
    ctx.moveTo(cx + r * 0.6, cy - r * 0.25);
    ctx.lineTo(cx + r * 0.2, cy + r * 0.25);
  } else {
    ctx.arc(cx + r * 0.05, cy, r * 0.35, -0.9, 0.9);
    ctx.moveTo(cx + r * 0.05 + r * 0.6 * Math.cos(-0.9), cy + r * 0.6 * Math.sin(-0.9));
    ctx.arc(cx + r * 0.05, cy, r * 0.6, -0.9, 0.9);
  }
  ctx.stroke();
}

// --- Title -----------------------------------------------------------------------

export function titleButtons(): Button[] {
  const w = 190;
  const h = 58;
  const x = (SCREEN.w - w) / 2;
  // On the painted title's empty wall, above the block tower.
  const y = SCREEN.h * 0.24;
  return [
    { id: 'classic', x, y, w, h, label: 'PLAY', color: PALETTE.button, dark: PALETTE.buttonDark },
    { id: 'boom', x, y: y + h + 22, w, h, label: 'BOOM!', color: PALETTE.boomButton, dark: PALETTE.boomButtonDark },
    { id: 'mute', x: SCREEN.w - 50, y: 8, w: 42, h: 42, label: '', color: '', dark: '' },
  ];
}

export function drawTitle(ctx: CanvasRenderingContext2D, save: Save, muted: boolean, time: number): void {
  const art = sprite('title');
  if (art) drawCover(ctx, art, 0.15);
  else {
    const g = ctx.createLinearGradient(0, 0, 0, SCREEN.h);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(1, PALETTE.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  }

  // The title, bouncing gently, one colour per letter like the blocks.
  const title = 'BLOCK PARTY!';
  const colours = ['#3fc6f0', '#ffd23f', '#a66cf0', '#6fd85a', '#ff5c6c', '#4f7cff', '#ff9a3c'];
  const size = 28;
  const spacing = 19;
  const startX = SCREEN.w / 2 - ((title.length - 1) * spacing) / 2;
  for (let i = 0; i < title.length; i++) {
    const ch = title[i]!;
    if (ch === ' ') continue;
    const y = SCREEN.h * 0.1 + Math.sin(time * 3 + i * 0.6) * 4;
    drawText(ctx, ch, startX + i * spacing + 2, y + 3, { size, color: PALETTE.hudShadow, align: 'center' });
    drawText(ctx, ch, startX + i * spacing, y, { size, color: colours[i % colours.length]!, align: 'center' });
  }

  // Ellie and the raccoon, big, on the floor either side of the tower.
  const h = 112;
  const floor = SCREEN.h * 0.95;
  const ellie = spriteFrames('ellie.poses');
  if (ellie) drawFitted(ctx, ellie[time % 6 < 3 ? 0 : 1]!, 4, floor - h + Math.sin(time * 2) * 2, h * 0.7, h);
  const bandit = spriteFrames('bandit.tease');
  if (bandit) drawFitted(ctx, bandit[Math.floor(time / 1.5) % 2]!, SCREEN.w - 4 - h * 0.85, floor - h * 0.85, h * 0.85, h * 0.85);

  const buttons = titleButtons();
  for (const b of buttons) {
    if (b.id === 'mute') drawIconButton(ctx, b, muted ? 'muted' : 'sound');
    else drawButton(ctx, b, 24);
  }
  // A crate on the BOOM button, so it says what it is without words.
  const boom = buttons[1]!;
  const crate = spriteFrames('tnt.damage');
  if (crate) drawFitted(ctx, crate[0]!, boom.x + 14, boom.y + 12, 30, 30);
  for (const b of buttons.slice(0, 2)) {
    const best = save.best[b.id as 'classic' | 'boom'];
    if (best > 0) drawText(ctx, `best ${best}`, b.x + b.w / 2, b.y + b.h + 10, { size: 10, color: PALETTE.hudText, align: 'center' });
  }
}

// --- In play ---------------------------------------------------------------------

export function hudButtons(): Button[] {
  return [{ id: 'pause', x: SCREEN.w / 2 + 30, y: L.hudH - 50, w: 36, h: 36, label: '', color: '', dark: '' }];
}

export function drawHud(ctx: CanvasRenderingContext2D, state: GameState): void {
  const cx = SCREEN.w / 2;
  drawText(ctx, String(state.score), cx, L.hudH - 66, { size: 18, color: PALETTE.gold, align: 'center', glow: true });
  drawText(ctx, `LV ${state.level}`, cx - 56, L.hudH - 36, { size: 11, color: PALETTE.hudText, align: 'center' });
  drawText(ctx, `${state.lines}`, cx - 56, L.hudH - 22, { size: 11, color: alpha(PALETTE.hudText, 0.7), align: 'center' });
  for (const b of hudButtons()) drawIconButton(ctx, b, 'pause');
}

// --- Pause -----------------------------------------------------------------------

export function pauseButtons(muted: boolean): Button[] {
  const w = 180;
  const h = 52;
  const x = (SCREEN.w - w) / 2;
  const y = SCREEN.h * 0.34;
  return [
    { id: 'resume', x, y, w, h, label: 'PLAY', color: PALETTE.button, dark: PALETTE.buttonDark },
    { id: 'restart', x, y: y + h + 18, w, h, label: 'NEW GAME', color: '#5a8cff', dark: '#2f55b8' },
    { id: 'home', x, y: y + (h + 18) * 2, w, h, label: 'HOME', color: '#8a6cff', dark: '#5338b8' },
    { id: 'mute', x: (SCREEN.w - 46) / 2, y: y + (h + 18) * 3 + 4, w: 46, h: 46, label: muted ? 'muted' : 'sound', color: '', dark: '' },
  ];
}

export function drawPause(ctx: CanvasRenderingContext2D, muted: boolean): void {
  ctx.fillStyle = 'rgba(10, 6, 24, 0.72)';
  ctx.fillRect(0, 0, SCREEN.w, SCREEN.h);
  drawText(ctx, 'PAUSED', SCREEN.w / 2, SCREEN.h * 0.24, { size: 24, color: PALETTE.hudText, align: 'center', glow: true });
  for (const b of pauseButtons(muted)) {
    if (b.id === 'mute') drawIconButton(ctx, b, muted ? 'muted' : 'sound');
    else drawButton(ctx, b, 18);
  }
}
