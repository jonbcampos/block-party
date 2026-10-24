/**
 * Best scores and the mute switch.
 *
 * Versioned, and defensive about what it reads back, as in the siblings:
 * localStorage is shared, hand-editable, and survives across builds.
 * Unreadable data is discarded and the game starts fresh; it never throws.
 */

import type { Mode } from '../game/state';

const KEY = 'block-party.save';
const VERSION = 1;

export interface Save {
  v: number;
  best: Record<Mode, number>;
  muted: boolean;
}

export function freshSave(): Save {
  return { v: VERSION, best: { classic: 0, boom: 0 }, muted: false };
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshSave();
    const data = JSON.parse(raw) as Partial<Save>;
    if (data.v !== VERSION || typeof data.best !== 'object' || data.best === null) return freshSave();
    const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v) : 0);
    return { v: VERSION, best: { classic: num(data.best.classic), boom: num(data.best.boom) }, muted: data.muted === true };
  } catch {
    return freshSave();
  }
}

export function writeSave(save: Save): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Private mode or full storage: the best score is lost, the game is not.
  }
}

/** Keep the better score. Returns true if this one is a new best. */
export function recordScore(save: Save, mode: Mode, score: number): boolean {
  if (score <= save.best[mode]) return false;
  save.best[mode] = score;
  writeSave(save);
  return true;
}
