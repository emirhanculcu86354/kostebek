import type { GameStateData } from './GameTypes';

export const SAVE_VERSION = 2;

export const STARTING_REPUTATION = { mafia: 15, police: 70, suspicion: 5, integrity: 50 };

export function createNewGameState(): GameStateData {
  return {
    version: SAVE_VERSION,
    createdAt: Date.now(),
    playTime: 0,
    reputation: { ...STARTING_REPUTATION },
    player: {
      health: 100,
      maxHealth: 100,
      position: null,
      facing: 0,
      equipped: 'pistol',
      magazines: { pistol: 12, shotgun: 0 },
      gadget: null,
    },
    inventory: {
      capacity: 14,
      slots: [
        { item: 'pistol', count: 1 },
        { item: 'ammo_9mm', count: 24 },
        { item: 'medkit', count: 1 },
      ],
    },
    evidence: {},
    progression: { xp: 0, level: 1, skillPoints: 1, skills: [] },
    missions: {
      active: 'm1',
      completed: [],
      failedAttempts: {},
      results: {},
      completedObjectives: [],
      failedObjectives: [],
    },
    flags: {},
    counters: {},
    world: { removed: [], killed: [], openDoors: [], activated: [], hiddenNpcs: [], following: [] },
  };
}
