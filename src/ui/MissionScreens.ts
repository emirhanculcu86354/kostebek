import { EVIDENCE } from '../data/EvidenceData';
import { ITEMS } from '../data/ItemData';
import type { Ending } from '../game/Ending';
import type { RepStat } from '../game/GameTypes';
import type { DecisionOption } from '../gameplay/LedgerDecision';
import { REP_LABELS } from '../gameplay/ReputationSystem';
import type { MissionOutcome } from '../missions/MissionManager';
import type { MissionDef } from '../missions/MissionTypes';
import { button, deltaClass, el, esc, signed } from './dom';
import type { GameFacade } from './GameFacade';

/** Briefing, result, ending and the evidence-decision modal. */
export class MissionScreens {
  readonly root: HTMLElement;

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'screen story hidden');
    parent.appendChild(this.root);
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private open(cls: string): HTMLElement {
    this.root.innerHTML = '';
    this.root.className = `screen story ${cls}`;
    const card = el('div', 'story-card');
    this.root.appendChild(card);
    return card;
  }

  briefing(m: MissionDef): void {
    const card = this.open('briefing');
    card.innerHTML = `
      <div class="eyebrow">GÖREV ${m.index} / 5</div>
      <h1>${esc(m.title)}</h1>
      <div class="loc-line">${esc(m.location)}</div>
      <p class="brief">${esc(m.briefing)}</p>`;
    const row = el('div', 'btn-row');
    row.appendChild(
      button('Göreve Başla', () => {
        this.game.uiSound('ui');
        this.game.startBriefedMission();
      }, 'btn primary big'),
    );
    row.appendChild(button('Ana Menü', () => this.game.toMainMenu(), 'btn ghost'));
    card.appendChild(row);
  }

  result(o: MissionOutcome, isFinale: boolean): void {
    const card = this.open(o.success ? 'result success' : 'result failure');
    const r = o.result;
    const stats: RepStat[] = ['mafia', 'police', 'suspicion', 'integrity'];
    const rep = stats
      .map((s) => `<div class="rep-delta ${deltaClass(r.repDelta[s], s === 'suspicion')}"><span>${REP_LABELS[s]}</span><b>${signed(r.repDelta[s])}</b></div>`)
      .join('');
    const ev = r.evidence.length ? r.evidence.map((id) => `<li>${esc(EVIDENCE[id]?.name ?? id)}</li>`).join('') : '<li class="muted">Bu görevde kanıt toplanmadı.</li>';
    const next = o.success ? (o.nextMission ? `Sıradaki: <b>Görev ${o.nextMission.index} — ${esc(o.nextMission.title)}</b>` : isFinale ? 'Operasyonun sonu.' : '') : esc(o.reason ?? '');
    card.innerHTML = `
      <div class="eyebrow">GÖREV ${o.mission.index} — ${esc(o.mission.title)}</div>
      <h1>${o.success ? 'GÖREV TAMAMLANDI' : 'GÖREV BAŞARISIZ'}</h1>
      ${o.success ? '' : `<p class="fail-reason">${esc(o.reason ?? '')}</p>`}
      <div class="result-grid">
        <section><h3>İtibar değişimi</h3>${rep}</section>
        <section><h3>Toplanan kanıtlar</h3><ul class="ev-list">${ev}</ul>
          <h3>Ödüller</h3><p>${o.success ? `+${r.xp} TP${o.mission.rewards.items?.length ? ' · ' + o.mission.rewards.items.map((i) => `${i.count}× ${esc(ITEMS[i.item]?.name ?? i.item)}`).join(', ') : ''}` : '—'}</p>
        </section>
      </div>
      <p class="next-line">${o.success ? next : ''}</p>`;
    const row = el('div', 'btn-row');
    if (o.success) {
      row.appendChild(
        button(isFinale ? 'Sonu Gör' : o.nextMission ? 'Devam' : 'Ana Menü', () => {
          this.game.uiSound('ui');
          this.game.continueAfterResult();
        }, 'btn primary big'),
      );
    } else {
      row.appendChild(
        button('Tekrar Dene', () => {
          this.game.uiSound('ui');
          this.game.restartMission();
        }, 'btn primary big'),
      );
      row.appendChild(button('Ana Menü', () => this.game.toMainMenu(), 'btn ghost'));
    }
    card.appendChild(row);
  }

  ending(e: Ending, stats: { submitted: number; mafia: number; police: number; integrity: number }): void {
    const card = this.open('ending');
    card.innerHTML = `
      <div class="eyebrow">OPERASYON SONUCU</div>
      <h1>${esc(e.title)}</h1>
      <p class="brief">${esc(e.text)}</p>
      <div class="ending-stats">
        <div><span>Merkeze ulaşan kanıt</span><b>${stats.submitted}</b></div>
        <div><span>Örgüt güveni</span><b>${stats.mafia}</b></div>
        <div><span>Emniyet güveni</span><b>${stats.police}</b></div>
        <div><span>Vicdan</span><b>${stats.integrity}</b></div>
      </div>
      <p class="hint">Farklı seçimlerle farklı sonlara ulaşabilirsin.</p>`;
    const row = el('div', 'btn-row');
    row.appendChild(button('Ana Menü', () => this.game.toMainMenu(), 'btn primary big'));
    card.appendChild(row);
  }

  decision(title: string, intro: string, options: DecisionOption[], check: (o: DecisionOption) => boolean): void {
    const card = this.open('decision');
    card.innerHTML = `<div class="eyebrow">KARAR</div><h1>${esc(title)}</h1><p class="brief">${esc(intro)}</p>`;
    const list = el('div', 'decision-list');
    for (const o of options) {
      const ok = check(o);
      const b = button(
        `<b>${esc(o.title)}</b><span>${esc(o.description)}</span>${ok ? '' : `<em>🔒 ${esc(o.lockedLabel ?? 'Kilitli')}</em>`}`,
        () => {
          if (!ok) return;
          this.game.uiSound('ui');
          this.game.decide(o.id);
        },
        `decision-opt${ok ? '' : ' locked'}`,
      );
      b.disabled = !ok;
      list.appendChild(b);
    }
    card.appendChild(list);
  }
}
