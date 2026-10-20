import type { Settings } from '../game/GameTypes';
import { button, el } from './dom';
import type { GameFacade } from './GameFacade';

/** Settings form shared by the main menu and the pause menu. Changes apply immediately. */
export function renderSettings(game: GameFacade, onBack: () => void): HTMLElement {
  const s: Settings = { ...game.settings };
  const root = el('div', 'settings');
  root.appendChild(el('h2', '', 'Ayarlar'));

  const slider = (label: string, key: 'masterVolume' | 'musicVolume' | 'sfxVolume' | 'cameraZoom', min: number, max: number, stepV: number, fmt: (v: number) => string) => {
    const row = el('label', 'set-row');
    const val = el('span', 'set-val', fmt(s[key]));
    row.innerHTML = `<span class="set-label">${label}</span>`;
    const input = el('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(stepV);
    input.value = String(s[key]);
    input.addEventListener('input', () => {
      s[key] = Number(input.value);
      val.textContent = fmt(s[key]);
      game.applySettings({ ...s });
    });
    row.append(input, val);
    root.appendChild(row);
  };
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  slider('Ana ses', 'masterVolume', 0, 1, 0.05, pct);
  slider('Müzik ve ortam', 'musicVolume', 0, 1, 0.05, pct);
  slider('Efektler', 'sfxVolume', 0, 1, 0.05, pct);
  slider('Kamera uzaklığı', 'cameraZoom', 0.6, 1.5, 0.05, (v) => (v < 0.95 ? 'Yakın' : v > 1.05 ? 'Uzak' : 'Normal') + ` (${v.toFixed(2)})`);

  const q = el('div', 'set-row');
  q.innerHTML = '<span class="set-label">Grafik kalitesi</span>';
  const seg = el('div', 'segmented');
  const opts: [Settings['quality'], string][] = [
    ['low', 'Düşük'],
    ['medium', 'Orta'],
    ['high', 'Yüksek'],
  ];
  for (const [v, label] of opts) {
    const b = button(label, () => {
      s.quality = v;
      seg.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      b.classList.add('on');
      game.applySettings({ ...s });
    }, 'seg');
    if (s.quality === v) b.classList.add('on');
    seg.appendChild(b);
  }
  q.appendChild(seg);
  root.appendChild(q);

  const dn = el('label', 'set-row');
  dn.innerHTML = '<span class="set-label">Hasar sayıları</span>';
  const cb = el('input');
  cb.type = 'checkbox';
  cb.checked = s.showDamageNumbers;
  cb.addEventListener('change', () => {
    s.showDamageNumbers = cb.checked;
    game.applySettings({ ...s });
  });
  dn.appendChild(cb);
  root.appendChild(dn);

  root.appendChild(el('p', 'hint', 'Düşük kalite gölgeleri kapatır ve çözünürlüğü düşürür; mobil cihazlar için önerilir.'));
  root.appendChild(
    button('Geri', () => {
      game.uiSound('uiBack');
      onBack();
    }, 'btn ghost'),
  );
  return root;
}
