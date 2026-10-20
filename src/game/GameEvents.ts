import type { RepStat } from './GameTypes';

/** Events published by gameplay systems. UI, audio and the mission manager subscribe to these. */
export interface GameEvents extends Record<string, unknown> {
  repChanged: { stat: RepStat; delta: number; value: number; reason?: string };
  suspicionTier: { from: SuspicionTier; to: SuspicionTier };
  itemAdded: { item: string; count: number };
  itemRemoved: { item: string; count: number };
  inventoryFull: { item: string };
  evidenceChanged: { id: string; status: string };
  xpGained: { amount: number; total: number };
  levelUp: { level: number; skillPoints: number };
  skillUnlocked: { id: string };
  flagSet: { flag: string; value: boolean };
  notify: { text: string; tone: 'info' | 'good' | 'bad' };
  worldEvent: { name: string; arg?: string };
}

export type SuspicionTier = 'low' | 'medium' | 'high' | 'critical';
