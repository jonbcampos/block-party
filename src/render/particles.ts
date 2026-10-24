import { spriteFrames } from './sprites';
import { alpha } from './palette';
import { drawText } from '../ui/text';

/**
 * Everything that flies about and fades: block chunks, sparkles, fire, smoke,
 * shockwave rings, the painted explosion flipbook and the words that pop up.
 *
 * In virtual px, in one fixed pool. A top-out sweep blows up the whole board at
 * once, about 140 blocks, each of which throws a few chunks, so the pool is
 * sized for that with plenty to spare and the oldest particle is recycled when
 * it does run out.
 */

export enum PKind {
  /** A spinning square chunk of a block. */
  Chunk,
  /** A tiny bright star of light. */
  Spark,
  /** White-hot, then orange, red, then smoke. */
  Fire,
  Smoke,
  /** A shockwave racing outward. `size2` is the final radius. */
  Ring,
  /** The painted explosion flipbook. `size` is its radius. */
  Flip,
  Text,
  Confetti,
}

export interface Particle {
  alive: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  size: number;
  size2: number;
  life: number;
  maxLife: number;
  color: string;
  color2: string;
  gravity: number;
  drag: number;
  text: string;
}

const MAX = 1600;

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

const CONFETTI = ['#ff7eb6', '#ffd23f', '#3fc6f0', '#a66cf0', '#6fd85a', '#ff9a3c', '#ffffff'];

