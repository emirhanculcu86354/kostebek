import { SAVE_VERSION } from '../game/GameState';
import type { GameStateData, Settings } from '../game/GameTypes';

export interface SaveFile {
  version: number;
  savedAt: number;
  label: string;
  state: GameStateData;
  /** State at the start of the active mission (for "restart mission" after loading). */
  snapshot: GameStateData | null;
}

export const DEFAULT_SETTINGS: Settings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  sfxVolume: 0.8,
  cameraZoom: 1,
  quality: 'medium',
  showDamageNumbers: true,
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isStrArr = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);

/**
 * Upgrade older save layouts in place. Each step handles exactly one version bump so
 * future schema changes only append a new case.
 */
export function migrateState(raw: Record<string, unknown>): Record<string, unknown> {
  let v = isNum(raw.version) ? raw.version : 1;
  if (v < 2) {
    // v1 had no integrity stat and no follower list.
    const rep = isObj(raw.reputation) ? raw.reputation : {};
    if (!isNum(rep.integrity)) rep.integrity = 50;
    raw.reputation = rep;
    const world = isObj(raw.world) ? raw.world : {};
    if (!Array.isArray(world.following)) world.following = [];
    if (!Array.isArray(world.hiddenNpcs)) world.hiddenNpcs = [];
    raw.world = world;
    v = 2;
  }
  raw.version = v;
  return raw;
}

/** Structural validation. Returns a list of problems; empty means valid. */
export function validateState(s: unknown): string[] {
  const errors: string[] = [];
  if (!isObj(s)) return ['state is not an object'];
  if (s.version !== SAVE_VERSION) errors.push(`unsupported version ${String(s.version)}`);
  const rep = s.reputation;
  if (!isObj(rep)) errors.push('reputation missing');
  else
    for (const k of ['mafia', 'police', 'suspicion', 'integrity']) {
      const val = rep[k];
      if (!isNum(val) || val < 0 || val > 100) errors.push(`reputation.${k} invalid`);
    }
  const p = s.player;
  if (!isObj(p)) errors.push('player missing');
  else {
    if (!isNum(p.health) || !isNum(p.maxHealth) || p.maxHealth <= 0) errors.push('player.health invalid');
    if (!isStr(p.equipped)) errors.push('player.equipped invalid');
    if (!isObj(p.magazines)) errors.push('player.magazines invalid');
    if (p.position !== null && !(isObj(p.position) && isNum(p.position.x) && isNum(p.position.z))) errors.push('player.position invalid');
  }
  const inv = s.inventory;
  if (!isObj(inv) || !Array.isArray(inv.slots) || !isNum(inv.capacity)) errors.push('inventory invalid');
  else if (!inv.slots.every((sl) => isObj(sl) && isStr(sl.item) && isNum(sl.count) && sl.count > 0)) errors.push('inventory slot invalid');
  if (!isObj(s.evidence)) errors.push('evidence invalid');
  const pr = s.progression;
  if (!isObj(pr) || !isNum(pr.xp) || !isNum(pr.level) || !isNum(pr.skillPoints) || !isStrArr(pr.skills)) errors.push('progression invalid');
  const m = s.missions;
  if (!isObj(m) || !(m.active === null || isStr(m.active)) || !isStrArr(m.completed) || !isStrArr(m.completedObjectives)) errors.push('missions invalid');
  if (!isObj(s.flags)) errors.push('flags invalid');
  if (!isObj(s.counters)) errors.push('counters invalid');
  const w = s.world;
  if (!isObj(w) || !isStrArr(w.removed) || !isStrArr(w.killed) || !isStrArr(w.openDoors)) errors.push('world invalid');
  return errors;
}

export function validateSettings(raw: unknown): Settings {
  const out = { ...DEFAULT_SETTINGS };
  if (!isObj(raw)) return out;
  const vol = (v: unknown, d: number) => (isNum(v) ? Math.min(1, Math.max(0, v)) : d);
  out.masterVolume = vol(raw.masterVolume, out.masterVolume);
  out.musicVolume = vol(raw.musicVolume, out.musicVolume);
  out.sfxVolume = vol(raw.sfxVolume, out.sfxVolume);
  out.cameraZoom = isNum(raw.cameraZoom) ? Math.min(1.5, Math.max(0.6, raw.cameraZoom)) : out.cameraZoom;
  out.quality = raw.quality === 'low' || raw.quality === 'high' || raw.quality === 'medium' ? raw.quality : out.quality;
  out.showDamageNumbers = typeof raw.showDamageNumbers === 'boolean' ? raw.showDamageNumbers : out.showDamageNumbers;
  return out;
}
