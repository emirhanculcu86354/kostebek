import type { EventBus } from '../core/EventBus';
import { EVIDENCE } from '../data/EvidenceData';
import type { GameEvents } from '../game/GameEvents';
import type { EvidenceAction, EvidenceStatus, GameStateData } from '../game/GameTypes';

export interface EvidenceResult {
  ok: boolean;
  reason?: 'unknown' | 'not_collected' | 'already_collected' | 'already_resolved';
  /** Police trust the caller should award (only for successful submissions). */
  policeReward: number;
}

/**
 * Pure transition table. "collected" and "kept" are the only states from which evidence can be
 * resolved, so every piece can be submitted or returned exactly once.
 */
export function evidenceTransition(current: EvidenceStatus, action: EvidenceAction): EvidenceStatus | null {
  switch (action) {
    case 'collect':
      return current === 'none' ? 'collected' : null;
    case 'keep':
      return current === 'collected' ? 'kept' : null;
    case 'submit':
    case 'return':
      if (current === 'collected' || current === 'kept') return action === 'submit' ? 'submitted' : 'returned';
      return null;
  }
}

export const STATUS_LABEL: Record<EvidenceStatus, string> = {
  none: 'Bulunmadı',
  collected: 'Elde',
  kept: 'Saklanıyor',
  submitted: 'Merkeze gönderildi',
  returned: 'Örgüte iade edildi',
};

export class EvidenceSystem {
  constructor(
    private getState: () => GameStateData,
    private bus: EventBus<GameEvents>,
  ) {}

  status(id: string): EvidenceStatus {
    return this.getState().evidence[id]?.status ?? 'none';
  }

  /** Evidence the player physically has and can still act on. */
  isHeld(id: string): boolean {
    const s = this.status(id);
    return s === 'collected' || s === 'kept';
  }

  apply(id: string, action: EvidenceAction): EvidenceResult {
    const def = EVIDENCE[id];
    if (!def) return { ok: false, reason: 'unknown', policeReward: 0 };
    const current = this.status(id);
    const next = evidenceTransition(current, action);
    if (!next) {
      const reason = action === 'collect' ? 'already_collected' : current === 'none' ? 'not_collected' : 'already_resolved';
      return { ok: false, reason, policeReward: 0 };
    }
    const state = this.getState();
    const rec = state.evidence[id] ?? { status: 'none' as EvidenceStatus };
    rec.status = next;
    if (action === 'collect') rec.mission = state.missions.active ?? def.mission;
    state.evidence[id] = rec;
    this.bus.emit('evidenceChanged', { id, status: next });
    const reward = action === 'submit' ? Math.round(def.policeValue * (0.6 + def.reliability * 0.4) + (rec.analyzed ? 2 : 0)) : 0;
    return { ok: true, policeReward: reward };
  }

  analyze(id: string): boolean {
    const rec = this.getState().evidence[id];
    if (!rec || rec.analyzed) return false;
    rec.analyzed = true;
    return true;
  }

  list(): { id: string; status: EvidenceStatus; analyzed: boolean }[] {
    const ev = this.getState().evidence;
    return Object.keys(EVIDENCE)
      .filter((id) => (ev[id]?.status ?? 'none') !== 'none')
      .map((id) => ({ id, status: ev[id].status, analyzed: !!ev[id].analyzed }));
  }
}
