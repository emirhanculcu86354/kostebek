import { angleLerp, damp } from '../core/math';
import type { Entity } from '../entities/Entity';
import type { RuntimeContext } from '../game/Context';

export interface PathAgent extends Entity {
  path: { x: number; z: number }[] | null;
  pathIndex: number;
  repathTimer: number;
}

/**
 * Move an agent toward a target using the nav grid, with periodic re-planning,
 * collision resolution, soft separation and AI door opening.
 * Returns true once within `arrive` of the target.
 */
export function moveAgent(
  a: PathAgent,
  tx: number,
  tz: number,
  speed: number,
  dt: number,
  ctx: RuntimeContext,
  arrive = 0.35,
  repathEvery = 0.7,
  faceMove = true,
): boolean {
  const dxT = tx - a.pos.x;
  const dzT = tz - a.pos.z;
  const distT = Math.hypot(dxT, dzT);
  if (distT <= arrive) {
    a.vel.set(0, 0, 0);
    return true;
  }
  a.repathTimer -= dt;
  const goalChanged = a.path && a.path.length > 0 && Math.hypot(a.path[a.path.length - 1].x - tx, a.path[a.path.length - 1].z - tz) > 1.2;
  if (!a.path || a.repathTimer <= 0 || goalChanged) {
    // Direct line if clear (cheap), otherwise A*.
    if (distT < 4 && ctx.world.collision.raycast(a.pos.x, a.pos.z, dxT / distT, dzT / distT, distT, false).dist >= distT) a.path = [{ x: tx, z: tz }];
    else a.path = ctx.world.nav.findPath(a.pos.x, a.pos.z, tx, tz) ?? [{ x: tx, z: tz }];
    a.pathIndex = 0;
    a.repathTimer = repathEvery + Math.random() * 0.3;
  }
  let wp = a.path[Math.min(a.pathIndex, a.path.length - 1)];
  let dx = wp.x - a.pos.x;
  let dz = wp.z - a.pos.z;
  let d = Math.hypot(dx, dz);
  while (d < 0.3 && a.pathIndex < a.path.length - 1) {
    a.pathIndex++;
    wp = a.path[a.pathIndex];
    dx = wp.x - a.pos.x;
    dz = wp.z - a.pos.z;
    d = Math.hypot(dx, dz);
  }
  if (d < 1e-4) return distT <= arrive;
  const vx = (dx / d) * speed;
  const vz = (dz / d) * speed;
  a.vel.x += (vx - a.vel.x) * damp(10, dt);
  a.vel.z += (vz - a.vel.z) * damp(10, dt);
  step(a, dt, ctx);
  if (faceMove) a.facing = angleLerp(a.facing, Math.atan2(a.vel.x, a.vel.z), damp(10, dt));
  openDoorsNear(a, ctx);
  return false;
}

/** Integrate velocity with collision and separation from other bodies. */
export function step(a: Entity, dt: number, ctx: RuntimeContext): void {
  a.pos.x += a.vel.x * dt;
  a.pos.z += a.vel.z * dt;
  for (const o of ctx.runtime.all) {
    if (o === a || !o.alive || !o.object.visible) continue;
    const dx = a.pos.x - o.pos.x;
    const dz = a.pos.z - o.pos.z;
    const min = a.radius + o.radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min && d2 > 1e-6) {
      const d = Math.sqrt(d2);
      const push = (min - d) * 0.5;
      a.pos.x += (dx / d) * push;
      a.pos.z += (dz / d) * push;
    }
  }
  ctx.world.collision.resolveCircle(a.pos, a.radius);
}

export function openDoorsNear(a: Entity, ctx: RuntimeContext): void {
  for (const door of ctx.world.doors.values()) {
    if (door.open || door.locked) continue;
    if (Math.hypot(door.def.x - a.pos.x, door.def.z - a.pos.z) < 1.3) {
      door.setOpen(true);
      ctx.audio.play('door', 0.4);
    }
  }
}

export function faceToward(a: Entity, x: number, z: number, dt: number, rate = 10): void {
  a.facing = angleLerp(a.facing, Math.atan2(x - a.pos.x, z - a.pos.z), damp(rate, dt));
}
