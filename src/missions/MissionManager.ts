import { deepClone } from '../core/math';
import { EVIDENCE } from '../data/EvidenceData';
import type { GameSession } from '../game/GameSession';
import type { GameStateData, MissionResultRecord } from '../game/GameTypes';
import { MISSIONS } from './MissionData';
import type { MissionDef, ObjectiveDef } from './MissionTypes';
import { FlagKeys, isObjectiveMet, objectiveProgress, type ObjectiveContext } from './ObjectiveHandlers';

export type ObjectiveStatus = 'hidden' | 'active' | 'complete' | 'failed';

export interface ObjectiveView {
  def: ObjectiveDef;
  status: ObjectiveStatus;
  text: string;
}

export interface MissionOutcome {
  mission: MissionDef;
  success: boolean;
  reason?: string;
  result: MissionResultRecord;
  nextMission: MissionDef | null;
}

export interface MissionRuntimeHooks {
  npcAlive(id: string): boolean;
  playerDead(): boolean;
}

/** Data-driven mission flow: objectives, branching, failure and rewards. Renderer-agnostic. */
export class MissionManager {
  /** State captured when the current mission started; used for restart and result deltas. */
  snapshot: GameStateData | null = null;
  private finished = false;
  onObjectiveComplete: (o: ObjectiveDef) => void = () => {};
  onObjectiveFailed: (o: ObjectiveDef) => void = () => {};

  constructor(
    private session: GameSession,
    private hooks: MissionRuntimeHooks,
    private missions: Record<string, MissionDef> = MISSIONS,
  ) {}

  get active(): MissionDef | null {
    const id = this.session.state.missions.active;
    return id ? (this.missions[id] ?? null) : null;
  }

  get isFinished(): boolean {
    return this.finished;
  }

  isUnlocked(id: string): boolean {
    const m = this.missions[id];
    return !!m && this.session.check(m.unlock);
  }

  private ctx(): ObjectiveContext {
    const s = this.session;
    return {
      flag: (f) => s.flag(f),
      counter: (k) => s.counter(k),
      hasItem: (i) => s.inventory.has(i),
      evidenceFound: (id) => s.evidence.status(id) !== 'none',
      npcAlive: (id) => this.hooks.npcAlive(id),
    };
  }

  /** Begins a mission fresh: clears mission scope, snapshots state, applies start effects. */
  start(id: string): MissionDef {
    const m = this.missions[id];
    if (!m) throw new Error(`Unknown mission ${id}`);
    this.session.state.missions.active = id;
    this.session.resetMissionScope();
    this.session.state.player.position = null;
    this.snapshot = deepClone(this.session.state);
    this.finished = false;
    this.session.apply(m.onStart);
    return m;
  }

  /** Restore the state captured at mission start (used by "restart mission"). */
  restart(): MissionDef | null {
    if (!this.snapshot) return null;
    this.session.state = deepClone(this.snapshot);
    const id = this.session.state.missions.active;
    if (!id) return null;
    this.finished = false;
    this.session.apply(this.missions[id].onStart);
    return this.missions[id];
  }

  /** Resume after loading a save mid-mission. */
  resume(snapshot: GameStateData | null): void {
    this.snapshot = snapshot ? deepClone(snapshot) : deepClone(this.session.state);
    this.finished = false;
  }

  private isAvailable(o: ObjectiveDef, done: Set<string>): boolean {
    if (o.activeIf && !this.session.check(o.activeIf)) return false;
    if (o.after && !o.after.every((a) => done.has(a))) return false;
    return true;
  }

  objectives(): ObjectiveView[] {
    const m = this.active;
    if (!m) return [];
    const ms = this.session.state.missions;
    const done = new Set(ms.completedObjectives);
    const failed = new Set(ms.failedObjectives);
    const ctx = this.ctx();
    return m.objectives.map((def) => {
      let status: ObjectiveStatus;
      if (done.has(def.id)) status = 'complete';
      else if (failed.has(def.id)) status = 'failed';
      else status = this.isAvailable(def, done) ? 'active' : 'hidden';
      return { def, status, text: def.text + (status === 'active' ? objectiveProgress(def.condition, ctx) : '') };
    });
  }

