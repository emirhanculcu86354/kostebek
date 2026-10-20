import type { GameSession } from '../game/GameSession';
import { FlagKeys } from '../missions/ObjectiveHandlers';
import { DIALOGUES } from './DialogueData';
import type { DialogueChoice, DialogueDef, DialogueNode } from './DialogueTypes';

export interface ChoiceView {
  index: number;
  text: string;
  tag?: string;
  locked: boolean;
  lockedLabel?: string;
}

/** Runs data-driven conversations. Applies effects through the session so all rules stay central. */
export class DialogueManager {
  private def: DialogueDef | null = null;
  private node: DialogueNode | null = null;
  onEnd: (dialogueId: string) => void = () => {};

  constructor(
    private session: GameSession,
    private dialogues: Record<string, DialogueDef> = DIALOGUES,
  ) {}

  get active(): boolean {
    return this.node !== null;
  }

  get current(): DialogueNode | null {
    return this.node;
  }

  get dialogueId(): string | null {
    return this.def?.id ?? null;
  }

  start(id: string): boolean {
    const def = this.dialogues[id];
    if (!def) return false;
    this.def = def;
    const alt = def.startIf?.find((s) => this.session.check(s.when));
    this.enter(alt ? alt.node : def.start);
    return true;
  }

  private enter(nodeId: string | undefined): void {
    if (!this.def) return;
    const node = nodeId ? this.def.nodes[nodeId] : undefined;
    if (!node) {
      this.end();
      return;
    }
    this.node = node;
    this.session.apply(node.effects);
  }

  choices(): ChoiceView[] {
    const node = this.node;
    if (!node) return [];
    if (!node.choices || node.choices.length === 0) {
      return [{ index: -1, text: node.next ? 'Devam' : 'Konuşmayı bitir', locked: false }];
    }
    const out: ChoiceView[] = [];
    node.choices.forEach((c, i) => {
      const ok = this.session.check(c.conditions);
      if (!ok && !c.lockedLabel) return;
      out.push({ index: i, text: c.text, tag: c.tag, locked: !ok, lockedLabel: c.lockedLabel });
    });
    return out;
  }

  /** index -1 = continue on nodes without choices. */
  choose(index: number): void {
    const node = this.node;
    if (!node) return;
    if (index === -1) {
      this.enter(node.next);
      return;
    }
    const c: DialogueChoice | undefined = node.choices?.[index];
    if (!c || !this.session.check(c.conditions)) return;
    this.session.apply(c.effects);
    if (c.next) this.enter(c.next);
    else this.end();
  }

  /** Abort without completing (e.g. combat interrupt). No completion flag is set. */
  cancel(): void {
    this.def = null;
    this.node = null;
  }

  private end(): void {
    const def = this.def;
    this.def = null;
    this.node = null;
    if (!def) return;
    this.session.apply(def.onEnd);
    this.session.setFlag(FlagKeys.dialogue(def.id));
    this.session.setFlag(`dlg.${def.id}`);
    this.onEnd(def.id);
  }
}
