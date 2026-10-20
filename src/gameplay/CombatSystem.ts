import * as THREE from 'three';
import type { WeaponDef } from '../data/ItemData';
import { Enemy } from '../entities/Enemy';
import type { Entity } from '../entities/Entity';
import { NPC } from '../entities/NPC';
import type { RuntimeContext } from '../game/Context';

export interface DamageEvent {
  target: Entity;
  source: Entity | null;
  amount: number;
  killed: boolean;
  point: THREE.Vector3;
}

export interface AttackOptions {
  damageMult?: number;
  spreadMult?: number;
  noiseMult?: number;
}

const tmpFrom = new THREE.Vector3();
const tmpTo = new THREE.Vector3();
const BULLET_Y = 1.25;

/**
 * Hit resolution for hitscan firearms and melee. Validates line of sight against walls,
 * so nobody shoots through solid geometry. Damage outcomes are centralised here — the
 * natural seam for a future authoritative co-op server.
 */
export class CombatSystem {
  onDamage: (e: DamageEvent) => void = () => {};
  onNoise: (x: number, z: number, radius: number, source: Entity) => void = () => {};

  constructor(private ctx: () => RuntimeContext) {}

  /** Can `attacker` damage `target` at all? */
  canHit(attacker: Entity, target: Entity): boolean {
    if (target === attacker || !target.alive || !target.targetable || !target.object.visible) return false;
    if (target instanceof Enemy && target.dormant) return false;
    if (attacker.team === 'player') return target.team !== 'player';
    // Enemies hit the player and any civilians/killable NPCs in the line of fire, never each other.
    if (attacker instanceof Enemy) return target.team === 'player' || target instanceof NPC;
    return false;
  }

  fire(shooter: Entity, weapon: WeaponDef, dirX: number, dirZ: number, opts: AttackOptions = {}): void {
    const ctx = this.ctx();
    const len = Math.hypot(dirX, dirZ) || 1;
    dirX /= len;
    dirZ /= len;
    const ox = shooter.pos.x + dirX * 0.45 + dirZ * 0.12;
    const oz = shooter.pos.z + dirZ * 0.45 - dirX * 0.12;
    tmpFrom.set(ox, BULLET_Y, oz);
    const isPlayer = shooter.team === 'player';
    ctx.effects.muzzle(tmpFrom, weapon.pellets > 1);
    ctx.lighting.flash(tmpFrom);
    ctx.audio.play(isPlayer ? (weapon.id === 'shotgun' ? 'shotgun' : 'pistol') : 'enemyShot', isPlayer ? 1 : this.falloff(shooter));
    if (isPlayer) ctx.camera.addShake(weapon.pellets > 1 ? 0.35 : 0.12);

    const spread = weapon.spread * (opts.spreadMult ?? 1);
    for (let p = 0; p < weapon.pellets; p++) {
      const a = Math.atan2(dirX, dirZ) + (Math.random() - 0.5) * 2 * spread;
      const dx = Math.sin(a);
      const dz = Math.cos(a);
      const wall = ctx.world.collision.raycast(ox, oz, dx, dz, weapon.range, true);
      let bestT = wall.dist;
      let best: Entity | null = null;
      for (const t of ctx.runtime.all) {
        if (!this.canHit(shooter, t)) continue;
        // Ray vs circle.
        const fx = ox - t.pos.x;
        const fz = oz - t.pos.z;
        const b = fx * dx + fz * dz;
        const r = t.radius + 0.12;
        const c = fx * fx + fz * fz - r * r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const hitT = -b - Math.sqrt(disc);
        if (hitT > 0 && hitT < bestT) {
          bestT = hitT;
          best = t;
        }
      }
      tmpTo.set(ox + dx * bestT, BULLET_Y, oz + dz * bestT);
      ctx.effects.tracer(tmpFrom, tmpTo, !isPlayer);
      if (best) {
        // Damage falls off a little at long range.
        const fall = 1 - Math.max(0, bestT / weapon.range - 0.5) * 0.6;
        this.applyDamage(best, weapon.damage * (opts.damageMult ?? 1) * fall, shooter, tmpTo.clone());
        ctx.effects.hit(tmpTo);
      } else if (bestT < weapon.range) {
        ctx.effects.impact(tmpTo);
      }
    }
    this.onNoise(shooter.pos.x, shooter.pos.z, weapon.noise * (opts.noiseMult ?? 1), shooter);
  }

  /** Arc melee in front of the attacker. Returns true if anything was hit. */
  melee(attacker: Entity, range: number, damage: number, arc = 1.4, only?: Entity): boolean {
    const ctx = this.ctx();
    let hitAny = false;
    const fx = Math.sin(attacker.facing);
    const fz = Math.cos(attacker.facing);
    for (const t of only ? [only] : ctx.runtime.all) {
      if (!this.canHit(attacker, t)) continue;
      const dx = t.pos.x - attacker.pos.x;
      const dz = t.pos.z - attacker.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > range + t.radius) continue;
      const dot = (dx * fx + dz * fz) / (d || 1);
      if (d > 0.6 && dot < Math.cos(arc / 2)) continue;
      if (!ctx.world.collision.lineOfSight(attacker.pos.x, attacker.pos.z, t.pos.x, t.pos.z)) continue;
      this.applyDamage(t, damage, attacker, new THREE.Vector3(t.pos.x, 1.2, t.pos.z));
      hitAny = true;
    }
    ctx.audio.play(hitAny ? 'hit' : 'melee', attacker.team === 'player' ? 1 : this.falloff(attacker));
    if (hitAny && attacker.team === 'player') ctx.camera.addShake(0.15);
    this.onNoise(attacker.pos.x, attacker.pos.z, 3, attacker);
    return hitAny;
  }

  applyDamage(target: Entity, amount: number, source: Entity | null, point: THREE.Vector3): void {
    if (!target.alive) return;
    if (target.team === 'player' && (target as { invulnerable?: boolean }).invulnerable) return;
    const ctx = this.ctx();
    const dmg = Math.max(1, Math.round(amount));
    target.health -= dmg;
    target.lastDamageAt = ctx.time;
    target.rig.hitFlash();
    if (target instanceof Enemy) target.onDamaged();
    const killed = target.health <= 0;
    if (killed) {
      target.health = 0;
      target.alive = false;
    }
    this.onDamage({ target, source, amount: dmg, killed, point });
  }

  private falloff(e: Entity): number {
    const p = this.ctx().runtime.player.pos;
    const d = Math.hypot(e.pos.x - p.x, e.pos.z - p.z);
    return Math.max(0.15, 1 - d / 30);
  }
}
