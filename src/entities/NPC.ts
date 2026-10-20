import * as THREE from 'three';
import type { NpcSpawn } from '../missions/MissionTypes';
import { Entity } from './Entity';
import { APPEARANCES, civilianAppearance } from './Humanoid';

export type NpcMode = 'idle' | 'wander' | 'follow' | 'flee' | 'hurt' | 'cower';

export class NPC extends Entity {
  readonly spawn: NpcSpawn;
  mode: NpcMode;
  wanderIndex = 0;
  waitTimer = Math.random() * 2;
  path: { x: number; z: number }[] | null = null;
  pathIndex = 0;
  repathTimer = 0;
  fleeTimer = 0;
  fleeFrom = new THREE.Vector3();
  readonly homeFacing: number;
  speed = 0;

  constructor(spawn: NpcSpawn, seed = 0) {
    const ap = spawn.character === 'civilian' ? civilianAppearance(seed) : (APPEARANCES[spawn.character] ?? civilianAppearance(seed));
    super(spawn.id, spawn.civilian ? 'civilian' : 'npc', ap, spawn.killable || spawn.civilian ? 100 : 9999);
    this.spawn = spawn;
    this.targetable = !!(spawn.civilian || spawn.killable);
    this.pos.set(spawn.pos.x, 0, spawn.pos.z);
    this.facing = spawn.facing ?? 0;
    this.homeFacing = this.facing;
    this.mode = spawn.wander?.length ? 'wander' : 'idle';
    this.rig.setArmed(false);
  }

  get isStory(): boolean {
    return !this.spawn.civilian;
  }
}
