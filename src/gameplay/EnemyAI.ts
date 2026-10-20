import * as THREE from 'three';
import { WEAPONS } from '../data/ItemData';
import { AIState, Enemy } from '../entities/Enemy';
import type { Entity } from '../entities/Entity';
import { NPC } from '../entities/NPC';
import { PlayerState } from '../entities/Player';
import type { RuntimeContext } from '../game/Context';
import { faceToward, moveAgent, step } from './Steering';

const ENEMY_PISTOL = { ...WEAPONS.pistol, id: 'enemy_pistol' };

const BARKS = {
  alert: ['Orada!', 'Gördüm onu!', 'Durdurun şunu!', 'Hey! Sen!'],
  search: ['Nereye kayboldu?', 'Buralarda bir yerde...', 'Çık ortaya!'],
  suspicious: ['Ne oluyor?', 'Kim var orada?', 'Hm?'],
  restricted: ['Burada ne arıyorsun?', 'Burası yasak, çık dışarı!', 'Kim izin verdi sana?'],
};

const pick = (a: string[]) => a[Math.floor(Math.random() * a.length)];

/**
 * Finite-state machine for all enemy roles. Perception uses vision cone + wall line of
 * sight; noise is handled through hearNoise(). Neutral organisation members only react to
 * restricted-zone trespass or watched NPCs until something makes them hostile.
 */
export class EnemyAI {
  onBark: (e: Enemy, text: string) => void = () => {};
  /** A neutral watcher caught the player/NPC. */
  onWatcherDetect: (e: Enemy) => void = () => {};

  constructor(private ctx: () => RuntimeContext) {}

  update(e: Enemy, dt: number): void {
    if (!e.alive) {
      if (e.state !== AIState.Dead) e.setState(AIState.Dead);
      e.rig.update(dt, 0, 'dead');
      e.syncTransform();
      e.updateIndicators(dt);
      return;
    }
    if (e.dormant) return;
    const ctx = this.ctx();
    e.stateTime += dt;
    e.attackTimer -= dt;
    e.catchCooldown -= dt;
    e.barkTimer -= dt;
    e.confrontTimer -= dt;

    const player = ctx.runtime.player;
    const target = e.hostile ? this.chooseTarget(e) : player;
    const seen = this.perceive(e, target, dt);
    if (seen) {
      e.lastKnown = (e.lastKnown ?? new THREE.Vector3()).copy(target.pos);
      e.lastSeenTime = ctx.time;
    }

    if (e.hostile) this.updateHostile(e, target, seen, dt);
    else this.updateNeutral(e, seen, dt);

    const speed = Math.hypot(e.vel.x, e.vel.z);
    const pose =
      e.state === AIState.Attacking && !e.stats.melee
        ? 'aim'
        : e.windup > 0
          ? 'melee'
          : speed > 0.2
            ? 'move'
            : e.hostile && (e.state === AIState.Pursuing || e.state === AIState.Alerted) && !e.stats.melee
              ? 'aim'
              : 'idle';
    e.rig.update(dt, speed, pose);
    e.syncTransform();
    e.updateIndicators(dt);
  }

  private chooseTarget(e: Enemy): Entity {
    const ctx = this.ctx();
    const p = ctx.runtime.player;
    // Hostile watchers also go after the civilian the player protects.
    if (e.tags.has('watchers')) {
      for (const n of ctx.runtime.npcs) {
        if (!n.alive || !n.spawn.killable) continue;
        const dn = n.pos.distanceTo(e.pos);
        if (dn + 2 < p.pos.distanceTo(e.pos) && ctx.world.collision.lineOfSight(e.pos.x, e.pos.z, n.pos.x, n.pos.z)) return n;
      }
    }
    return p;
  }

