import { Audio } from './core/audio';
import { Input, type KeyAction, type QueuedPointer } from './core/input';
import { startLoop } from './core/loop';
import { loadSave, recordScore, writeSave } from './core/save';
import { Viewport } from './core/viewport';
import { WakeLock } from './core/wakelock';
import { LINE_POINTS, SCREEN } from './game/config';
import { GameState, type GameEvent, type Mode } from './game/state';
import { BLOCKS, PALETTE } from './render/palette';
import { Cast } from './render/cast';
import { L, cellX, cellY, layout } from './render/layout';
import { Particles } from './render/particles';
import { camera, drawScene, kick, updateCamera } from './render/scene';
import { loadSprites } from './render/sprites';
import { Gestures } from './ui/gestures';
import { drawHud, drawPause, drawTitle, hitTest, hudButtons, pauseButtons, titleButtons } from './ui/screens';

const canvas = document.getElementById('game') as HTMLCanvasElement | null;
if (!canvas) throw new Error('#game canvas missing');

const viewport = new Viewport(canvas);
const input = new Input(viewport);
const state = new GameState();
const particles = new Particles();
const audio = new Audio();
const wakeLock = new WakeLock();
const cast = new Cast(audio, particles);
const gestures = new Gestures();

// Generated art and sound, if any. Fire and forget: the game never waits for
// either, and every piece that arrives replaces its hand-drawn stand-in.
loadSprites(import.meta.env.BASE_URL);
audio.loadRecorded(import.meta.env.BASE_URL);
const save = loadSave();
audio.muted = save.muted;

let realTime = 0;
/** One "new best!" per game, not one per point. */
let cheeredBest = false;
const CLEAR_WORDS = ['', 'YAY!', 'DOUBLE!', 'TRIPLE!', 'SUPER!'];
const BOOM_WORDS = ['BOOM!', 'KABOOM!', 'BANG!', 'KA-BLAM!'];
let boomWord = 0;
/** Pops and shatters can come by the hundred in a tick; a few sounds are plenty. */
let breakSounds = 0;

function newGame(mode: Mode): void {
  state.start(mode);
  particles.clear();
  cast.reset();
  gestures.cancel();
  cheeredBest = false;
}

function goHome(): void {
  recordScore(save, state.mode, state.score);
  state.phase = 'title';
  gestures.cancel();
}

function toggleMute(): void {
  audio.setMuted(!audio.muted);
  save.muted = audio.muted;
  writeSave(save);
}

function pause(): void {
  if (state.phase !== 'playing') return;
  state.phase = 'paused';
  gestures.cancel();
  recordScore(save, state.mode, state.score);
}

// --- Input -------------------------------------------------------------------

function onPointer(p: QueuedPointer): void {
  if (state.phase === 'title') {
    if (p.kind !== 'down') return;
    const hit = hitTest(titleButtons(), p.x, p.y);
    if (!hit) return;
    if (hit.id === 'mute') {
      toggleMute();
      return;
    }
    audio.play('select');
    newGame(hit.id === 'boom' ? 'boom' : 'classic');
    return;
  }
  if (state.phase === 'paused') {
    if (p.kind !== 'down') return;
    const hit = hitTest(pauseButtons(audio.muted), p.x, p.y);
    if (!hit) return;
    audio.play('select');
    if (hit.id === 'resume') state.phase = 'playing';
    else if (hit.id === 'restart') {
      recordScore(save, state.mode, state.score);
      newGame(state.mode);
    } else if (hit.id === 'home') goHome();
    else if (hit.id === 'mute') toggleMute();
    return;
  }
  // Playing.
  if (p.kind === 'down' && hitTest(hudButtons(), p.x, p.y)) {
    audio.play('select');
    pause();
    return;
  }
  gestures.handle(p, state);
}

function onKey(k: KeyAction): void {
  if (k === 'pause') {
    if (state.phase === 'playing') pause();
    else if (state.phase === 'paused') state.phase = 'playing';
    return;
  }
  if (state.phase === 'title') {
    if (k === 'confirm' || k === 'drop') newGame('classic');
    return;
  }
  if (state.phase !== 'playing') {
    if (k === 'confirm') state.phase = 'playing';
    return;
  }
  if (k === 'left') state.move(-1);
  else if (k === 'right') state.move(1);
  else if (k === 'turn') state.rotate(1);
  else if (k === 'turn-back') state.rotate(-1);
  else if (k === 'soft') state.softDrop();
  else if (k === 'drop') state.hardDrop();
}

// --- Events -> sound, particles, words -----------------------------------------

