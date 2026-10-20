import { describe, expect, it } from 'vitest';
import { DialogueManager } from '../src/dialogue/DialogueManager';
import { DIALOGUES } from '../src/dialogue/DialogueData';
import { GameSession } from '../src/game/GameSession';
import { MissionManager } from '../src/missions/MissionManager';
import { MISSIONS } from '../src/missions/MissionData';
import { FlagKeys } from '../src/missions/ObjectiveHandlers';

function setup(alive: Record<string, boolean> = {}) {
  const s = new GameSession();
  let dead = false;
  const mm = new MissionManager(s, { npcAlive: (id) => alive[id] ?? true, playerDead: () => dead });
  return { s, mm, kill: () => (dead = true) };
}

describe('MissionManager', () => {
  it('runs mission 1 in order and completes with rewards', () => {
    const { s, mm } = setup();
    mm.start('m1');
    const visible = () => mm.objectives().filter((o) => o.status === 'active').map((o) => o.def.id);
    expect(visible()).toEqual(['o1']);
    s.setFlag(FlagKeys.dialogue('nermin_m1'));
    expect(mm.update()).toBeNull();
    expect(visible()).toEqual(['o2']);
    s.setFlag(FlagKeys.dialogue('tekin_m1'));
    mm.update();
    s.inventory.add('package');
    mm.update();
    expect(visible()).toEqual(['o4', 'o5']);
    s.addCounter(FlagKeys.kill('ambush'), 2);
    mm.update();
    s.inventory.remove('package');
    s.setFlag('m.delivered');
    const outcome = mm.update();
    expect(outcome?.success).toBe(true);
    expect(outcome?.nextMission?.id).toBe('m2');
    expect(s.state.missions.completed).toContain('m1');
    expect(s.state.progression.xp).toBeGreaterThanOrEqual(120);
    // Optional objective o5 was skipped but did not block completion.
    expect(s.state.missions.completedObjectives).not.toContain('o5');
  });

  it('fails when the player dies', () => {
    const { mm, kill } = setup();
    mm.start('m1');
    kill();
    const o = mm.update();
    expect(o?.success).toBe(false);
  });

  it('fails mission 4 when Ferhat dies', () => {
    const alive = { ferhat: true };
    const { mm } = setup(alive);
    mm.start('m4');
    alive.ferhat = false;
    const o = mm.update();
    expect(o?.success).toBe(false);
    expect(o?.reason).toContain('Ferhat');
  });

  it('branches mission 4 by dialogue choice', () => {
    const { s, mm } = setup();
    mm.start('m4');
    s.setFlag(FlagKeys.dialogue('selim_m4'));
    s.setFlag(FlagKeys.zone('ferhat_office'));
    mm.update();
    // Choose the protect path through the real dialogue data.
    const dm = new DialogueManager(s, DIALOGUES);
    dm.start('ferhat_m4');
    dm.choose(0); // Sakin ol
    dm.choose(dm.choices()[0].index); // "Bunu kanıtlayabilir misin?" (the [Bilgi] option is hidden)
    const protect = dm.choices().find((c) => c.text.startsWith('Kimse'))!;
    dm.choose(protect.index);
    while (dm.active) dm.choose(-1);
    expect(s.flag('m.path.protect')).toBe(true);
    expect(mm.update()).toBeNull();
    const active = mm.objectives().filter((o) => o.status === 'active').map((o) => o.def.id);
    expect(active).toEqual(['p1']);
    expect(s.state.reputation.suspicion).toBeGreaterThanOrEqual(25);
    s.addCounter(FlagKeys.kill('watchers'), 2);
    mm.update();
    s.setFlag(FlagKeys.dialogue('ferhat_m4_after'));
    expect(mm.update()?.success).toBe(true);
  });

  it('marks avoidDetection failed when detected and still allows success', () => {
    const { s, mm } = setup();
    mm.start('m2');
    s.setFlag(FlagKeys.zone('club_hall'));
    mm.update();
    s.setFlag(FlagKeys.detected);
    mm.update();
    expect(s.state.missions.failedObjectives).toContain('o4');
    s.setFlag(FlagKeys.dialogue('riza_m2'));
    mm.update();
    s.setFlag(FlagKeys.dialogue('haydar_m2'));
    expect(mm.update()?.success).toBe(true);
  });

  it('restart restores the snapshot taken at mission start', () => {
    const { s, mm } = setup();
    mm.start('m3');
    const mafia = s.state.reputation.mafia;
    s.reputation.change('mafia', 30);
    s.inventory.add('shotgun');
    mm.restart();
    expect(s.state.reputation.mafia).toBe(mafia);
    expect(s.inventory.has('shotgun')).toBe(false);
  });

  it('mission 5 exposure switches to the escape branch', () => {
    const { s, mm } = setup();
    mm.start('m5');
    s.setFlag(FlagKeys.exposed);
    mm.update();
    const active = mm.objectives().filter((o) => o.status === 'active').map((o) => o.def.id);
    expect(active).toContain('o9');
    expect(active).not.toContain('o1');
    s.setFlag(FlagKeys.zone('street_escape'));
    mm.update();
    s.setFlag(FlagKeys.dialogue('nermin_m5'));
    expect(mm.update()?.success).toBe(true);
  });

  it('every mission references existing dialogues', () => {
    for (const m of Object.values(MISSIONS)) {
      for (const n of m.npcs) for (const d of n.dialogues ?? []) expect(DIALOGUES[d.dialogue], `${m.id}/${n.id}/${d.dialogue}`).toBeDefined();
      for (const o of m.objectives) {
        const c = o.condition;
        if (c.type === 'talk' || c.type === 'report') expect(DIALOGUES[c.dialogue], `${m.id}/${o.id}`).toBeDefined();
      }
    }
  });

  it('every dialogue link points to an existing node', () => {
    for (const d of Object.values(DIALOGUES)) {
      expect(d.nodes[d.start], d.id).toBeDefined();
      for (const n of Object.values(d.nodes)) {
        if (n.next) expect(d.nodes[n.next], `${d.id}.${n.id}.next`).toBeDefined();
        for (const c of n.choices ?? []) if (c.next) expect(d.nodes[c.next], `${d.id}.${n.id}->${c.next}`).toBeDefined();
      }
      for (const s of d.startIf ?? []) expect(d.nodes[s.node]).toBeDefined();
    }
  });
});
