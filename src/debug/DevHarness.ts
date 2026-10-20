import type { Game } from '../game/Game';

/**
 * Development-only automation helpers (never bundled in production builds).
 * Usage from the browser console: `dev.startMission('m3')`, `dev.walkTo(x, z)`, `dev.fight()`.
 */
export function installDevHarness(game: Game): void {
  const g = game;
  const canvas = g.renderer.canvas;
  const key = (code: string, down: boolean) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code }));

  const dev = {
    game: g,
    press(code: string) {
      key(code, true);
      key(code, false);
      g.advance(1 / 30);
    },
    /** Start any mission directly with a fresh state that has the earlier missions marked done. */
    startMission(id: string) {
      g.newGame();
      const order = ['m1', 'm2', 'm3', 'm4', 'm5'];
      g.session.state.missions.completed = order.slice(0, order.indexOf(id));
      g.session.state.missions.active = id;
      g.startBriefedMission();
      g.advance(0.1);
    },
    /** Walk with real WASD input along a nav-grid path. Doors on the way are opened with E. */
    walkTo(x: number, z: number, maxSeconds = 25): boolean {
      const p = g.runtime.player;
      const path = g.world.nav.findPath(p.pos.x, p.pos.z, x, z) ?? [{ x, z }];
      for (const wp of path) {
        // Open any closed door the next segment passes through (as a player would with E).
        for (const d of g.world.doors.values()) {
          if (d.open || d.locked) continue;
          const ax = p.pos.x;
          const az = p.pos.z;
          const bx = wp.x - ax;
          const bz = wp.z - az;
          const len2 = bx * bx + bz * bz || 1;
          const t = Math.max(0, Math.min(1, ((d.def.x - ax) * bx + (d.def.z - az) * bz) / len2));
          if (Math.hypot(ax + bx * t - d.def.x, az + bz * t - d.def.z) < 1.2) d.setOpen(true);
        }
        if (!dev.straight(wp.x, wp.z, maxSeconds / Math.max(1, path.length) + 3)) break;
      }
      return Math.hypot(x - p.pos.x, z - p.pos.z) < 0.8;
    },
    straight(x: number, z: number, maxSeconds = 10): boolean {
      const p = g.runtime.player;
      for (let t = 0; t < maxSeconds; t += 1 / 30) {
        const dx = x - p.pos.x;
        const dz = z - p.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.35) break;
        // World → screen: right=(1,0,-1)/√2, up=(-1,0,-1)/√2.
        const sx = (dx - dz) / Math.SQRT2 / d;
        const sy = (-dx - dz) / Math.SQRT2 / d;
        g.input.debugMove = { x: sx, y: sy };
        g.advance(1 / 30);
      }
      g.input.debugMove = null;
      g.advance(1 / 30);
      return Math.hypot(x - p.pos.x, z - p.pos.z) < 0.8;
    },
    /** Aim at and shoot the nearest visible hostile with real mouse events. */
    shootNearest(): boolean {
      const p = g.runtime.player;
      const vis = g.runtime.enemies
        .filter((e) => e.alive && !e.dormant && e.hostile && g.world.collision.lineOfSight(p.pos.x, p.pos.z, e.pos.x, e.pos.z) && e.pos.distanceTo(p.pos) < 16)
        .sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
      if (!vis.length) return false;
      const sp = g.camera.worldToScreen(vis[0].pos.clone().setY(1.2), innerWidth, innerHeight);
      canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: sp.x, clientY: sp.y, bubbles: true }));
      canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: sp.x, clientY: sp.y, button: 0, bubbles: true }));
      g.advance(0.08);
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      g.advance(0.2);
      return true;
    },
    fight(maxSteps = 150): string {
      for (let i = 0; i < maxSteps && g.runtime.player.alive; i++) {
        if (g.runtime.player.health < 35 && g.session.inventory.has('medkit')) dev.press('KeyH');
        if (!dev.shootNearest()) g.advance(0.25);
        if (!g.runtime.enemies.some((e) => e.alive && !e.dormant && e.hostile)) return `cleared in ${i}`;
      }
      return g.runtime.player.alive ? 'timeout' : 'player died';
    },
    /** Finish the current conversation picking choices by index function. */
    talk(pick: (n: number) => number = () => 0): string[] {
      const out: string[] = [];
      for (let n = 0; g.dialogue.active && n < 25; n++) {
        const c = g.dialogue.choices().filter((x) => !x.locked);
        const i = Math.max(0, Math.min(pick(c.length), c.length - 1));
        out.push(`${g.dialogue.current!.id}> ${c[i].text}`);
        g.chooseDialogue(c[i].index);
      }
      return out;
    },
    objectives(): string[] {
      return g.missions
        .objectives()
        .filter((o) => o.status !== 'hidden')
        .map((o) => `${o.def.id}:${o.status}`);
    },
  };
  (window as unknown as { dev: typeof dev }).dev = dev;
}