  /** Vision cone + line-of-sight. Fills/decays the detection meter. Returns true if target is visible. */
  private perceive(e: Enemy, t: Entity, dt: number, slot: 'main' | 'watch' = 'main'): boolean {
    const ctx = this.ctx();
    const main = slot === 'main';
    if (!t.alive) {
      if (main) e.canSeeTarget = false;
      else e.watchCanSee = false;
      return false;
    }
    const dx = t.pos.x - e.pos.x;
    const dz = t.pos.z - e.pos.z;
    const dist = Math.hypot(dx, dz);
    const range = e.stats.vision * (e.hostile && e.detection >= 1 ? 1.4 : 1);
    if (dist > range) {
      if (main) e.canSeeTarget = false;
      else e.watchCanSee = false;
      return false;
    }
    const ang = Math.atan2(dx, dz) - e.facing;
    const diff = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
    const inCone = diff <= e.stats.fov / 2 || dist < 2.0 || (e.detection >= 1 && e.hostile && dist < 8);
    if (!inCone) return false;
    // Line-of-sight ray casts are throttled per enemy and per target slot.
    if (main) {
      e.losTimer -= dt;
      if (e.losTimer <= 0) {
        e.canSeeTarget = ctx.world.collision.lineOfSight(e.pos.x, e.pos.z, t.pos.x, t.pos.z);
        e.losTimer = 0.12;
      }
      return e.canSeeTarget;
    }
    e.watchLosTimer -= dt;
    if (e.watchLosTimer <= 0) {
      e.watchCanSee = ctx.world.collision.lineOfSight(e.pos.x, e.pos.z, t.pos.x, t.pos.z);
      e.watchLosTimer = 0.12;
    }
    return e.watchCanSee;
  }

  private detectionRate(e: Enemy, dist: number): number {
    const ctx = this.ctx();
    const p = ctx.runtime.player;
    let rate = 1.9 - 1.3 * Math.min(1, dist / e.stats.vision);
    if (p.state === PlayerState.Running) rate *= 1.45;
    if (p.state === PlayerState.Aiming || ctx.time - p.lastShotAt < 1) rate *= 1.6;
    rate *= ctx.session.progression.modifier('detectionSpeed');
    const tier = ctx.session.reputation.tier;
    if (!e.hostile) rate *= tier === 'medium' ? 1.25 : tier === 'high' || tier === 'critical' ? 1.55 : 1;
    return rate;
  }

  // ───────────────────────── Neutral organisation members ─────────────────────────

  private updateNeutral(e: Enemy, seenPlayer: boolean, dt: number): void {
    const ctx = this.ctx();
    const p = ctx.runtime.player;
    let watching = false;
    let watchTarget: Entity | null = null;
    if (e.spawn.watch?.restricted && seenPlayer && ctx.runtime.restrictedZoneAt(p.pos.x, p.pos.z)) {
      watching = true;
      watchTarget = p;
    }
    if (!watching && e.spawn.watch?.npc) {
      const n = ctx.runtime.npc(e.spawn.watch.npc);
      if (n && n.alive && n.mode === 'follow' && this.perceive(e, n, dt, 'watch')) {
        watching = true;
        watchTarget = n;
      }
    }

    if (watching && watchTarget && e.catchCooldown <= 0) {
      const dist = watchTarget.pos.distanceTo(e.pos);
      e.detection = Math.min(1, e.detection + this.detectionRate(e, dist) * dt * 0.8);
      if (e.state !== AIState.Suspicious) e.setState(AIState.Suspicious);
      e.vel.set(0, 0, 0);
      faceToward(e, watchTarget.pos.x, watchTarget.pos.z, dt, 6);
      if (e.detection >= 1) {
        e.detection = 0;
        e.catchCooldown = 9;
        e.confrontTimer = 2.5;
        this.bark(e, pick(BARKS.restricted), true);
        this.onWatcherDetect(e);
      }
      return;
    }

    e.detection = Math.max(0, e.detection - dt * 0.3);
    if (e.confrontTimer > 0) {
      e.vel.set(0, 0, 0);
      faceToward(e, p.pos.x, p.pos.z, dt, 6);
      return;
    }
    if (e.state === AIState.Suspicious && e.detection > 0.02) {
      e.vel.set(0, 0, 0);
      return;
    }
    if (e.state === AIState.Investigating && e.moveTarget) {
      if (moveAgent(e, e.moveTarget.x, e.moveTarget.z, e.stats.walkSpeed, dt, ctx, 1.2) || e.stateTime > 8) {
        e.setState(AIState.Searching);
      }
      return;
    }
    if (e.state === AIState.Searching) {
      e.vel.set(0, 0, 0);
      e.facing += Math.sin(e.stateTime * 1.8) * dt * 1.5;
      if (e.stateTime > 2.5) e.setState(AIState.Returning);
      return;
    }
    this.patrolOrIdle(e, dt);
  }

