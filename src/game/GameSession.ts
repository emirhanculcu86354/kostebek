import { EventBus } from '../core/EventBus';
import { ITEMS } from '../data/ItemData';
import { EvidenceSystem } from '../gameplay/EvidenceSystem';
import { InventorySystem } from '../gameplay/InventorySystem';
import { ProgressionSystem } from '../gameplay/ProgressionSystem';
import { ReputationSystem } from '../gameplay/ReputationSystem';
import type { GameEvents } from './GameEvents';
import { createNewGameState } from './GameState';
import type { Condition, Effect, GameStateData } from './GameTypes';

/**
 * Owns the authoritative, serialisable game state and the rule systems operating on it.
 * Nothing here touches Three.js or the DOM, so a future server can run the same code.
 */
export class GameSession {
  state: GameStateData;
  readonly bus = new EventBus<GameEvents>();
  readonly reputation: ReputationSystem;
  readonly evidence: EvidenceSystem;
  readonly inventory: InventorySystem;
  readonly progression: ProgressionSystem;

  constructor(state: GameStateData = createNewGameState()) {
    this.state = state;
    const get = () => this.state;
    this.progression = new ProgressionSystem(get, this.bus);
    this.reputation = new ReputationSystem(get, this.bus, () => this.progression.modifier('suspicionGain'));
    this.evidence = new EvidenceSystem(get, this.bus);
    this.inventory = new InventorySystem(get, this.bus);
  }

  flag(name: string): boolean {
    return !!this.state.flags[name];
  }

  setFlag(name: string, value = true): void {
    if (!!this.state.flags[name] === value) return;
    if (value) this.state.flags[name] = true;
    else delete this.state.flags[name];
    this.bus.emit('flagSet', { flag: name, value });
  }

  counter(key: string): number {
    return this.state.counters[key] ?? 0;
  }

  addCounter(key: string, delta: number): void {
    this.state.counters[key] = this.counter(key) + delta;
  }

  check(cond: Condition | Condition[] | undefined): boolean {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every((c) => this.check(c));
    if ('all' in cond) return cond.all.every((c) => this.check(c));
    if ('any' in cond) return cond.any.some((c) => this.check(c));
    if ('not' in cond) return !this.check(cond.not);
    if ('flag' in cond) return this.flag(cond.flag);
    if ('notFlag' in cond) return !this.flag(cond.notFlag);
    if ('skill' in cond) return this.progression.hasSkill(cond.skill);
    if ('stat' in cond) {
      const v = this.state.reputation[cond.stat];
      return (cond.min === undefined || v >= cond.min) && (cond.max === undefined || v <= cond.max);
    }
    if ('hasItem' in cond) return this.inventory.has(cond.hasItem, cond.count ?? 1);
    if ('evidence' in cond) {
      const s = this.evidence.status(cond.evidence);
      return Array.isArray(cond.status) ? cond.status.includes(s) : s === cond.status;
    }
    if ('evidenceHeld' in cond) return this.evidence.isHeld(cond.evidenceHeld);
    if ('counter' in cond) return this.counter(cond.counter) >= cond.min;
    if ('anyEvidenceHeld' in cond) return this.evidence.list().some((e) => e.status === 'collected' || e.status === 'kept');
    if ('missionDone' in cond) return this.state.missions.completed.includes(cond.missionDone);
    return false;
  }

  apply(effects: Effect[] | undefined): void {
    if (!effects) return;
    for (const e of effects) this.applyOne(e);
  }

  private applyOne(e: Effect): void {
    switch (e.type) {
      case 'rep':
        this.reputation.change(e.stat, e.delta, e.reason);
        break;
      case 'flag':
        this.setFlag(e.flag, e.value ?? true);
        break;
      case 'counter':
        this.addCounter(e.key, e.delta);
        break;
      case 'giveItem': {
        const added = this.inventory.add(e.item, e.count ?? 1);
        if (added > 0) {
          const name = ITEMS[e.item]?.name ?? e.item;
          this.bus.emit('notify', { text: `+${added > 1 ? added + ' ' : ''}${name}`, tone: 'info' });
        }
        break;
      }
      case 'takeItem':
        this.inventory.remove(e.item, e.count ?? 1);
        break;
      case 'evidence': {
        const r = this.evidence.apply(e.id, e.action);
        if (r.ok && r.policeReward > 0) this.reputation.change('police', r.policeReward, 'Kanıt merkeze ulaştı');
        break;
      }
      case 'xp':
        this.progression.addXp(e.amount);
        break;
      case 'heal': {
        const p = this.state.player;
        p.health = Math.min(p.maxHealth, p.health + e.amount);
        break;
      }
      case 'notify':
        this.bus.emit('notify', { text: e.text, tone: e.tone ?? 'info' });
        break;
      case 'event':
        this.bus.emit('worldEvent', { name: e.name, arg: e.arg });
        break;
    }
  }

  /** Clears mission-scoped flags/counters ("m." prefix) and per-mission world changes. */
  resetMissionScope(): void {
    for (const k of Object.keys(this.state.flags)) if (k.startsWith('m.')) delete this.state.flags[k];
    for (const k of Object.keys(this.state.counters)) if (k.startsWith('m.')) delete this.state.counters[k];
    this.state.world = { removed: [], killed: [], openDoors: [], activated: [], hiddenNpcs: [], following: [] };
    this.state.missions.completedObjectives = [];
    this.state.missions.failedObjectives = [];
  }
}
