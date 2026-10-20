import * as THREE from 'three';
import { WEAPONS } from '../data/ItemData';
import { PlayerState } from '../entities/Player';
import { TIER_LABELS } from '../gameplay/ReputationSystem';
import type { CameraController } from '../rendering/CameraController';
import { button, el, esc } from './dom';
import type { GameFacade } from './GameFacade';

interface Floater {
  el: HTMLElement;
  pos: THREE.Vector3;
  life: number;
  max: number;
  rise: number;
}

/** In-game heads-up display. Text updates are throttled; markers/floaters update per frame. */
export class HUD {
  readonly root: HTMLElement;
  private hpFill: HTMLElement;
  private hpNum: HTMLElement;
  private hpBar: HTMLElement;
  private sus: HTMLElement;
  private loc: HTMLElement;
  private missionTitle: HTMLElement;
  private objList: HTMLElement;
  private weaponName: HTMLElement;
  private mag: HTMLElement;
  private res: HTMLElement;
  private reloadFill: HTMLElement;
  private reloadBar: HTMLElement;
  private prompt: HTMLElement;
  private toasts: HTMLElement;
  private vignette: HTMLElement;
  private alertEdge: HTMLElement;
  private marker: HTMLElement;
  private markerDist: HTMLElement;
  private progress: HTMLElement;
  private progressFill: HTMLElement;
  private floatersRoot: HTMLElement;
  private floaters: Floater[] = [];
  private textTimer = 0;
  private lastObjKey = '';
  private hurtT = 0;
  private screenPos = { x: 0, y: 0, visible: true };

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'hud hidden');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div class="hud-tl panel-lite">
        <div class="hp"><span class="lbl">SAĞLIK</span><div class="hp-bar"><div class="hp-fill"></div></div><span class="hp-num">100</span></div>
        <div class="status-row"><span class="sus"><i class="eye"></i><b></b></span><span class="loc"></span></div>
      </div>
      <div class="hud-tr panel-lite">
        <div class="mission-title"></div>
        <ul class="objectives"></ul>
      </div>
      <div class="hud-topbtns"></div>
      <div class="hud-br panel-lite">
        <div class="weapon-name"></div>
        <div class="ammo"><b class="mag">0</b><span class="sep">/</span><span class="res">0</span></div>
        <div class="reload-bar"><div></div></div>
        <div class="keyhints">R şarjör · Q silah · H tedavi</div>
      </div>
      <div class="prompt"></div>
      <div class="interact-progress"><div></div></div>
      <div class="toasts"></div>
      <div class="vignette"></div>
      <div class="alert-edge"></div>
      <div class="obj-marker"><span class="pin"></span><span class="dist"></span></div>
      <div class="floaters"></div>`;
    parent.appendChild(this.root);
    const q = <T extends HTMLElement>(s: string) => this.root.querySelector<T>(s)!;
    this.hpFill = q('.hp-fill');
    this.hpNum = q('.hp-num');
    this.hpBar = q('.hp-bar');
    this.sus = q('.sus');
    this.loc = q('.loc');
    this.missionTitle = q('.mission-title');
    this.objList = q('.objectives');
    this.weaponName = q('.weapon-name');
    this.mag = q('.mag');
    this.res = q('.res');
    this.reloadBar = q('.reload-bar');
    this.reloadFill = q('.reload-bar div');
    this.prompt = q('.prompt');
    this.toasts = q('.toasts');
    this.vignette = q('.vignette');
    this.alertEdge = q('.alert-edge');
    this.marker = q('.obj-marker');
    this.markerDist = q('.obj-marker .dist');
    this.progress = q('.interact-progress');
    this.progressFill = q('.interact-progress div');
    this.floatersRoot = q('.floaters');

    const top = q('.hud-topbtns');
    top.append(
      button('<span class="ico">☰</span><span class="txt">Menü</span>', () => game.openPause(), 'hbtn'),
      button('<span class="ico">▤</span><span class="txt">Karakter</span><kbd>Tab</kbd>', () => game.openPanel('inventory'), 'hbtn'),
      button('<span class="ico">✎</span><span class="txt">Günlük</span><kbd>J</kbd>', () => game.openPanel('journal'), 'hbtn'),
    );
  }

  show(v: boolean): void {
    this.root.classList.toggle('hidden', !v);
    document.body.classList.toggle('hud-on', v);
  }

  setPrompt(text: string | null, key = 'E'): void {
    if (!text) {
      this.prompt.classList.remove('on');
      return;
    }
    const html = `<kbd>${key}</kbd> ${esc(text)}`;
    if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
    this.prompt.classList.add('on');
  }

  setInteractProgress(k: number | null): void {
    if (k === null) {
      this.progress.classList.remove('on');
      return;
    }
    this.progress.classList.add('on');
    this.progressFill.style.width = `${Math.round(k * 100)}%`;
  }

  toast(text: string, tone: 'info' | 'good' | 'bad' = 'info'): void {
    const t = el('div', `toast ${tone}`, esc(text));
    this.toasts.prepend(t);
    while (this.toasts.children.length > 5) this.toasts.lastElementChild!.remove();
    setTimeout(() => t.classList.add('out'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  hurt(amount: number): void {
    this.hurtT = Math.min(1, this.hurtT + amount / 30);
  }

  floater(pos: THREE.Vector3, text: string, cls: string, life = 0.9, rise = 1.2): void {
    if (this.floaters.length > 24) {
      const old = this.floaters.shift()!;
      old.el.remove();
    }
    const e = el('div', `floater ${cls}`, esc(text));
    this.floatersRoot.appendChild(e);
    this.floaters.push({ el: e, pos: pos.clone(), life, max: life, rise });
  }

  update(dt: number, camera: CameraController, alertActive: boolean, markerWorld: THREE.Vector3 | null, area: string): void {
    const g = this.game;
    const s = g.session.state;
    const w = innerWidth;
    const h = innerHeight;
    const player = g.controller.player;

    // Per-frame: vignette, floaters, marker, reload.
    this.hurtT = Math.max(0, this.hurtT - dt * 1.2);
    const lowHp = player.health / player.maxHealth < 0.3 && player.alive;
    this.vignette.style.opacity = String(Math.min(1, this.hurtT + (lowHp ? 0.35 + Math.sin(performance.now() / 300) * 0.1 : 0)));
    this.alertEdge.classList.toggle('on', alertActive);

    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.el.remove();
        this.floaters.splice(i, 1);
        continue;
      }
      const k = 1 - f.life / f.max;
      const p = f.pos.clone();
      p.y += k * f.rise;
      camera.worldToScreen(p, w, h, this.screenPos);
      f.el.style.transform = `translate(${this.screenPos.x}px, ${this.screenPos.y}px) translate(-50%, -50%)`;
      f.el.style.opacity = String(Math.min(1, f.life / (f.max * 0.4)));
    }

    if (markerWorld) {
      camera.worldToScreen(markerWorld, w, h, this.screenPos);
      const margin = 46;
      let x = this.screenPos.x;
      let y = this.screenPos.y;
      const off = x < margin || x > w - margin || y < margin + 70 || y > h - margin;
      x = Math.min(w - margin, Math.max(margin, x));
      y = Math.min(h - margin, Math.max(margin + 70, y));
      this.marker.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      this.marker.classList.add('on');
      this.marker.classList.toggle('offscreen', off);
      const d = Math.round(Math.hypot(markerWorld.x - player.pos.x, markerWorld.z - player.pos.z));
      this.markerDist.textContent = d > 2 ? `${d} m` : '';
    } else this.marker.classList.remove('on');

    const reloading = player.state === PlayerState.Reloading;
    this.reloadBar.classList.toggle('on', reloading);
    if (reloading) this.reloadFill.style.width = `${Math.round((1 - player.reloadTimer / Math.max(0.01, player.reloadDuration)) * 100)}%`;

    // Throttled text.
    this.textTimer -= dt;
    if (this.textTimer > 0) return;
    this.textTimer = 0.12;

    const hp = Math.max(0, Math.round(player.health));
    this.hpFill.style.width = `${(hp / player.maxHealth) * 100}%`;
    this.hpNum.textContent = String(hp);
    this.hpBar.classList.toggle('low', hp < 30);

    const tier = g.session.reputation.tier;
    this.sus.className = `sus tier-${tier}`;
    this.sus.querySelector('b')!.textContent = `Şüphe: ${TIER_LABELS[tier]}`;
    this.loc.textContent = area;

    const wpn = WEAPONS[player.weapon] ?? WEAPONS.fists;
    this.weaponName.textContent = wpn.name;
    if (wpn.kind === 'firearm') {
      this.mag.textContent = String(s.player.magazines[wpn.id] ?? 0);
      this.res.textContent = String(g.controller.reserve(wpn));
      this.root.classList.remove('melee');
      this.mag.classList.toggle('empty', (s.player.magazines[wpn.id] ?? 0) === 0);
    } else {
      this.mag.textContent = '—';
      this.res.textContent = '—';
      this.root.classList.add('melee');
    }

    const m = g.missions.active;
    const objs = g.missions.objectives().filter((o) => o.status !== 'hidden');
    const key = (m?.id ?? '') + objs.map((o) => o.def.id + o.status + o.text).join('|');
    if (key !== this.lastObjKey) {
      this.lastObjKey = key;
      this.missionTitle.innerHTML = m ? `<span class="idx">GÖREV ${m.index}</span> ${esc(m.title)}` : '';
      // Show active first, then the last few completed.
      const active = objs.filter((o) => o.status === 'active');
      const done = objs.filter((o) => o.status !== 'active').slice(-2);
      this.objList.innerHTML = [...done, ...active]
        .map(
          (o) =>
            `<li class="${o.status}${o.def.optional ? ' optional' : ''}"><i></i><span>${esc(o.text)}${o.def.optional ? ' <em>(isteğe bağlı)</em>' : ''}</span></li>`,
        )
        .join('');
    }
  }

  clearTransient(): void {
    for (const f of this.floaters) f.el.remove();
    this.floaters = [];
    this.toasts.innerHTML = '';
    this.setPrompt(null);
    this.setInteractProgress(null);
    this.hurtT = 0;
    this.lastObjKey = '';
  }
}
