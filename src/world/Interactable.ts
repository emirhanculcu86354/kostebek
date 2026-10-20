import * as THREE from 'three';
import { ITEMS } from '../data/ItemData';
import type { InteractableModel, InteractableSpawn } from '../missions/MissionTypes';
import { boxGeo, cachedGeo, colorMat } from '../rendering/Materials';

/** A world object the player can use: evidence, pickups, mission props. */
export class InteractableObject {
  readonly root = new THREE.Group();
  readonly pos: THREE.Vector3;
  used = false;
  private marker: THREE.Mesh;
  private t = Math.random() * 6;
  highlighted = false;

  constructor(
    readonly spawn: InteractableSpawn,
    readonly autoPickup = false,
  ) {
    this.pos = new THREE.Vector3(spawn.pos.x, 0, spawn.pos.z);
    this.root.position.copy(this.pos);
    const model = buildModel(spawn.model);
    // Objects on desks sit at desk height.
    const onDesk = spawn.model === 'laptop' || spawn.model === 'ledger' || spawn.model === 'note' || spawn.model === 'documents';
    model.position.y = onDesk ? 0.8 : 0;
    this.root.add(model);

    // Soft amber ring marks interactable objects from the isometric view.
    this.marker = new THREE.Mesh(
      cachedGeo('iring', () => new THREE.RingGeometry(0.32, 0.4, 28)),
      new THREE.MeshBasicMaterial({ color: 0xd99a42, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide }),
    );
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = onDesk ? 0.84 : 0.04;
    this.root.add(this.marker);
  }

  get label(): string {
    return `${this.spawn.verb}: ${this.spawn.name}`;
  }

  update(dt: number): void {
    this.t += dt;
    const pulse = 0.45 + Math.sin(this.t * 3) * 0.2 + (this.highlighted ? 0.35 : 0);
    (this.marker.material as THREE.MeshBasicMaterial).opacity = pulse;
    this.marker.scale.setScalar(this.highlighted ? 1.25 : 1);
  }

  dispose(): void {
    this.root.removeFromParent();
    (this.marker.material as THREE.Material).dispose();
  }
}

function m(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

export function buildModel(model: InteractableModel): THREE.Object3D {
  const g = new THREE.Group();
  switch (model) {
    case 'package':
      g.add(m(boxGeo(0.6, 0.4, 0.45), colorMat(0x8a6a44, 0.9), 0, 0.2, 0));
      g.add(m(boxGeo(0.62, 0.05, 0.1), colorMat(0xc94a4a, 0.6), 0, 0.4, 0));
      break;
    case 'laptop': {
      g.add(m(boxGeo(0.42, 0.03, 0.3), colorMat(0x2a2e34, 0.4, 0.5), 0, 0.015, 0));
      const screen = m(boxGeo(0.42, 0.28, 0.02), colorMat(0x1a2a3a, 0.2, 0.2, 0x4a7ab0, 0.9), 0, 0.15, -0.15);
      screen.rotation.x = -0.25;
      g.add(screen);
      break;
    }
    case 'ledger':
      g.add(m(boxGeo(0.32, 0.06, 0.42), colorMat(0x4a2418, 0.7), 0, 0.03, 0));
      g.add(m(boxGeo(0.3, 0.02, 0.4), colorMat(0xe8e0cc, 0.9), 0.01, 0.065, 0));
      break;
    case 'documents':
    case 'note':
      g.add(m(boxGeo(0.25, 0.01, 0.34), colorMat(0xe8e2d4, 0.9), 0, 0.01, 0));
      g.add(m(boxGeo(0.25, 0.01, 0.34), colorMat(0xd8d2c4, 0.9), 0.05, 0.02, 0.04));
      break;
    case 'medkit':
      g.add(m(boxGeo(0.45, 0.25, 0.3), colorMat(0xd8d4cc, 0.6), 0, 0.125, 0));
      g.add(m(boxGeo(0.06, 0.02, 0.2), colorMat(0xc94a4a, 0.5), 0, 0.26, 0));
      g.add(m(boxGeo(0.2, 0.02, 0.06), colorMat(0xc94a4a, 0.5), 0, 0.26, 0));
      break;
    case 'ammo':
      g.add(m(boxGeo(0.35, 0.2, 0.25), colorMat(0x4a5a3a, 0.7), 0, 0.1, 0));
      g.add(m(boxGeo(0.36, 0.04, 0.26), colorMat(0xb8892b, 0.4, 0.6), 0, 0.2, 0));
      break;
    case 'shotgun':
      g.add(m(boxGeo(0.08, 0.08, 1.0), colorMat(0x1b1d20, 0.4, 0.7), 0, 0.06, 0));
      g.add(m(boxGeo(0.1, 0.12, 0.35), colorMat(0x5a3a22, 0.7), 0, 0.07, 0.45));
      break;
    case 'key':
      g.add(m(cachedGeo('keyring', () => new THREE.TorusGeometry(0.08, 0.02, 6, 16)), colorMat(0xc9a35a, 0.3, 0.9), 0, 0.03, 0).rotateX(Math.PI / 2));
      g.add(m(boxGeo(0.04, 0.02, 0.2), colorMat(0xc9a35a, 0.3, 0.9), 0, 0.03, 0.15));
      break;
    case 'phone':
      g.add(m(boxGeo(0.1, 0.02, 0.18), colorMat(0x111111, 0.3, 0.4, 0x203040, 0.6), 0, 0.01, 0));
      break;
    case 'safe':
    case 'board':
      g.add(m(boxGeo(0.4, 0.4, 0.4), colorMat(0x333333, 0.6), 0, 0.2, 0));
      break;
  }
  return g;
}

/** Map an item id to a pickup model for enemy drops. */
export function modelForItem(item: string): InteractableModel {
  if (item === 'medkit') return 'medkit';
  if (item === 'warehouse_key') return 'key';
  if (item === 'shotgun') return 'shotgun';
  if (ITEMS[item]?.category === 'ammo') return 'ammo';
  return 'package';
}
