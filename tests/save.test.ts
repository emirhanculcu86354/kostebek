import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../src/game/GameState';
import { MemoryStorage, SaveManager } from '../src/persistence/SaveManager';
import { validateSettings, validateState } from '../src/persistence/SaveSchema';

describe('Save system', () => {
  it('a fresh state is valid', () => {
    expect(validateState(createNewGameState())).toEqual([]);
  });

  it('round-trips state through storage', () => {
    const sm = new SaveManager(new MemoryStorage());
    const st = createNewGameState();
    st.reputation.mafia = 42;
    st.flags['story.x'] = true;
    st.player.position = { x: 3, z: -4 };
    expect(sm.save(st, null, 'test').ok).toBe(true);
    const r = sm.load();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.state.reputation.mafia).toBe(42);
      expect(r.save.state.flags['story.x']).toBe(true);
      expect(r.save.state.player.position).toEqual({ x: 3, z: -4 });
    }
  });

  it('refuses to overwrite a valid save with invalid data', () => {
    const sm = new SaveManager(new MemoryStorage());
    const st = createNewGameState();
    st.reputation.police = 33;
    sm.save(st, null, 'good');
    const bad = createNewGameState();
    (bad.reputation as { police: number }).police = 999;
    expect(sm.save(bad, null, 'bad').ok).toBe(false);
    const r = sm.load();
    expect(r.ok && r.save.state.reputation.police).toBe(33);
  });

  it('falls back to the backup when the main save is corrupted', () => {
    const storage = new MemoryStorage();
    const sm = new SaveManager(storage);
    const st = createNewGameState();
    st.reputation.mafia = 11;
    sm.save(st, null, 'first');
    st.reputation.mafia = 22;
    sm.save(st, null, 'second');
    storage.setItem('kostebek.save', '{"state": broken');
    const r = sm.load();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.fromBackup).toBe(true);
      expect(r.save.state.reputation.mafia).toBe(11);
    }
  });

  it('reports a missing save gracefully', () => {
    const sm = new SaveManager(new MemoryStorage());
    const r = sm.load();
    expect(r.ok).toBe(false);
  });

  it('migrates a version 1 save', () => {
    const storage = new MemoryStorage();
    const st = createNewGameState() as unknown as Record<string, any>;
    st.version = 1;
    delete st.reputation.integrity;
    delete st.world.following;
    storage.setItem('kostebek.save', JSON.stringify({ version: 1, savedAt: 1, label: 'eski', state: st, snapshot: null }));
    const r = new SaveManager(storage).load();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.save.state.version).toBe(2);
      expect(r.save.state.reputation.integrity).toBe(50);
    }
  });

  it('sanitises settings', () => {
    const s = validateSettings({ masterVolume: 5, quality: 'ultra', cameraZoom: 0.1 });
    expect(s.masterVolume).toBe(1);
    expect(s.quality).toBe('medium');
    expect(s.cameraZoom).toBe(0.6);
  });
});
