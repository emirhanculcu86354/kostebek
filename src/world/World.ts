import * as THREE from 'three';
import { damp } from '../core/math';
import { boxGeo, colorMat, fadedVersion, texturedMat, worldBoxGeo } from '../rendering/Materials';
import { textTexture } from '../rendering/TextureFactory';
import { CollisionWorld, NavGrid, type AABB } from './CollisionWorld';
import { BOUNDS, DOORS, FLOORS, LIGHTS, PROPS, SIGNS, WALLS, WALL_T, type DoorDef, type FloorKey, type MaterialKey } from './DistrictMap';
import type { AssetManager } from '../rendering/AssetManager';
import { buildProp, PROP_SIZE, propFootprint } from './PropFactory';
import type { PropDef } from './DistrictMap';

const WALL_MATS: Record<MaterialKey, () => THREE.Material> = {
  brick: () => texturedMat('brick', 1, 1, 0.92),
  brickDark: () => texturedMat('brickDark', 1, 1, 0.92),
  plaster: () => texturedMat('plaster', 1, 1, 0.95),
  concrete: () => texturedMat('concrete', 1, 1, 0.9),
  metal: () => texturedMat('metal', 1, 1, 0.5, 0xffffff, 0.4),
  wood: () => texturedMat('wood', 1, 1, 0.8),
  woodDark: () => texturedMat('wood', 1, 1, 0.8, 0x7a6a5a),
  facade: () => texturedMat('facade', 1, 1, 0.85),
  interior: () => texturedMat('plaster', 1, 1, 0.95, 0xb0aaa0),
  clubWall: () => texturedMat('clubWall', 1, 1, 0.9),
};

const FLOOR_TEX: Record<FloorKey, [string, number, number]> = {
  asphalt: ['asphalt', 6, 0.95],
  sidewalk: ['sidewalk', 3, 0.9],
  tiles: ['tiles', 2.5, 0.85],
  clubFloor: ['clubFloor', 4, 0.35],
  concreteFloor: ['concreteFloor', 5, 0.85],
  woodFloor: ['woodFloor', 3, 0.7],
  carpet: ['carpet', 3, 1],
  parking: ['parking', 5, 0.95],
};

export class Door {
  open = false;
  locked = false;
  lockText = '';
  private t = 0;
  readonly collider: AABB;
  readonly root = new THREE.Group();
  private panel: THREE.Object3D;

  constructor(
    readonly def: DoorDef,
    collision: CollisionWorld,
  ) {
    const along = def.axis === 'x';
    const w = def.width;
    this.collider = collision.addBox(def.x, def.z, along ? w : WALL_T, along ? WALL_T : w, true, `door:${def.id}`);
    this.root.position.set(def.x, 0, def.z);
    if (def.shutter) {
      const m = new THREE.Mesh(worldBoxGeo(w, 2.9, 0.12, 1), colorMat(0x5a6068, 0.5, 0.6));
      m.position.y = 1.45;
      m.castShadow = true;
      this.panel = m;
      this.root.add(m);
    } else {
      const pivot = new THREE.Group();
      const leaf = new THREE.Mesh(boxGeo(w - 0.06, 2.5, 0.09), colorMat(0x3b2a1f, 0.55));
      leaf.position.set((w - 0.06) / 2, 1.25, 0);
      leaf.castShadow = true;
      const handle = new THREE.Mesh(boxGeo(0.06, 0.06, 0.2), colorMat(0xb0a080, 0.3, 0.9));
      handle.position.set(w - 0.3, 1.1, 0);
      pivot.add(leaf, handle);
      pivot.position.x = -w / 2;
      this.panel = pivot;
      this.root.add(pivot);
    }
    if (!along) this.root.rotation.y = Math.PI / 2;
    // Lintel above opening so the doorway reads as part of the wall.
    const lintel = new THREE.Mesh(boxGeo(w, 0.5, WALL_T), colorMat(0x2a2522, 0.9));
    lintel.position.y = 2.75;
    this.root.add(lintel);
  }

  setOpen(v: boolean): void {
    this.open = v;
    this.collider.enabled = !v;
  }

  update(dt: number): void {
    const target = this.open ? 1 : 0;
    this.t += (target - this.t) * damp(10, dt);
    if (this.def.shutter) this.panel.position.y = 1.45 + this.t * 2.6;
    else this.panel.rotation.y = -this.t * (Math.PI / 2) * 0.95;
  }
}

