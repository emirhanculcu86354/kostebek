import type { GameStateData, Settings } from '../game/GameTypes';
import { migrateState, validateSettings, validateState, type SaveFile } from './SaveSchema';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const SAVE_KEY = 'kostebek.save';
const BACKUP_KEY = 'kostebek.save.backup';
const SETTINGS_KEY = 'kostebek.settings';

export type LoadResult = { ok: true; save: SaveFile; fromBackup: boolean } | { ok: false; error: string };

/** In-memory fallback when localStorage is unavailable (private mode, sandboxed iframes). */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

export function defaultStorage(): KeyValueStorage {
  try {
    const t = '__kostebek_test__';
    localStorage.setItem(t, '1');
    localStorage.removeItem(t);
    return localStorage;
  } catch {
    return new MemoryStorage();
  }
}

export class SaveManager {
  constructor(private storage: KeyValueStorage = defaultStorage()) {}

  hasSave(): boolean {
    return this.load().ok;
  }

  /** Validates before writing; a broken state never replaces a valid save. */
  save(state: GameStateData, snapshot: GameStateData | null, label: string): { ok: boolean; error?: string } {
    const errors = validateState(state);
    if (errors.length) return { ok: false, error: errors.join(', ') };
    if (snapshot && validateState(snapshot).length) snapshot = null;
    const file: SaveFile = { version: state.version, savedAt: Date.now(), label, state, snapshot };
    try {
      const prev = this.storage.getItem(SAVE_KEY);
      if (prev && this.parse(prev).ok) this.storage.setItem(BACKUP_KEY, prev);
      this.storage.setItem(SAVE_KEY, JSON.stringify(file));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'storage error' };
    }
  }

  load(): LoadResult {
    const main = this.storage.getItem(SAVE_KEY);
    if (main) {
      const r = this.parse(main);
      if (r.ok) return { ok: true, save: r.save, fromBackup: false };
    }
    const backup = this.storage.getItem(BACKUP_KEY);
    if (backup) {
      const r = this.parse(backup);
      if (r.ok) return { ok: true, save: r.save, fromBackup: true };
    }
    return { ok: false, error: main ? 'Kayıt dosyası bozuk.' : 'Kayıt bulunamadı.' };
  }

  parse(json: string): { ok: true; save: SaveFile } | { ok: false; error: string } {
    let raw: unknown;
    try {
      raw = JSON.parse(json);
    } catch {
      return { ok: false, error: 'JSON çözümlenemedi' };
    }
    if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'geçersiz kayıt' };
    const file = raw as Record<string, unknown>;
    if (typeof file.state !== 'object' || file.state === null) return { ok: false, error: 'durum yok' };
    const state = migrateState(file.state as Record<string, unknown>);
    const errors = validateState(state);
    if (errors.length) return { ok: false, error: errors.join(', ') };
    let snapshot: GameStateData | null = null;
    if (typeof file.snapshot === 'object' && file.snapshot !== null) {
      const snap = migrateState(file.snapshot as Record<string, unknown>);
      if (validateState(snap).length === 0) snapshot = snap as unknown as GameStateData;
    }
    return {
      ok: true,
      save: {
        version: state.version as number,
        savedAt: typeof file.savedAt === 'number' ? file.savedAt : 0,
        label: typeof file.label === 'string' ? file.label : '',
        state: state as unknown as GameStateData,
        snapshot,
      },
    };
  }

  deleteSave(): void {
    this.storage.removeItem(SAVE_KEY);
    this.storage.removeItem(BACKUP_KEY);
  }

  loadSettings(): Settings {
    try {
      const raw = this.storage.getItem(SETTINGS_KEY);
      return validateSettings(raw ? JSON.parse(raw) : null);
    } catch {
      return validateSettings(null);
    }
  }

  saveSettings(s: Settings): void {
    try {
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch {
      /* storage full or unavailable: settings stay in memory */
    }
  }
}
