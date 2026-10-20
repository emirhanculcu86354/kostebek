import * as THREE from 'three';
import { boxGeo, cachedGeo, colorMat, texturedMat, worldBoxGeo } from '../rendering/Materials';
import type { PropDef, PropKind } from './DistrictMap';

/** Default footprint (w, d, h) per prop kind. */
export const PROP_SIZE: Record<PropKind, [number, number, number]> = {
  crate: [1, 1, 1],
  crateStack: [2, 2, 2],
  container: [6, 2.6, 2.7],
  shelf: [4, 1, 2.6],
  desk: [2, 1, 0.8],
  barCounter: [1, 6, 1.1],
  barShelf: [0.6, 6, 2.3],
  stool: [0.5, 0.5, 0.8],
  roundTable: [1.3, 1.3, 0.8],
  longTable: [4, 1.6, 0.8],
  sofa: [3, 0.9, 0.9],
  armchair: [1, 1, 0.9],
  cabinet: [0.8, 2, 2],
  safe: [1, 1, 1.2],
  dumpster: [1.3, 2.4, 1.4],
  car: [1.9, 4.2, 1.45],
  van: [2.2, 5.2, 2.2],
  lamp: [0.3, 0.3, 5],
  bench: [1.8, 0.6, 0.9],
  busStop: [3.2, 1, 2.4],
  kiosk: [2.2, 2.2, 2.4],
  barrier: [2, 0.4, 1],
  djBooth: [3, 1, 1.2],
  board: [4, 0.2, 2.2],
  plant: [0.6, 0.6, 1.2],
  pallet: [1.2, 1, 0.15],
  forklift: [1.4, 2.4, 1.6],
  bin: [0.6, 0.6, 0.9],
  speaker: [0.7, 0.7, 1.8],
};

const NO_COLLIDE: PropKind[] = ['stool', 'pallet'];

export function propFootprint(p: PropDef): { w: number; d: number; h: number; collide: boolean } {
  const [dw, dd, dh] = PROP_SIZE[p.kind];
  let w = p.w ?? dw;
  let d = p.d ?? dd;
  const h = p.h ?? dh;
  // Car/van/sofa sizes are authored along their local axes; rotate footprint for quarter turns.
  if (p.rot && Math.abs(Math.sin(p.rot)) > 0.7 && (p.kind === 'car' || p.kind === 'van' || p.kind === 'sofa' || p.kind === 'armchair' || p.kind === 'bench')) {
    [w, d] = [d, w];
  }
  return { w, d, h, collide: p.collide ?? !NO_COLLIDE.includes(p.kind) };
}

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, cast = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

