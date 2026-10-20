import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/game/GameSession';
import { STARTING_REPUTATION } from '../src/game/GameState';
import { computeRepChange, suspicionTier } from '../src/gameplay/ReputationSystem';

describe('ReputationSystem', () => {
  it('starts with the design values', () => {
    const s = new GameSession();
    expect(s.state.reputation).toEqual(STARTING_REPUTATION);
  });

  it('clamps to 0..100', () => {
    expect(computeRepChange(95, 'mafia', 20)).toBe(100);
    expect(computeRepChange(3, 'police', -10)).toBe(0);
  });

  it('scales only suspicion gains by the stealth multiplier', () => {
    expect(computeRepChange(10, 'suspicion', 10, 0.7)).toBe(17);
    expect(computeRepChange(10, 'suspicion', -5, 0.7)).toBe(5);
    expect(computeRepChange(10, 'mafia', 10, 0.7)).toBe(20);
  });

  it('maps suspicion to tiers at the documented thresholds', () => {
    expect(suspicionTier(0)).toBe('low');
    expect(suspicionTier(29)).toBe('low');
    expect(suspicionTier(30)).toBe('medium');
    expect(suspicionTier(60)).toBe('high');
    expect(suspicionTier(84)).toBe('high');
    expect(suspicionTier(85)).toBe('critical');
  });

  it('emits tier changes and applies the Soğukkanlılık skill', () => {
    const s = new GameSession();
    const tiers: string[] = [];
    s.bus.on('suspicionTier', (e) => tiers.push(e.to));
    s.state.progression.skills.push('stealth_calm');
    const applied = s.reputation.change('suspicion', 40);
    expect(applied).toBe(28);
    expect(s.state.reputation.suspicion).toBe(33);
    expect(tiers).toEqual(['medium']);
  });

  it('applies dialogue/mission effects through the session', () => {
    const s = new GameSession();
    s.apply([
      { type: 'rep', stat: 'mafia', delta: 5 },
      { type: 'rep', stat: 'police', delta: -15 },
      { type: 'flag', flag: 'story.test' },
    ]);
    expect(s.state.reputation.mafia).toBe(20);
    expect(s.state.reputation.police).toBe(55);
    expect(s.check({ flag: 'story.test' })).toBe(true);
    expect(s.check({ stat: 'police', max: 60 })).toBe(true);
  });
});
