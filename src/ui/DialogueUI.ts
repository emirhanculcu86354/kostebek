import { SPEAKERS } from '../dialogue/DialogueData';
import { el, esc } from './dom';
import type { GameFacade } from './GameFacade';

/** Bottom dialogue box: speaker, typed text, numbered choices (keys 1-9 or tap). */
export class DialogueUI {
  readonly root: HTMLElement;
  private speaker: HTMLElement;
  private role: HTMLElement;
  private text: HTMLElement;
  private choices: HTMLElement;
  private feedback: HTMLElement;
  private typing = 0;
  private full = '';
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'dialogue hidden');
    this.root.innerHTML = `
      <div class="dlg-card">
        <div class="dlg-head"><span class="dlg-speaker"></span><span class="dlg-role"></span></div>
        <p class="dlg-text"></p>
        <div class="dlg-feedback"></div>
        <div class="dlg-choices"></div>
      </div>`;
    parent.appendChild(this.root);
    this.speaker = this.root.querySelector('.dlg-speaker')!;
    this.role = this.root.querySelector('.dlg-role')!;
    this.text = this.root.querySelector('.dlg-text')!;
    this.choices = this.root.querySelector('.dlg-choices')!;
    this.feedback = this.root.querySelector('.dlg-feedback')!;
    this.text.addEventListener('click', () => this.skipTyping());
    this.keyHandler = (e) => {
      if (this.root.classList.contains('hidden')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 9) {
        const btn = this.choices.querySelectorAll<HTMLButtonElement>('button:not([disabled])')[n - 1];
        btn?.click();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (this.typing < this.full.length) this.skipTyping();
        else {
          const btns = this.choices.querySelectorAll<HTMLButtonElement>('button:not([disabled])');
          if (btns.length === 1) btns[0].click();
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', this.keyHandler);
  }

  show(): void {
    this.root.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.feedback.innerHTML = '';
  }

  /** Brief reputation feedback ("Örgüt Güveni +5") shown under the text. */
  pushFeedback(html: string): void {
    const f = el('span', 'fb', html);
    this.feedback.appendChild(f);
    setTimeout(() => f.remove(), 3500);
  }

  render(): void {
    const node = this.game.dialogue.current;
    if (!node) return;
    const sp = SPEAKERS[node.speaker] ?? SPEAKERS.scene;
    this.root.classList.toggle('narration', node.speaker === 'scene');
    this.speaker.textContent = sp.name;
    this.speaker.style.color = sp.color;
    this.role.textContent = sp.role;
    this.full = node.text;
    this.typing = 0;
    this.text.textContent = '';
    this.choices.innerHTML = '';
    this.choices.classList.add('pending');
    const list = this.game.dialogue.choices();
    list.forEach((c, i) => {
      const b = el('button', `dlg-choice${c.locked ? ' locked' : ''}`);
      b.type = 'button';
      b.innerHTML = `<span class="num">${i + 1}</span>${c.tag ? `<span class="tag">${esc(c.tag)}</span> ` : ''}${esc(c.text)}${c.locked ? `<em> — ${esc(c.lockedLabel ?? '')}</em>` : ''}`;
      if (c.locked) b.disabled = true;
      b.addEventListener('click', () => {
        if (this.typing < this.full.length) {
          this.skipTyping();
          return;
        }
        this.game.uiSound('ui');
        this.game.chooseDialogue(c.index);
      });
      this.choices.appendChild(b);
    });
  }

  private skipTyping(): void {
    this.typing = this.full.length;
    this.text.textContent = this.full;
    this.choices.classList.remove('pending');
  }

  update(dt: number): void {
    if (this.root.classList.contains('hidden') || this.typing >= this.full.length) return;
    this.typing = Math.min(this.full.length, this.typing + dt * 70);
    this.text.textContent = this.full.slice(0, Math.floor(this.typing));
    if (this.typing >= this.full.length) this.choices.classList.remove('pending');
  }
}
