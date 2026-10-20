import type { Condition, Effect } from '../game/GameTypes';

export interface Speaker {
  id: string;
  name: string;
  role: string;
  color: string;
}

export interface DialogueChoice {
  text: string;
  /** Next node id; omit to end the conversation. */
  next?: string;
  conditions?: Condition;
  /** Shown greyed-out with this label when conditions fail; hidden otherwise. */
  lockedLabel?: string;
  /** Prefix tag like "[İkna]" shown before the text. */
  tag?: string;
  effects?: Effect[];
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  /** Effects applied when this node is entered. */
  effects?: Effect[];
  choices?: DialogueChoice[];
  /** Auto-advance target when there are no choices. */
  next?: string;
}

export interface DialogueDef {
  id: string;
  start: string;
  /** Alternative start nodes picked by condition (first match wins). */
  startIf?: { when: Condition; node: string }[];
  nodes: Record<string, DialogueNode>;
  /** Effects applied once when the conversation ends normally. */
  onEnd?: Effect[];
}
