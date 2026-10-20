import type * as THREE from 'three';
import { Enemy, AIState } from '../entities/Enemy';
import type { Entity } from '../entities/Entity';
import { NPC } from '../entities/NPC';
import { Player } from '../entities/Player';
import type { GameSession } from '../game/GameSession';
import type { MissionDef, NpcSpawn, ZoneDef } from '../missions/MissionTypes';
import { FlagKeys } from '../missions/ObjectiveHandlers';
import { InteractableObject, modelForItem } from './Interactable';
import type { World } from './World';
import { ITEMS } from '../data/ItemData';

/** Spawns and owns the dynamic content of the active mission (entities, objects, zones). */
export class MissionRuntime {
  readonly player = new Player();
  enemies: Enemy[] = [];
  npcs: NPC[] = [];
  objects: InteractableObject[] = [];
  mission: MissionDef | null = null;
  private zoneInside = new Set<string>();
  private dropCounter = 0;
  /** Mission simulation time, kept in sync by the game loop. */
  now = 0;

  constructor(
    private scene: THREE.Scene,
    private world: World,
    private session: GameSession,
  ) {
    scene.add(this.player.object);
  }

  get all(): Entity[] {
    return [this.player, ...this.enemies, ...this.npcs];
  }

  load(m: MissionDef): void {
    this.clear();
    this.mission = m;
    const st = this.session.state;
    const w = st.world;

    // Player
    const p = this.player;
    p.alive = true;
    p.maxHealth = st.player.maxHealth;
    p.health = st.player.health > 0 ? st.player.health : st.player.maxHealth;
    const pos = st.player.position ?? m.spawn;
    p.pos.set(pos.x, 0, pos.z);
    p.facing = st.player.position ? st.player.facing : (m.spawnFacing ?? 0);
    p.vel.set(0, 0, 0);
    p.weapon = st.player.equipped;
    p.syncTransform();

    for (const es of m.enemies) {
      if (w.killed.includes(es.id)) continue;
      const e = new Enemy(es);
      if (w.activated.includes(es.group ?? '')) e.dormant = false;
      if (e.dormant) e.object.visible = false;
      e.syncTransform();
      this.enemies.push(e);
      this.scene.add(e.object);
    }
    // Hostility switched by events persists through saves via flags.
    for (const e of this.enemies) {
      if (this.session.flag(`m.hostile.${e.spawn.faction}`) || [...e.tags].some((t) => this.session.flag(`m.hostile.${t}`))) e.hostile = true;
      if (!e.dormant && e.hostile && e.spawn.group) this.alertTo(e, p.pos);
    }

    const civilians = this.makeCivilians(m.civilians ?? 0, m.index);
    let seed = 0;
    for (const ns of [...m.npcs, ...civilians]) {
      if (w.hiddenNpcs.includes(ns.id)) continue;
      if (ns.showIf && !this.session.check(ns.showIf)) continue;
      const n = new NPC(ns, seed++);
      if (w.following.includes(n.id)) n.mode = 'follow';
      if (this.session.flag(`m.injured.${n.id}`)) n.mode = 'hurt';
      n.syncTransform();
      this.npcs.push(n);
      this.scene.add(n.object);
    }

    for (const is of m.interactables) {
      if (w.removed.includes(is.id)) continue;
      const o = new InteractableObject(is);
      this.objects.push(o);
      this.scene.add(o.root);
    }

    this.world.resetDoors(w.openDoors);
    this.applyDoorLocks();
    this.zoneInside.clear();
  }

  /** Re-evaluate locked doors from mission data and current state. */
  applyDoorLocks(): void {
    const locks = this.mission?.lockedDoors ?? {};
    for (const d of this.world.doors.values()) {
      const l = locks[d.def.id];
      const locked = !!l && !this.session.check(l.unlock);
      d.locked = locked;
      d.lockText = l?.text ?? '';
    }
    this.world.syncDoorNav();
  }

  clear(): void {
    for (const e of this.enemies) e.dispose();
    for (const n of this.npcs) n.dispose();
    for (const o of this.objects) o.dispose();
    this.enemies = [];
    this.npcs = [];
    this.objects = [];
    this.mission = null;
  }

  private makeCivilians(count: number, seed: number): NpcSpawn[] {
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    const out: NpcSpawn[] = [];
    for (let i = 0; i < count; i++) {
      const side = rnd() > 0.5 ? 4.9 : -4.9;
      const x = -30 + rnd() * 60;
      const pts = [0, 1, 2].map(() => ({ x: Math.max(-34, Math.min(34, x + (rnd() - 0.5) * 18)), z: side + (rnd() - 0.5) * 0.8 }));
      out.push({ id: `civ${i}`, character: 'civilian', pos: pts[0], civilian: true, wander: pts });
    }
    return out;
  }

