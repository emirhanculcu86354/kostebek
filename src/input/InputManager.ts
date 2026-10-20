import { emptyIntent, type PlayerIntent } from './InputTypes';
import { KeyboardInput } from './KeyboardInput';
import { TouchInput } from './TouchInput';

/** Merges all local devices into one PlayerIntent per frame. */
export class InputManager {
  readonly keyboard: KeyboardInput;
  readonly touch: TouchInput;
  private intent: PlayerIntent = emptyIntent();
  /** Dev/automation analog stick (screen space). Null in normal play. */
  debugMove: { x: number; y: number } | null = null;

  constructor(canvas: HTMLCanvasElement, uiRoot: HTMLElement) {
    this.keyboard = new KeyboardInput(canvas);
    this.touch = new TouchInput(uiRoot);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    if (coarse) this.touch.setActive(true);
  }

  poll(): PlayerIntent {
    const i = emptyIntent();
    this.keyboard.fill(i);
    this.touch.fill(i);
    if (this.debugMove) {
      i.moveX = this.debugMove.x;
      i.moveY = this.debugMove.y;
    }
    // Hide touch UI if the player clearly switched to keyboard/mouse.
    if (this.touch.active && this.keyboard.lastUsed > this.touch.lastUsed + 4000 && i.aimScreen) this.touch.setActive(false);
    this.intent = i;
    return i;
  }

  get last(): PlayerIntent {
    return this.intent;
  }

  flush(): void {
    this.keyboard.flush();
    this.touch.flush();
  }
}
