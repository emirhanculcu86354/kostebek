import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { evidenceTransition } from '../src/gameplay/EvidenceSystem';
import { LEDGER_DECISION } from '../src/gameplay/LedgerDecision';

describe('Evidence rules', () => {
  it('only allows resolving held evidence once', () => {
    expect(evidenceTransition('none', 'submit')).toBeNull();
    expect(evidenceTransition('collected', 'submit')).toBe('submitted');
    expect(evidenceTransition('kept', 'return')).toBe('returned');
    expect(evidenceTransition('submitted', 'submit')).toBeNull();
    expect(evidenceTransition('returned', 'submit')).toBeNull();
    expect(evidenceTransition('collected', 'collect')).toBeNull();
  });

  it('awards police trust exactly once per submission', () => {
    const s = new GameSession();
    s.apply([{ type: 'evidence', id: 'ev_phone_records', action: 'collect' }]);
    const before = s.state.reputation.police;
    s.apply([{ type: 'evidence', id: 'ev_phone_records', action: 'submit' }]);
    const afterFirst = s.state.reputation.police;
    expect(afterFirst).toBeGreaterThan(before);
    s.apply([{ type: 'evidence', id: 'ev_phone_records', action: 'submit' }]);
    expect(s.state.reputation.police).toBe(afterFirst);
    expect(s.evidence.status('ev_phone_records')).toBe('submitted');
  });

  it('cannot submit uncollected evidence', () => {
    const s = new GameSession();
    const r = s.evidence.apply('ev_footage', 'submit');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('not_collected');
  });

  it('ledger decision: copy option is locked without the skill', () => {
    const s = new GameSession();
    const copy = LEDGER_DECISION.find((o) => o.id === 'copy')!;
    s.inventory.add('camera');
    expect(s.check(copy.conditions)).toBe(false);
    s.state.progression.skills.push('inv_eye');
    expect(s.check(copy.conditions)).toBe(true);
  });

  it('ledger decision: submit sends the original and raises suspicion', () => {
    const s = new GameSession();
    s.apply([
      { type: 'evidence', id: 'ev_ledger', action: 'collect' },
      { type: 'giveItem', item: 'ledger' },
    ]);
    s.apply(LEDGER_DECISION.find((o) => o.id === 'submit')!.effects);
    expect(s.evidence.status('ev_ledger')).toBe('submitted');
    expect(s.inventory.has('ledger')).toBe(false);
    expect(s.state.reputation.suspicion).toBeGreaterThan(5);
    expect(s.flag('m.ledger_decided')).toBe(true);
  });

  it('kept evidence can still be submitted later, once', () => {
    const s = new GameSession();
    s.apply([{ type: 'evidence', id: 'ev_ledger', action: 'collect' }]);
    s.apply(LEDGER_DECISION.find((o) => o.id === 'keep')!.effects);
    expect(s.evidence.isHeld('ev_ledger')).toBe(true);
    expect(s.evidence.apply('ev_ledger', 'submit').ok).toBe(true);
    expect(s.evidence.apply('ev_ledger', 'submit').ok).toBe(false);
  });
});