  // ───────────────────────── Hostile behaviour ─────────────────────────

  private updateHostile(e: Enemy, t: Entity, seen: boolean, dt: number): void {
    const ctx = this.ctx();
    const dist = t.pos.distanceTo(e.pos);
    if (!t.alive) {
      if (e.state !== AIState.Returning && e.state !== AIState.Patrol && e.state !== AIState.Idle) e.setState(AIState.Returning);
      e.detection = 0;
    } else if (seen) {
      e.detection = Math.min(1, e.detection + this.detectionRate(e, dist) * dt);
    } else if (e.state !== AIState.Pursuing && e.state !== AIState.Attacking && e.state !== AIState.Alerted) {
      e.detection = Math.max(0, e.detection - dt * 0.25);
    }

    switch (e.state) {
      case AIState.Idle:
      case AIState.Patrol:
      case AIState.Returning:
        if (seen && e.detection >= 1) this.goAlert(e);
        else if (seen && e.detection > 0.25) e.setState(AIState.Suspicious);
        else if (e.state === AIState.Returning) {
          const home = e.spawn.patrol?.[0] ?? e.home;
          if (moveAgent(e, home.x, home.z, e.stats.walkSpeed, dt, ctx, 0.4)) {
            e.patrolIndex = 0;
            e.setState(e.spawn.patrol?.length ? AIState.Patrol : AIState.Idle);
          }
        } else this.patrolOrIdle(e, dt);
        break;

      case AIState.Suspicious:
        e.vel.set(0, 0, 0);
        if (e.lastKnown) faceToward(e, e.lastKnown.x, e.lastKnown.z, dt, 5);
        if (e.stateTime < 0.1) this.bark(e, pick(BARKS.suspicious));
        if (e.detection >= 1) this.goAlert(e);
        else if (!seen && e.stateTime > 1.2) {
          if (e.lastKnown && e.detection > 0.15) {
            e.moveTarget = e.lastKnown.clone();
            e.setState(AIState.Investigating);
          } else if (e.detection <= 0) e.setState(AIState.Returning);
        }
        break;

      case AIState.Investigating:
        if (seen && e.detection >= 1) this.goAlert(e);
        else if (seen) e.detection = Math.min(1, e.detection + dt * 0.6);
        else if (!e.moveTarget || moveAgent(e, e.moveTarget.x, e.moveTarget.z, e.stats.walkSpeed * 1.25, dt, ctx, 0.8) || e.stateTime > 10) e.setState(AIState.Searching);
        break;

      case AIState.Searching:
        e.vel.set(0, 0, 0);
        e.facing += dt * 1.6 * (Math.floor(e.stateTime / 1.5) % 2 ? -1 : 1);
        if (e.stateTime < 0.1) this.bark(e, pick(BARKS.search));
        if (seen && e.detection > 0.5) this.goAlert(e);
        else if (e.stateTime > 4.5) {
          e.detection = 0;
          e.setState(AIState.Returning);
        }
        break;

      case AIState.Alerted:
        e.vel.set(0, 0, 0);
        if (e.lastKnown) faceToward(e, e.lastKnown.x, e.lastKnown.z, dt, 14);
        if (e.stateTime > 0.35) e.setState(AIState.Pursuing);
        break;

      case AIState.Pursuing: {
        if (seen && dist <= e.stats.attackRange && (e.stats.melee || dist > 1.2)) {
          e.setState(AIState.Attacking);
          break;
        }
        if (seen && e.stats.melee && dist <= e.stats.attackRange) {
          e.setState(AIState.Attacking);
          break;
        }
        const lk = seen ? t.pos : e.lastKnown;
        if (!lk) {
          e.setState(AIState.Searching);
          break;
        }
        const reached = moveAgent(e, lk.x, lk.z, e.stats.runSpeed, dt, ctx, e.stats.melee ? 1.2 : 1.0, 0.5);
        if (!seen && (reached || ctx.time - e.lastSeenTime > 6)) e.setState(AIState.Searching);
        break;
      }

      case AIState.Attacking:
        if (e.stats.melee) this.meleeAttack(e, t, dist, seen, dt);
        else this.rangedAttack(e, t, dist, seen, dt);
        break;
    }
  }

