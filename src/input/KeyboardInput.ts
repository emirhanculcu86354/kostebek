import type { PlayerIntent } from './InputTypes';

/** Keyboard + mouse. Collects held keys and edge-triggered presses between frames. */
export class KeyboardInput {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouse = { x: 0, y: 0, inside: false };
  private lmb = false;
  private rmb = false;
  private lmbPressed = false;
  private wheel = 0;
  lastUsed = 0;
  private disposers: (() => void)[] = [];

  constructor(canvas: HTMLCanvasElement) {
    const on = <K extends keyof WindowEventMap>(t: EventTarget, type: K | string, fn: (e: any) => void, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.disposers.push(() => t.removeEventListener(type, fn, opts));
    };
    on(window, 'keydown', (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Tab' || e.code === 'Space') e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      this.lastUsed = performance.now();
    });
    on(window, 'keyup', (e: KeyboardEvent) => this.down.delete(e.code));
    on(window, 'blur', () => {
      this.down.clear();
      this.lmb = this.rmb = false;
    });
    on(canvas, 'mousemove', (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.inside = true;
      this.lastUsed = performance.now();
    });
    on(canvas, 'mouseleave', () => (this.mouse.inside = false));
    on(canvas, 'mousedown', (e: MouseEvent) => {
      if (e.button === 0) {
        this.lmb = true;
        this.lmbPressed = true;
      }
      if (e.button === 2) this.rmb = true;
      this.lastUsed = performance.now();
    });
    on(window, 'mouseup', (e: MouseEvent) => {
      if (e.button === 0) this.lmb = false;
      if (e.button === 2) this.rmb = false;
    });
    on(canvas, 'contextmenu', (e: Event) => e.preventDefault());
    on(
      canvas,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.wheel += Math.sign(e.deltaY) * 0.08;
      },
      { passive: false },
    );
  }

  private take(code: string): boolean {
    return this.pressed.delete(code);
  }

  fill(intent: PlayerIntent): void {
    const d = this.down;
    let mx = 0;
    let my = 0;
    if (d.has('KeyW') || d.has('ArrowUp')) my += 1;
    if (d.has('KeyS') || d.has('ArrowDown')) my -= 1;
    if (d.has('KeyD') || d.has('ArrowRight')) mx += 1;
    if (d.has('KeyA') || d.has('ArrowLeft')) mx -= 1;
    if (mx || my) {
      // Normalise diagonals so they are not faster.
      const len = Math.hypot(mx, my);
      intent.moveX = mx / len;
      intent.moveY = my / len;
    }
    intent.run = intent.run || d.has('ShiftLeft') || d.has('ShiftRight');
    intent.aim = intent.aim || this.rmb;
    if (this.mouse.inside) intent.aimScreen = { x: this.mouse.x, y: this.mouse.y };
    intent.fire = intent.fire || this.lmb;
    intent.firePressed = intent.firePressed || this.lmbPressed;
    intent.interact = intent.interact || this.take('KeyE');
    intent.reload = intent.reload || this.take('KeyR');
    intent.dodge = intent.dodge || this.take('Space');
    intent.switchWeapon = intent.switchWeapon || this.take('KeyQ');
    intent.heal = intent.heal || this.take('KeyH');
    intent.inventory = intent.inventory || this.take('Tab') || this.take('KeyI');
    intent.journal = intent.journal || this.take('KeyJ');
    intent.pause = intent.pause || this.take('Escape') || this.take('KeyP');
    intent.zoomDelta += this.wheel;
    this.wheel = 0;
    this.lmbPressed = false;
  }

  /** Drop pending presses (e.g. when a menu opens) so they don't leak into gameplay. */
  flush(): void {
    this.pressed.clear();
    this.lmbPressed = false;
    this.lmb = false;
    this.rmb = false;
  }

  /** UI-level shortcuts while menus are open. */
  consume(code: string): boolean {
    return this.take(code);
  }

  dispose(): void {
    this.disposers.forEach((f) => f());
  }
}
