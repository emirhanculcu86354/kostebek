import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { PropKind } from '../world/DistrictMap';

export interface ManifestModel {
  /** File under public/assets/models/. */
  file: string;
  /** Which procedural prop this model replaces (visual only; collision keeps the authored footprint). */
  replacesProp: PropKind;
  source: string;
  license: string;
  attribution?: string;
  /** Extra rotation around Y in degrees, applied before fitting (e.g. 180 when the model faces +Z). */
  rotY?: number;
  /** 'contain' (default) keeps proportions inside the footprint; 'stretch' fills width, depth and height. */
  fit?: 'contain' | 'stretch';
  /** Strip the model's own hues (textures and colours) so `tint` / the prop colour define them. */
  grayscale?: boolean;
  /** Hex colour multiplied into every material, e.g. "#6b4a2f", to match the scene palette. */
  tint?: string;
  /** Multiply by the prop's authored `color` from DistrictMap when it has one (e.g. each car keeps its paint). */
  usePropColor?: boolean;
}

interface LoadedProp {
  obj: THREE.Object3D;
  fit: 'contain' | 'stretch';
  usePropColor: boolean;
}

function forEachMaterial(root: THREE.Object3D, fn: (m: THREE.MeshStandardMaterial) => THREE.Material): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((m) => fn(m as THREE.MeshStandardMaterial))
      : fn(mesh.material as THREE.MeshStandardMaterial);
  });
}

function grayscaleTexture(tex: THREE.Texture): THREE.Texture {
  const img = tex.image as CanvasImageSource & { width: number; height: number };
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return tex;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const l = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    px[i] = px[i + 1] = px[i + 2] = l;
  }
  ctx.putImageData(data, 0, 0);
  const out = tex.clone();
  out.source = new THREE.Source(canvas);
  out.needsUpdate = true;
  return out;
}

export interface AssetManifest {
  version: number;
  models: ManifestModel[];
}

/**
 * Optional GLB/GLTF loading driven by public/assets/manifest.json.
 * Every model is optional: a missing manifest, a 404 or a corrupt file only logs a warning and
 * the procedural fallback stays in place, so the game never depends on external files.
 */
export class AssetManager {
  private loader = new GLTFLoader();
  private props = new Map<PropKind, LoadedProp>();
  readonly failures: string[] = [];

  async load(baseUrl = './assets/'): Promise<void> {
    let manifest: AssetManifest;
    try {
      const res = await fetch(`${baseUrl}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = (await res.json()) as AssetManifest;
      if (!Array.isArray(manifest.models)) throw new Error('models missing');
    } catch (e) {
      console.info('[assets] Manifest not available; using procedural assets only.', e);
      return;
    }
    await Promise.all(
      manifest.models.map(async (m) => {
        try {
          const gltf = await this.loader.loadAsync(`${baseUrl}models/${m.file}`);
          gltf.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) {
              mesh.castShadow = true;
              mesh.receiveShadow = true;
            }
          });
          if (m.grayscale || m.tint) {
            const grayMaps = new Map<THREE.Texture, THREE.Texture>();
            const tint = m.tint ? new THREE.Color(m.tint) : null;
            forEachMaterial(gltf.scene, (src) => {
              const mat = src.clone();
              if (m.grayscale) {
                if (mat.map) {
                  if (!grayMaps.has(mat.map)) grayMaps.set(mat.map, grayscaleTexture(mat.map));
                  mat.map = grayMaps.get(mat.map) ?? mat.map;
                }
                if (mat.color) {
                  const l = mat.color.r * 0.299 + mat.color.g * 0.587 + mat.color.b * 0.114;
                  mat.color.setRGB(l, l, l);
                }
              }
              if (tint && mat.color) mat.color.multiply(tint);
              return mat;
            });
          }
          const root = new THREE.Group();
          gltf.scene.rotation.y = THREE.MathUtils.degToRad(m.rotY ?? 0);
          root.add(gltf.scene);
          this.props.set(m.replacesProp, {
            obj: root,
            fit: m.fit === 'stretch' ? 'stretch' : 'contain',
            usePropColor: !!m.usePropColor,
          });
        } catch (e) {
          this.failures.push(m.file);
          console.warn(`[assets] ${m.file} could not be loaded; keeping procedural ${m.replacesProp}.`, e);
        }
      }),
    );
  }

  hasProp(kind: PropKind): boolean {
    return this.props.has(kind);
  }

  /** A clone scaled to fit the given footprint (see ManifestModel.fit), sitting on the ground and centred. */
  propInstance(kind: PropKind, w: number, d: number, h: number, color?: number): THREE.Object3D | null {
    const src = this.props.get(kind);
    if (!src) return null;
    const obj = src.obj.clone(true);
    if (src.usePropColor && color !== undefined) {
      const c = new THREE.Color(color);
      forEachMaterial(obj, (m) => {
        const mat = m.clone();
        if (mat.color) mat.color.multiply(c);
        return mat;
      });
    }
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const sx = w / Math.max(size.x, 1e-3);
    const sy = h / Math.max(size.y, 1e-3);
    const sz = d / Math.max(size.z, 1e-3);
    if (src.fit === 'stretch') obj.scale.set(sx, sy, sz);
    else obj.scale.setScalar(Math.min(sx, sy, sz));
    const box2 = new THREE.Box3().setFromObject(obj);
    const c = box2.getCenter(new THREE.Vector3());
    obj.position.set(-c.x, -box2.min.y, -c.z);
    const wrap = new THREE.Group();
    wrap.add(obj);
    return wrap;
  }
}
