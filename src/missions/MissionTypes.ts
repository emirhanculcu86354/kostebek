import type { Condition, Effect, Vec2 } from '../game/GameTypes';

export type ObjectiveCondition =
  | { type: 'reach'; zone: string }
  | { type: 'escape'; zone: string }
  | { type: 'talk'; dialogue: string }
  | { type: 'report'; dialogue: string }
  | { type: 'interact'; target: string }
  | { type: 'deliver'; item: string; target: string }
  | { type: 'collect'; evidence: string }
  | { type: 'collectItem'; item: string }
  | { type: 'defeat'; tag: string; count: number }
  | { type: 'flag'; flag: string }
  | { type: 'protect'; npc: string; untilFlag: string }
  | { type: 'avoidDetection' };

export type MarkerRef = { zone: string } | { npc: string } | { interactable: string } | { enemyTag: string } | { pos: Vec2 };

export interface ObjectiveDef {
  id: string;
  text: string;
  optional?: boolean;
  condition: ObjectiveCondition;
  /** Only relevant (shown and required) while these hold — used for branching paths. */
  activeIf?: Condition;
  /** Becomes available after these objectives complete. */
  after?: string[];
  marker?: MarkerRef;
  /** Bonus XP when completed. */
  xp?: number;
}

export type FailCondition =
  | { type: 'playerDead' }
  | { type: 'npcDead'; npc: string; message: string }
  | { type: 'flag'; flag: string; message: string }
  | { type: 'exposed' };

export type EnemyRole = 'guard' | 'gangster' | 'enforcer';
export type Faction = 'org' | 'rival';

export interface EnemySpawn {
  id: string;
  role: EnemyRole;
  faction: Faction;
  name: string;
  pos: Vec2;
  facing?: number;
  patrol?: Vec2[];
  hostile: boolean;
  tags?: string[];
  /** Hidden and inactive until a world event "activate:<group>" fires. */
  group?: string;
  health?: number;
  drops?: { item: string; count: number }[];
  /** Neutral (org) watchers: who/what they react to. */
  watch?: { restricted?: boolean; npc?: string; onDetect?: Effect[] };
  appearance?: string;
  /** Neutral enemies can be talked to. */
  dialogues?: NpcDialogueRule[];
  bark?: string;
}

export interface NpcDialogueRule {
  dialogue: string;
  when?: Condition;
}

export interface NpcSpawn {
  id: string;
  character: string;
  pos: Vec2;
  facing?: number;
  dialogues?: NpcDialogueRule[];
  /** Ambient civilian — harming them has consequences. */
  civilian?: boolean;
  killable?: boolean;
  wander?: Vec2[];
  showIf?: Condition;
  label?: string;
  /** Line shown when no dialogue rule matches. */
  bark?: string;
}

export type InteractableModel =
  | 'package'
  | 'laptop'
  | 'ledger'
  | 'documents'
  | 'medkit'
  | 'ammo'
  | 'shotgun'
  | 'key'
  | 'phone'
  | 'note'
  | 'safe'
  | 'board';

export interface InteractableSpawn {
  id: string;
  model: InteractableModel;
  pos: Vec2;
  name: string;
  verb: string;
  effects: Effect[];
  requires?: Condition;
  requiresText?: string;
  showIf?: Condition;
  once?: boolean;
  /** Seconds of "interacting" state before effects apply. */
  duration?: number;
  /** Marked on the map only with the "Muhbir Ağı" skill. */
  hiddenLead?: boolean;
}

export interface ZoneDef {
  id: string;
  x: number;
  z: number;
  w: number;
  d: number;
  restricted?: boolean;
  label?: string;
  /** Flag only set if this NPC is within 6 units of the player. */
  requiresNpcNear?: string;
  onEnter?: Effect[];
  /** Restricted only while this holds. */
  activeIf?: Condition;
}

export interface MissionDef {
  id: string;
  index: number;
  title: string;
  location: string;
  briefing: string;
  unlock?: Condition;
  spawn: Vec2;
  spawnFacing?: number;
  objectives: ObjectiveDef[];
  failConditions: FailCondition[];
  rewards: { xp: number; items?: { item: string; count: number }[] };
  onStart?: Effect[];
  onComplete?: Effect[];
  next: string[];
  enemies: EnemySpawn[];
  npcs: NpcSpawn[];
  interactables: InteractableSpawn[];
  zones: ZoneDef[];
  /** Door id -> condition that unlocks it. Doors not listed are unlocked. */
  lockedDoors?: Record<string, { unlock: Condition; text: string }>;
  /** If true, critical suspicion sets "m.exposed" instead of failing the mission. */
  exposureBranch?: boolean;
  /** Ambient civilians wander the street. */
  civilians?: number;
}