function onEvent(e: GameEvent): void {
  const x = cellX(e.x);
  const y = cellY(e.y);
  switch (e.kind) {
    case 'move':
      audio.play('move');
      break;
    case 'rotate':
      audio.play('rotate');
      break;
    case 'turn-fail':
      audio.play('turn-fail');
      break;
    case 'land':
      audio.play('land');
      break;
    case 'drop':
      audio.play('drop');
      kick(0.18);
      break;
    case 'lock':
      audio.play('lock');
      break;
    case 'spawn':
      gestures.pieceChanged();
      break;
    case 'clear': {
      audio.play('clear', e.value / 4);
      if (e.tag === 1) audio.play('fuse');
      const word = CLEAR_WORDS[Math.min(4, e.value)]!;
      const rowY = cellY(e.y) + ((e.value - 1) * L.cell) / 2;
      particles.popup(SCREEN.w / 2, rowY - 4, word, e.value >= 4 ? PALETTE.pink : PALETTE.gold, e.value >= 4 ? 26 : 20, 1.1);
      particles.popup(SCREEN.w / 2, rowY + 18, `+${LINE_POINTS[Math.min(4, e.value)]! * state.level * Math.max(1, state.chain)}`, '#ffffff', 11, 0.9);
      if (e.value >= 4) particles.confetti(SCREEN.w / 2, rowY, 40, 1.4);
      break;
    }
    case 'pop': {
      const look = BLOCKS[e.value];
      if (look) particles.chunks(x, y, L.cell, look.face, look.dark, 0.5);
      particles.sparkle(x, y, 3, '#ffffff', 60);
      break;
    }
    case 'shatter': {
      const look = BLOCKS[e.value];
      if (look) particles.chunks(x, y, L.cell, look.face, look.dark, 1.3);
      else particles.chunks(x, y, L.cell, PALETTE.tntRed, PALETTE.tntDark, 1.3);
      if (breakSounds < 2) {
        breakSounds++;
        audio.play('break-wood', 0.5);
      }
      break;
    }
    case 'boom': {
      const wipe = e.tag === 1;
      particles.explosion(x, y, L.cell * (wipe ? 3.2 : 2.6));
      audio.play('boom');
      audio.duck(0.3, 0.9);
      kick(wipe ? 0.7 : 0.85, wipe ? 0.7 : 0.9);
      if (!wipe) {
        particles.popup(x, y - L.cell * 1.6, BOOM_WORDS[boomWord++ % BOOM_WORDS.length]!, '#ffd23f', 20, 0.9);
      }
      break;
    }
    case 'combo':
      particles.popup(SCREEN.w / 2, L.boardY + L.boardH * 0.35, e.value >= 3 ? 'MEGA BOOM!' : 'COMBO!', '#ff8c42', 26, 1.4);
      particles.confetti(SCREEN.w / 2, L.boardY + L.boardH * 0.35, 30);
      break;
    case 'level':
      audio.play('level');
      particles.popup(SCREEN.w / 2, L.boardY + L.boardH * 0.45, `LEVEL ${e.value}!`, '#3fc6f0', 22, 1.5);
      break;
    case 'dance':
      audio.play('nyah');
      break;
    case 'topout':
      recordScore(save, state.mode, state.score);
      particles.popup(SCREEN.w / 2, L.boardY + L.boardH * 0.4, 'MEGA BOOM!', '#ff8c42', 30, 2);
      break;
    case 'fresh':
      particles.confetti(SCREEN.w / 2, L.boardY + L.boardH * 0.5, 50, 1.6);
      particles.popup(SCREEN.w / 2, L.boardY + L.boardH * 0.45, 'AGAIN!', '#ffffff', 26, 1.4);
      break;
  }
}

// --- Loop ----------------------------------------------------------------------

function update(dt: number): void {
  realTime += dt;
  if (input.consumeAnyPress()) {
    audio.unlock();
    wakeLock.arm();
  }
  layout();
  gestures.cell = L.cell;
  input.drainKeys(onKey);
  input.drainPointer(onPointer);

  const playing = state.phase === 'playing' || state.phase === 'paused';
  audio.setMusic(!playing ? 'music.title' : state.mode === 'boom' ? 'music.boom' : 'music.play');
  audio.updateMusic();

  updateCamera(dt);
  if (state.phase !== 'playing') return;

  breakSounds = 0;
  state.update(dt);
  state.drainEvents((e) => {
    onEvent(e);
    cast.onEvent(e, state);
  });
  cast.update(dt, state);
  particles.update(dt);

  if (!cheeredBest && state.score > save.best[state.mode] && save.best[state.mode] > 0) {
    cheeredBest = true;
    particles.popup(SCREEN.w / 2, L.boardY + 40, 'NEW BEST!', PALETTE.gold, 20, 1.6);
    particles.confetti(SCREEN.w / 2, L.boardY + 40, 30);
  }
}

function render(): void {
  const ctx = viewport.ctx;
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(-SCREEN.w, -SCREEN.h, SCREEN.w * 3, SCREEN.h * 3);

  if (state.phase === 'title') {
    drawTitle(ctx, save, audio.muted, realTime);
    return;
  }
  drawScene(ctx, state, particles, cast);
  drawHud(ctx, state);
  if (state.phase === 'paused') drawPause(ctx, audio.muted);
}

startLoop({ update, render });

// Offline play and instant launch from the home screen. Production only.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((error) => console.warn('[sw] registration failed', error));
  });
}

if (import.meta.env.DEV) {
  void Promise.all([import('./dev/verify'), import('./dev/art')]).then(([{ verify }, { checkArt }]) => {
    (window as unknown as Record<string, unknown>).__game = {
      state,
      cast,
      camera,
      checkArt,
      verify,
      newGame,
      /** Run the whole game loop by hand for `seconds`, regardless of rAF. */
      advance: (seconds: number) => {
        for (let t = 0; t < seconds; t += 1 / 120) update(1 / 120);
      },
    };
  });
}
