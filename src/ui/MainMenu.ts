import { button, el, esc } from './dom';
import type { GameFacade } from './GameFacade';
import { renderSettings } from './SettingsUI';

/** Title screen with New Game / Continue / Settings / Credits. */
export class MainMenu {
  readonly root: HTMLElement;
  private confirmNew = false;

  constructor(
    parent: HTMLElement,
    private game: GameFacade,
  ) {
    this.root = el('div', 'screen main-menu hidden');
    parent.appendChild(this.root);
  }

  show(): void {
    this.confirmNew = false;
    this.root.classList.remove('hidden');
    this.renderMain();
  }

  hide(): void {
    this.root.classList.add('hidden');
  }

  private renderMain(): void {
    const g = this.game;
    const info = g.saveInfo();
    this.root.innerHTML = '';
    const box = el('div', 'menu-box');
    box.innerHTML = `
      <div class="logo">
        <div class="logo-top">KÖSTEBEK</div>
        <div class="logo-sub">KARANLIK KİMLİK</div>
        <div class="logo-line"></div>
        <p class="tagline">Gizli kimlikle girdiğin örgütten kendin olarak çıkabilecek misin?</p>
      </div>`;
    const list = el('div', 'menu-list');
    if (info) {
      const cont = button(`Devam Et<small>${esc(info.label)} · ${new Date(info.savedAt).toLocaleString('tr-TR')}</small>`, () => {
        g.uiSound('ui');
        g.continueGame();
      }, 'btn primary big');
      list.appendChild(cont);
    }
    const ng = button(this.confirmNew ? 'Emin misin? Kayıt silinecek' : 'Yeni Oyun', () => {
      g.uiSound('ui');
      if (info && !this.confirmNew) {
        this.confirmNew = true;
        this.renderMain();
        return;
      }
      g.newGame();
    }, `btn big ${info ? '' : 'primary'} ${this.confirmNew ? 'danger' : ''}`);
    list.appendChild(ng);
    list.appendChild(
      button('Ayarlar', () => {
        g.uiSound('ui');
        this.renderSettings();
      }, 'btn big'),
    );
    list.appendChild(
      button('Yapımcılar', () => {
        g.uiSound('ui');
        this.renderCredits();
      }, 'btn big'),
    );
    box.appendChild(list);
    box.appendChild(el('div', 'controls-hint', '<b>Masaüstü:</b> WASD hareket · Fare nişan · Sol tık ateş · Sağ tık hassas nişan · E etkileşim · R şarjör · Boşluk kaçış · Q silah · Tab karakter · J günlük · Esc duraklat<br><b>Mobil:</b> Sol çubuk hareket · Sağ çubuk nişan/ateş · Ekrandaki düğmeler'));
    this.root.appendChild(box);
  }

  private renderSettings(): void {
    this.root.innerHTML = '';
    const box = el('div', 'menu-box narrow');
    box.appendChild(renderSettings(this.game, () => this.renderMain()));
    this.root.appendChild(box);
  }

  private renderCredits(): void {
    this.root.innerHTML = '';
    const box = el('div', 'menu-box narrow credits');
    box.innerHTML = `
      <h2>Yapımcılar</h2>
      <p><b>KÖSTEBEK: KARANLIK KİMLİK</b> — oynanabilir prototip.</p>
      <p>Oyun tasarımı, kod, diyalog ve prosedürel varlıklar bu proje için üretildi.</p>
      <p>Grafik motoru: <b>Three.js</b> (MIT). Derleme: <b>Vite</b>, <b>TypeScript</b>.</p>
      <p>Tüm 3B modeller, dokular ve sesler çalışma anında kodla üretilir; harici telifli içerik kullanılmamıştır. Ayrıntılar için <code>docs/ASSETS.md</code>.</p>
      <p class="hint">Bu bir kurgu eseridir. Kişi, kurum ve olaylar hayal ürünüdür.</p>`;
    box.appendChild(
      button('Geri', () => {
        this.game.uiSound('uiBack');
        this.renderMain();
      }, 'btn ghost'),
    );
    this.root.appendChild(box);
  }
}
