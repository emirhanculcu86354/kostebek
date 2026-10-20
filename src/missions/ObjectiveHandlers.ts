import type { ObjectiveCondition } from './MissionTypes';

/** What objective handlers need to know about the world. Implemented by GameSession + runtime. */
export interface ObjectiveContext {
  flag(name: string): boolean;
  counter(key: string): number;
  hasItem(item: string): boolean;
  evidenceFound(id: string): boolean;
  npcAlive(id: string): boolean;
}

/** Canonical flag names written by the runtime when things happen in the world. */
export const FlagKeys = {
  zone: (id: string) => `m.zone.${id}`,
  dialogue: (id: string) => `m.dlg.${id}`,
  interact: (id: string) => `m.int.${id}`,
  kill: (tag: string) => `m.kill.${tag}`,
  detected: 'm.detected',
  exposed: 'm.exposed',
};

type Handler<T extends ObjectiveCondition['type']> = (c: Extract<ObjectiveCondition, { type: T }>, ctx: ObjectiveContext) => boolean;

const handlers: { [K in ObjectiveCondition['type']]: Handler<K> } = {
  reach: (c, ctx) => ctx.flag(FlagKeys.zone(c.zone)),
  escape: (c, ctx) => ctx.flag(FlagKeys.zone(c.zone)),
  talk: (c, ctx) => ctx.flag(FlagKeys.dialogue(c.dialogue)),
  report: (c, ctx) => ctx.flag(FlagKeys.dialogue(c.dialogue)),
  interact: (c, ctx) => ctx.flag(FlagKeys.interact(c.target)),
  deliver: (c, ctx) => ctx.flag(FlagKeys.interact(c.target)) && !ctx.hasItem(c.item),
  collect: (c, ctx) => ctx.evidenceFound(c.evidence),
  collectItem: (c, ctx) => ctx.hasItem(c.item),
  defeat: (c, ctx) => ctx.counter(FlagKeys.kill(c.tag)) >= c.count,
  flag: (c, ctx) => ctx.flag(c.flag),
  protect: (c, ctx) => ctx.npcAlive(c.npc) && ctx.flag(c.untilFlag),
  // Completed when the mission ends without detection; evaluated by the manager.
  avoidDetection: () => false,
};

export function isObjectiveMet(cond: ObjectiveCondition, ctx: ObjectiveContext): boolean {
  return (handlers[cond.type] as Handler<typeof cond.type>)(cond as never, ctx);
}

/** Progress text suffix such as "(2/4)" for count-based objectives. */
export function objectiveProgress(cond: ObjectiveCondition, ctx: ObjectiveContext): string {
  if (cond.type === 'defeat') return ` (${Math.min(ctx.counter(FlagKeys.kill(cond.tag)), cond.count)}/${cond.count})`;
  return '';
}