  private goAlert(e: Enemy): void {
    e.detection = 1;
    e.setState(AIState.Alerted);
    this.bark(e, pick(BARKS.alert), true);
    this.ctx().audio.play('alert', 0.5);
    // Alert allies nearby.
    for (const o of this.ctx().runtime.enemies) {
      if (o === e || !o.alive || o.dormant || !o.hostile || o.spawn.faction !== e.spawn.faction) continue;
      if (o.pos.distanceTo(e.pos) < 11 && o.state !== AIState.Pursuing && o.state !== AIState.Attacking && o.state !== AIState.Alerted) {
        o.lastKnown = e.lastKnown?.clone() ?? null;
        o.detection = 1;
        o.setState(AIState.Alerted);
      }
    }
  }

  private meleeAttack(e: Enemy, t: Entity, dist: number, seen: boolean, dt: number): void {
    const ctx = this.ctx();
    faceToward(e, t.pos.x, t.pos.z, dt, 12);
    if (e.windup > 0) {
      e.windup -= dt;
      e.vel.multiplyScalar(0.8);
      step(e, dt, ctx);
      if (e.windup <= 0) {
        e.rig.triggerAttack();
        const hit = ctx.combat.melee(e, e.stats.attackRange + 0.3, e.stats.damage, 1.5, t);
        if (hit && t === ctx.runtime.player) {
          const p = ctx.runtime.player;
          if (p.state !== PlayerState.Dead && p.state !== PlayerState.Dodging) {
            p.stunTimer = 0.3;
            p.setState(PlayerState.Stunned);
            p.vel.set(Math.sin(e.facing) * 5, 0, Math.cos(e.facing) * 5);
          }
        }
        e.attackTimer = e.stats.cooldown;
      }
      return;
    }
    if (dist > e.stats.attackRange + 0.4 || !seen) {
      e.setState(AIState.Pursuing);
      return;
    }
    if (e.attackTimer <= 0) {
      e.windup = 0.38;
      return;
    }
    e.vel.set(0, 0, 0);
  }

