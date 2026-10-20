import * as THREE from 'three';
import type { Settings } from '../game/GameTypes';

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  private quality: Settings['quality'] = 'medium';

  constructor(container: HTMLElement, quality: Settings['quality']) {
    this.renderer = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(0x101318);
    this.renderer.domElement.id = 'game-canvas';
    container.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color(0x101318);
    this.scene.fog = new THREE.Fog(0x101318, 70, 120);
    this.setQuality(quality);
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  setQuality(q: Settings['quality']): void {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(Math.min(dpr, q === 'low' ? 1 : q === 'medium' ? 1.5 : 2));
    const shadows = q !== 'low';
    if (this.renderer.shadowMap.enabled !== shadows) {
      this.renderer.shadowMap.enabled = shadows;
      // Materials must recompile when shadow support toggles.
      this.scene.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        if (Array.isArray(m)) m.forEach((x) => (x.needsUpdate = true));
        else if (m) (m as THREE.Material).needsUpdate = true;
      });
    }
  }

  get currentQuality(): Settings['quality'] {
    return this.quality;
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }
}
