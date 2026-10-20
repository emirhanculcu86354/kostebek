import * as THREE from 'three';
import { angleLerp, damp } from '../core/math';
import { ITEMS, WEAPONS, type WeaponDef } from '../data/ItemData';
import { Enemy } from '../entities/Enemy';
import { Player, PlayerState } from '../entities/Player';
import type { RuntimeContext } from '../game/Context';
import type { PlayerIntent } from '../input/InputTypes';
import { step } from './Steering';

const WALK = 4.1;
const RUN = 6.3;
const AIM_WALK = 2.6;
const DODGE_SPEED = 11;
const DODGE_TIME = 0.3;
const DODGE_COOLDOWN = 0.75;

const tmp = new THREE.Vector3();

/**
 * State-based player controller. One place decides which action is allowed, so a dead
 * character cannot shoot, a reload cannot restart itself, and dodging blocks attacks.
 */
export class CharacterController {
  onMessage: (text: string) => void = () => {};
  onInteractComplete: () => void = () => {};
  private regenTimer = 0;

  constructor(private ctx: () => RuntimeContext) {}

  get player(): Player {
    return this.ctx().runtime.player;
  }

  weapon(): WeaponDef {
    return WEAPONS[this.player.weapon] ?? WEAPONS.fists;
  }

  ownedWeapons(): string[] {
    const inv = this.ctx().session.inventory;
    const list = ['fists'];
    for (const id of ['pistol', 'shotgun']) if (inv.has(id)) list.push(id);
    return list;
  }

  magazine(id = this.player.weapon): number {
    return this.ctx().session.state.player.magazines[id] ?? 0;
  }

  reserve(w = this.weapon()): number {
    return w.ammoItem ? this.ctx().session.inventory.count(w.ammoItem) : 0;
  }