  private rangedAttack(e: Enemy, t: Entity, dist: number, seen: boolean, dt: number): void {
    const ctx = this.ctx();
    if (!seen && ctx.time - e.lastSeenTime > 1.2) {
      e.setState(AIState.Pursuing);
      return;
    }
    if (dist > e.stats.attackRange * 1.15) {
      e.setState(AIState.Pursuing);
      return;
    }
    // Positioning: keep the preferred band; gangsters look for cover.
    e.repositionTimer -= dt;
    if (e.repositionTimer <= 0 || !e.moveTarget) {
      e.moveTarget = this.choosePosition(e, t, dist);
      e.repositionTimer = e.role === 'gangster' ? 2.4 + Math.random() : 1.6 + Math.random();
    }
    const moving = e.moveTarget && !moveAgent(e, e.moveTarget.x, e.moveTarget.z, e.role === 'gangster' ? e.stats.runSpeed * 0.7 : e.stats.walkSpeed * 1.2, dt, ctx, 0.3, 1.0, false);
    if (!moving) e.vel.set(0, 0, 0);
    faceToward(e, t.pos.x, t.pos.z, dt, 12);

    if (!seen || e.attackTimer > 0) return;
    // Fire with role-based cadence; gangsters shoot in bursts.
    const spreadByDist = e.stats.spread * (0.7 + dist / 12);
    const moveSpread = moving ? 1.4 : 1;
    const dx = t.pos.x - e.pos.x;
    const dz = t.pos.z - e.pos.z;
    ctx.combat.fire(e, { ...ENEMY_PISTOL, damage: e.stats.damage, spread: spreadByDist * moveSpread, range: e.stats.attackRange * 1.3, noise: 14 }, dx, dz);
    e.rig.triggerAttack();
    if (e.role === 'gangster') {
      if (e.burstLeft <= 0) e.burstLeft = 3;
      e.burstLeft--;
      e.attackTimer = e.burstLeft > 0 ? 0.22 : 1.5 + Math.random() * 0.6;
    } else e.attackTimer = e.stats.cooldown + Math.random() * 0.4;
  }

  /** Sample candidate positions: valid ground, preferred range band, line of sight, near cover. */
  private choosePosition(e: Enemy, t: Entity, dist: number): THREE.Vector3 {
    const ctx = this.ctx();
    const col = ctx.world.collision;
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    const want = (e.stats.preferredMin + e.stats.preferredMax) / 2;
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1.5 + Math.random() * 3.5;
      const x = e.pos.x + Math.sin(a) * r;
      const z = e.pos.z + Math.cos(a) * r;
      if (!ctx.world.nav.walkable(x, z)) continue;
      const dT = Math.hypot(t.pos.x - x, t.pos.z - z);
      if (!col.lineOfSight(x, z, t.pos.x, t.pos.z)) continue;
      let score = -Math.abs(dT - want);
      if (e.role === 'gangster') {
        // Near cover = some sight-blocking box within 1.4 units.
        for (const [cx, cz] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          if (col.raycast(x, z, cx, cz, 1.4, true).dist < 1.4) {
            score += 3;
            break;
          }
        }
      }
      score -= r * 0.15;
      if (score > bestScore) {
        bestScore = score;
        best = new THREE.Vector3(x, 0, z);
      }
    }
    if (!best) {
      // Fallback: step back or toward to fix the range.
      const k = dist < e.stats.preferredMin ? -1.5 : dist > e.stats.preferredMax ? 1.5 : 0;
      const dx = (t.pos.x - e.pos.x) / (dist || 1);
      const dz = (t.pos.z - e.pos.z) / (dist || 1);
      best = new THREE.Vector3(e.pos.x + dx * k, 0, e.pos.z + dz * k);
    }
    return best;
  }

  private patrolOrIdle(e: Enemy, dt: number): void {
    const ctx = this.ctx();
    const pts = e.spawn.patrol;
    if (!pts || pts.length === 0) {
      if (e.state !== AIState.Idle) {
        if (moveAgent(e, e.home.x, e.home.z, e.stats.walkSpeed, dt, ctx, 0.3)) e.setState(AIState.Idle);
        return;
      }
      e.vel.set(0, 0, 0);
      e.facing += (e.homeFacing - e.facing) * Math.min(1, dt * 3);
      return;
    }
    if (e.state !== AIState.Patrol) e.setState(AIState.Patrol);
    if (e.waitTimer > 0) {
      e.waitTimer -= dt;
      e.vel.set(0, 0, 0);
      e.facing += Math.sin(ctx.time * 0.9 + e.id.length) * dt * 0.6;
      return;
    }
    const wp = pts[e.patrolIndex % pts.length];
    if (moveAgent(e, wp.x, wp.z, e.stats.walkSpeed, dt, ctx, 0.35)) {
      e.patrolIndex = (e.patrolIndex + 1) % pts.length;
      e.waitTimer = 1.4 + Math.random() * 1.6;
      e.path = null;
    }
  }

  /** Something loud happened. Hostiles investigate; neutrals glance. */
  hearNoise(e: Enemy, x: number, z: number, fromPlayer: boolean): void {
    if (!e.alive || e.dormant) return;
    if (e.hostile) {
      if (e.state === AIState.Pursuing || e.state === AIState.Attacking || e.state === AIState.Alerted) return;
      e.lastKnown = new THREE.Vector3(x, 0, z);
      e.moveTarget = e.lastKnown.clone();
      e.detection = Math.max(e.detection, fromPlayer ? 0.6 : 0.4);
      e.setState(AIState.Investigating);
      this.bark(e, pick(BARKS.suspicious));
    } else if (e.state !== AIState.Suspicious) {
      e.moveTarget = new THREE.Vector3(x, 0, z);
      e.setState(AIState.Investigating);
    }
  }

  private bark(e: Enemy, text: string, force = false): void {
    if (e.barkTimer > 0 && !force) return;
    e.barkTimer = 3.5;
    this.onBark(e, text);
  }
}

