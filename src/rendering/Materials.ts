import * as THREE from 'three';
import { getTexture } from './TextureFactory';

/** Shared material cache: identical surfaces reuse one material instance. */
const cache = new Map<string, THREE.Material>();

export function stdMat(key: string, make: () => THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m as THREE.MeshStandardMaterial;
}

export function colorMat(color: number, roughness = 0.8, metalness = 0, emissive = 0, emissiveIntensity = 1): THREE.MeshStandardMaterial {
  return stdMat(`c|${color}|${roughness}|${metalness}|${emissive}|${emissiveIntensity}`, () =>
    new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity }),
  );
}

export function texturedMat(tex: string, rx: number, ry: number, roughness = 0.9, color = 0xffffff, metalness = 0): THREE.MeshStandardMaterial {
  return stdMat(`t|${tex}|${rx.toFixed(2)}|${ry.toFixed(2)}|${roughness}|${color}|${metalness}`, () =>
    new THREE.MeshStandardMaterial({ map: getTexture(tex, rx, ry), roughness, color, metalness }),
  );
}

/** Translucent version of a wall used when it hides the player. */
export function fadedVersion(m: THREE.Material): THREE.Material {
  const key = `fade|${m.uuid}`;
  let f = cache.get(key);
  if (!f) {
    f = m.clone();
    f.transparent = true;
    f.opacity = 0.18;
    f.depthWrite = false;
    cache.set(key, f);
  }
  return f;
}

const geoCache = new Map<string, THREE.BufferGeometry>();
export function boxGeo(w: number, h: number, d: number): THREE.BufferGeometry {
  const key = `b|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  let g = geoCache.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(key, g);
  }
  return g;
}
/** Box whose UVs are scaled to world units, so one material tiles consistently on any size. */
export function worldBoxGeo(w: number, h: number, d: number, unit = 3): THREE.BufferGeometry {
  const key = `wb|${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}|${unit}`;
  let g = geoCache.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // Face order: +x, -x, +y, -y, +z, -z (4 verts each).
  const dims: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++)
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / unit, (uv.getY(i) * dims[f][1]) / unit);
    }
  uv.needsUpdate = true;
  geoCache.set(key, g);
  return g;
}

export function cachedGeo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    geoCache.set(key, g);
  }
  return g;
}
