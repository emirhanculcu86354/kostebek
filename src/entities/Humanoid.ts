import * as THREE from 'three';
import { cachedGeo } from '../rendering/Materials';

export interface Appearance {
  skin: number;
  hair: number;
  jacket: number;
  shirt: number;
  pants: number;
  shoes: number;
  scale?: number;
  bald?: boolean;
  /** Long coat silhouette. */
  coat?: boolean;
  /** Female/long hair silhouette. */
  longHair?: boolean;
  beard?: boolean;
  cap?: number;
}

export const APPEARANCES: Record<string, Appearance> = {
  player: { skin: 0xc49a7a, hair: 0x1a1512, jacket: 0x3b3f45, shirt: 0x6a5a48, pants: 0x23262b, shoes: 0x15120f, beard: true },
  haydar: { skin: 0xb88d6c, hair: 0x9a9690, jacket: 0x1a1a1d, shirt: 0x7a2a2a, pants: 0x1a1a1d, shoes: 0x0e0e0e, coat: true, scale: 1.04, beard: true },
  selim: { skin: 0xc29a78, hair: 0x0e0c0b, jacket: 0x4a3226, shirt: 0x161616, pants: 0x1d1b1a, shoes: 0x0c0b0a, coat: true },
  nermin: { skin: 0xd2a88a, hair: 0x3a2418, jacket: 0x2e3e52, shirt: 0xc8c4bc, pants: 0x22262c, shoes: 0x18181a, longHair: true, scale: 0.95 },
  tekin: { skin: 0xb98e6e, hair: 0x2a1c12, jacket: 0x5a4a2a, shirt: 0x8a8070, pants: 0x3a3a40, shoes: 0x2a2018, cap: 0x2a2a2a, scale: 0.95 },
  riza: { skin: 0xc8a080, hair: 0x5a5550, jacket: 0x111111, shirt: 0xe8e4dc, pants: 0x161616, shoes: 0x0b0b0b, bald: true },
  ferhat: { skin: 0xd4ae90, hair: 0x2c241e, jacket: 0x5a6670, shirt: 0xd8d8d0, pants: 0x3a3e44, shoes: 0x241a14, scale: 0.94 },
  bora: { skin: 0xb4896a, hair: 0x120f0d, jacket: 0x2a2c2e, shirt: 0x3a3a3a, pants: 0x1a1c1e, shoes: 0x0f0f0f, bald: true, scale: 1.05 },
  kapici: { skin: 0xa8805f, hair: 0x0f0d0c, jacket: 0x151515, shirt: 0x151515, pants: 0x151515, shoes: 0x0a0a0a, bald: true, scale: 1.12 },
  dancer: { skin: 0xd8b090, hair: 0x6a3018, jacket: 0x6a2a4a, shirt: 0x6a2a4a, pants: 0x222228, shoes: 0x111111, longHair: true, scale: 0.93 },
  civilian: { skin: 0xc8a080, hair: 0x3a2a1a, jacket: 0x4a5a6a, shirt: 0x9a9a90, pants: 0x3a3a44, shoes: 0x222222 },
  // Faction looks
  rival_guard: { skin: 0xb48a6a, hair: 0x111111, jacket: 0x5a2424, shirt: 0x1a1a1a, pants: 0x202024, shoes: 0x111111, cap: 0x1a1a1a },
  rival_gangster: { skin: 0xc09070, hair: 0x1a1410, jacket: 0x7a3a1e, shirt: 0x2a2a2a, pants: 0x2a2a30, shoes: 0x141414 },
  rival_enforcer: { skin: 0xa07a5a, hair: 0x0a0a0a, jacket: 0x3a1414, shirt: 0x151515, pants: 0x18181a, shoes: 0x0e0e0e, bald: true, scale: 1.18, beard: true },
  org_guard: { skin: 0xb8906e, hair: 0x14110f, jacket: 0x1d2026, shirt: 0x3a4250, pants: 0x1a1c20, shoes: 0x0e0e0e },
  org_gangster: { skin: 0xc29676, hair: 0x1a1410, jacket: 0x262a30, shirt: 0x6a6a6a, pants: 0x1d1d22, shoes: 0x101010 },
  org_enforcer: { skin: 0xa88262, hair: 0x0a0a0a, jacket: 0x121316, shirt: 0x121316, pants: 0x121316, shoes: 0x0a0a0a, bald: true, scale: 1.16 },
};

