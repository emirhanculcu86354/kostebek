import type { DialogueManager } from '../dialogue/DialogueManager';
import type { GameSession } from '../game/GameSession';
import type { Settings } from '../game/GameTypes';
import type { CharacterController } from '../gameplay/CharacterController';
import type { MissionManager } from '../missions/MissionManager';

/** What the UI may read and trigger. Keeps DOM code out of gameplay systems. */
export interface GameFacade {
  readonly session: GameSession;
  readonly missions: MissionManager;
  readonly dialogue: DialogueManager;
  readonly controller: CharacterController;
  readonly settings: Settings;

  newGame(): void;
  continueGame(): void;
  saveInfo(): { label: string; savedAt: number } | null;
  startBriefedMission(): void;
  resume(): void;
  saveGame(): void;
  canSave(): { ok: boolean; reason?: string };
  restartMission(): void;
  toMainMenu(): void;
  applySettings(s: Settings): void;
  chooseDialogue(index: number): void;
  closePanel(): void;
  openPanel(kind: 'inventory' | 'journal'): void;
  openPause(): void;
  useItem(slot: number): void;
  dropItem(slot: number): void;
  equipItem(slot: number): void;
  unlockSkill(id: string): void;
  submitEvidence(id: string): void;
  analyzeEvidence(id: string): void;
  decide(optionId: string): void;
  continueAfterResult(): void;
  uiSound(kind: 'ui' | 'uiBack'): void;
}