interface Fadeable {
  meshes: THREE.Mesh[];
  originals: THREE.Material[];
  faded: boolean;
}

/** Static district: geometry, collision, navigation, doors and lights. Built once. */
export class World {
  readonly collision = new CollisionWorld();
  readonly nav: NavGrid;
  readonly doors = new Map<string, Door>();
  readonly root = new THREE.Group();
  private fadeables: Fadeable[] = [];
  private fadeTargets: THREE.Object3D[] = [];
  private fadeOwner = new Map<THREE.Object3D, Fadeable>();
  private lights: { light: THREE.PointLight; priority: number }[] = [];
  private raycaster = new THREE.Raycaster();
  private propObjects: { def: PropDef; obj: THREE.Object3D; fade: Fadeable | null }[] = [];

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    this.buildGround();
    this.buildWalls();
    this.buildProps();
    this.buildSigns();
    this.buildLights();
    // Navigation is computed with doors open, then locked doors are blocked dynamically.
    const doorBoxes: AABB[] = [];
    for (const def of DOORS) {
      const door = new Door(def, this.collision);
      this.doors.set(def.id, door);
      this.root.add(door.root);
      doorBoxes.push(door.collider);
    }
    doorBoxes.forEach((b) => (b.enabled = false));
    this.nav = new NavGrid(this.collision, BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX, BOUNDS.maxZ, 0.5, 0.4);
    doorBoxes.forEach((b) => (b.enabled = true));
  }

  private buildGround(): void {
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), colorMat(0x0b0d10, 1));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.02;
    this.root.add(outer);
    let y = 0;
    for (const f of FLOORS) {
      const [tex, unit, rough] = FLOOR_TEX[f.mat];
      const mat = texturedMat(tex, 1, 1, rough);
      const geo = new THREE.PlaneGeometry(f.w, f.d);
      const uv = geo.attributes.uv as THREE.BufferAttribute;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * f.w) / unit, (uv.getY(i) * f.d) / unit);
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      // Tiny offsets avoid z-fighting where floors overlap.
      y += 0.0015;
      m.position.set(f.x, y, f.z);
      m.receiveShadow = true;
      this.root.add(m);
    }
    // Road markings.
    const dash = colorMat(0xd8d2c0, 0.8, 0, 0x222018, 1);
    for (let x = -34; x < 36; x += 4) {
      const m = new THREE.Mesh(boxGeo(2, 0.01, 0.15), dash);
      m.position.set(x, 0.03, 0);
      this.root.add(m);
    }
    // Curbs.
    for (const z of [-3.5, 3.5]) {
      const c = new THREE.Mesh(boxGeo(72, 0.12, 0.2), colorMat(0x6a6e72, 0.8));
      c.position.set(0, 0.06, z);
      c.receiveShadow = true;
      this.root.add(c);
    }
    // Zebra crossing in front of the club.
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(boxGeo(0.45, 0.01, 6.6), colorMat(0xd8d2c0, 0.85));
      m.position.set(-24 + i * 0.9, 0.025, 0);
      this.root.add(m);
    }
    // Fake light pools under lamps: cheap warmth that survives low quality.
    const poolTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d')!;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,176,102,0.55)');
      grad.addColorStop(1, 'rgba(255,176,102,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (const l of LIGHTS) {
      if (l.color !== 0xffb066 && l.color !== 0xffa860) continue;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), poolMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(l.x, 0.04, l.z);
      this.root.add(m);
    }
  }

  private buildWalls(): void {
    for (const w of WALLS) {
      const mat = WALL_MATS[w.mat]();
      const m = new THREE.Mesh(worldBoxGeo(w.w, w.h, w.d, w.mat === 'facade' ? 5.5 : 3), mat);
      m.position.set(w.x, w.h / 2, w.z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.root.add(m);
      this.collision.addBox(w.x, w.z, w.w, w.d, w.h > 1.2);
      // Cap strip on top reads as wall thickness from the isometric view.
      const cap = new THREE.Mesh(boxGeo(w.w + 0.02, 0.06, w.d + 0.02), colorMat(0x14171b, 0.9));
      cap.position.set(w.x, w.h + 0.03, w.z);
      this.root.add(cap);
      if (w.h > 1.2) this.registerFade(m, [m, cap]);
    }
  }

  private buildProps(): void {
    for (const p of PROPS) {
      const obj = buildProp(p);
      this.root.add(obj);
      const fp = propFootprint(p);
      if (fp.collide) this.collision.addBox(p.x, p.z, fp.w, fp.d, fp.h >= 1.3);
      let fade: Fadeable | null = null;
      if (fp.h >= 2 && p.kind !== 'lamp') fade = this.registerFade(obj, collectMeshes(obj));
      this.propObjects.push({ def: p, obj, fade });
    }
  }

  private buildSigns(): void {
    for (const s of SIGNS) {
      const tex = textTexture(s.text, s.color);
      const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.w / 4), mat);
      // All signs face +z so they read from the isometric camera; south-side ones sit above the roofline.
      m.position.set(s.x, s.y, s.z + (s.rot === 0 ? 0.25 : 0.3));
      this.root.add(m);
    }
  }

  private buildLights(): void {
    for (const l of LIGHTS) {
      const light = new THREE.PointLight(l.color, l.intensity, l.distance, 1.6);
      light.position.set(l.x, l.y, l.z);
      this.root.add(light);
      this.lights.push({ light, priority: l.priority });
    }
  }

  setQuality(q: 'low' | 'medium' | 'high'): void {
    const maxP = q === 'low' ? 1 : q === 'medium' ? 2 : 3;
    for (const { light, priority } of this.lights) light.visible = priority <= maxP;
  }

  private registerFade(_target: THREE.Object3D, meshes: THREE.Mesh[]): Fadeable {
    const f: Fadeable = { meshes, originals: meshes.map((m) => m.material as THREE.Material), faded: false };
    this.fadeables.push(f);
    for (const m of meshes) {
      this.fadeTargets.push(m);
      this.fadeOwner.set(m, f);
    }
    return f;
  }

  private unregisterFade(f: Fadeable): void {
    this.fadeables = this.fadeables.filter((x) => x !== f);
    this.fadeTargets = this.fadeTargets.filter((m) => !f.meshes.includes(m as THREE.Mesh));
    for (const m of f.meshes) this.fadeOwner.delete(m);
  }

  /** Swap procedural props for loaded GLB models where the manifest provides one. */
  applyAssetOverrides(assets: AssetManager): number {
    let n = 0;
    for (const entry of this.propObjects) {
      const p = entry.def;
      if (!assets.hasProp(p.kind)) continue;
      const [dw, dd, dh] = PROP_SIZE[p.kind];
      const inst = assets.propInstance(p.kind, p.w ?? dw, p.d ?? dd, p.h ?? dh, p.color);
      if (!inst) continue;
      if (entry.fade) this.unregisterFade(entry.fade);
      entry.obj.clear();
      entry.obj.add(inst);
      entry.fade = (p.h ?? dh) >= 2 ? this.registerFade(entry.obj, collectMeshes(entry.obj)) : null;
      n++;
    }
    return n;
  }

  /** Make walls between the camera and the focus point translucent. */
  updateOcclusion(focus: THREE.Vector3, toCamera: THREE.Vector3): void {
    const hitSet = new Set<Fadeable>();
    const offsets = [0, -0.7, 0.7];
    const side = new THREE.Vector3(-toCamera.z, 0, toCamera.x).normalize();
    for (const o of offsets) {
      for (const hgt of [0.4, 1.4]) {
        const origin = focus.clone().addScaledVector(side, o);
        origin.y = hgt;
        this.raycaster.set(origin, toCamera);
        this.raycaster.far = 40;
        for (const hit of this.raycaster.intersectObjects(this.fadeTargets, false)) {
          const f = this.fadeOwner.get(hit.object);
          if (f) hitSet.add(f);
        }
      }
    }
    for (const f of this.fadeables) {
      const should = hitSet.has(f);
      if (should === f.faded) continue;
      f.faded = should;
      f.meshes.forEach((m, i) => (m.material = should ? fadedVersion(f.originals[i]) : f.originals[i]));
    }
  }

  update(dt: number): void {
    for (const d of this.doors.values()) d.update(dt);
  }

  /** Re-sync dynamic nav blockers for locked doors. */
  syncDoorNav(): void {
    for (const d of this.doors.values()) {
      const c = d.collider;
      this.nav.setDynamic(d.def.id, c.minX, c.minZ, c.maxX, c.maxZ, d.locked && !d.open);
    }
  }

  resetDoors(openIds: string[] = []): void {
    for (const d of this.doors.values()) d.setOpen(openIds.includes(d.def.id));
  }
}

function collectMeshes(obj: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  obj.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh);
  });
  return meshes;
}
