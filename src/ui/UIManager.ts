import { DialogueUI } from './DialogueUI';
import { el } from './dom';
import type { GameFacade } from './GameFacade';
import { HUD } from './HUD';
import { InventoryUI } from './InventoryUI';
import { MainMenu } from './MainMenu';
import { MissionJournalUI } from './MissionJournalUI';
import { MissionScreens } from './MissionScreens';
import { PauseMenu } from './PauseMenu';

/** Owns every DOM layer. Gameplay never touches DOM directly; it calls into these. */
export class UIManager {
  readonly root: HTMLElement;
  readonly hud: HUD;
  readonly menu: MainMenu;
  readonly story: MissionScreens;
  readonly dialogue: DialogueUI;
  readonly inventory: InventoryUI;
  readonly journal: MissionJournalUI;
  readonly pause: PauseMenu;
  private loading: HTMLElement;

  constructor(container: HTMLElement, game: GameFacade) {
    this.root = el('div', '');
    this.root.id = 'ui';
    container.appendChild(this.root);
    this.hud = new HUD(this.root, game);
    this.dialogue = new DialogueUI(this.root, game);
    this.inventory = new InventoryUI(this.root, game);
    this.journal = new MissionJournalUI(this.root, game);
    this.pause = new PauseMenu(this.root, game);
    this.story = new MissionScreens(this.root, game);
    this.menu = new MainMenu(this.root, game);
    this.loading = el('div', 'loading', '<div class="spinner"></div><span>Yükleniyor…</span>');
    this.root.appendChild(this.loading);
  }

  doneLoading(): void {
    this.loading.classList.add('out');
    setTimeout(() => this.loading.remove(), 600);
  }

  /** Hide every overlay except the HUD. */
  closeOverlays(): void {
    this.menu.hide();
    this.story.hide();
    this.dialogue.hide();
    this.inventory.hide();
    this.journal.hide();
    this.pause.hide();
  }
}