const CIVILIAN_VARIANTS: Partial<Appearance>[] = [
  { jacket: 0x4a5a6a, pants: 0x3a3a44 },
  { jacket: 0x6a4a3a, pants: 0x2a2a30, longHair: true, hair: 0x5a3a20 },
  { jacket: 0x3a4a3a, pants: 0x44403a, cap: 0x5a3020 },
  { jacket: 0x7a6a50, pants: 0x2a2e36, hair: 0x8a8a88 },
  { jacket: 0x2a3550, pants: 0x1a1a1e, longHair: true, hair: 0x1a1210 },
];

export function civilianAppearance(seed: number): Appearance {
  return { ...APPEARANCES.civilian, ...CIVILIAN_VARIANTS[seed % CIVILIAN_VARIANTS.length] };
}

export type RigPose = 'idle' | 'move' | 'aim' | 'melee' | 'reload' | 'dodge' | 'dead' | 'hurt' | 'interact' | 'sit';

const capsule = (r: number, l: number) => cachedGeo(`cap|${r}|${l}`, () => new THREE.CapsuleGeometry(r, l, 4, 8));
const sphere = (r: number) => cachedGeo(`sph|${r}`, () => new THREE.SphereGeometry(r, 12, 10));
const box = (w: number, h: number, d: number) => cachedGeo(`hb|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d));

/**
 * Procedural low-poly humanoid with code-driven animation. Readable silhouette from the
 * isometric camera and zero external asset dependency.
 */
export class HumanoidRig {
  readonly root = new THREE.Group();
  private body = new THREE.Group();
  private legL = new THREE.Group();
  private legR = new THREE.Group();
  private armL = new THREE.Group();
  private armR = new THREE.Group();
  private torso: THREE.Mesh;
  private head: THREE.Group;
  private gun = new THREE.Group();
  private mats: THREE.MeshStandardMaterial[] = [];
  private phase = Math.random() * 10;
  private flash = 0;
  private deathT = 0;
  private attackT = 0;
  private blob: THREE.Mesh;
  readonly ring: THREE.Mesh;
  readonly height: number;

  constructor(a: Appearance) {
    const s = a.scale ?? 1;
    this.height = 1.85 * s;
    const mat = (c: number, rough = 0.75) => {
      const m = new THREE.MeshStandardMaterial({ color: c, roughness: rough });
      this.mats.push(m);
      return m;
    };
    const skin = mat(a.skin, 0.6);
    const jacket = mat(a.jacket, 0.7);
    const shirt = mat(a.shirt, 0.8);
    const pants = mat(a.pants, 0.85);
    const shoes = mat(a.shoes, 0.5);
    const hair = mat(a.hair, 0.9);

    const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Legs (pivot at hip).
    for (const [leg, side] of [
      [this.legL, -1],
      [this.legR, 1],
    ] as const) {
      leg.position.set(side * 0.11, 0.92, 0);
      add(leg, capsule(0.085, 0.62), pants, 0, -0.42, 0);
      add(leg, box(0.13, 0.09, 0.26), shoes, 0, -0.87, 0.04);
      this.body.add(leg);
    }

    // Torso and jacket.
    this.torso = add(this.body, capsule(0.2, 0.36), shirt, 0, 1.28, 0);
    this.torso.scale.set(1.15, 1, 0.7);
    const jk = add(this.body, box(0.5, a.coat ? 0.95 : 0.58, 0.3), jacket, 0, a.coat ? 1.12 : 1.3, -0.01);
    jk.scale.set(1, 1, 1);
    // Open front of the jacket reveals the shirt.
    add(this.body, box(0.12, 0.5, 0.02), shirt, 0, 1.33, 0.152);

    // Head.
    this.head = new THREE.Group();
    this.head.position.set(0, 1.68, 0);
    add(this.head, capsule(0.05, 0.06), skin, 0, -0.12, 0);
    add(this.head, sphere(0.15), skin, 0, 0.02, 0.01);
    if (!a.bald) {
      const h = add(this.head, sphere(0.158), hair, 0, 0.06, -0.015);
      h.scale.set(1, 0.75, 1);
      if (a.longHair) {
        const back = add(this.head, box(0.28, 0.32, 0.12), hair, 0, -0.08, -0.1);
        back.scale.set(1, 1, 1);
      }
    }
    if (a.beard) add(this.head, box(0.2, 0.08, 0.06), hair, 0, -0.08, 0.12);
    if (a.cap !== undefined) {
      const capM = mat(a.cap, 0.8);
      const c = add(this.head, sphere(0.165), capM, 0, 0.07, 0);
      c.scale.set(1, 0.55, 1);
      add(this.head, box(0.22, 0.03, 0.14), capM, 0, 0.06, 0.17);
    }
    this.body.add(this.head);

    // Arms (pivot at shoulder).
    for (const [arm, side] of [
      [this.armL, -1],
      [this.armR, 1],
    ] as const) {
      arm.position.set(side * 0.31, 1.5, 0);
      add(arm, capsule(0.07, 0.42), jacket, 0, -0.28, 0);
      add(arm, sphere(0.065), skin, 0, -0.58, 0.02);
      this.body.add(arm);
    }

    // Pistol in right hand.
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.4, metalness: 0.7 });
    add(this.gun, box(0.07, 0.11, 0.26), gunMat, 0, 0, 0.08);
    add(this.gun, box(0.06, 0.13, 0.07), gunMat, 0, -0.09, -0.02);
    this.gun.position.set(0, -0.62, 0.06);
    this.armR.add(this.gun);

    this.body.scale.setScalar(s);
    this.root.add(this.body);

    // Contact shadow blob keeps characters grounded even with shadows disabled.
    this.blob = new THREE.Mesh(
      cachedGeo('blob', () => new THREE.CircleGeometry(0.42, 20)),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.blob.rotation.x = -Math.PI / 2;
    this.blob.position.y = 0.02;
    this.root.add(this.blob);

    // Selection ring (interaction target / hostile marker).
    this.ring = new THREE.Mesh(
      cachedGeo('ring', () => new THREE.RingGeometry(0.5, 0.58, 32)),
      new THREE.MeshBasicMaterial({ color: 0xd99a42, transparent: true, opacity: 0.85, depthWrite: false }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.03;
    this.ring.visible = false;
    this.root.add(this.ring);
  }

  setArmed(v: boolean): void {
    this.gun.visible = v;
  }

  hitFlash(): void {
    this.flash = 0.15;
  }

  triggerAttack(): void {
    this.attackT = 0.25;
  }

  setRing(color: number | null): void {
    if (color === null) {
      this.ring.visible = false;
      return;
    }
    this.ring.visible = true;
    (this.ring.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  /** speed: horizontal speed in m/s. */
  update(dt: number, speed: number, pose: RigPose): void {
    const t = Math.min(dt, 0.05);
    if (this.flash > 0) {
      this.flash -= t;
      const e = this.flash > 0 ? 0.6 : 0;
      for (const m of this.mats) m.emissive.setRGB(e, e * 0.25, e * 0.2);
    }
    if (pose === 'dead') {
      this.deathT = Math.min(1, this.deathT + t * 2.8);
      const k = 1 - Math.pow(1 - this.deathT, 3);
      this.body.rotation.x = -k * (Math.PI / 2) * 0.96;
      this.body.position.y = k * 0.15;
      this.blob.scale.set(1, 2.2 * k + 1, 1);
      this.armL.rotation.set(-k * 2.4, 0, -k * 0.4);
      this.armR.rotation.set(-k * 2.4, 0, k * 0.4);
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
      return;
    }
    this.deathT = 0;
    this.body.rotation.x = 0;
    this.body.position.y = 0;
    this.blob.scale.set(1, 1, 1);

    const moving = speed > 0.2;
    if (moving) this.phase += t * (2.5 + speed * 1.55);
    const amp = moving ? Math.min(1, speed / 4.5) : 0;
    const sw = Math.sin(this.phase);
    this.legL.rotation.x = sw * 0.75 * amp;
    this.legR.rotation.x = -sw * 0.75 * amp;
    this.body.position.y = moving ? Math.abs(Math.cos(this.phase)) * 0.045 * amp : Math.sin(this.phase * 0.5 + performance.now() * 0.0015) * 0.006;
    this.head.rotation.y = 0;

    let aL = { x: -sw * 0.6 * amp, z: -0.08 };
    let aR = { x: sw * 0.6 * amp, z: 0.08 };
    this.body.rotation.z = 0;
    this.body.rotation.y = 0;

    switch (pose) {
      case 'aim':
        aR = { x: -1.5, z: 0.05 };
        aL = { x: -1.35, z: 0.55 };
        this.body.rotation.y = -0.12;
        break;
      case 'melee': {
        const k = this.attackT > 0 ? Math.sin((1 - this.attackT / 0.25) * Math.PI) : 0;
        aR = { x: -1.2 - k * 0.6, z: -0.3 + k * 0.9 };
        aL = { x: -0.9, z: 0.4 };
        this.body.rotation.y = -0.4 + k * 0.8;
        break;
      }
      case 'reload':
        aR = { x: -0.9, z: -0.25 };
        aL = { x: -1.0, z: 0.5 + Math.sin(performance.now() * 0.02) * 0.1 };
        this.head.rotation.x = 0.35;
        break;
      case 'dodge':
        this.body.rotation.x = 0.55;
        this.body.position.y = -0.25;
        aL = { x: -1.3, z: -0.3 };
        aR = { x: -1.3, z: 0.3 };
        this.legL.rotation.x = -1.1;
        this.legR.rotation.x = -0.4;
        break;
      case 'hurt':
        this.body.rotation.x = 0.25;
        this.body.position.y = -0.35;
        this.legL.rotation.x = -1.4;
        this.legR.rotation.x = -1.3;
        aL = { x: -0.6, z: -0.3 };
        aR = { x: -0.7, z: 0.3 };
        this.head.rotation.x = 0.5;
        break;
      case 'interact':
        aR = { x: -1.0, z: 0 };
        this.head.rotation.x = 0.4;
        break;
      case 'sit':
        break;
      default:
        if (this.attackT > 0) {
          const k = Math.sin((1 - this.attackT / 0.25) * Math.PI);
          aR = { x: -1.2 - k * 0.6, z: -0.3 + k * 0.9 };
        }
    }
    if (pose !== 'dodge' && pose !== 'hurt') this.head.rotation.x = pose === 'reload' || pose === 'interact' ? this.head.rotation.x : 0;
    if (this.attackT > 0) this.attackT -= t;
    // Smooth arm rotation toward the target pose.
    const k = 1 - Math.exp(-18 * t);
    this.armL.rotation.x += (aL.x - this.armL.rotation.x) * k;
    this.armL.rotation.z += (aL.z - this.armL.rotation.z) * k;
    this.armR.rotation.x += (aR.x - this.armR.rotation.x) * k;
    this.armR.rotation.z += (aR.z - this.armR.rotation.z) * k;
  }

  /** World position of the muzzle (approximation in front of the chest). */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.gun.getWorldPosition(out);
  }

  dispose(): void {
    for (const m of this.mats) m.dispose();
    (this.blob.material as THREE.Material).dispose();
    (this.ring.material as THREE.Material).dispose();
  }
}