export class Particles {
  readonly pool: Particle[] = [];
  private cursor = 0;

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        alive: false,
        kind: PKind.Spark,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vr: 0,
        size: 1,
        size2: 1,
        life: 0,
        maxLife: 1,
        color: '#fff',
        color2: '#fff',
        gravity: 0,
        drag: 0,
        text: '',
      });
    }
  }

  clear(): void {
    for (const p of this.pool) p.alive = false;
  }

  private spawn(kind: PKind, x: number, y: number, life: number): Particle {
    let p = this.pool[this.cursor]!;
    for (let i = 0; i < MAX; i++) {
      const c = this.pool[(this.cursor + i) % MAX]!;
      if (!c.alive) {
        p = c;
        this.cursor = (this.cursor + i + 1) % MAX;
        break;
      }
    }
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.rot = 0;
    p.vr = 0;
    p.size = 1;
    p.size2 = 1;
    p.life = life;
    p.maxLife = life;
    p.gravity = 0;
    p.drag = 0;
    p.text = '';
    return p;
  }

  /** A block breaking: four chunks of its colours tumbling out. `force` scales the throw. */
  chunks(x: number, y: number, cell: number, face: string, dark: string, force: number): void {
    for (let i = 0; i < 4; i++) {
      const p = this.spawn(PKind.Chunk, x + rand(-cell, cell) * 0.25, y + rand(-cell, cell) * 0.25, rand(0.7, 1.2));
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 140) * force;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - rand(60, 140) * force;
      p.vr = rand(-12, 12);
      p.size = cell * rand(0.3, 0.5);
      p.gravity = 520;
      p.drag = 0.4;
      p.color = face;
      p.color2 = dark;
    }
  }

  sparkle(x: number, y: number, n: number, color = '#ffffff', speed = 90): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(PKind.Spark, x, y, rand(0.35, 0.8));
      const a = rand(0, Math.PI * 2);
      const s = rand(0.3, 1) * speed;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.size = rand(1.5, 3.2);
      p.drag = 2.5;
      p.color = color;
    }
  }

  confetti(x: number, y: number, n: number, spread = 1): void {
    for (let i = 0; i < n; i++) {
      const p = this.spawn(PKind.Confetti, x + rand(-30, 30) * spread, y, rand(1.2, 2.2));
      p.vx = rand(-90, 90) * spread;
      p.vy = rand(-260, -120);
      p.vr = rand(-14, 14);
      p.size = rand(3, 5.5);
      p.size2 = rand(2, 3.5);
      p.gravity = 340;
      p.drag = 1.2;
      p.color = CONFETTI[Math.floor(Math.random() * CONFETTI.length)]!;
    }
  }

  /**
   * One explosion, in layers, the same recipe as the slingshot's TNT: a white
   * flash, a shockwave ring, the painted fireball (if it was generated), a
   * cluster of fire puffs cooling through orange and red, smoke rising after,
   * and sparks. `r` is the blast radius in px.
   */
  explosion(x: number, y: number, r: number): void {
    const ring = this.spawn(PKind.Ring, x, y, 0.4);
    ring.size = r * 0.3;
    ring.size2 = r * 1.6;
    ring.color = '#fff3c4';

    if (spriteFrames('boom.fx')) {
      const f = this.spawn(PKind.Flip, x, y, 0.7);
      f.size = r * 1.25;
      f.rot = rand(-0.3, 0.3);
      f.size2 = Math.random() < 0.5 ? -1 : 1;
    }
    for (let i = 0; i < 12; i++) {
      const p = this.spawn(PKind.Fire, x + rand(-r, r) * 0.3, y + rand(-r, r) * 0.3, rand(0.45, 0.8));
      const a = rand(0, Math.PI * 2);
      const s = rand(30, 110) * (r / 40);
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - 20;
      p.size = r * rand(0.28, 0.5);
      p.drag = 3.2;
    }
    for (let i = 0; i < 6; i++) {
      const p = this.spawn(PKind.Smoke, x + rand(-r, r) * 0.4, y + rand(-r, r) * 0.3, rand(1, 1.6));
      p.vx = rand(-20, 20);
      p.vy = rand(-50, -20);
      p.size = r * rand(0.3, 0.5);
      p.size2 = p.size * 2.2;
      p.drag = 1;
      p.color = '#4a3a55';
    }
    this.sparkle(x, y, 14, '#ffe08a', 260);
  }

  /** A raccoon's toot: a few pale yellow-green puffs that wobble up and fade. */
  toot(x: number, y: number, dir: number): void {
    for (let i = 0; i < 5; i++) {
      const p = this.spawn(PKind.Smoke, x + rand(-3, 3), y + rand(-3, 3), rand(1.1, 1.7));
      p.vx = dir * rand(10, 40);
      p.vy = rand(-26, -8);
      p.size = rand(3, 5);
      p.size2 = p.size * rand(1.8, 2.6);
      p.drag = 1.5;
      p.color = '#cbdc6a';
    }
  }

  /** A word that pops up, grows a little, floats and fades. */
  popup(x: number, y: number, text: string, color: string, size = 16, life = 1): void {
    const p = this.spawn(PKind.Text, x, y, life);
    p.text = text;
    p.color = color;
    p.size = size;
    p.vy = -26;
    p.drag = 1.4;
  }

  update(dt: number): void {
    for (const p of this.pool) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Smoke under fire, fire under everything else; additive for the hot parts.
    for (const p of this.pool) if (p.alive && p.kind === PKind.Smoke) this.drawOne(ctx, p);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pool) {
      if (p.alive && (p.kind === PKind.Fire || p.kind === PKind.Flip || p.kind === PKind.Ring || p.kind === PKind.Spark)) {
        this.drawOne(ctx, p);
      }
    }
    ctx.restore();
    for (const p of this.pool) {
      if (p.alive && (p.kind === PKind.Chunk || p.kind === PKind.Confetti)) this.drawOne(ctx, p);
    }
    for (const p of this.pool) if (p.alive && p.kind === PKind.Text) this.drawOne(ctx, p);
  }

  private drawOne(ctx: CanvasRenderingContext2D, p: Particle): void {
    const t = 1 - p.life / p.maxLife; // 0 -> 1 over its life
    switch (p.kind) {
      case PKind.Chunk: {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.min(1, p.life * 3);
        const s = p.size;
        ctx.fillStyle = p.color2;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.fillStyle = p.color;
        ctx.fillRect(-s / 2 + 1, -s / 2 + 1, s - 2, s - 2);
        ctx.restore();
        break;
      }
      case PKind.Confetti: {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(p.rot * 1.7));
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size2 / 2, p.size, p.size2);
        ctx.restore();
        break;
      }
      case PKind.Spark: {
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = p.color;
        const s = p.size * (1 - t * 0.5);
        ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        ctx.globalAlpha = 1;
        break;
      }
      case PKind.Fire: {
        // Cools white -> yellow -> orange -> red as it ages.
        const color = t < 0.15 ? '#fffbe6' : t < 0.35 ? '#ffd23f' : t < 0.65 ? '#ff8c2a' : '#c8352b';
        ctx.globalAlpha = (1 - t) * 0.85;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.6 + t * 0.6), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case PKind.Smoke: {
        ctx.globalAlpha = (1 - t) * 0.5 * Math.min(1, t * 6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (p.size2 - p.size) * t, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case PKind.Ring: {
        const r = p.size + (p.size2 - p.size) * Math.sqrt(t);
        ctx.globalAlpha = (1 - t) * 0.9;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2 + (1 - t) * 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case PKind.Flip: {
        const frames = spriteFrames('boom.fx');
        if (!frames) break;
        const frame = frames[Math.min(frames.length - 1, Math.floor(t * frames.length))]!;
        const d = p.size * 2;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.size2, 1);
        const smoothing = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        const aspect = frame.width / frame.height;
        ctx.drawImage(frame, (-d * aspect) / 2, -d / 2, d * aspect, d);
        ctx.imageSmoothingEnabled = smoothing;
        ctx.restore();
        break;
      }
      case PKind.Text: {
        const grow = t < 0.15 ? 0.6 + (t / 0.15) * 0.55 : 1.15 - Math.min(0.15, (t - 0.15) * 0.5);
        ctx.globalAlpha = Math.min(1, p.life * 2.5);
        drawText(ctx, p.text, p.x + 1.5, p.y + 1.5, { size: Math.round(p.size * grow), color: alpha('#2a1840', 0.9), align: 'center' });
        drawText(ctx, p.text, p.x, p.y, { size: Math.round(p.size * grow), color: p.color, align: 'center' });
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}