  /**
   * Advance objective state. Returns an outcome when the mission ends this tick.
   * Safe to call every frame; it is cheap for small objective lists.
   */
  update(): MissionOutcome | null {
    const m = this.active;
    if (!m || this.finished) return null;
    const s = this.session;
    const ms = s.state.missions;
    const ctx = this.ctx();

    // Objectives may chain, so loop until stable.
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 10) {
      changed = false;
      const done = new Set(ms.completedObjectives);
      for (const o of m.objectives) {
        if (done.has(o.id) || ms.failedObjectives.includes(o.id)) continue;
        if (!this.isAvailable(o, done)) continue;
        if (o.condition.type === 'avoidDetection') {
          if (s.flag(FlagKeys.detected)) {
            ms.failedObjectives.push(o.id);
            this.onObjectiveFailed(o);
          }
          continue;
        }
        if (isObjectiveMet(o.condition, ctx)) {
          ms.completedObjectives.push(o.id);
          if (o.xp) s.progression.addXp(o.xp);
          this.onObjectiveComplete(o);
          changed = true;
        }
      }
    }

    const fail = this.checkFailure(m, ctx);
    if (fail) return this.finish(false, fail);

    // Complete when every required objective on the currently active branch is done.
    const done = new Set(ms.completedObjectives);
    const required = m.objectives.filter(
      (o) => !o.optional && o.condition.type !== 'avoidDetection' && (!o.activeIf || s.check(o.activeIf)),
    );
    if (required.length > 0 && required.every((o) => done.has(o.id))) return this.finish(true);
    return null;
  }

  private checkFailure(m: MissionDef, ctx: ObjectiveContext): string | null {
    for (const f of m.failConditions) {
      switch (f.type) {
        case 'playerDead':
          if (this.hooks.playerDead()) return 'Öldün. Kimliğin seninle birlikte gömüldü.';
          break;
        case 'npcDead':
          if (!ctx.npcAlive(f.npc)) return f.message;
          break;
        case 'flag':
          if (ctx.flag(f.flag)) return f.message;
          break;
        case 'exposed':
          if (ctx.flag(FlagKeys.exposed)) return 'Kimliğin deşifre oldu. Örgüt artık senin polis olduğunu biliyor.';
          break;
      }
    }
    return null;
  }

  /** Force-complete (used by scripted endings) or fail the active mission. */
  finish(success: boolean, reason?: string): MissionOutcome | null {
    const m = this.active;
    if (!m || this.finished) return null;
    this.finished = true;
    const s = this.session;
    const ms = s.state.missions;

    if (success) {
      // Optional stealth objectives succeed if the player was never detected.
      for (const o of m.objectives) {
        if (o.condition.type === 'avoidDetection' && !ms.failedObjectives.includes(o.id) && !ms.completedObjectives.includes(o.id)) {
          ms.completedObjectives.push(o.id);
          if (o.xp) s.progression.addXp(o.xp);
          this.onObjectiveComplete(o);
        }
      }
      s.apply(m.onComplete);
      s.progression.addXp(m.rewards.xp);
      for (const r of m.rewards.items ?? []) s.inventory.add(r.item, r.count);
      // Between jobs, suspicion cools down a little: the organisation has short memory for quiet men.
      s.reputation.change('suspicion', -6, 'Sakin geçen günler');
    } else {
      ms.failedAttempts[m.id] = (ms.failedAttempts[m.id] ?? 0) + 1;
    }

    const before = this.snapshot?.reputation ?? s.state.reputation;
    const after = s.state.reputation;
    const evidence = Object.keys(EVIDENCE).filter(
      (id) => (this.snapshot?.evidence[id]?.status ?? 'none') === 'none' && s.evidence.status(id) !== 'none',
    );
    const result: MissionResultRecord = {
      outcome: success ? 'success' : 'failure',
      repDelta: {
        mafia: after.mafia - before.mafia,
        police: after.police - before.police,
        suspicion: after.suspicion - before.suspicion,
        integrity: after.integrity - before.integrity,
      },
      evidence,
      xp: s.state.progression.xp - (this.snapshot?.progression.xp ?? 0),
    };

    let nextMission: MissionDef | null = null;
    if (success) {
      ms.results[m.id] = result;
      if (!ms.completed.includes(m.id)) ms.completed.push(m.id);
      const nextId = m.next.find((n) => this.isUnlocked(n));
      nextMission = nextId ? this.missions[nextId] : null;
      ms.active = nextMission ? nextMission.id : null;
    }
    return { mission: m, success, reason, result, nextMission };
  }
}
