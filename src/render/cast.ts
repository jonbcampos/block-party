import type { Audio } from '../core/audio';
import { CHATTER_GAP, SCREEN, TEASE_GAP } from '../game/config';
import type { GameEvent, GameState } from '../game/state';
import type { Layout } from './layout';
import type { Particles } from './particles';
import { drawFitted, spriteFrames } from './sprites';

/**
 * Ellie and the raccoon, sitting either side of the next piece and reacting to
 * everything that happens on the board.
 *
 * They're the same two characters (and the same painted sheets) as the
 * slingshot game: the raccoon is the one whose TNT keeps turning up in the
 * pieces, and he is NOT pleased when it goes off. He teases when the stack gets
 * tall, dances when it reaches the top, and gets blown clean off his perch by
 * the big top-out bang (nobody is hurt: he comes running back). Ellie cheers,
 * teases back, and holds her nose when he toots.
 *
 * Voice lines are one at a time (Audio.say drops a line that would talk over
 * another), and each character has a minimum gap so it stays a joke.
 */

type EllieMood = 'ready' | 'tease' | 'aim' | 'go' | 'cheer' | 'ew' | 'amazed' | 'ohwell';
const ELLIE_FRAME: Record<EllieMood, number> = { ready: 0, tease: 1, aim: 2, go: 3, cheer: 4, ew: 5, amazed: 6, ohwell: 7 };

