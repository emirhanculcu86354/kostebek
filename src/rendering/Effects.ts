import * as THREE from 'three';

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Spark {
  sprite: THREE.Sprite;
  life: number;
  max: number;
  vy: number;
}

function radialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Pooled combat feedback: tracers, muzzle flashes, impact puffs. No per-frame allocation. */
export class Effects {
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private flashMat: THREE.SpriteMaterial;
  private puffMat: THREE.SpriteMaterial;
  private hitMat: THREE.SpriteMaterial;
  private laser: THREE.Line;
  private group = new THREE.Group();

  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    this.flashMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(255,230,170,1)', 'rgba(255,140,40,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    this.puffMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(190,190,180,0.8)', 'rgba(120,120,120,0)'), depthWrite: false, transparent: true });
    this.hitMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(255,250,235,1)', 'rgba(255,200,150,0)'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    for (let i = 0; i < 24; i++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const mat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0, depthWrite: false });
      const line = new THREE.Line(geo, mat);
      line.visible = false;
      line.frustumCulled = false;
      this.group.add(line);
      this.tracers.push({ line, life: 0 });
    }
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      s.visible = false;
      this.group.add(s);
      this.sparks.push({ sprite: s, life: 0, max: 1, vy: 0 });
    }
    const lg = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.laser = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xc94a4a, transparent: true, opacity: 0.55, depthWrite: false }));
    this.laser.frustumCulled = false;
    this.laser.visible = false;
    this.group.add(this.laser);
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, enemy = false): void {
    const t = this.tracers.find((x) => x.life <= 0) ?? this.tracers[0];
    const pos = t.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    (t.line.material as THREE.LineBasicMaterial).color.setHex(enemy ? 0xff9a70 : 0xffe6b0);
    t.life = 0.07;
    t.line.visible = true;
  }

  private spawnSprite(mat: THREE.SpriteMaterial, p: THREE.Vector3, size: number, life: number, vy = 0): void {
    const s = this.sparks.find((x) => x.life <= 0) ?? this.sparks[0];
    const m = s.sprite.material;
    m.map = mat.map;
    m.blending = mat.blending;
    m.needsUpdate = true;
    m.userData.puff = mat === this.puffMat;
    s.sprite.position.copy(p);
    s.sprite.scale.set(size, size, 1);
    s.life = s.max = life;
    s.vy = vy;
    s.sprite.visible = true;
  }

  muzzle(p: THREE.Vector3, big = false): void {
    this.spawnSprite(this.flashMat, p, big ? 1.1 : 0.7, 0.05);
  }

  impact(p: THREE.Vector3): void {
    this.spawnSprite(this.puffMat, p, 0.45, 0.35, 0.8);
  }

  hit(p: THREE.Vector3): void {
    this.spawnSprite(this.hitMat, p, 0.6, 0.1);
  }

  setLaser(from: THREE.Vector3 | null, to?: THREE.Vector3): void {
    if (!from || !to) {
      this.laser.visible = false;
      return;
    }
    const pos = this.laser.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, from.x, from.y, from.z);
    pos.setXYZ(1, to.x, to.y, to.z);
    pos.needsUpdate = true;
    this.laser.visible = true;
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      if (t.life <= 0) continue;
      t.life -= dt;
      (t.line.material as THREE.LineBasicMaterial).opacity = Math.max(0, t.life / 0.07) * 0.9;
      if (t.life <= 0) t.line.visible = false;
    }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.life -= dt;
      const k = s.life / s.max;
      s.sprite.position.y += s.vy * dt;
      s.sprite.material.opacity = Math.max(0, k);
      if (s.sprite.material.userData.puff) s.sprite.scale.setScalar(0.45 + (1 - k) * 0.5);
      if (s.life <= 0) s.sprite.visible = false;
    }
  }

  clear(): void {
    for (const t of this.tracers) {
      t.life = 0;
      t.line.visible = false;
    }
    for (const s of this.sparks) {
      s.life = 0;
      s.sprite.visible = false;
    }
    this.laser.visible = false;
  }
}
