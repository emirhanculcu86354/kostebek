import type { EventBus } from '../core/EventBus';
import { SKILL_BY_ID, type SkillModifier } from '../data/SkillData';
import type { GameEvents } from '../game/GameEvents';
import type { GameStateData } from '../game/GameTypes';

export const XP_PER_LEVEL = 150;

export class ProgressionSystem {
  constructor(
    private getState: () => GameStateData,
    private bus: EventBus<GameEvents>,
  ) {}

  private get prog() {
    return this.getState().progression;
  }

  hasSkill(id: string): boolean {
    return this.prog.skills.includes(id);
  }

  addXp(amount: number): void {
    if (amount <= 0) return;
    const p = this.prog;
    p.xp += amount;
    this.bus.emit('xpGained', { amount, total: p.xp });
    const targetLevel = 1 + Math.floor(p.xp / XP_PER_LEVEL);
    while (p.level < targetLevel) {
      p.level++;
      p.skillPoints++;
      this.bus.emit('levelUp', { level: p.level, skillPoints: p.skillPoints });
    }
  }

  canUnlock(id: string): { ok: boolean; reason?: string } {
    const def = SKILL_BY_ID[id];
    if (!def) return { ok: false, reason: 'Bilinmeyen beceri' };
    if (this.hasSkill(id)) return { ok: false, reason: 'Zaten açık' };
    if (def.requires && !this.hasSkill(def.requires)) {
      return { ok: false, reason: `Önce: ${SKILL_BY_ID[def.requires].name}` };
    }
    if (this.prog.skillPoints < def.cost) return { ok: false, reason: 'Yetersiz beceri puanı' };
    return { ok: true };
  }

  unlock(id: string): boolean {
    if (!this.canUnlock(id).ok) return false;
    this.prog.skillPoints -= SKILL_BY_ID[id].cost;
    this.prog.skills.push(id);
    this.bus.emit('skillUnlocked', { id });
    return true;
  }

  /** Multiplicative modifier from all unlocked skills (1 when none apply). */
  modifier(mod: SkillModifier): number {
    let m = 1;
    for (const id of this.prog.skills) {
      const v = SKILL_BY_ID[id]?.modifiers?.[mod];
      if (v !== undefined) m *= v;
    }
    return m;
  }

  xpIntoLevel(): { current: number; needed: number } {
    return { current: this.prog.xp % XP_PER_LEVEL, needed: XP_PER_LEVEL };
  }
}
