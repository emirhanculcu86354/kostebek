import { EVIDENCE, KIND_LABEL } from '../data/EvidenceData';
import { STATUS_LABEL } from '../gameplay/EvidenceSystem';
import { MISSIONS, MISSION_ORDER } from '../missions/MissionData';
import { button, el, esc, signed } from './dom';
import type { GameFacade } from './GameFacade';

type Tab = 'mission' | 'evidence' | 'done';

/** Mission journal: active objectives, evidence board, completed missions. */
export class MissionJournalUI {
  readonly root: HTMLElement;
  private tab: Tab = 'mission';
  private selectedEv: string | null = null;

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'panel-screen hidden');
    parent.appendChild(this.root);
  }

  show(tab?: Tab): void {
    if (tab) this.tab = tab;
    this.root.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  render(): void {
    const g = this.game;
    this.root.innerHTML = '';
    const card = el('div', 'panel-card');
    const head = el('div', 'panel-head');
    head.appendChild(el('h2', '', 'Günlük'));
    const tabs = el('div', 'tabs');
    const defs: [Tab, string][] = [
      ['mission', 'Aktif Görev'],
      ['evidence', `Kanıtlar (${g.session.evidence.list().length})`],
      ['done', 'Tamamlananlar'],
    ];
    for (const [t, label] of defs)
      tabs.appendChild(
        button(label, () => {
          g.uiSound('ui');
          this.tab = t;
          this.render();
        }, `tab${this.tab === t ? ' on' : ''}`),
      );
    head.appendChild(tabs);
    head.appendChild(button('✕', () => g.closePanel(), 'close'));
    card.appendChild(head);
    const body = el('div', 'panel-body');
    if (this.tab === 'mission') this.renderMission(body);
    else if (this.tab === 'evidence') this.renderEvidence(body);
    else this.renderDone(body);
    card.appendChild(body);
    this.root.appendChild(card);
  }

  private renderMission(body: HTMLElement): void {
    const m = this.game.missions.active;
    if (!m) {
      body.innerHTML = '<p class="muted">Aktif görev yok.</p>';
      return;
    }
    const objs = this.game.missions.objectives().filter((o) => o.status !== 'hidden');
    body.innerHTML = `
      <div class="journal-mission">
        <div class="eyebrow">GÖREV ${m.index} · ${esc(m.location)}</div>
        <h3>${esc(m.title)}</h3>
        <p>${esc(m.briefing)}</p>
        <ul class="objectives big">${objs
          .map((o) => `<li class="${o.status}${o.def.optional ? ' optional' : ''}"><i></i><span>${esc(o.text)}${o.def.optional ? ' <em>(isteğe bağlı)</em>' : ''}${o.status === 'failed' ? ' <em class="bad">— başarısız</em>' : ''}</span></li>`)
          .join('')}</ul>
      </div>`;
  }

  private renderEvidence(body: HTMLElement): void {
    const g = this.game;
    const list = g.session.evidence.list();
    if (!list.length) {
      body.innerHTML = '<p class="muted">Henüz kanıt toplamadın. Belgeler, kayıtlar ve tanıklar haritada amber halkayla işaretlenir.</p>';
      return;
    }
    if (!this.selectedEv || !list.some((e) => e.id === this.selectedEv)) this.selectedEv = list[0].id;
    const wrap = el('div', 'ev-wrap');
    const ul = el('div', 'ev-items');
    for (const e of list) {
      const def = EVIDENCE[e.id];
      const b = button(
        `<b>${esc(def.name)}</b><span>${KIND_LABEL[def.kind]} · <i class="st-${e.status}">${STATUS_LABEL[e.status]}</i></span>`,
        () => {
          this.selectedEv = e.id;
          g.uiSound('ui');
          this.render();
        },
        `ev-item${this.selectedEv === e.id ? ' sel' : ''}`,
      );
      ul.appendChild(b);
    }
    wrap.appendChild(ul);
    const id = this.selectedEv!;
    const def = EVIDENCE[id];
    const rec = g.session.state.evidence[id];
    const canAnalyze = g.session.progression.hasSkill('inv_eye');
    const det = el('div', 'ev-detail');
    det.innerHTML = `
      <div class="eyebrow">${KIND_LABEL[def.kind]} · Görev ${def.mission.replace('m', '')}</div>
      <h3>${esc(def.name)}</h3>
      <p>${esc(def.description)}</p>
      ${rec.analyzed ? `<div class="analysis"><b>Analiz:</b> ${esc(def.analysis)}</div>` : ''}
      <p class="muted">İlgili: ${def.related.map(esc).join(', ')}</p>
      <div class="reliab"><span>Güvenilirlik</span><div class="bar"><i style="width:${def.reliability * 100}%"></i></div></div>
      <p class="muted">Durum: <b class="st-${rec.status}">${STATUS_LABEL[rec.status]}</b></p>`;
    const actions = el('div', 'btn-row');
    if (g.session.evidence.isHeld(id)) {
      actions.appendChild(button('Merkeze gönder', () => g.submitEvidence(id), 'btn primary'));
    }
    if (!rec.analyzed) {
      const b = button(canAnalyze ? 'Analiz et' : 'Analiz et (Göz Hafızası gerekli)', () => g.analyzeEvidence(id), 'btn');
      b.disabled = !canAnalyze;
      actions.appendChild(b);
    }
    det.appendChild(actions);
    if (g.session.evidence.isHeld(id)) det.appendChild(el('p', 'hint', 'Gönderilen kanıt Emniyet güvenini artırır. Her kanıt yalnızca bir kez gönderilebilir.'));
    wrap.appendChild(det);
    body.appendChild(wrap);
  }

  private renderDone(body: HTMLElement): void {
    const ms = this.game.session.state.missions;
    const rows = MISSION_ORDER.filter((id) => ms.completed.includes(id))
      .map((id) => {
        const m = MISSIONS[id];
        const r = ms.results[id];
        return `<div class="done-row"><b>${m.index}. ${esc(m.title)}</b><span>Örgüt ${signed(r?.repDelta.mafia ?? 0)} · Emniyet ${signed(r?.repDelta.police ?? 0)} · Şüphe ${signed(r?.repDelta.suspicion ?? 0)} · ${r?.evidence.length ?? 0} kanıt</span></div>`;
      })
      .join('');
    body.innerHTML = rows || '<p class="muted">Henüz tamamlanmış görev yok.</p>';
  }
}
