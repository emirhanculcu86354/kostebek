import * as THREE from 'three';
import type { Settings } from '../game/GameTypes';

/** Night-time key lighting: cool moonlight with shadows that follow the action. */
export class Lighting {
  readonly moon: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  /** Always-present flash lights (intensity 0 when idle) avoid shader recompiles. */
  readonly flashes: THREE.PointLight[] = [];

  constructor(scene: THREE.Scene) {
    this.hemi = new THREE.HemisphereLight(0x8a9cc0, 0x22252b, 2.1);
    scene.add(this.hemi);
    scene.add(new THREE.AmbientLight(0x3a4250, 1.0));

    this.moon = new THREE.DirectionalLight(0xa8bce0, 2.0);
    this.moon.position.set(-12, 30, 8);
    this.moon.castShadow = true;
    const cam = this.moon.shadow.camera;
    cam.left = -22;
    cam.right = 22;
    cam.top = 22;
    cam.bottom = -22;
    cam.near = 1;
    cam.far = 80;
    this.moon.shadow.bias = -0.0006;
    this.moon.shadow.normalBias = 0.03;
    scene.add(this.moon);
    scene.add(this.moon.target);

    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffc070, 0, 7, 2);
      scene.add(l);
      this.flashes.push(l);
    }
  }

  setQuality(q: Settings['quality']): void {
    const size = q === 'high' ? 2048 : 1024;
    if (this.moon.shadow.mapSize.x !== size) {
      this.moon.shadow.mapSize.set(size, size);
      this.moon.shadow.map?.dispose();
      this.moon.shadow.map = null;
    }
  }

  follow(p: THREE.Vector3): void {
    // Snap to texel-ish steps to reduce shadow swimming.
    const x = Math.round(p.x * 2) / 2;
    const z = Math.round(p.z * 2) / 2;
    this.moon.position.set(x - 12, 30, z + 8);
    this.moon.target.position.set(x, 0, z);
  }

  private flashIndex = 0;
  flash(pos: THREE.Vector3): void {
    const l = this.flashes[this.flashIndex++ % this.flashes.length];
    l.position.copy(pos);
    l.intensity = 9;
  }

  update(dt: number): void {
    for (const l of this.flashes) if (l.intensity > 0) l.intensity = Math.max(0, l.intensity - dt * 120);
  }
}
