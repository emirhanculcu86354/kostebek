import { Entity } from './Entity';
import { APPEARANCES } from './Humanoid';

export enum PlayerState {
  Idle = 'Idle',
  Walking = 'Walking',
  Running = 'Running',
  Aiming = 'Aiming',
  Attacking = 'Attacking',
  Reloading = 'Reloading',
  Dodging = 'Dodging',
  Interacting = 'Interacting',
  Stunned = 'Stunned',
  Dead = 'Dead',
}

/** The undercover officer. Behaviour lives in CharacterController; this is the body + state. */
export class Player extends Entity {
  state: PlayerState = PlayerState.Idle;
  stateTime = 0;
  weapon = 'pistol';
  attackCooldown = 0;
  reloadTimer = 0;
  reloadDuration = 0;
  dodgeTimer = 0;
  dodgeCooldown = 0;
  dodgeDirX = 0;
  dodgeDirZ = 1;
  stunTimer = 0;
  /** Reload time left when a stun interrupted reloading; resumes afterwards. */
  pendingReload = 0;
  interactTimer = 0;
  interactDuration = 0;
  /** Aim direction on the ground plane (normalised). */
  aimX = 0;
  aimZ = 1;
  lastShotAt = -10;
  invulnerable = false;
  noiseTimer = 0;
  stepTimer = 0;

  constructor() {
    super('player', 'player', APPEARANCES.player, 100);
    this.radius = 0.36;
  }

  setState(s: PlayerState): void {
    if (this.state === s) return;
    if (this.state === PlayerState.Reloading && s === PlayerState.Stunned) this.pendingReload = this.reloadTimer;
    this.state = s;
    this.stateTime = 0;
  }

  get busy(): boolean {
    return (
      this.state === PlayerState.Dodging ||
      this.state === PlayerState.Interacting ||
      this.state === PlayerState.Stunned ||
      this.state === PlayerState.Dead ||
      this.state === PlayerState.Attacking
    );
  }
}
