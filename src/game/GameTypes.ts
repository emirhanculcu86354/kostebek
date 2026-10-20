/** Shared data types for conditions, effects and persistent state. Pure data, no rendering. */

export type RepStat = 'mafia' | 'police' | 'suspicion' | 'integrity';

export type EvidenceStatus = 'none' | 'collected' | 'kept' | 'submitted' | 'returned';

export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { skill: string }
  | { stat: RepStat; min?: number; max?: number }
  | { hasItem: string; count?: number }
  | { evidence: string; status: EvidenceStatus | EvidenceStatus[] }
  | { evidenceHeld: string }
  | { missionDone: string }
  | { counter: string; min: number }
  | { anyEvidenceHeld: true }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type Effect =
  | { type: 'rep'; stat: RepStat; delta: number; reason?: string }
  | { type: 'flag'; flag: string; value?: boolean }
  | { type: 'counter'; key: string; delta: number }
  | { type: 'giveItem'; item: string; count?: number }
  | { type: 'takeItem'; item: string; count?: number }
  | { type: 'evidence'; id: string; action: EvidenceAction }
  | { type: 'xp'; amount: number }
  | { type: 'heal'; amount: number }
  | { type: 'notify'; text: string; tone?: 'info' | 'good' | 'bad' }
  /** World/game-side trigger interpreted by the runtime (activate enemies, follow, etc.). */
  | { type: 'event'; name: string; arg?: string };

export type EvidenceAction = 'collect' | 'submit' | 'return' | 'keep';

export interface Vec2 {
  x: number;
  z: number;
}

export interface Reputation {
  mafia: number;
  police: number;
  suspicion: number;
  integrity: number;
}

export interface InventorySlot {
  item: string;
  count: number;
}

export interface EvidenceRecord {
  status: EvidenceStatus;
  mission?: string;
  analyzed?: boolean;
}

export interface MissionResultRecord {
  outcome: 'success' | 'failure';
  repDelta: Reputation;
  evidence: string[];
  xp: number;
}

export interface Settings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  cameraZoom: number;
  quality: 'low' | 'medium' | 'high';
  showDamageNumbers: boolean;
}

export interface PlayerSave {
  health: number;
  maxHealth: number;
  position: Vec2 | null;
  facing: number;
  /** Equipped weapon id; 'fists' when unarmed. */
  equipped: string;
  /** Rounds currently in each firearm's magazine. */
  magazines: Record<string, number>;
  gadget: string | null;
}

export interface GameStateData {
  version: number;
  createdAt: number;
  playTime: number;
  reputation: Reputation;
  player: PlayerSave;
  inventory: { slots: InventorySlot[]; capacity: number };
  evidence: Record<string, EvidenceRecord>;
  progression: { xp: number; level: number; skillPoints: number; skills: string[] };
  missions: {
    active: string | null;
    completed: string[];
    failedAttempts: Record<string, number>;
    results: Record<string, MissionResultRecord>;
    completedObjectives: string[];
    failedObjectives: string[];
  };
  /** Story flags. Keys starting with "m." are mission-scoped and cleared on mission start. */
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  world: { removed: string[]; killed: string[]; openDoors: string[]; activated: string[]; hiddenNpcs: string[]; following: string[] };
}
