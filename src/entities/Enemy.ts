import * as THREE from 'three';
import type { EnemyRole, EnemySpawn } from '../missions/MissionTypes';
import { iconTexture } from '../rendering/TextureFactory';
import { Entity } from './Entity';
import { APPEARANCES } from './Humanoid';

export enum AIState {
  Idle = 'Idle',
  Patrol = 'Patrol',
  Suspicious = 'Suspicious',
  Investigating = 'Investigating',
  Alerted = 'Alerted',
  Pursuing = 'Pursuing',
  Attacking = 'Attacking',
  Searching = 'Searching',
  Returning = 'Returning',
  Dead = 'Dead',
}

export interface RoleStats {
  health: number;
  walkSpeed: number;
  runSpeed: number;
  vision: number;
  fov: number;
  attackRange: number;
  damage: number;
  cooldown: number;
  spread: number;
  melee: boolean;
  preferredMin: number;
  preferredMax: number;
}

export const ROLE_STATS: Record<EnemyRole, RoleStats> = {
  guard: { health: 80, walkSpeed: 1.7, runSpeed: 4.3, vision: 11, fov: 1.95, attackRange: 11, damage: 7, cooldown: 0.85, spread: 0.1, melee: false, preferredMin: 3, preferredMax: 10 },
  gangster: { health: 70, walkSpeed: 1.8, runSpeed: 4.6, vision: 12.5, fov: 2.0, attackRange: 13, damage: 8, cooldown: 0.3, spread: 0.08, melee: false, preferredMin: 5.5, preferredMax: 10 },
  enforcer: { health: 180, walkSpeed: 1.6, runSpeed: 5.0, vision: 10, fov: 1.8, attackRange: 1.55, damage: 16, cooldown: 1.2, spread: 0, melee: true, preferredMin: 0, preferredMax: 1.4 },
};

let iconCache: Record<string, THREE.SpriteMaterial> | null = null;
function icons(): Record<string, THREE.SpriteMaterial> {
  if (!iconCache) {
    iconCache = {
      '?': new THREE.SpriteMaterial({ map: iconTexture('?', '#D99A42'), depthTest: false, transparent: true }),
      '!': new THREE.SpriteMaterial({ map: iconTexture('!', '#C94A4A'), depthTest: false, transparent: true }),
      '…': new THREE.SpriteMaterial({ map: iconTexture('…', '#A3ADB9'), depthTest: false, transparent: true }),
    };
  }
  return iconCache;
}

export class Enemy extends Entity {
  readonly spawn: EnemySpawn;
  readonly role: EnemyRole;
  readonly stats: RoleStats;
  readonly tags: Set<string>;
  hostile: boolean;
  dormant: boolean;
  state: AIState = AIState.Idle;
  stateTime = 0;
  detection = 0;
  home: THREE.Vector3;
  homeFacing: number;
  patrolIndex = 0;
  waitTimer = 0;
  path: { x: number; z: number }[] | null = null;
  pathIndex = 0;
  repathTimer = 0;
  lastKnown: THREE.Vector3 | null = null;
  lastSeenTime = -99;
  attackTimer = 0;
  windup = 0;
  burstLeft = 0;
  repositionTimer = 0;
  moveTarget: THREE.Vector3 | null = null;
  catchCooldown = 0;
  barkTimer = 0;
  losTimer = 0;
  canSeeTarget = false;
  /** Separate LOS cache for a watched NPC so it never mixes with the player's. */
  watchLosTimer = 0;
  watchCanSee = false;
  targetId = 'player';
  /** Neutral watcher reaction timer ("Burada ne arıyorsun?"). */
  confrontTimer = 0;
  private icon: THREE.Sprite;
  private hpBg: THREE.Sprite;
  private hpFg: THREE.Sprite;
  private hpShowTimer = 0;

  constructor(spawn: EnemySpawn) {
    const appearanceKey = spawn.appearance ?? `${spawn.faction}_${spawn.role}`;
    const stats = ROLE_STATS[spawn.role];
    super(spawn.id, spawn.faction, APPEARANCES[appearanceKey] ?? APPEARANCES.org_guard, spawn.health ?? stats.health);
    this.spawn = spawn;
    this.role = spawn.role;
    this.stats = stats;
    this.tags = new Set(spawn.tags ?? []);
    this.hostile = spawn.hostile;
    this.dormant = !!spawn.group;
    this.pos.set(spawn.pos.x, 0, spawn.pos.z);
    this.facing = spawn.facing ?? 0;
    this.home = this.pos.clone();
    this.homeFacing = this.facing;
    this.radius = spawn.role === 'enforcer' ? 0.46 : 0.38;
    this.rig.setArmed(!stats.melee);
    this.state = spawn.patrol?.length ? AIState.Patrol : AIState.Idle;

    this.icon = new THREE.Sprite(icons()['?']);
    this.icon.scale.set(0.55, 0.55, 1);
    this.icon.position.y = this.rig.height + 0.55;
    this.icon.visible = false;
    this.icon.renderOrder = 10;
    this.rig.root.add(this.icon);

    const bgMat = new THREE.SpriteMaterial({ color: 0x101318, depthTest: false, transparent: true, opacity: 0.85 });
    const fgMat = new THREE.SpriteMaterial({ color: 0xc94a4a, depthTest: false });
    this.hpBg = new THREE.Sprite(bgMat);
    this.hpFg = new THREE.Sprite(fgMat);
    for (const s of [this.hpBg, this.hpFg]) {
      s.center.set(0, 0.5);
      s.position.set(-0.45, this.rig.height + 0.25, 0);
      s.renderOrder = 11;
      s.visible = false;
      this.rig.root.add(s);
    }
    this.hpBg.scale.set(0.9, 0.09, 1);
    this.hpFg.scale.set(0.9, 0.07, 1);
  }

  setState(s: AIState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateTime = 0;
    this.path = null;
  }

  onDamaged(): void {
    this.hpShowTimer = 4;
  }

  /** Update overhead indicators. Called each frame after AI. */
  updateIndicators(dt: number): void {
    const ic = icons();
    let symbol: string | null = null;
    if (this.alive && !this.dormant) {
      if (this.state === AIState.Alerted || ((this.state === AIState.Pursuing || this.state === AIState.Attacking) && this.stateTime < 1.5)) symbol = '!';
      else if (this.detection > 0.05 || this.state === AIState.Suspicious || this.state === AIState.Investigating || this.state === AIState.Searching) symbol = this.hostile || this.detection > 0.05 ? '?' : '…';
    }
    if (symbol) {
      this.icon.visible = true;
      this.icon.material = ic[symbol];
      const s = symbol === '?' ? 0.35 + this.detection * 0.35 : 0.6;
      this.icon.scale.set(s, s, 1);
    } else this.icon.visible = false;

    this.hpShowTimer -= dt;
    const showHp = this.alive && this.hpShowTimer > 0;
    this.hpBg.visible = this.hpFg.visible = showHp;
    if (showHp) this.hpFg.scale.x = 0.9 * Math.max(0, this.health / this.maxHealth);
    // Anchor the bar's left edge half a bar to the screen-left (world (-1,0,1)/√2), undoing body rotation.
    const wx = -0.318;
    const wz = 0.318;
    const c = Math.cos(this.facing);
    const s = Math.sin(this.facing);
    this.hpBg.position.x = this.hpFg.position.x = wx * c - wz * s;
    this.hpBg.position.z = this.hpFg.position.z = wx * s + wz * c;
  }

  override dispose(): void {
    (this.hpBg.material as THREE.Material).dispose();
    (this.hpFg.material as THREE.Material).dispose();
    super.dispose();
  }
}
