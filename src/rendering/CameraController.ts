import * as THREE from 'three';
import { clamp, damp } from '../core/math';

/**
 * Fixed-angle orthographic isometric camera. No rotation: readability first.
 * Zoom is the visible world height; clamped so neither phone nor ultrawide gets extreme framing.
 */
export class CameraController {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3();
  private focus = new THREE.Vector3();
  private offsetDir = new THREE.Vector3(1, 1.25, 1).normalize();
  private distance = 60;
  private viewHeight = 19;
  private zoomScale = 1;
  private userZoom = 1;
  private aspect = 1;
  private shake = 0;
  private lookAhead = new THREE.Vector3();
  readonly forward = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  readonly toCamera = new THREE.Vector3();
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  reduceShake = false;

  static readonly MIN_ZOOM = 0.6;
  static readonly MAX_ZOOM = 1.5;

  constructor() {
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 200);
    this.toCamera.copy(this.offsetDir);
    // Screen-up on the ground is "away from the camera"; screen-right is up × world-up = (1,0,-1).
    this.forward.set(-this.offsetDir.x, 0, -this.offsetDir.z).normalize();
    this.right.set(-this.forward.z, 0, this.forward.x);
  }

  /** Settings zoom (0.6..1.5, 1 = default). */
  setUserZoom(z: number): void {
    this.userZoom = clamp(z, CameraController.MIN_ZOOM, CameraController.MAX_ZOOM);
    this.updateProjection();
  }

  /** Mouse wheel / pinch delta. */
  addZoom(delta: number): void {
    this.zoomScale = clamp(this.zoomScale * (1 + delta), 0.7, 1.35);
    this.updateProjection();
  }

  resize(w: number, h: number): void {
    this.aspect = w / Math.max(1, h);
    this.updateProjection();
  }

  private updateProjection(): void {
    let height = this.viewHeight * this.userZoom * this.zoomScale;
    let width = height * this.aspect;
    // On portrait phones keep a minimum visible width, so the player sees what comes from the sides.
    const minWidth = 12.5 * this.userZoom * this.zoomScale;
    if (width < minWidth) {
      width = minWidth;
      height = width / this.aspect;
    }
    height = Math.min(height, 34);
    width = height * this.aspect;
    const c = this.camera;
    c.left = -width / 2;
    c.right = width / 2;
    c.top = height / 2;
    c.bottom = -height / 2;
    c.updateProjectionMatrix();
  }

  addShake(amount: number): void {
    this.shake = Math.min(0.6, this.shake + (this.reduceShake ? amount * 0.3 : amount));
  }

  snapTo(p: THREE.Vector3): void {
    this.target.copy(p);
    this.focus.copy(p);
    this.apply();
  }

  update(dt: number, follow: THREE.Vector3, aimX = 0, aimZ = 0, aiming = false): void {
    this.target.copy(follow);
    const la = aiming ? 2.2 : 0.8;
    this.lookAhead.lerp(new THREE.Vector3(aimX * la, 0, aimZ * la), damp(4, dt));
    const goal = this.target.clone().add(this.lookAhead);
    this.focus.lerp(goal, damp(7, dt));
    this.apply();
    if (this.shake > 0) {
      const s = this.shake * 0.25;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
  }

  private apply(): void {
    this.camera.position.copy(this.focus).addScaledVector(this.offsetDir, this.distance);
    this.camera.lookAt(this.focus);
  }

  /** Screen point (pixels) → world point on a horizontal plane at height y. */
  screenToGround(px: number, py: number, w: number, h: number, y = 0, out = new THREE.Vector3()): THREE.Vector3 | null {
    const ndc = new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    this.plane.constant = -y;
    return this.raycaster.ray.intersectPlane(this.plane, out);
  }

  /** World → screen pixels. */
  worldToScreen(p: THREE.Vector3, w: number, h: number, out = { x: 0, y: 0, visible: true }) {
    const v = p.clone().project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * w;
    out.y = (-v.y * 0.5 + 0.5) * h;
    out.visible = v.x >= -1.1 && v.x <= 1.1 && v.y >= -1.1 && v.y <= 1.1;
    return out;
  }

  /** Converts a screen-space direction (x right, y up) to a world XZ direction. */
  screenDirToWorld(sx: number, sy: number): { x: number; z: number } {
    const x = this.right.x * sx + this.forward.x * sy;
    const z = this.right.z * sx + this.forward.z * sy;
    const len = Math.hypot(x, z) || 1;
    return { x: x / len, z: z / len };
  }
}