  update(dt: number, intent: PlayerIntent): void {
    const ctx = this.ctx();
    const p = this.player;
    const session = ctx.session;
    p.stateTime += dt;
    p.attackCooldown -= dt;
    p.dodgeCooldown -= dt;

    if (!p.alive) {
      p.setState(PlayerState.Dead);
      p.rig.update(dt, 0, 'dead');
      p.syncTransform();
      ctx.effects.setLaser(null);
      return;
    }

    // Ensure the equipped weapon is still owned (e.g. after loading or dropping it).
    if (!this.ownedWeapons().includes(p.weapon)) this.equip('fists');

    // ── Aim direction ──
    let aiming = intent.aim;
    if (intent.aimScreen) {
      const r = ctx.camera.screenToGround(intent.aimScreen.x, intent.aimScreen.y, innerWidth, innerHeight, 1.2, tmp);
      if (r) {
        const dx = r.x - p.pos.x;
        const dz = r.z - p.pos.z;
        const l = Math.hypot(dx, dz);
        if (l > 0.3) {
          p.aimX = dx / l;
          p.aimZ = dz / l;
        }
      }
    }
    if (intent.aimStick) {
      const d = ctx.camera.screenDirToWorld(intent.aimStick.x, intent.aimStick.y);
      p.aimX = d.x;
      p.aimZ = d.z;
      aiming = true;
    } else if (intent.autoTarget) {
      const t = this.autoTarget();
      if (t) {
        const dx = t.pos.x - p.pos.x;
        const dz = t.pos.z - p.pos.z;
        const l = Math.hypot(dx, dz) || 1;
        p.aimX = dx / l;
        p.aimZ = dz / l;
      } else {
        p.aimX = Math.sin(p.facing);
        p.aimZ = Math.cos(p.facing);
      }
    }

    // ── Timed states ──
    switch (p.state) {
      case PlayerState.Dodging:
        p.dodgeTimer -= dt;
        p.vel.set(p.dodgeDirX * DODGE_SPEED, 0, p.dodgeDirZ * DODGE_SPEED);
        step(p, dt, ctx);
        if (p.dodgeTimer <= 0) {
          p.invulnerable = false;
          p.setState(PlayerState.Idle);
        }
        this.finish(dt, 'dodge');
        return;
      case PlayerState.Stunned:
        p.stunTimer -= dt;
        p.vel.multiplyScalar(Math.max(0, 1 - dt * 8));
        step(p, dt, ctx);
        if (p.stunTimer <= 0) {
          if (p.pendingReload > 0) {
            p.setState(PlayerState.Reloading);
            p.reloadTimer = p.pendingReload;
            p.pendingReload = 0;
          } else p.setState(PlayerState.Idle);
        }
        this.finish(dt, 'hurt');
        return;
      case PlayerState.Interacting:
        p.vel.set(0, 0, 0);
        p.interactTimer -= dt;
        if (Math.hypot(intent.moveX, intent.moveY) > 0.3 || intent.dodge) {
          p.setState(PlayerState.Idle);
          this.onMessage('Etkileşim yarıda kesildi.');
        } else if (p.interactTimer <= 0) {
          p.setState(PlayerState.Idle);
          this.onInteractComplete();
        }
        this.finish(dt, 'interact');
        return;
      case PlayerState.Attacking:
        if (p.stateTime > 0.28) p.setState(PlayerState.Idle);
        break;
    }

    // ── Reload progress (can move while reloading) ──
    if (p.state === PlayerState.Reloading) {
      p.reloadTimer -= dt;
      if (p.reloadTimer <= 0) this.completeReload();
    }

    // ── Actions ──
    if (intent.switchWeapon && p.state !== PlayerState.Attacking) this.cycleWeapon();
    if (intent.heal) this.useMedkit();
    if (intent.reload) this.startReload();
    if (intent.dodge && p.dodgeCooldown <= 0 && p.state !== PlayerState.Attacking) {
      let dx = intent.moveX;
      let dy = intent.moveY;
      let wx: number;
      let wz: number;
      if (Math.hypot(dx, dy) > 0.2) {
        const d = ctx.camera.screenDirToWorld(dx, dy);
        wx = d.x;
        wz = d.z;
      } else {
        wx = Math.sin(p.facing);
        wz = Math.cos(p.facing);
      }
      if (p.state === PlayerState.Reloading) p.reloadTimer = 0; // dodge cancels reload; ammo stays
      p.dodgeDirX = wx;
      p.dodgeDirZ = wz;
      p.dodgeTimer = DODGE_TIME;
      p.dodgeCooldown = DODGE_COOLDOWN;
      p.invulnerable = true;
      p.facing = Math.atan2(wx, wz);
      p.setState(PlayerState.Dodging);
      ctx.audio.play('step', 1);
      this.finish(dt, 'dodge');
      return;
    }

    const w = this.weapon();
    if (intent.fire && p.state !== PlayerState.Reloading && p.attackCooldown <= 0) {
      if (w.kind === 'melee') this.meleeAttack(w);
      else this.shoot(w, intent.firePressed);
    }

    // ── Movement ──
    let mx = 0;
    let mz = 0;
    const mag = Math.min(1, Math.hypot(intent.moveX, intent.moveY));
    if (mag > 0.05) {
      const d = ctx.camera.screenDirToWorld(intent.moveX, intent.moveY);
      mx = d.x * mag;
      mz = d.z * mag;
    }
    const running = intent.run && !aiming && mag > 0.5 && p.state !== PlayerState.Reloading;
    const speed = p.state === PlayerState.Attacking ? 1.2 : aiming ? AIM_WALK : running ? RUN : WALK;
    const k = damp(14, dt);
    p.vel.x += (mx * speed - p.vel.x) * k;
    p.vel.z += (mz * speed - p.vel.z) * k;
    step(p, dt, ctx);

    // ── Facing ──
    const recentlyShot = ctx.time - p.lastShotAt < 0.5;
    const hSpeed = Math.hypot(p.vel.x, p.vel.z);
    if (aiming || recentlyShot || p.state === PlayerState.Attacking) p.facing = angleLerp(p.facing, Math.atan2(p.aimX, p.aimZ), damp(22, dt));
    else if (hSpeed > 0.4) p.facing = angleLerp(p.facing, Math.atan2(p.vel.x, p.vel.z), damp(12, dt));

    // ── State resolution ──
    if (p.state !== PlayerState.Reloading && p.state !== PlayerState.Attacking) {
      if (aiming) p.setState(PlayerState.Aiming);
      else if (hSpeed > 0.4) p.setState(running ? PlayerState.Running : PlayerState.Walking);
      else p.setState(PlayerState.Idle);
    }

    // ── Noise & footsteps ──
    if (hSpeed > 0.4) {
      p.stepTimer -= dt;
      if (p.stepTimer <= 0) {
        p.stepTimer = running ? 0.3 : 0.45;
        ctx.audio.play('step', running ? 0.9 : 0.5);
      }
      p.noiseTimer -= dt;
      if (running && p.noiseTimer <= 0) {
        p.noiseTimer = 0.5;
        ctx.combat.onNoise(p.pos.x, p.pos.z, 5 * session.progression.modifier('noise'), p);
      }
    }

    // ── Out-of-combat regeneration up to 60% ──
    this.regenTimer = ctx.time - p.lastDamageAt;
    if (this.regenTimer > 6 && p.health < p.maxHealth * 0.6) p.health = Math.min(p.maxHealth * 0.6, p.health + dt * 2.5);

    // Laser sight while aiming a firearm.
    if (aiming && w.kind === 'firearm') {
      const from = new THREE.Vector3(p.pos.x + p.aimX * 0.5, 1.25, p.pos.z + p.aimZ * 0.5);
      const hit = ctx.world.collision.raycast(from.x, from.z, p.aimX, p.aimZ, w.range, true);
      ctx.effects.setLaser(from, new THREE.Vector3(from.x + p.aimX * hit.dist, 1.25, from.z + p.aimZ * hit.dist));
    } else ctx.effects.setLaser(null);

    const pose = p.state === PlayerState.Reloading ? 'reload' : p.state === PlayerState.Attacking ? 'melee' : aiming || recentlyShot ? (w.kind === 'firearm' ? 'aim' : 'idle') : hSpeed > 0.3 ? 'move' : 'idle';
    this.finish(dt, pose);
  }

