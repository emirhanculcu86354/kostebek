import { clamp } from '../core/math';
import type { EventBus } from '../core/EventBus';
import type { GameEvents, SuspicionTier } from '../game/GameEvents';
import type { GameStateData, RepStat, Reputation } from '../game/GameTypes';

export const REP_LABELS: Record<RepStat, string> = {
  mafia: 'Örgüt Güveni',
  police: 'Emniyet Güveni',
  suspicion: 'Şüphe',
  integrity: 'Vicdan',
};

export const TIER_LABELS: Record<SuspicionTier, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
  critical: 'Kritik',
};

export const SUSPICION_THRESHOLDS = { medium: 30, high: 60, critical: 85 } as const;

export function suspicionTier(value: number): SuspicionTier {
  if (value >= SUSPICION_THRESHOLDS.critical) return 'critical';
  if (value >= SUSPICION_THRESHOLDS.high) return 'high';
  if (value >= SUSPICION_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/**
 * Pure rule: compute a new stat value. Suspicion gains are scaled by the stealth multiplier;
 * reductions are never scaled so recovery stays predictable.
 */
export function computeRepChange(current: number, stat: RepStat, delta: number, suspicionGainMult = 1): number {
  let d = delta;
  if (stat === 'suspicion' && d > 0) d = Math.round(d * suspicionGainMult);
  return clamp(current + d, 0, 100);
}

/** Centralised trust/suspicion bookkeeping. Every change goes through here. */
export class ReputationSystem {
  constructor(
    private getState: () => GameStateData,
    private bus: EventBus<GameEvents>,
    private suspicionGainMult: () => number = () => 1,
  ) {}

  get values(): Reputation {
    return this.getState().reputation;
  }

  get(stat: RepStat): number {
    return this.values[stat];
  }

  get tier(): SuspicionTier {
    return suspicionTier(this.values.suspicion);
  }

  /** Returns the delta actually applied after clamping and modifiers. */
  change(stat: RepStat, delta: number, reason?: string): number {
    const rep = this.values;
    const before = rep[stat];
    const prevTier = suspicionTier(rep.suspicion);
    const after = computeRepChange(before, stat, delta, this.suspicionGainMult());
    rep[stat] = after;
    const applied = after - before;
    if (applied !== 0) {
      this.bus.emit('repChanged', { stat, delta: applied, value: after, reason });
      if (stat === 'suspicion') {
        const nextTier = suspicionTier(after);
        if (nextTier !== prevTier) this.bus.emit('suspicionTier', { from: prevTier, to: nextTier });
      }
    }
    return applied;
  }
}
