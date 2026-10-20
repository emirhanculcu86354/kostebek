import type { PlayerIntent } from './InputTypes';

interface Stick {
  zone: HTMLElement;
  base: HTMLElement;
  knob: HTMLElement;
  pointer: number | null;
  ox: number;
  oy: number;
  x: number;
  y: number;
}

const STICK_R = 56;

/** Pointer capture keeps a drag bound to its control; some browsers throw for synthetic pointers. */
function capture(el: HTMLElement, id: number): void {
  try {
    el.setPointerCapture(id);
  } catch {
    /* capture is an optimisation, not a requirement */
  }
}

/** Virtual twin-stick + action buttons with multitouch. All essential actions are reachable. */
export class TouchInput {
  readonly root: HTMLElement;
  private move: Stick;
  private aim: Stick;
  private held = new Set<string>();
  private pressed = new Set<string>();
  private buttons = new Map<string, HTMLElement>();
  active = false;
  lastUsed = 0;

  constructor(parent: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'touch-controls';
    this.root.innerHTML = `
      <div class="stick-zone left"><div class="stick-base"><div class="stick-knob"></div></div><span class="stick-hint">HAREKET</span></div>
      <div class="stick-zone right"><div class="stick-base aim"><div class="stick-knob"></div></div><span class="stick-hint">NİŞAN</span></div>
      <div class="touch-buttons">
        <button class="tbtn interact" data-act="interact" aria-label="Etkileşim">E<small>Etkileşim</small></button>
        <button class="tbtn fire" data-act="fire" aria-label="Ateş">✸<small>Saldır</small></button>
        <button class="tbtn dodge" data-act="dodge" aria-label="Kaç">⤳<small>Kaç</small></button>
        <button class="tbtn reload" data-act="reload" aria-label="Şarjör">↻<small>Şarjör</small></button>
        <button class="tbtn switch" data-act="switchWeapon" aria-label="Silah değiştir">⇄<small>Silah</small></button>
        <button class="tbtn heal" data-act="heal" aria-label="İlk yardım">✚<small>Tedavi</small></button>
        <button class="tbtn run" data-act="run" aria-label="Koş">»<small>Koş</small></button>
      </div>`;
    parent.appendChild(this.root);
    const mk = (sel: string): Stick => {
      const zone = this.root.querySelector<HTMLElement>(sel)!;
      return { zone, base: zone.querySelector('.stick-base')!, knob: zone.querySelector('.stick-knob')!, pointer: null, ox: 0, oy: 0, x: 0, y: 0 };
    };
    this.move = mk('.stick-zone.left');
    this.aim = mk('.stick-zone.right');
    this.bindStick(this.move, true);
    this.bindStick(this.aim, false);

    this.root.querySelectorAll<HTMLElement>('.tbtn').forEach((b) => {
      const act = b.dataset.act!;
      this.buttons.set(act, b);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        capture(b, e.pointerId);
        if (act === 'run') {
          // Run is a toggle on touch.
          if (this.held.has('run')) this.held.delete('run');
          else this.held.add('run');
          b.classList.toggle('on', this.held.has('run'));
        } else {
          this.held.add(act);
          this.pressed.add(act);
          b.classList.add('pressed');
        }
        this.lastUsed = performance.now();
      });
      const up = () => {
        if (act !== 'run') this.held.delete(act);
        b.classList.remove('pressed');
      };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
    // Prevent page scrolling / zooming while controlling the character.
    this.root.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('touchstart', () => this.setActive(true), { passive: true });
  }

  private bindStick(s: Stick, floating: boolean): void {
    s.zone.addEventListener('pointerdown', (e) => {
      if (s.pointer !== null) return;
      e.preventDefault();
      capture(s.zone, e.pointerId);
      s.pointer = e.pointerId;
      const r = s.zone.getBoundingClientRect();
      if (floating) {
        s.ox = e.clientX - r.left;
        s.oy = e.clientY - r.top;
      } else {
        const br = s.base.getBoundingClientRect();
        s.ox = br.left + br.width / 2 - r.left;
        s.oy = br.top + br.height / 2 - r.top;
      }
      s.base.style.left = `${s.ox}px`;
      s.base.style.top = `${s.oy}px`;
      s.zone.classList.add('engaged');
      this.updateStick(s, e.clientX - r.left, e.clientY - r.top);
      this.lastUsed = performance.now();
    });
    s.zone.addEventListener('pointermove', (e) => {
      if (s.pointer !== e.pointerId) return;
      const r = s.zone.getBoundingClientRect();
      this.updateStick(s, e.clientX - r.left, e.clientY - r.top);
    });
    const end = (e: PointerEvent) => {
      if (s.pointer !== e.pointerId) return;
      s.pointer = null;
      s.x = s.y = 0;
      s.knob.style.transform = 'translate(-50%, -50%)';
      s.zone.classList.remove('engaged');
      if (floating) {
        s.base.style.left = '';
        s.base.style.top = '';
      }
    };
    s.zone.addEventListener('pointerup', end);
    s.zone.addEventListener('pointercancel', end);
  }

  private updateStick(s: Stick, px: number, py: number): void {
    let dx = px - s.ox;
    let dy = py - s.oy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_R) {
      dx = (dx / len) * STICK_R;
      dy = (dy / len) * STICK_R;
    }
    s.x = dx / STICK_R;
    s.y = -dy / STICK_R;
    s.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  setActive(v: boolean): void {
    if (this.active === v) return;
    this.active = v;
    document.body.classList.toggle('touch-mode', v);
  }

  /** Show the interact button only when there is something to interact with. */
  setInteractAvailable(v: boolean, label = ''): void {
    const b = this.buttons.get('interact');
    if (!b) return;
    b.classList.toggle('available', v);
    const small = b.querySelector('small');
    if (small && label) small.textContent = label;
  }

  setWeaponMelee(melee: boolean): void {
    const b = this.buttons.get('fire');
    if (b) b.firstChild!.textContent = melee ? '✊' : '✸';
  }

  fill(intent: PlayerIntent): void {
    if (!this.active) {
      this.pressed.clear();
      return;
    }
    const m = this.move;
    const mag = Math.hypot(m.x, m.y);
    if (mag > 0.15) {
      const k = Math.min(1, (mag - 0.15) / 0.85) / mag;
      intent.moveX = m.x * k;
      intent.moveY = m.y * k;
      if (mag > 0.95 && this.held.has('run')) intent.run = true;
    }
    if (this.held.has('run') && mag > 0.15) intent.run = true;
    const a = this.aim;
    const amag = Math.hypot(a.x, a.y);
    if (a.pointer !== null && amag > 0.25) {
      intent.aim = true;
      intent.aimStick = { x: a.x / amag, y: a.y / amag };
      if (amag > 0.85) intent.fire = true;
    }
    if (this.held.has('fire')) {
      intent.fire = true;
      if (!intent.aimStick) intent.autoTarget = true;
    }
    const take = (k: string) => this.pressed.delete(k);
    if (take('fire')) intent.firePressed = true;
    intent.interact = intent.interact || take('interact');
    intent.dodge = intent.dodge || take('dodge');
    intent.reload = intent.reload || take('reload');
    intent.switchWeapon = intent.switchWeapon || take('switchWeapon');
    intent.heal = intent.heal || take('heal');
  }

  flush(): void {
    this.pressed.clear();
    this.held.delete('fire');
  }
}
