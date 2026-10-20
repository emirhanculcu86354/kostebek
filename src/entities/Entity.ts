import * as THREE from 'three';
import { HumanoidRig, type Appearance } from './Humanoid';

export type Team = 'player' | 'org' | 'rival' | 'civilian' | 'npc';

/** Shared state for anything with a body in the world: player, enemies, NPCs. */
export abstract class Entity {
  readonly pos = new THREE.Vector3();
  readonly vel = new THREE.Vector3();
  facing = 0;
  radius = 0.38;
  health: number;
  maxHealth: number;
  alive = true;
  /** Can bullets and melee hit it? */
  targetable = true;
  readonly rig: HumanoidRig;
  lastDamageAt = -999;

  constructor(
    readonly id: string,
    public team: Team,
    appearance: Appearance,
    maxHealth: number,
  ) {
    this.rig = new HumanoidRig(appearance);
    this.health = this.maxHealth = maxHealth;
  }

  get object(): THREE.Object3D {
    return this.rig.root;
  }

  dirX(): number {
    return Math.sin(this.facing);
  }

  dirZ(): number {
    return Math.cos(this.facing);
  }

  syncTransform(): void {
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = this.facing;
  }

  dispose(): void {
    this.rig.root.removeFromParent();
    this.rig.dispose();
  }
}