  npc(id: string): NPC | undefined {
    return this.npcs.find((n) => n.id === id);
  }

  npcAlive(id: string): boolean {
    const n = this.npc(id);
    // Hidden NPCs (left the scene safely) count as alive.
    if (!n) return this.session.state.world.hiddenNpcs.includes(id) || !this.mission?.npcs.some((s) => s.id === id);
    return n.alive;
  }

  enemiesWithTag(tag: string): Enemy[] {
    return this.enemies.filter((e) => e.tags.has(tag) || e.spawn.faction === tag);
  }

  alertTo(e: Enemy, p: THREE.Vector3): void {
    e.detection = 1;
    e.lastKnown = p.clone();
    e.lastSeenTime = this.now;
    e.setState(AIState.Pursuing);
  }

  // ───────────── World events ─────────────

  activateGroup(group: string): void {
    const w = this.session.state.world;
    if (!w.activated.includes(group)) w.activated.push(group);
    for (const e of this.enemies) {
      if (e.spawn.group !== group || !e.dormant) continue;
      e.dormant = false;
      e.object.visible = true;
      if (e.hostile) this.alertTo(e, this.player.pos);
    }
  }

  setHostile(key: string): void {
    this.session.setFlag(`m.hostile.${key}`);
    for (const e of this.enemiesWithTag(key)) {
      if (!e.alive) continue;
      e.hostile = true;
      if (!e.dormant) this.alertTo(e, this.player.pos);
    }
  }

  follow(id: string, v = true): void {
    const n = this.npc(id);
    const w = this.session.state.world;
    if (v) {
      if (!w.following.includes(id)) w.following.push(id);
      if (n) n.mode = 'follow';
    } else {
      w.following = w.following.filter((x) => x !== id);
      if (n) n.mode = 'idle';
    }
  }

  hide(id: string): void {
    const w = this.session.state.world;
    if (!w.hiddenNpcs.includes(id)) w.hiddenNpcs.push(id);
    w.following = w.following.filter((x) => x !== id);
    const n = this.npc(id);
    if (n) {
      n.dispose();
      this.npcs = this.npcs.filter((x) => x !== n);
    }
  }

  injure(id: string): void {
    this.session.setFlag(`m.injured.${id}`);
    const n = this.npc(id);
    if (n) n.mode = 'hurt';
  }

  spawnDrop(item: string, count: number, x: number, z: number): void {
    const name = ITEMS[item]?.name ?? item;
    const o = new InteractableObject(
      {
        id: `drop_${this.dropCounter++}`,
        model: modelForItem(item),
        pos: { x: x + (Math.random() - 0.5) * 0.6, z: z + (Math.random() - 0.5) * 0.6 },
        name,
        verb: 'Al',
        once: true,
        effects: [{ type: 'giveItem', item, count }],
      },
      true,
    );
    this.objects.push(o);
    this.scene.add(o.root);
  }

  removeObject(o: InteractableObject): void {
    o.used = true;
    if (!o.autoPickup && !this.session.state.world.removed.includes(o.spawn.id)) this.session.state.world.removed.push(o.spawn.id);
    o.dispose();
    this.objects = this.objects.filter((x) => x !== o);
  }

  // ───────────── Zones ─────────────

  private zoneActive(z: ZoneDef): boolean {
    return !z.activeIf || this.session.check(z.activeIf);
  }

  private inside(z: ZoneDef, x: number, zz: number): boolean {
    return Math.abs(x - z.x) <= z.w / 2 && Math.abs(zz - z.z) <= z.d / 2;
  }

  /** Set zone flags and run enter effects. */
  updateZones(): void {
    const m = this.mission;
    if (!m) return;
    const p = this.player.pos;
    for (const z of m.zones) {
      if (!this.zoneActive(z)) continue;
      const inside = this.inside(z, p.x, p.z);
      if (inside && !this.zoneInside.has(z.id)) {
        if (z.requiresNpcNear) {
          const n = this.npc(z.requiresNpcNear);
          if (!n || !n.alive || n.pos.distanceTo(p) > 6) continue;
        }
        this.zoneInside.add(z.id);
        const key = FlagKeys.zone(z.id);
        if (!this.session.flag(key)) {
          this.session.setFlag(key);
          this.session.apply(z.onEnter);
        }
      } else if (!inside) this.zoneInside.delete(z.id);
    }
  }

  restrictedZoneAt(x: number, z: number): ZoneDef | null {
    for (const zone of this.mission?.zones ?? []) if (zone.restricted && this.zoneActive(zone) && this.inside(zone, x, z)) return zone;
    return null;
  }
}