  private finish(dt: number, pose: Parameters<Player['rig']['update']>[2]): void {
    const p = this.player;
    p.rig.setArmed(this.weapon().kind === 'firearm');
    p.rig.update(dt, Math.hypot(p.vel.x, p.vel.z), pose);
    p.syncTransform();
    // Sync persistent player data.
    const sp = this.ctx().session.state.player;
    sp.health = Math.max(0, Math.round(p.health));
    sp.equipped = p.weapon;
  }

  private autoTarget(): Enemy | null {
    const ctx = this.ctx();
    const p = this.player;
    let best: Enemy | null = null;
    let bestD = this.weapon().kind === 'melee' ? 3 : this.weapon().range;
    for (const e of ctx.runtime.enemies) {
      if (!e.alive || e.dormant || !e.hostile) continue;
      const d = e.pos.distanceTo(p.pos);
      if (d < bestD && ctx.world.collision.lineOfSight(p.pos.x, p.pos.z, e.pos.x, e.pos.z)) {
        best = e;
        bestD = d;
      }
    }
    return best;
  }

  private shoot(w: WeaponDef, pressed: boolean): void {
    const ctx = this.ctx();
    const p = this.player;
    const mags = ctx.session.state.player.magazines;
    if ((mags[w.id] ?? 0) <= 0) {
      if (pressed) {
        ctx.audio.play('empty');
        if (this.reserve(w) > 0) this.startReload();
        else this.onMessage('Mermi yok! Yumruğa geç (Q) ya da mermi bul.');
      }
      p.attackCooldown = 0.25;
      return;
    }
    mags[w.id] = (mags[w.id] ?? 0) - 1;
    p.attackCooldown = w.cooldown;
    p.lastShotAt = ctx.time;
    p.facing = Math.atan2(p.aimX, p.aimZ);
    const prog = ctx.session.progression;
    ctx.combat.fire(p, w, p.aimX, p.aimZ, {
      damageMult: prog.modifier('damage'),
      spreadMult: prog.modifier('spread') * (p.state === PlayerState.Aiming ? 0.45 : 1) * (Math.hypot(p.vel.x, p.vel.z) > 3 ? 1.5 : 1),
      noiseMult: prog.modifier('noise'),
    });
    p.rig.triggerAttack();
    if (mags[w.id] === 0 && this.reserve(w) > 0) this.startReload();
  }

