import * as THREE from 'three';

/** Procedural canvas textures so the game looks intentional without external files. */

type Painter = (g: CanvasRenderingContext2D, s: number) => void;

function rand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function noise(g: CanvasRenderingContext2D, s: number, amount: number, seed: number, light = 255) {
  const r = rand(seed);
  const img = g.getImageData(0, 0, s, s);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.min(light, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(light, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(light, Math.max(0, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
}

function blotches(g: CanvasRenderingContext2D, s: number, count: number, color: string, seed: number, maxR = 40) {
  const r = rand(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * s;
    const y = r() * s;
    const rad = 4 + r() * maxR;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
}

const painters: Record<string, Painter> = {
  asphalt(g, s) {
    g.fillStyle = '#2a2e33';
    g.fillRect(0, 0, s, s);
    noise(g, s, 34, 1);
    blotches(g, s, 18, 'rgba(10,12,14,0.35)', 2, 60);
    blotches(g, s, 6, 'rgba(120,130,140,0.06)', 3, 50);
  },
  sidewalk(g, s) {
    g.fillStyle = '#4a4e53';
    g.fillRect(0, 0, s, s);
    noise(g, s, 22, 4);
    g.strokeStyle = 'rgba(20,22,25,0.55)';
    g.lineWidth = 3;
    const n = 4;
    for (let i = 0; i <= n; i++) {
      g.beginPath();
      g.moveTo((i * s) / n, 0);
      g.lineTo((i * s) / n, s);
      g.moveTo(0, (i * s) / n);
      g.lineTo(s, (i * s) / n);
      g.stroke();
    }
    blotches(g, s, 8, 'rgba(0,0,0,0.18)', 5, 30);
  },
  parking(g, s) {
    painters.asphalt(g, s);
    g.fillStyle = 'rgba(220,215,200,0.55)';
    g.fillRect(0, 0, 6, s);
    g.fillRect(s / 2 - 3, 0, 6, s * 0.45);
  },
  brick(g, s) {
    g.fillStyle = '#3a2a26';
    g.fillRect(0, 0, s, s);
    const r = rand(7);
    const bh = s / 16;
    const bw = s / 6;
    for (let row = 0; row < 16; row++) {
      const off = row % 2 ? bw / 2 : 0;
      for (let col = -1; col < 7; col++) {
        const v = 70 + r() * 40;
        g.fillStyle = `rgb(${v + 30},${v * 0.55},${v * 0.45})`;
        g.fillRect(col * bw + off + 2, row * bh + 2, bw - 4, bh - 4);
      }
    }
    noise(g, s, 20, 8);
    blotches(g, s, 10, 'rgba(0,0,0,0.25)', 9, 50);
  },
  brickDark(g, s) {
    painters.brick(g, s);
    g.fillStyle = 'rgba(12,14,20,0.55)';
    g.fillRect(0, 0, s, s);
  },
  plaster(g, s) {
    g.fillStyle = '#6c6a64';
    g.fillRect(0, 0, s, s);
    noise(g, s, 16, 10);
    blotches(g, s, 14, 'rgba(40,36,30,0.18)', 11, 70);
  },
  concrete(g, s) {
    g.fillStyle = '#585c60';
    g.fillRect(0, 0, s, s);
    noise(g, s, 26, 12);
    blotches(g, s, 16, 'rgba(20,22,24,0.25)', 13, 60);
    g.strokeStyle = 'rgba(25,27,30,0.5)';
    g.lineWidth = 2;
    g.strokeRect(1, 1, s - 2, s / 2 - 2);
    g.strokeRect(1, s / 2, s - 2, s / 2 - 2);
  },
  concreteFloor(g, s) {
    g.fillStyle = '#4b4f53';
    g.fillRect(0, 0, s, s);
    noise(g, s, 20, 14);
    blotches(g, s, 12, 'rgba(15,15,15,0.3)', 15, 70);
    g.strokeStyle = 'rgba(20,20,20,0.45)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, s, s);
    g.fillStyle = 'rgba(217,154,66,0.35)';
    g.fillRect(0, s * 0.9, s, 6);
  },
  woodFloor(g, s) {
    const r = rand(16);
    const pw = s / 8;
    for (let i = 0; i < 8; i++) {
      const v = 70 + r() * 30;
      g.fillStyle = `rgb(${v + 25},${v * 0.7},${v * 0.45})`;
      g.fillRect(i * pw, 0, pw, s);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(i * pw, 0, 2, s);
      g.fillRect(i * pw, r() * s, pw, 2);
    }
    noise(g, s, 18, 17);
  },
  clubFloor(g, s) {
    const n = 8;
    const t = s / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = (i + j) % 2 ? '#1b1d22' : '#24262c';
        g.fillRect(i * t, j * t, t, t);
      }
    noise(g, s, 14, 18);
  },
  tiles(g, s) {
    g.fillStyle = '#3c3f43';
    g.fillRect(0, 0, s, s);
    noise(g, s, 26, 19);
    g.strokeStyle = 'rgba(15,16,18,0.6)';
    g.lineWidth = 2;
    for (let i = 0; i <= 2; i++) {
      g.beginPath();
      g.moveTo((i * s) / 2, 0);
      g.lineTo((i * s) / 2, s);
      g.moveTo(0, (i * s) / 2);
      g.lineTo(s, (i * s) / 2);
      g.stroke();
    }
    blotches(g, s, 10, 'rgba(0,0,0,0.3)', 20, 40);
  },
  carpet(g, s) {
    g.fillStyle = '#3a2f33';
    g.fillRect(0, 0, s, s);
    noise(g, s, 30, 21);
  },
  metal(g, s) {
    g.fillStyle = '#5a6068';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < s; i += 16) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(i, 0, 4, s);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(i + 5, 0, 3, s);
    }
    noise(g, s, 14, 22);
  },
  wood(g, s) {
    g.fillStyle = '#6b4a2e';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(30,18,8,0.6)';
    g.lineWidth = 3;
    for (let i = 0; i <= 4; i++) {
      g.beginPath();
      g.moveTo(0, (i * s) / 4);
      g.lineTo(s, (i * s) / 4);
      g.stroke();
    }
    g.strokeRect(2, 2, s - 4, s - 4);
    noise(g, s, 22, 23);
  },
  facade(g, s) {
    g.fillStyle = '#22262c';
    g.fillRect(0, 0, s, s);
    noise(g, s, 14, 24);
    const r = rand(25);
    for (let x = 0; x < 4; x++)
      for (let y = 0; y < 2; y++) {
        const lit = r() > 0.72;
        g.fillStyle = lit ? 'rgba(230,170,90,0.75)' : 'rgba(40,52,66,0.9)';
        g.fillRect(x * (s / 4) + 14, y * (s / 2) + 22, s / 4 - 28, s / 2 - 50);
      }
  },
  clubWall(g, s) {
    g.fillStyle = '#2a1e22';
    g.fillRect(0, 0, s, s);
    noise(g, s, 12, 26);
    g.fillStyle = 'rgba(201,74,74,0.18)';
    g.fillRect(0, s * 0.62, s, 5);
  },
};

const cache = new Map<string, THREE.CanvasTexture>();

export function getTexture(name: string, repeatX = 1, repeatY = 1, size = 256): THREE.Texture {
  const key = `${name}|${repeatX}|${repeatY}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let base = cache.get(`${name}|base`);
  if (!base) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const g = canvas.getContext('2d')!;
    (painters[name] ?? painters.concrete)(g, size);
    base = new THREE.CanvasTexture(canvas);
    base.colorSpace = THREE.SRGBColorSpace;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    base.anisotropy = 4;
    cache.set(`${name}|base`, base);
  }
  const tex = base.clone();
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  cache.set(key, tex as THREE.CanvasTexture);
  return tex;
}

/** Text texture for signs and labels. */
export function textTexture(text: string, color: string, width = 512, height = 128, font = '700 72px "Barlow Condensed", "Arial Narrow", sans-serif'): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d')!;
  g.fillStyle = 'rgba(16,19,24,0.92)';
  g.fillRect(0, 0, width, height);
  g.strokeStyle = color;
  g.globalAlpha = 0.5;
  g.lineWidth = 4;
  g.strokeRect(6, 6, width - 12, height - 12);
  g.globalAlpha = 1;
  g.font = font;
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = color;
  g.shadowBlur = 12;
  g.fillText(text, width / 2, height / 2 + 4, width - 40);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Icon sprite texture: "!" or "?" etc. */
export function iconTexture(symbol: string, color: string): THREE.CanvasTexture {
  const s = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const g = canvas.getContext('2d')!;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  g.fillStyle = 'rgba(16,19,24,0.85)';
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = color;
  g.stroke();
  g.fillStyle = color;
  g.font = '700 40px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(symbol, s / 2, s / 2 + 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