type RaccoonMood = 'raspberry' | 'nyah' | 'toot' | 'burp' | 'smug' | 'laugh' | 'scared' | 'dizzy' | 'run';
const RACCOON_FRAME: Record<Exclude<RaccoonMood, 'run'>, [string, number]> = {
  raspberry: ['bandit.tease', 0],
  nyah: ['bandit.tease', 1],
  toot: ['bandit.tease', 2],
  burp: ['bandit.tease', 3],
  smug: ['bandit.mood', 0],
  laugh: ['bandit.mood', 1],
  scared: ['bandit.mood', 2],
  dizzy: ['bandit.mood', 3],
};

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Cast {
  private ellie = { mood: 'ready' as EllieMood, timer: 0, hop: 0, nextLine: 0, ewIn: -1 };
  private raccoon = {
    mood: 'smug' as RaccoonMood,
    timer: 0,
    hop: 0,
    nextLine: 0,
    /** Blown away by a top-out: offset from his perch and spin. */
    away: 0,
    awayV: 0,
    spin: 0,
    returning: false,
    nextTease: 0,
    nextToot: 18,
  };
  private time = 0;

  constructor(
    private audio: Audio,
    private particles: Particles,
  ) {}

  reset(): void {
    this.ellie.mood = 'ready';
    this.ellie.timer = 0;
    const r = this.raccoon;
    r.mood = 'smug';
    r.timer = 0;
    r.away = 0;
    r.awayV = 0;
    r.spin = 0;
    r.returning = false;
    r.nextTease = this.time + 6;
    r.nextToot = this.time + rand(16, 26);
  }

  private setEllie(mood: EllieMood, seconds: number, hop = false): void {
    this.ellie.mood = mood;
    this.ellie.timer = seconds;
    if (hop) this.ellie.hop = 1;
  }

  private setRaccoon(mood: RaccoonMood, seconds: number, hop = false): void {
    if (this.raccoon.away > 0 && !this.raccoon.returning) return;
    this.raccoon.mood = mood;
    this.raccoon.timer = seconds;
    if (hop) this.raccoon.hop = 1;
  }

  /** Ellie says one of these, if she hasn't spoken too recently. `force` skips the gap. */
  private ellieSays(ids: readonly string[], delay = 0, force = false): void {
    if (!force && this.time < this.ellie.nextLine) return;
    this.ellie.nextLine = this.time + CHATTER_GAP * 0.6;
    if (!this.audio.say(ids, { delay })) this.audio.play('ellie-giggle');
  }

  private raccoonSays(ids: readonly string[], delay = 0, force = false): void {
    if (!force && this.time < this.raccoon.nextLine) return;
    this.raccoon.nextLine = this.time + CHATTER_GAP;
    if (!this.audio.say(ids, { delay })) this.audio.play('giggle');
  }

  onEvent(e: GameEvent, state: GameState): void {
    switch (e.kind) {
      case 'spawn':
        if (e.value === 1 && Math.random() < 0.35) {
          // A crate in the piece: it's HIS TNT.
          this.setRaccoon('scared', 1.2);
          if (Math.random() < 0.5) this.raccoonSays(['r.mytnt']);
          else this.ellieSays(['e.ooh']);
        }
        break;
      case 'clear':
        if (e.value >= 4) {
          this.setEllie('amazed', 1.6, true);
          this.setRaccoon('scared', 1.6, true);
          this.ellieSays(['e.super', 'e.wow'], 0, true);
          this.raccoonSays(['r.nofair'], 0.9, true);
        } else if (e.tag === 1) {
          // A crate is about to go: Ellie gets ready, he panics.
          this.setEllie('go', 1.0);
          this.setRaccoon('scared', 1.4, true);
          this.raccoonSays(['r.uhoh']);
        } else {
          this.setEllie('cheer', 1.1, true);
          this.setRaccoon('scared', 0.9);
          this.ellieSays(e.value >= 2 ? ['e.yay', 'e.takethat'] : ['e.yay']);
        }
        break;
      case 'boom':
        if (e.tag === 1) break; // the top-out sweep has its own reactions
        this.setEllie('cheer', 1.4, true);
        this.setRaccoon('dizzy', 1.8, true);
        if (e.value <= 1) this.ellieSays(['e.kaboom'], 0.05);
        break;
      case 'combo':
        this.setEllie('amazed', 1.6, true);
        this.ellieSays(['e.boomboom', 'e.wow'], 0, true);
        this.raccoonSays(['r.whoa'], 0.8);
        break;
      case 'level':
        this.setEllie('cheer', 1.4, true);
        this.ellieSays(['e.faster', 'e.yay']);
        this.setRaccoon('toot', 1.4);
        this.toot(0.3);
        break;
      case 'danger':
        if (this.time >= this.raccoon.nextTease) {
          this.raccoon.nextTease = this.time + TEASE_GAP;
          this.setRaccoon(Math.random() < 0.5 ? 'nyah' : 'raspberry', 1.6, true);
          this.raccoonSays(['r.toohigh', 'r.nyah', 'r.hehe']);
          this.setEllie(Math.random() < 0.5 ? 'tease' : 'aim', 1.6);
          this.ellieSays(['e.hmph', 'e.nyah'], 1.2);
        }
        break;
      case 'dance':
        this.setRaccoon('laugh', 1.6, true);
        this.raccoonSays(['r.wewin'], 0, true);
        this.setEllie('ohwell', 1.6);
        this.ellieSays(['e.ohno'], 1.0, true);
        break;
      case 'topout': {
        // Blown clean off his perch, spinning.
        const r = this.raccoon;
        r.mood = 'dizzy';
        r.away = 0.01;
        r.awayV = 1;
        r.returning = false;
        this.setEllie('amazed', 2.2, true);
        this.ellieSays(['e.kaboom'], 0.25, true);
        this.raccoonSays(['r.whoa'], 0.9, true);
        break;
      }
      case 'fresh':
        this.raccoon.returning = true;
        this.raccoon.mood = 'run';
        this.setEllie('go', 1.2, true);
        this.ellieSays(['e.again', 'e.letsgo'], 0, true);
        break;
    }
    void state;
  }

  /** He toots; she holds her nose. `delay` before Ellie reacts. */
  private toot(delay: number): void {
    this.audio.toot(Math.random() < 0.5 ? 'pfft' : 'squeak', 1.15, 0.7);
    const x = SCREEN.w - 30;
    this.particles.toot(x + 8, 70, 1);
    if (Math.random() < 0.5) this.raccoonSays(['r.oops', 'r.excuse'], 0.35);
    this.ellie.ewIn = delay;
    this.ellieSays(['e.ew'], delay + 0.9);
  }

  update(dt: number, state: GameState): void {
    this.time += dt;
    const e = this.ellie;
    e.timer -= dt;
    e.hop = Math.max(0, e.hop - dt * 2.5);
    if (e.ewIn >= 0) {
      e.ewIn -= dt;
      if (e.ewIn < 0) this.setEllie('ew', 1.6);
    }
    if (e.timer <= 0 && e.mood !== 'ready') e.mood = 'ready';

    const r = this.raccoon;
    r.timer -= dt;
    r.hop = Math.max(0, r.hop - dt * 2.5);
    if (r.away > 0) {
      if (!r.returning) {
        // Up, away and spinning, then he waits off screen.
        r.away = Math.min(1, r.away + dt * 1.4);
        r.spin += dt * 14;
      } else {
        r.away = Math.max(0, r.away - dt * 0.9);
        if (r.away === 0) {
          r.returning = false;
          r.spin = 0;
          this.setRaccoon('smug', 1.5);
        }
      }
    } else if (r.timer <= 0 && r.mood !== 'smug') {
      r.mood = 'smug';
    }

    // Idle mischief: now and then he toots, because of course he does.
    if (state.phase === 'playing' && state.step === 'falling' && this.time > r.nextToot && r.away === 0) {
      r.nextToot = this.time + rand(22, 38);
      this.setRaccoon(Math.random() < 0.35 ? 'burp' : 'toot', 1.4, true);
      if (r.mood === 'burp') {
        this.audio.burp(1.1, 0.8);
        this.raccoonSays(['r.excuse'], 0.5);
        this.setEllie('ew', 1.4);
      } else {
        this.toot(0.4);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, L: Layout): void {
    const h = Math.min(L.hudH - 26, 84);
    const groundY = L.hudH - 3;

    // Ellie, on the left.
    {
      const e = this.ellie;
      const bob = Math.sin(this.time * 2.2) * 1.2;
      const hop = -Math.sin(e.hop * Math.PI) * 10;
      const w = h * 0.72;
      const x = 8;
      const y = groundY - h + bob + hop;
      const frames = spriteFrames('ellie.poses');
      if (frames) drawFitted(ctx, frames[ELLIE_FRAME[e.mood]]!, x, y, w, h);
      else drawEllieFallback(ctx, x + w / 2, groundY + hop, h, e.mood);
    }

    // The raccoon, on the right, facing her.
    {
      const r = this.raccoon;
      const size = h * 0.86;
      const bob = Math.sin(this.time * 2.6 + 1) * 1.2;
      const hop = -Math.sin(r.hop * Math.PI) * 9;
      // Blown away: an arc up and off to the right.
      const k = r.away;
      const ax = k * 140;
      const ay = r.returning ? 0 : -Math.sin(Math.min(1, k) * Math.PI * 0.6) * 60;
      const cx = SCREEN.w - 8 - size / 2 + ax;
      const bottom = groundY + bob + hop + ay;
      ctx.save();
      ctx.translate(cx, bottom - size / 2);
      if (!r.returning) ctx.rotate(r.spin);
      let frame: HTMLCanvasElement | null = null;
      if (r.mood === 'run') {
        const run = spriteFrames('bandit.run');
        // The run row faces right; coming back he runs LEFT, so mirror it.
        if (run) frame = run[Math.floor(this.time * 10) % run.length]!;
        ctx.scale(-1, 1);
      } else {
        const [sheet, i] = RACCOON_FRAME[r.mood];
        frame = spriteFrames(sheet)?.[i] ?? null;
      }
      const w = r.mood === 'run' ? size * 1.3 : size * 0.95;
      const fh = r.mood === 'run' ? size * 0.72 : size;
      if (frame) drawFitted(ctx, frame, -w / 2, size / 2 - fh, w, fh);
      else drawRaccoonFallback(ctx, size, r.mood);
      ctx.restore();
    }
  }
}

// --- Fallbacks: no generated art at all ---------------------------------------

function drawEllieFallback(ctx: CanvasRenderingContext2D, cx: number, bottom: number, h: number, mood: EllieMood): void {
  const head = h * 0.2;
  const hy = bottom - h + head * 1.4;
  // Dress.
  ctx.fillStyle = '#ff6f6f';
  ctx.beginPath();
  ctx.moveTo(cx, hy + head);
  ctx.lineTo(cx - h * 0.2, bottom - h * 0.18);
  ctx.lineTo(cx + h * 0.2, bottom - h * 0.18);
  ctx.closePath();
  ctx.fill();
  // Legs.
  ctx.fillStyle = '#c98b5a';
  ctx.fillRect(cx - h * 0.09, bottom - h * 0.18, h * 0.05, h * 0.16);
  ctx.fillRect(cx + h * 0.04, bottom - h * 0.18, h * 0.05, h * 0.16);
  // Arms up when cheering.
  ctx.strokeStyle = '#c98b5a';
  ctx.lineWidth = h * 0.04;
  const up = mood === 'cheer' || mood === 'amazed';
  ctx.beginPath();
  ctx.moveTo(cx - h * 0.08, hy + head * 1.4);
  ctx.lineTo(cx - h * 0.2, up ? hy - head * 0.4 : hy + head * 2.6);
  ctx.moveTo(cx + h * 0.08, hy + head * 1.4);
  ctx.lineTo(cx + h * 0.2, up ? hy - head * 0.4 : hy + head * 2.6);
  ctx.stroke();
  // Hair and face.
  ctx.fillStyle = '#4a2c1a';
  ctx.beginPath();
  ctx.arc(cx, hy, head * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c98b5a';
  ctx.beginPath();
  ctx.arc(cx + head * 0.15, hy + head * 0.1, head * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a10';
  ctx.fillRect(cx - head * 0.2, hy - head * 0.1, 2, 2);
  ctx.fillRect(cx + head * 0.45, hy - head * 0.1, 2, 2);
}

function drawRaccoonFallback(ctx: CanvasRenderingContext2D, size: number, mood: RaccoonMood): void {
  const r = size * 0.38;
  ctx.fillStyle = '#8d8f99';
  ctx.beginPath();
  ctx.arc(0, size * 0.1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f2e6d0';
  ctx.beginPath();
  ctx.arc(0, size * 0.2, r * 0.6, 0, Math.PI * 2);
  ctx.fill();
  // Ears.
  ctx.fillStyle = '#6c6e78';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * r * 0.6, -r * 0.65, r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
  // Mask.
  ctx.fillStyle = '#2b2b33';
  ctx.fillRect(-r * 0.75, -r * 0.3, r * 1.5, r * 0.34);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-r * 0.42, -r * 0.24, 3, 3);
  ctx.fillRect(r * 0.3, -r * 0.24, 3, 3);
  if (mood === 'raspberry' || mood === 'nyah') {
    ctx.fillStyle = '#ff7e9a';
    ctx.fillRect(-2, r * 0.15, 4, 5);
  }
}
