import type { AudioManager } from '../audio/AudioManager';
import type { CombatSystem } from '../gameplay/CombatSystem';
import type { CameraController } from '../rendering/CameraController';
import type { Effects } from '../rendering/Effects';
import type { Lighting } from '../rendering/Lighting';
import type { MissionRuntime } from '../world/MissionRuntime';
import type { World } from '../world/World';
import type { GameSession } from './GameSession';

/** Everything a gameplay system may touch. Passed explicitly instead of using globals. */
export interface RuntimeContext {
  session: GameSession;
  world: World;
  runtime: MissionRuntime;
  combat: CombatSystem;
  audio: AudioManager;
  camera: CameraController;
  lighting: Lighting;
  effects: Effects;
  /** Seconds since the mission started (simulation time, pauses with the game). */
  time: number;
  notify(text: string, tone?: 'info' | 'good' | 'bad'): void;
}
