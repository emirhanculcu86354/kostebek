import './styles/main.css';
import { Game } from './game/Game';

function boot(): void {
  const container = document.getElementById('app');
  if (!container) throw new Error('#app missing');
  try {
    const game = new Game(container);
    game.start();
    // Dev-only automation hooks; gameplay never reads these and production builds omit them.
    if (import.meta.env.DEV) {
      (window as unknown as { __kostebek?: Game }).__kostebek = game;
      void import('./debug/DevHarness').then((m) => m.installDevHarness(game));
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<div class="fatal"><h1>KÖSTEBEK</h1><p>Oyun başlatılamadı. Tarayıcınız WebGL desteklemiyor olabilir.</p><pre>${String(err)}</pre></div>`;
  }
}

boot();