/** NPC behaviour: idle, wander, follow, flee, cower. */
export function updateNpc(n: NPC, dt: number, ctx: RuntimeContext): void {
  if (!n.alive) {
    n.rig.update(dt, 0, 'dead');
    n.syncTransform();
    return;
  }
  const p = ctx.runtime.player;
  let speed = 0;
  switch (n.mode) {
    case 'wander': {
      const pts = n.spawn.wander!;
      if (n.waitTimer > 0) {
        n.waitTimer -= dt;
        n.vel.set(0, 0, 0);
      } else {
        const wp = pts[n.wanderIndex % pts.length];
        if (moveAgent(n, wp.x, wp.z, n.spawn.civilian ? 1.2 : 0.9, dt, ctx, 0.4)) {
          n.wanderIndex++;
          n.waitTimer = 1 + Math.random() * 4;
        }
      }
      break;
    }
    case 'follow': {
      const d = n.pos.distanceTo(p.pos);
      if (d > 2.2) moveAgent(n, p.pos.x, p.pos.z, d > 6 ? 5.2 : 3.9, dt, ctx, 1.8, 0.5);
      else {
        n.vel.multiplyScalar(0.8);
        faceToward(n, p.pos.x, p.pos.z, dt, 5);
      }
      break;
    }
    case 'flee': {
      n.fleeTimer -= dt;
      const dx = n.pos.x - n.fleeFrom.x;
      const dz = n.pos.z - n.fleeFrom.z;
      const d = Math.hypot(dx, dz) || 1;
      moveAgent(n, n.pos.x + (dx / d) * 4, n.pos.z + (dz / d) * 4, 4.2, dt, ctx, 0.5, 0.6);
      if (n.fleeTimer <= 0) n.mode = n.spawn.wander?.length ? 'wander' : 'cower';
      break;
    }
    case 'cower':
    case 'hurt':
    case 'idle':
    default:
      n.vel.set(0, 0, 0);
      if (n.mode === 'idle' && n.pos.distanceTo(p.pos) < 3.2 && p.alive) faceToward(n, p.pos.x, p.pos.z, dt, 3);
      else if (n.mode === 'idle') n.facing += (n.homeFacing - n.facing) * Math.min(1, dt * 2);
  }
  speed = Math.hypot(n.vel.x, n.vel.z);
  n.rig.update(dt, speed, n.mode === 'hurt' || n.mode === 'cower' ? 'hurt' : speed > 0.2 ? 'move' : 'idle');
  n.syncTransform();
}

export function scareNpcs(ctx: RuntimeContext, x: number, z: number, radius: number): void {
  for (const n of ctx.runtime.npcs) {
    if (!n.alive || !n.spawn.civilian) continue;
    if (Math.hypot(n.pos.x - x, n.pos.z - z) > radius) continue;
    n.mode = 'flee';
    n.fleeTimer = 4 + Math.random() * 2;
    n.fleeFrom.set(x, 0, z);
  }
}