const cyl = (rt: number, rb: number, h: number, seg = 12) => cachedGeo(`cyl|${rt}|${rb}|${h}|${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));

export function buildProp(p: PropDef): THREE.Object3D {
  const g = new THREE.Group();
  const [dw, dd, dh] = PROP_SIZE[p.kind];
  // Authored (unrotated) dimensions.
  const w = p.w ?? dw;
  const d = p.d ?? dd;
  const h = p.h ?? dh;
  const wood = texturedMat('wood', 1, 1, 0.85);
  const darkWood = colorMat(0x3a2618, 0.6);
  const metalDark = colorMat(0x2c3138, 0.5, 0.6);

  switch (p.kind) {
    case 'crate':
      g.add(mesh(worldBoxGeo(w, h, d, 1.2), wood, 0, h / 2, 0));
      break;
    case 'crateStack': {
      g.add(mesh(worldBoxGeo(w, h * 0.55, d, 1.2), wood, 0, h * 0.275, 0));
      const top = mesh(worldBoxGeo(w * 0.7, h * 0.45, d * 0.75, 1.2), wood, w * 0.08, h * 0.55 + h * 0.225, -d * 0.05);
      top.rotation.y = 0.12;
      g.add(top);
      break;
    }
    case 'container': {
      const col = p.color ?? 0x2f5d7c;
      g.add(mesh(worldBoxGeo(w, h, d, 2), texturedMat('metal', 1, 1, 0.6, col, 0.3), 0, h / 2, 0));
      g.add(mesh(boxGeo(0.08, h * 0.95, d * 0.96), colorMat(0x1c2b36, 0.5, 0.4), w / 2 + 0.02, h / 2, 0));
      break;
    }
    case 'shelf': {
      for (const sx of [-w / 2 + 0.05, w / 2 - 0.05])
        for (const sz of [-d / 2 + 0.05, d / 2 - 0.05]) g.add(mesh(boxGeo(0.08, h, 0.08), metalDark, sx, h / 2, sz));
      for (let i = 0; i < 3; i++) {
        const y = 0.3 + i * (h / 3);
        g.add(mesh(boxGeo(w, 0.06, d), colorMat(0x5a5048, 0.8), 0, y, 0));
        for (let k = 0; k < 3; k++) g.add(mesh(boxGeo(0.7, 0.5, d * 0.7), wood, -w / 2 + 0.7 + k * (w / 3), y + 0.28, 0));
      }
      break;
    }
    case 'desk': {
      g.add(mesh(boxGeo(w, 0.07, d), darkWood, 0, 0.76, 0));
      for (const sx of [-w / 2 + 0.08, w / 2 - 0.08])
        for (const sz of [-d / 2 + 0.08, d / 2 - 0.08]) g.add(mesh(boxGeo(0.06, 0.74, 0.06), metalDark, sx, 0.37, sz));
      g.add(mesh(boxGeo(0.5, 0.35, d * 0.8), darkWood, w / 2 - 0.3, 0.55, 0));
      break;
    }
    case 'barCounter': {
      g.add(mesh(worldBoxGeo(w, h, d, 1.5), colorMat(0x2a1b14, 0.55), 0, h / 2, 0));
      g.add(mesh(boxGeo(w + 0.2, 0.06, d + 0.1), colorMat(0x6b4a2e, 0.35, 0.1), 0, h + 0.03, 0));
      g.add(mesh(boxGeo(0.04, 0.06, d), colorMat(0xd99a42, 0.4, 0, 0xd99a42, 0.8), w / 2 + 0.06, 0.15, 0, false));
      break;
    }
    case 'barShelf': {
      g.add(mesh(boxGeo(w, h, d), colorMat(0x1b1310, 0.7), 0, h / 2, 0));
      const cols = [0xd99a42, 0x4f7a4a, 0x8a3030, 0xc9c4b8];
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 9; i++) {
          const c = cols[(i + row) % cols.length];
          g.add(mesh(cyl(0.06, 0.07, 0.32, 6), colorMat(c, 0.2, 0.1, c, 0.35), w / 2 + 0.05, 0.9 + row * 0.5, -d / 2 + 0.4 + i * (d / 9.5), false));
        }
      break;
    }
    case 'stool':
      g.add(mesh(cyl(0.22, 0.22, 0.08), colorMat(0x6a1e1e, 0.5), 0, 0.78, 0));
      g.add(mesh(cyl(0.04, 0.04, 0.76, 6), metalDark, 0, 0.38, 0));
      break;
    case 'roundTable': {
      g.add(mesh(cyl(0.6, 0.6, 0.05, 18), darkWood, 0, 0.76, 0));
      g.add(mesh(cyl(0.06, 0.25, 0.74, 8), metalDark, 0, 0.37, 0));
      for (const a of [0.6, 0.6 + Math.PI]) {
        const ch = new THREE.Group();
        ch.add(mesh(boxGeo(0.45, 0.06, 0.45), colorMat(0x3d2a20, 0.7), 0, 0.46, 0));
        ch.add(mesh(boxGeo(0.45, 0.5, 0.06), colorMat(0x3d2a20, 0.7), 0, 0.72, 0.2));
        ch.position.set(Math.sin(a) * 0.85, 0, Math.cos(a) * 0.85);
        ch.rotation.y = a;
        g.add(ch);
      }
      break;
    }
    case 'longTable':
      g.add(mesh(boxGeo(w, 0.08, d), colorMat(0x24160e, 0.35, 0.05), 0, 0.76, 0));
      g.add(mesh(boxGeo(w * 0.8, 0.7, d * 0.4), colorMat(0x1a100a, 0.6), 0, 0.37, 0));
      // Glasses and an ashtray: life at the back table.
      for (let i = 0; i < 4; i++) g.add(mesh(cyl(0.05, 0.04, 0.14, 8), colorMat(0xd9c49a, 0.1, 0, 0x3a2a10, 0.4), -w / 2 + 0.6 + i * 0.9, 0.87, (i % 2) * 0.3 - 0.15, false));
      break;
    case 'sofa': {
      const leather = colorMat(0x4a1f22, 0.55);
      g.add(mesh(boxGeo(w, 0.45, d), leather, 0, 0.25, 0));
      g.add(mesh(boxGeo(w, 0.55, 0.22), leather, 0, 0.7, d / 2 - 0.11));
      g.add(mesh(boxGeo(0.22, 0.35, d), leather, -w / 2 + 0.11, 0.6, 0));
      g.add(mesh(boxGeo(0.22, 0.35, d), leather, w / 2 - 0.11, 0.6, 0));
      break;
    }
    case 'armchair': {
      const leather = colorMat(0x4a1f22, 0.55);
      g.add(mesh(boxGeo(w, 0.45, d), leather, 0, 0.25, 0));
      g.add(mesh(boxGeo(w, 0.55, 0.2), leather, 0, 0.7, d / 2 - 0.1));
      break;
    }
    case 'cabinet': {
      g.add(mesh(worldBoxGeo(w, h, d, 2), texturedMat('metal', 1, 1, 0.55, 0x8a9098, 0.4), 0, h / 2, 0));
      for (let i = 1; i < 4; i++) g.add(mesh(boxGeo(w + 0.02, 0.03, d * 0.9), metalDark, 0, (h / 4) * i, 0, false));
      break;
    }
    case 'safe':
      g.add(mesh(boxGeo(w, h, d), colorMat(0x22262b, 0.4, 0.7), 0, h / 2, 0));
      g.add(mesh(cyl(0.12, 0.12, 0.06, 16), colorMat(0xb0b4ba, 0.3, 0.9), 0, h * 0.6, d / 2 + 0.03, false).rotateX(Math.PI / 2));
      break;
    case 'dumpster': {
      const green = colorMat(0x2c4434, 0.7, 0.3);
      g.add(mesh(boxGeo(w, h * 0.85, d), green, 0, h * 0.43, 0));
      const lid = mesh(boxGeo(w + 0.08, 0.08, d + 0.08), colorMat(0x1d2a22, 0.6), 0, h * 0.88, 0);
      lid.rotation.x = 0.06;
      g.add(lid);
      break;
    }
    case 'car':
    case 'van': {
      const isVan = p.kind === 'van';
      const col = p.color ?? 0x444444;
      const body = colorMat(col, 0.35, 0.5);
      const glass = colorMat(0x10161d, 0.1, 0.8);
      const bw = isVan ? 2.1 : 1.85;
      const bl = isVan ? 5 : 4.1;
      g.add(mesh(boxGeo(bw, isVan ? 1.25 : 0.62, bl), body, 0, isVan ? 0.95 : 0.6, 0));
      if (isVan) {
        g.add(mesh(boxGeo(bw * 0.98, 0.6, 1.3), glass, 0, 1.6, -bl / 2 + 0.75));
        g.add(mesh(boxGeo(bw, 0.7, bl - 1.4), body, 0, 1.92, 0.7));
      } else {
        g.add(mesh(boxGeo(bw * 0.86, 0.5, 2.1), glass, 0, 1.15, 0.15));
        g.add(mesh(boxGeo(bw * 0.88, 0.06, 2.0), body, 0, 1.42, 0.15));
      }
      const wheel = cyl(0.36, 0.36, 0.25, 14);
      for (const sx of [-bw / 2, bw / 2])
        for (const sz of [-bl / 2 + 0.8, bl / 2 - 0.8]) {
          const wm = mesh(wheel, colorMat(0x111214, 0.9), sx, 0.36, sz);
          wm.rotation.z = Math.PI / 2;
          g.add(wm);
        }
      for (const sx of [-bw / 2 + 0.3, bw / 2 - 0.3]) {
        g.add(mesh(boxGeo(0.35, 0.12, 0.05), colorMat(0xfff2cc, 0.2, 0, 0xffe7b0, 1.2), sx, isVan ? 0.9 : 0.68, -bl / 2 - 0.01, false));
        g.add(mesh(boxGeo(0.3, 0.1, 0.05), colorMat(0x8a1010, 0.3, 0, 0xc01818, 0.9), sx, isVan ? 0.9 : 0.7, bl / 2 + 0.01, false));
      }
      break;
    }
    case 'lamp': {
      g.add(mesh(cyl(0.07, 0.1, 4.8, 8), metalDark, 0, 2.4, 0));
      g.add(mesh(boxGeo(0.08, 0.08, 1.1), metalDark, 0, 4.75, p.z < 0 ? 0.5 : -0.5));
      g.add(mesh(boxGeo(0.4, 0.12, 0.5), colorMat(0xfff0d0, 0.3, 0, 0xffb066, 2.2), 0, 4.66, p.z < 0 ? 1.0 : -1.0, false));
      break;
    }
    case 'bench':
      g.add(mesh(boxGeo(w, 0.06, 0.45), darkWood, 0, 0.45, 0));
      g.add(mesh(boxGeo(w, 0.4, 0.05), darkWood, 0, 0.7, 0.22));
      g.add(mesh(boxGeo(0.06, 0.45, 0.45), metalDark, -w / 2 + 0.1, 0.22, 0));
      g.add(mesh(boxGeo(0.06, 0.45, 0.45), metalDark, w / 2 - 0.1, 0.22, 0));
      break;
    case 'busStop':
      g.add(mesh(boxGeo(w, 0.08, d + 0.3), metalDark, 0, h, 0));
      g.add(mesh(boxGeo(w, h - 0.3, 0.04), colorMat(0x6a8aa0, 0.05, 0.2, 0x0a1218, 0.3), 0, h / 2 + 0.1, d / 2, false));
      g.add(mesh(boxGeo(0.08, h, 0.08), metalDark, -w / 2, h / 2, d / 2));
      g.add(mesh(boxGeo(0.08, h, 0.08), metalDark, w / 2, h / 2, d / 2));
      g.add(mesh(boxGeo(0.9, 1.6, 0.06), colorMat(0xe8dcc0, 0.4, 0, 0xd99a42, 0.6), w / 2 - 0.5, 1.3, d / 2 - 0.05, false));
      break;
    case 'kiosk':
      g.add(mesh(boxGeo(w, h, d), colorMat(0x4a5a4a, 0.7), 0, h / 2, 0));
      g.add(mesh(boxGeo(w + 0.4, 0.1, d + 0.4), colorMat(0x8a3030, 0.6), 0, h + 0.05, 0));
      g.add(mesh(boxGeo(w * 0.7, 0.8, 0.05), colorMat(0xffd9a0, 0.3, 0, 0xffb066, 0.8), 0, 1.4, -d / 2 - 0.02, false));
      break;
    case 'barrier':
      g.add(mesh(boxGeo(w, 0.25, d), colorMat(0xc94a4a, 0.6), 0, 0.85, 0));
      g.add(mesh(boxGeo(0.1, 0.8, 0.1), metalDark, -w / 2 + 0.1, 0.4, 0));
      g.add(mesh(boxGeo(0.1, 0.8, 0.1), metalDark, w / 2 - 0.1, 0.4, 0));
      break;
    case 'djBooth':
      g.add(mesh(boxGeo(w, h, d), colorMat(0x15161a, 0.5), 0, h / 2, 0));
      g.add(mesh(boxGeo(w, 0.05, 0.04), colorMat(0xc94a4a, 0.4, 0, 0xc94a4a, 1.5), 0, h * 0.8, d / 2 + 0.02, false));
      break;
    case 'speaker':
      g.add(mesh(boxGeo(w, h, d), colorMat(0x111214, 0.7), 0, h / 2, 0));
      g.add(mesh(cyl(0.22, 0.22, 0.05, 16), colorMat(0x24262a, 0.4), 0, h * 0.35, d / 2 + 0.02).rotateX(Math.PI / 2));
      break;
    case 'board': {
      g.add(mesh(boxGeo(w, h, d), colorMat(0x8a6a44, 0.95), 0, 1.4, 0));
      const pins = [
        [-1.4, 1.9],
        [-0.3, 2.0],
        [0.9, 1.8],
        [-0.9, 1.1],
        [0.5, 1.0],
        [1.5, 1.3],
      ];
      for (const [x, y] of pins) g.add(mesh(boxGeo(0.45, 0.5, 0.02), colorMat(0xe8e2d4, 0.8), x, y, -d / 2 - 0.02, false));
      g.add(mesh(boxGeo(2.8, 0.02, 0.01), colorMat(0xc94a4a, 0.5, 0, 0xc94a4a, 0.6), 0, 1.5, -d / 2 - 0.04, false));
      break;
    }
    case 'plant':
      g.add(mesh(cyl(0.22, 0.17, 0.45, 10), colorMat(0x2d2a28, 0.8), 0, 0.22, 0));
      g.add(mesh(cachedGeo('plantLeaf', () => new THREE.IcosahedronGeometry(0.42, 0)), colorMat(0x2e4a2c, 0.9), 0, 0.85, 0));
      break;
    case 'pallet':
      g.add(mesh(boxGeo(w, h, d), colorMat(0x7a5a38, 0.95), 0, h / 2, 0, false));
      break;
    case 'forklift':
      g.add(mesh(boxGeo(w, 1.0, d * 0.7), colorMat(0xb8892b, 0.6, 0.2), 0, 0.6, d * 0.1));
      g.add(mesh(boxGeo(w * 0.9, 0.08, 1), metalDark, 0, 1.9, 0.2));
      g.add(mesh(boxGeo(0.1, 2.2, 0.1), metalDark, -w / 2 + 0.1, 1.1, -d / 2 + 0.3));
      g.add(mesh(boxGeo(0.1, 2.2, 0.1), metalDark, w / 2 - 0.1, 1.1, -d / 2 + 0.3));
      g.add(mesh(boxGeo(w * 0.9, 0.06, 0.9), metalDark, 0, 0.12, -d / 2 - 0.1));
      break;
    case 'bin':
      g.add(mesh(cyl(0.28, 0.25, h, 10), colorMat(0x3a4048, 0.6, 0.4), 0, h / 2, 0));
      break;
  }
  g.position.set(p.x, 0, p.z);
  if (p.rot) g.rotation.y = p.rot;
  return g;
}
