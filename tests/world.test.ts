import { describe, expect, it } from 'vitest';
import { MISSIONS } from '../src/missions/MissionData';
import { CollisionWorld, NavGrid } from '../src/world/CollisionWorld';
import { BOUNDS, DOORS, PROPS, WALLS } from '../src/world/DistrictMap';
import { propFootprint } from '../src/world/PropFactory';

/** Static collision exactly as the game builds it (doors open). */
function buildWorld() {
  const col = new CollisionWorld();
  for (const w of WALLS) col.addBox(w.x, w.z, w.w, w.d, w.h > 1.2);
  for (const p of PROPS) {
    const fp = propFootprint(p);
    if (fp.collide) col.addBox(p.x, p.z, fp.w, fp.d, fp.h >= 1.3);
  }
  const nav = new NavGrid(col, BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX, BOUNDS.maxZ, 0.5, 0.4);
  return { col, nav };
}

describe('District geometry', () => {
  const { col, nav } = buildWorld();

  it('every doorway fits a character', () => {
    for (const d of DOORS) expect(col.overlapsCircle(d.x, d.z, 0.45), d.id).toBe(false);
  });

  it('no mission entity spawns inside geometry', () => {
    for (const m of Object.values(MISSIONS)) {
      const pts = [
        { id: 'spawn', ...m.spawn, r: 0.36 },
        ...m.npcs.map((n) => ({ id: n.id, ...n.pos, r: 0.3 })),
        ...m.enemies.map((e) => ({ id: e.id, ...e.pos, r: 0.3 })),
        ...m.enemies.flatMap((e) => (e.patrol ?? []).map((p, i) => ({ id: `${e.id}.patrol${i}`, ...p, r: 0.3 }))),
      ];
      for (const p of pts) expect(col.overlapsCircle(p.x, p.z, p.r), `${m.id}/${p.id}`).toBe(false);
    }
  });

  it('every objective target is reachable from the mission spawn', () => {
    for (const m of Object.values(MISSIONS)) {
      const targets = [
        ...m.npcs.filter((n) => !n.id.startsWith('civ')).map((n) => ({ id: n.id, ...n.pos })),
        ...m.interactables.map((i) => ({ id: i.id, ...i.pos })),
        ...m.zones.map((z) => ({ id: z.id, x: z.x, z: z.z })),
      ];
      for (const t of targets) {
        const path = nav.findPath(m.spawn.x, m.spawn.z, t.x, t.z, 40000);
        expect(path, `${m.id} → ${t.id}`).not.toBeNull();
        // The path must end close to the target (within talking/interaction range).
        const end = path![path!.length - 1];
        expect(Math.hypot(end.x - t.x, end.z - t.z), `${m.id} → ${t.id} end`).toBeLessThan(2.6);
      }
    }
  });

  it('walls block line of sight but low furniture does not', () => {
    // Through the club's south wall (x=-30, z=-7).
    expect(col.lineOfSight(-30, -9, -30, -4)).toBe(false);
    // Across the bar counter (1.1 m high) at x=-30.
    expect(col.lineOfSight(-31.2, -12.5, -28.5, -12.5)).toBe(true);
  });
});
