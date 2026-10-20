import { ITEMS, WEAPONS } from '../data/ItemData';
import { BRANCH_NAMES, SKILLS, type SkillBranch } from '../data/SkillData';
import type { RepStat } from '../game/GameTypes';
import { REP_LABELS, SUSPICION_THRESHOLDS, TIER_LABELS } from '../gameplay/ReputationSystem';
import { button, el, esc } from './dom';
import type { GameFacade } from './GameFacade';

type Tab = 'inventory' | 'skills' | 'reputation';

/** Character panel: inventory, skills and reputation. */
export class InventoryUI {
  readonly root: HTMLElement;
  private tab: Tab = 'inventory';
  private selected = 0;

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
    head.appendChild(el('h2', '', 'Karakter'));
    const tabs = el('div', 'tabs');
    const tabDefs: [Tab, string][] = [
      ['inventory', 'Envanter'],
      ['skills', 'Beceriler'],
      ['reputation', 'İtibar'],
    ];
    for (const [t, label] of tabDefs) {
      const b = button(label, () => {
        g.uiSound('ui');
        this.tab = t;
        this.render();
      }, `tab${this.tab === t ? ' on' : ''}`);
      tabs.appendChild(b);
    }
    head.appendChild(tabs);
    head.appendChild(button('✕', () => g.closePanel(), 'close'));
    card.appendChild(head);
    const body = el('div', 'panel-body');
    if (this.tab === 'inventory') this.renderInventory(body);
    else if (this.tab === 'skills') this.renderSkills(body);
    else this.renderReputation(body);
    card.appendChild(body);
    this.root.appendChild(card);
  }

  private renderInventory(body: HTMLElement): void {
    const g = this.game;
    const st = g.session.state;
    const inv = st.inventory;
    const wrap = el('div', 'inv-wrap');
    const gridBox = el('div', 'inv-left');
    const eq = WEAPONS[st.player.equipped] ?? WEAPONS.fists;
    gridBox.appendChild(
      el(
        'div',
        'equip-row',
        `<div class="equip"><span>Kuşanılan silah</span><b>${esc(eq.name)}</b>${eq.kind === 'firearm' ? `<small>Şarjör ${st.player.magazines[eq.id] ?? 0}/${eq.magazine}</small>` : ''}</div>
         <div class="equip"><span>Ekipman</span><b>${g.session.inventory.has('camera') ? 'Mini Kamera' : '—'}</b></div>
         <div class="equip"><span>Kapasite</span><b>${inv.slots.length}/${inv.capacity}</b></div>`,
      ),
    );
    const grid = el('div', 'inv-grid');
    for (let i = 0; i < inv.capacity; i++) {
      const s = inv.slots[i];
      const cell = el('button', `slot${s ? '' : ' empty'}${i === this.selected && s ? ' sel' : ''}`);
      cell.type = 'button';
      if (s) {
        const def = ITEMS[s.item];
        cell.innerHTML = `<span class="ico">${def?.icon ?? '?'}</span><span class="nm">${esc(def?.name ?? s.item)}</span>${s.count > 1 ? `<span class="ct">${s.count}</span>` : ''}${def?.missionItem ? '<span class="mi">GÖREV</span>' : ''}`;
        cell.addEventListener('click', () => {
          this.selected = i;
          g.uiSound('ui');
          this.render();
        });
      }
      grid.appendChild(cell);
    }
    gridBox.appendChild(grid);
    wrap.appendChild(gridBox);

    const det = el('div', 'inv-detail');
    const sel = inv.slots[this.selected];
    if (sel) {
      const def = ITEMS[sel.item];
      det.innerHTML = `<div class="big-ico">${def?.icon ?? '?'}</div><h3>${esc(def?.name ?? sel.item)}</h3><p>${esc(def?.description ?? '')}</p><p class="muted">Adet: ${sel.count}</p>`;
      const actions = el('div', 'btn-col');
      if (def?.category === 'weapon') {
        const equipped = st.player.equipped === def.weapon;
        const b = button(equipped ? 'Kuşanıldı' : 'Kuşan', () => g.equipItem(this.selected), 'btn primary');
        b.disabled = equipped;
        actions.appendChild(b);
      }
      if (def?.category === 'medical' || def?.use) {
        const label = def.use?.label ?? 'Kullan';
        const ok = def.use ? g.session.check(def.use.requires) : true;
        const b = button(label, () => g.useItem(this.selected), 'btn primary');
        if (!ok) {
          b.disabled = true;
          actions.appendChild(el('p', 'muted', esc(def.use?.requiresText ?? '')));
        }
        actions.appendChild(b);
      }
      if (!def?.missionItem) actions.appendChild(button('Bırak', () => g.dropItem(this.selected), 'btn ghost'));
      else actions.appendChild(el('p', 'muted', 'Görev eşyası bırakılamaz.'));
      det.appendChild(actions);
    } else det.innerHTML = '<p class="muted">Bir eşya seç.</p>';
    wrap.appendChild(det);
    body.appendChild(wrap);
  }

  private renderSkills(body: HTMLElement): void {
    const g = this.game;
    const p = g.session.state.progression;
    const xp = g.session.progression.xpIntoLevel();
    body.appendChild(
      el(
        'div',
        'skill-head',
        `<div><span>Seviye</span><b>${p.level}</b></div><div class="xp"><span>Tecrübe ${xp.current}/${xp.needed}</span><div class="bar"><i style="width:${(xp.current / xp.needed) * 100}%"></i></div></div><div><span>Beceri puanı</span><b class="${p.skillPoints ? 'accent' : ''}">${p.skillPoints}</b></div>`,
      ),
    );
    const cols = el('div', 'skill-cols');
    for (const branch of ['combat', 'stealth', 'investigation'] as SkillBranch[]) {
      const col = el('div', `skill-col ${branch}`);
      col.appendChild(el('h3', '', BRANCH_NAMES[branch]));
      for (const s of SKILLS.filter((x) => x.branch === branch)) {
        const owned = g.session.progression.hasSkill(s.id);
        const can = g.session.progression.canUnlock(s.id);
        const card = el('div', `skill${owned ? ' owned' : ''}`);
        card.innerHTML = `<b>${esc(s.name)}</b><p>${esc(s.description)}</p>`;
        if (owned) card.appendChild(el('span', 'owned-tag', '✓ Açık'));
        else {
          const b = button(can.ok ? 'Aç (1 puan)' : esc(can.reason ?? ''), () => g.unlockSkill(s.id), 'btn small' + (can.ok ? ' primary' : ''));
          b.disabled = !can.ok;
          card.appendChild(b);
        }
        col.appendChild(card);
      }
      cols.appendChild(col);
    }
    body.appendChild(cols);
  }

  private renderReputation(body: HTMLElement): void {
    const g = this.game;
    const r = g.session.state.reputation;
    const tier = g.session.reputation.tier;
    const bar = (stat: RepStat, desc: string) => {
      const v = r[stat];
      const ticks =
        stat === 'suspicion'
          ? `<i class="tick" style="left:${SUSPICION_THRESHOLDS.medium}%"></i><i class="tick" style="left:${SUSPICION_THRESHOLDS.high}%"></i><i class="tick crit" style="left:${SUSPICION_THRESHOLDS.critical}%"></i>`
          : '';
      return `<div class="rep ${stat}"><div class="rep-top"><b>${REP_LABELS[stat]}</b><span>${v}</span></div><div class="rep-bar"><i style="width:${v}%"></i>${ticks}</div><p>${desc}</p></div>`;
    };
    const tierText: Record<string, string> = {
      low: 'Kimse seni özellikle izlemiyor.',
      medium: 'Gözler üzerinde. Yasak yerlerde daha çabuk fark edilirsin, bazı konuşmalar temkinli geçer.',
      high: 'Selim seni izletiyor. Hata payın çok az; muhafızlar seni hemen fark eder.',
      critical: 'Kimliğin yanmak üzere. Bir hata daha her şeyi bitirebilir.',
    };
    body.innerHTML = `
      <div class="rep-grid">
        ${bar('mafia', 'Karaca ailesinin sahte kimliğine duyduğu güven. Yüksek güven daha büyük işlere kapı açar.')}
        ${bar('police', 'Merkezin performansına ve dürüstlüğüne güveni. Kanıt göndermek artırır, sivillere zarar vermek düşürür.')}
        ${bar('suspicion', `Örgütün senden şüphelenme düzeyi: <b class="tier-${tier}">${TIER_LABELS[tier]}</b>. ${tierText[tier]}`)}
        ${bar('integrity', 'Vicdanın: masumları korudukça yükselir, örgüt adına zarar verdikçe düşer.')}
      </div>`;
  }
}
