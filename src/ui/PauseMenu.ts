import { button, el, esc } from './dom';
import type { GameFacade } from './GameFacade';
import { renderSettings } from './SettingsUI';

export class PauseMenu {
  readonly root: HTMLElement;
  private confirm: 'restart' | 'menu' | null = null;
  private message = '';

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'screen pause hidden');
    parent.appendChild(this.root);
  }

  show(): void {
    this.confirm = null;
    this.message = '';
    this.root.classList.remove('hidden');
    this.render();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  get visible(): boolean {
    return !this.root.classList.contains('hidden');
  }

  setMessage(m: string): void {
    this.message = m;
    if (this.visible) this.render();
  }

  private render(): void {
    const g = this.game;
    this.root.innerHTML = '';
    const box = el('div', 'menu-box narrow');
    box.appendChild(el('h2', '', 'Duraklatıldı'));
    const m = g.missions.active;
    if (m) box.appendChild(el('p', 'muted', `Görev ${m.index}: ${esc(m.title)}`));
    const list = el('div', 'menu-list');
    list.appendChild(
      button('Devam Et', () => {
        g.uiSound('ui');
        g.resume();
      }, 'btn primary big'),
    );
    const can = g.canSave();
    const save = button(`Kaydet${can.ok ? '' : `<small>${esc(can.reason ?? '')}</small>`}`, () => {
      g.uiSound('ui');
      g.saveGame();
    }, 'btn big');
    save.disabled = !can.ok;
    list.appendChild(save);
    list.appendChild(
      button('Ayarlar', () => {
        g.uiSound('ui');
        this.root.innerHTML = '';
        const b = el('div', 'menu-box narrow');
        b.appendChild(renderSettings(g, () => this.render()));
        this.root.appendChild(b);
      }, 'btn big'),
    );
    list.appendChild(
      button(this.confirm === 'restart' ? 'Emin misin? Görev baştan başlar' : 'Görevi Yeniden Başlat', () => {
        if (this.confirm !== 'restart') {
          this.confirm = 'restart';
          this.render();
          return;
        }
        g.restartMission();
      }, `btn big${this.confirm === 'restart' ? ' danger' : ''}`),
    );
    list.appendChild(
      button(this.confirm === 'menu' ? 'Emin misin? Kaydedilmemiş ilerleme kaybolur' : 'Ana Menüye Dön', () => {
        if (this.confirm !== 'menu') {
          this.confirm = 'menu';
          this.render();
          return;
        }
        g.toMainMenu();
      }, `btn big ghost${this.confirm === 'menu' ? ' danger' : ''}`),
    );
    box.appendChild(list);
    if (this.message) box.appendChild(el('p', 'save-msg', esc(this.message)));
    this.root.appendChild(box);
  }
}