  private meleeAttack(w: WeaponDef): void {
    const ctx = this.ctx();
    const p = this.player;
    p.attackCooldown = w.cooldown;
    p.lastShotAt = ctx.time;
    p.facing = Math.atan2(p.aimX, p.aimZ);
    p.setState(PlayerState.Attacking);
    p.rig.triggerAttack();
    // Small lunge.
    p.vel.x += p.aimX * 3;
    p.vel.z += p.aimZ * 3;
    ctx.combat.melee(p, w.range, w.damage * ctx.session.progression.modifier('meleeDamage'));
  }

  startReload(): boolean {
    const ctx = this.ctx();
    const p = this.player;
    const w = this.weapon();
    if (w.kind !== 'firearm' || p.state === PlayerState.Reloading || p.busy) return false;
    if (this.magazine() >= w.magazine) return false;
    if (this.reserve(w) <= 0) {
      this.onMessage('Yedek mermi yok.');
      return false;
    }
    p.reloadDuration = w.reloadTime * ctx.session.progression.modifier('reloadTime');
    p.reloadTimer = p.reloadDuration;
    p.setState(PlayerState.Reloading);
    ctx.audio.play('reload');
    return true;
  }

  private completeReload(): void {
    const ctx = this.ctx();
    const p = this.player;
    const w = this.weapon();
    p.setState(PlayerState.Idle);
    if (!w.ammoItem) return;
    const mags = ctx.session.state.player.magazines;
    const need = w.magazine - (mags[w.id] ?? 0);
    const got = ctx.session.inventory.remove(w.ammoItem, need);
    mags[w.id] = (mags[w.id] ?? 0) + got;
  }

  equip(id: string): void {
    const p = this.player;
    if (p.state === PlayerState.Reloading) p.setState(PlayerState.Idle);
    p.pendingReload = 0;
    p.weapon = id;
    this.ctx().session.state.player.equipped = id;
    this.ctx().audio.play('ui', 0.6);
  }

  cycleWeapon(): void {
    const list = this.ownedWeapons();
    const i = list.indexOf(this.player.weapon);
    this.equip(list[(i + 1) % list.length]);
    this.onMessage(`Silah: ${WEAPONS[this.player.weapon].name}`);
  }

  useMedkit(): boolean {
    const ctx = this.ctx();
    const p = this.player;
    if (!p.alive) return false;
    if (p.health >= p.maxHealth) {
      this.onMessage('Sağlığın zaten dolu.');
      return false;
    }
    if (!ctx.session.inventory.has('medkit')) {
      this.onMessage('İlk yardım kitin yok.');
      return false;
    }
    ctx.session.inventory.remove('medkit');
    p.health = Math.min(p.maxHealth, p.health + (ITEMS.medkit.heal ?? 40));
    ctx.session.state.player.health = Math.round(p.health);
    ctx.audio.play('pickup');
    this.onMessage('+45 Sağlık');
    return true;
  }

  beginInteract(duration: number): void {
    const p = this.player;
    if (p.state === PlayerState.Reloading) p.setState(PlayerState.Idle);
    p.interactDuration = duration;
    p.interactTimer = duration;
    p.setState(PlayerState.Interacting);
  }
}
