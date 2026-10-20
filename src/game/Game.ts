import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { EVIDENCE } from '../data/EvidenceData';
import { ITEMS } from '../data/ItemData';
import { SKILL_BY_ID } from '../data/SkillData';
import { DialogueManager } from '../dialogue/DialogueManager';
import { SPEAKERS } from '../dialogue/DialogueData';
import { AIState, Enemy } from '../entities/Enemy';
import { NPC } from '../entities/NPC';
import { PlayerState } from '../entities/Player';
import { CharacterController } from '../gameplay/CharacterController';
import { CombatSystem, type DamageEvent } from '../gameplay/CombatSystem';
import { EnemyAI, scareNpcs, updateNpc } from '../gameplay/EnemyAI';
import { LEDGER_DECISION } from '../gameplay/LedgerDecision';
import { REP_LABELS } from '../gameplay/ReputationSystem';
import { InputManager } from '../input/InputManager';
import type { PlayerIntent } from '../input/InputTypes';
import { MissionManager, type MissionOutcome } from '../missions/MissionManager';
import type { MarkerRef } from '../missions/MissionTypes';
import { FlagKeys } from '../missions/ObjectiveHandlers';
import { SaveManager } from '../persistence/SaveManager';
import { AssetManager } from '../rendering/AssetManager';
import { CameraController } from '../rendering/CameraController';
import { Effects } from '../rendering/Effects';
import { Lighting } from '../rendering/Lighting';
import { Renderer } from '../rendering/Renderer';
import type { GameFacade } from '../ui/GameFacade';
import { UIManager } from '../ui/UIManager';
import { areaAt } from '../world/DistrictMap';
import type { InteractableObject } from '../world/Interactable';
import { MissionRuntime } from '../world/MissionRuntime';
import type { Door } from '../world/World';
import { World } from '../world/World';
import type { RuntimeContext } from './Context';
import { computeEnding } from './Ending';
import { GameSession } from './GameSession';
import { createNewGameState } from './GameState';
import type { Effect, Settings } from './GameTypes';

export type FlowState = 'menu' | 'briefing' | 'playing' | 'paused' | 'dialogue' | 'panel' | 'decision' | 'result' | 'ending';

type InteractTarget =
  | { kind: 'npc'; npc: NPC; label: string }
  | { kind: 'enemy'; enemy: Enemy; label: string }
  | { kind: 'object'; obj: InteractableObject; label: string }
  | { kind: 'door'; door: Door; label: string };

const DEFAULT_CATCH: Effect[] = [
  { type: 'rep', stat: 'suspicion', delta: 10, reason: 'Yasak bölgede yakalandın' },
  { type: 'flag', flag: 'm.detected' },
];

/** Top-level orchestrator: owns systems, the frame loop and game flow. */
export class Game implements GameFacade {
  readonly renderer: Renderer;
  readonly camera = new CameraController();
  readonly lighting: Lighting;
  readonly world: World;
  readonly effects: Effects;
  readonly audio: AudioManager;
  readonly saves = new SaveManager();
  readonly assets = new AssetManager();
  readonly session = new GameSession();
  readonly runtime: MissionRuntime;
  readonly combat: CombatSystem;
  readonly ai: EnemyAI;
  readonly controller: CharacterController;
  readonly missions: MissionManager;
  readonly dialogue: DialogueManager;
  readonly input: InputManager;
  readonly ui: UIManager;
  settings: Settings;
  private flowState: FlowState = 'menu';
  get flow(): FlowState {
    return this.flowState;
  }
  /** Mirrored to <body data-flow> so CSS can hide gameplay controls under overlays. */
  set flow(v: FlowState) {
    this.flowState = v;
    document.body.dataset.flow = v;
  }
  private time = 0;
  private ctx: RuntimeContext;
  private target: InteractTarget | null = null;
  private pendingObject: InteractableObject | null = null;
  private lastOutcome: MissionOutcome | null = null;
  private deathTimer = 0;
  private gunfireSuspicionCd = 0;
  private menuT = 0;
  private areaName = '';
  private areaTimer = 0;
  private lastFrame = performance.now();

  constructor(container: HTMLElement) {
    this.settings = this.saves.loadSettings();
    this.renderer = new Renderer(container, this.settings.quality);
    const scene = this.renderer.scene;
    this.lighting = new Lighting(scene);
    this.world = new World(scene);
    this.effects = new Effects(scene);
    this.audio = new AudioManager(this.settings);
    this.runtime = new MissionRuntime(scene, this.world, this.session);
    const self = this;
    this.ctx = {
      session: this.session,
      world: this.world,
      runtime: this.runtime,
      get combat() {
        return self.combat;
      },
      audio: this.audio,
      camera: this.camera,
      lighting: this.lighting,
      effects: this.effects,
      get time() {
        return self.time;
      },
      notify: (t, tone) => this.ui.hud.toast(t, tone),
    };
    this.combat = new CombatSystem(() => this.ctx);
    this.ai = new EnemyAI(() => this.ctx);
    this.controller = new CharacterController(() => this.ctx);
    this.missions = new MissionManager(this.session, {
      npcAlive: (id) => this.runtime.npcAlive(id),
      playerDead: () => !this.runtime.player.alive,
    });
    this.dialogue = new DialogueManager(this.session);
    this.input = new InputManager(this.renderer.canvas, container);
    this.ui = new UIManager(container, this);
    this.camera.reduceShake = this.input.touch.active;

    this.wireEvents();
    this.applySettings(this.settings, false);
    this.onResize();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 200));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.flow === 'playing') this.openPause();
      this.audio.suspend(document.hidden);
    });
    this.runtime.player.object.visible = false;
    this.camera.snapTo(new THREE.Vector3(-10, 0, 0));
    this.flow = 'menu';
    // Optional external models: failures are logged and the procedural versions stay.
    void this.assets.load().then(() => {
      const n = this.world.applyAssetOverrides(this.assets);
      if (n) console.info(`[assets] ${n} props replaced by GLB models.`);
    });
  }

  start(): void {
    this.ui.doneLoading();
    this.ui.menu.show();
    const loop = (t: number) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, Math.max(0, (t - this.lastFrame) / 1000));
      this.lastFrame = t;
      if (document.hidden) return;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  /** Debug/automation: run the simulation for `seconds` at 60 Hz without waiting for rAF. */
  advance(seconds: number): void {
    const steps = Math.ceil(seconds * 60);
    for (let i = 0; i < steps; i++) this.frame(1 / 60);
  }

  private onResize(): void {
    const w = innerWidth;
    const h = innerHeight;
    this.renderer.resize(w, h);
    this.camera.resize(w, h);
  }

  // ───────────────────────────── Event wiring ─────────────────────────────

  private wireEvents(): void {
    const bus = this.session.bus;
    bus.on('notify', (n) => this.ui.hud.toast(n.text, n.tone));
    bus.on('repChanged', (r) => {
      if (this.flow === 'menu') return;
      const good = r.stat === 'suspicion' ? r.delta < 0 : r.delta > 0;
      const arrow = r.delta > 0 ? '▲' : '▼';
      const text = `${REP_LABELS[r.stat]} ${arrow} ${Math.abs(r.delta)}${r.reason ? ` — ${r.reason}` : ''}`;
      if (this.flow === 'dialogue') this.ui.dialogue.pushFeedback(`<span class="${good ? 'good' : 'bad'}">${text}</span>`);
      else this.ui.hud.toast(text, good ? 'good' : 'bad');
    });
    bus.on('suspicionTier', (t) => {
      if (this.flow === 'menu') return;
      const msgs: Record<string, string> = {
        medium: 'Şüphe arttı: örgüt seni daha yakından izliyor.',
        high: 'Şüphe yüksek: Selim adamlarına seni izletiyor.',
        critical: 'Şüphe kritik seviyede!',
      };
      const rising = ['low', 'medium', 'high', 'critical'].indexOf(t.to) > ['low', 'medium', 'high', 'critical'].indexOf(t.from);
      if (rising && msgs[t.to]) this.ui.hud.toast(msgs[t.to], 'bad');
      if (t.to === 'critical' && this.runtime.mission && !this.missions.isFinished) this.triggerExposure();
    });
    bus.on('evidenceChanged', (e) => {
      if (e.status === 'collected') {
        this.audio.play('evidence');
        this.ui.hud.toast(`Kanıt eklendi: ${EVIDENCE[e.id]?.name ?? e.id}`, 'good');
      } else if (e.status === 'submitted') this.ui.hud.toast(`Merkeze gönderildi: ${EVIDENCE[e.id]?.name ?? e.id}`, 'good');
    });
    bus.on('itemAdded', () => this.audio.play('pickup', 0.7));
    bus.on('inventoryFull', (e) => this.ui.hud.toast(`Envanter dolu: ${ITEMS[e.item]?.name ?? e.item} alınamadı.`, 'bad'));
    bus.on('levelUp', (l) => {
      this.ui.hud.toast(`Seviye ${l.level}! Beceri puanı kazandın (Tab → Beceriler).`, 'good');
      this.audio.play('success', 0.5);
    });
    bus.on('worldEvent', (e) => this.onWorldEvent(e.name, e.arg));

    this.combat.onDamage = (e) => this.onDamage(e);
    this.combat.onNoise = (x, z, r, src) => this.onNoise(x, z, r, src === this.runtime.player);
    this.ai.onBark = (e, text) => this.ui.hud.floater(new THREE.Vector3(e.pos.x, e.rig.height + 0.9, e.pos.z), text, 'bark', 2.2, 0.25);
    this.ai.onWatcherDetect = (e) => {
      this.session.apply(e.spawn.watch?.onDetect ?? DEFAULT_CATCH);
      this.audio.play('alert');
      if (e.spawn.watch?.restricted) this.ui.hud.toast('Yasak bölgede yakalandın! Şüphe arttı.', 'bad');
    };
    this.controller.onMessage = (t) => this.ui.hud.toast(t);
    this.controller.onInteractComplete = () => {
      if (this.pendingObject) this.completeObject(this.pendingObject);
      this.pendingObject = null;
    };
    this.missions.onObjectiveComplete = (o) => {
      if (this.flow === 'menu') return;
      this.ui.hud.toast(`✓ ${o.text}`, 'good');
      this.audio.play('ui', 0.8);
    };
    this.missions.onObjectiveFailed = (o) => this.ui.hud.toast(`✗ ${o.text}`, 'bad');
    this.dialogue.onEnd = () => this.endDialogue();
  }

  // ───────────────────────────── Frame ─────────────────────────────

  private frame(dt: number): void {
    const intent = this.input.poll();
    if (this.flow === 'playing') this.updatePlaying(dt, intent);
    else this.handleMenuKeys(intent);

    this.world.update(dt);
    this.effects.update(dt);
    this.lighting.update(dt);
    for (const o of this.runtime.objects) o.update(dt);

    const p = this.runtime.player;
    if (this.flow === 'menu') {
      this.menuT += dt;
      const follow = new THREE.Vector3(Math.sin(this.menuT * 0.06) * 18 - 4, 0, -4 + Math.sin(this.menuT * 0.11) * 3);
      this.camera.update(dt, follow);
      this.lighting.follow(follow);
    } else {
      const aiming = p.state === PlayerState.Aiming;
      this.camera.update(dt, p.pos, p.aimX, p.aimZ, aiming);
      this.lighting.follow(p.pos);
      this.world.updateOcclusion(p.pos, this.camera.toCamera);
    }

    if (this.flow !== 'menu' && this.flow !== 'briefing' && this.flow !== 'ending') {
      const alert = this.runtime.enemies.some((e) => e.alive && !e.dormant && e.hostile && (e.state === AIState.Alerted || e.state === AIState.Pursuing || e.state === AIState.Attacking));
      this.areaTimer -= dt;
      if (this.areaTimer <= 0) {
        this.areaTimer = 0.5;
        this.areaName = areaAt(p.pos.x, p.pos.z);
      }
      this.ui.hud.update(dt, this.camera, alert && this.flow === 'playing', this.flow === 'playing' ? this.markerPosition() : null, this.areaName);
    }
    this.ui.dialogue.update(dt);
    this.renderer.render(this.camera.camera);
  }

  private handleMenuKeys(i: PlayerIntent): void {
    if (this.flow === 'panel') {
      if (i.pause || (i.inventory && this.ui.inventory.visible) || (i.journal && this.ui.journal.visible)) this.closePanel();
      else if (i.journal && this.ui.inventory.visible) this.openPanel('journal');
      else if (i.inventory && this.ui.journal.visible) this.openPanel('inventory');
    } else if (this.flow === 'paused' && i.pause) this.resume();
  }

  private updatePlaying(dt: number, intent: PlayerIntent): void {
    if (intent.pause) return this.openPause();
    if (intent.inventory) return this.openPanel('inventory');
    if (intent.journal) return this.openPanel('journal');
    if (intent.zoomDelta) this.camera.addZoom(intent.zoomDelta);

    this.time += dt;
    this.runtime.now = this.time;
    this.session.state.playTime += dt;
    this.gunfireSuspicionCd -= dt;
    const p = this.runtime.player;
    this.controller.update(dt, intent);
    this.input.touch.setWeaponMelee(this.controller.weapon().kind === 'melee');

    for (const e of this.runtime.enemies) {
      this.ai.update(e, dt);
      const combat = e.alive && !e.dormant && e.hostile && (e.state === AIState.Pursuing || e.state === AIState.Attacking || e.state === AIState.Alerted);
      e.rig.setRing(combat ? 0xc94a4a : null);
    }
    for (const n of this.runtime.npcs) updateNpc(n, dt, this.ctx);

    // Auto-pickup of drops.
    for (const o of [...this.runtime.objects]) {
      if (o.autoPickup && p.alive && o.pos.distanceTo(p.pos) < 1.1) this.completeObject(o);
      o.root.visible = !o.spawn.showIf || this.session.check(o.spawn.showIf);
    }

    this.runtime.updateZones();
    this.updateInteraction(intent);

    if (p.state === PlayerState.Interacting) this.ui.hud.setInteractProgress(1 - p.interactTimer / Math.max(0.01, p.interactDuration));
    else this.ui.hud.setInteractProgress(null);

    // Give the death animation a moment before the result screen.
    if (!p.alive) this.deathTimer += dt;
    else this.deathTimer = 0;
    if (p.alive || this.deathTimer > 1.6) {
      const outcome = this.missions.update();
      if (outcome) this.handleOutcome(outcome);
    }
  }

  // ───────────────────────────── Interaction ─────────────────────────────

  private npcName(n: NPC): string {
    if (n.spawn.civilian) return 'Yoldan geçen';
    return SPEAKERS[n.spawn.character]?.name ?? n.spawn.label ?? n.id;
  }

  private findTarget(): InteractTarget | null {
    const p = this.runtime.player;
    if (!p.alive || p.busy) return null;
    let best: InteractTarget | null = null;
    let bestScore = Infinity;
    const consider = (x: number, z: number, range: number, make: () => InteractTarget, bias = 0) => {
      const d = Math.hypot(x - p.pos.x, z - p.pos.z);
      if (d > range) return;
      // Prefer things in front of the player; doors yield to people and objects.
      const dot = ((x - p.pos.x) * Math.sin(p.facing) + (z - p.pos.z) * Math.cos(p.facing)) / (d || 1);
      const score = d - dot * 0.5 + bias;
      if (score < bestScore) {
        bestScore = score;
        best = make();
      }
    };
    for (const n of this.runtime.npcs) {
      if (!n.alive || n.spawn.civilian) continue;
      consider(n.pos.x, n.pos.z, 3.0, () => ({ kind: 'npc', npc: n, label: `Konuş: ${this.npcName(n)}` }));
    }
    for (const e of this.runtime.enemies) {
      if (!e.alive || e.dormant || e.hostile || (!e.spawn.dialogues && !e.spawn.bark)) continue;
      consider(e.pos.x, e.pos.z, 2.6, () => ({ kind: 'enemy', enemy: e, label: `Konuş: ${e.spawn.name}` }));
    }
    for (const o of this.runtime.objects) {
      if (o.autoPickup || !o.root.visible) continue;
      consider(o.pos.x, o.pos.z, 1.7, () => ({ kind: 'object', obj: o, label: o.label }));
    }
    for (const d of this.world.doors.values()) {
      consider(d.def.x, d.def.z, 1.9, () => ({ kind: 'door', door: d, label: `${d.open ? 'Kapat' : 'Aç'}: ${d.def.name}${d.locked ? ' (kilitli)' : ''}` }), 1.2);
    }
    return best;
  }

  private updateInteraction(intent: PlayerIntent): void {
    const prev = this.target;
    this.target = this.findTarget();
    if (prev && prev !== this.target) {
      if (prev.kind === 'npc') prev.npc.rig.setRing(null);
      if (prev.kind === 'object') prev.obj.highlighted = false;
    }
    const t = this.target;
    if (t?.kind === 'npc') t.npc.rig.setRing(0xd99a42);
    if (t?.kind === 'enemy') t.enemy.rig.setRing(0xd99a42);
    if (t?.kind === 'object') t.obj.highlighted = true;
    this.ui.hud.setPrompt(t ? t.label : null, this.input.touch.active ? '◉' : 'E');
    this.input.touch.setInteractAvailable(!!t, t ? t.label.split(':')[0] : '');
    if (t && intent.interact) this.interact(t);
  }

  private interact(t: InteractTarget): void {
    const p = this.runtime.player;
    switch (t.kind) {
      case 'npc':
      case 'enemy': {
        const ent = t.kind === 'npc' ? t.npc : t.enemy;
        const rules = t.kind === 'npc' ? t.npc.spawn.dialogues : t.enemy.spawn.dialogues;
        const rule = rules?.find((r) => this.session.check(r.when));
        if (rule) this.startDialogue(rule.dialogue, ent);
        else {
          const bark = t.kind === 'npc' ? t.npc.spawn.bark : t.enemy.spawn.bark;
          const name = t.kind === 'npc' ? this.npcName(t.npc) : t.enemy.spawn.name;
          if (bark) this.ui.hud.floater(new THREE.Vector3(ent.pos.x, ent.rig.height + 0.9, ent.pos.z), `${name}: ${bark}`, 'bark', 2.6, 0.2);
        }
        break;
      }
      case 'object': {
        const s = t.obj.spawn;
        if (s.requires && !this.session.check(s.requires)) {
          this.ui.hud.toast(s.requiresText ?? 'Bunu şimdi yapamazsın.', 'bad');
          this.audio.play('empty');
          return;
        }
        p.facing = Math.atan2(t.obj.pos.x - p.pos.x, t.obj.pos.z - p.pos.z);
        if (s.duration) {
          this.pendingObject = t.obj;
          this.controller.beginInteract(s.duration);
          this.audio.play('interact');
        } else this.completeObject(t.obj);
        break;
      }
      case 'door': {
        const d = t.door;
        if (d.locked && !d.open) {
          this.ui.hud.toast(d.lockText || 'Kilitli.', 'bad');
          this.audio.play('empty');
          return;
        }
        d.setOpen(!d.open);
        const open = this.session.state.world.openDoors;
        if (d.open && !open.includes(d.def.id)) open.push(d.def.id);
        if (!d.open) this.session.state.world.openDoors = open.filter((x) => x !== d.def.id);
        // Don't trap yourself inside the door frame.
        this.world.collision.resolveCircle(p.pos, p.radius);
        this.audio.play('door');
        break;
      }
    }
  }

  private completeObject(o: InteractableObject): void {
    if (o.used) return;
    this.audio.play('interact');
    this.session.setFlag(FlagKeys.interact(o.spawn.id));
    if (o.spawn.once !== false) this.runtime.removeObject(o);
    this.session.apply(o.spawn.effects);
    // Some objects change what doors are unlocked (keys).
    this.runtime.applyDoorLocks();
  }

  // ───────────────────────────── Dialogue ─────────────────────────────

  private startDialogue(id: string, who: NPC | Enemy | null): void {
    if (!this.dialogue.start(id)) return;
    this.flow = 'dialogue';
    const p = this.runtime.player;
    p.vel.set(0, 0, 0);
    if (p.state === PlayerState.Reloading || p.state === PlayerState.Aiming) p.setState(PlayerState.Idle);
    if (who) {
      who.facing = Math.atan2(p.pos.x - who.pos.x, p.pos.z - who.pos.z);
      p.facing = Math.atan2(who.pos.x - p.pos.x, who.pos.z - p.pos.z);
      who.syncTransform();
      p.syncTransform();
    }
    this.effects.setLaser(null);
    this.ui.hud.setPrompt(null);
    this.ui.dialogue.show();
    this.input.flush();
    this.audio.play('interact');
  }

  chooseDialogue(index: number): void {
    if (this.flow !== 'dialogue') return;
    this.dialogue.choose(index);
    if (this.dialogue.active) this.ui.dialogue.render();
  }

  private endDialogue(): void {
    this.ui.dialogue.hide();
    this.input.flush();
    this.runtime.applyDoorLocks();
    if (this.flow === 'dialogue') this.flow = 'playing';
  }

  // ───────────────────────────── World events ─────────────────────────────

  private onWorldEvent(name: string, arg?: string): void {
    switch (name) {
      case 'activate':
        if (arg) this.runtime.activateGroup(arg);
        break;
      case 'hostile':
        if (arg) this.runtime.setHostile(arg);
        break;
      case 'follow':
        if (arg) this.runtime.follow(arg);
        break;
      case 'unfollow':
        if (arg) this.runtime.follow(arg, false);
        break;
      case 'hide':
        if (arg) this.runtime.hide(arg);
        break;
      case 'injure':
        if (arg) this.runtime.injure(arg);
        break;
      case 'ledgerDecision':
        this.openDecision();
        break;
      case 'submitAll': {
        let n = 0;
        for (const e of this.session.evidence.list()) {
          if (e.status !== 'collected' && e.status !== 'kept') continue;
          this.session.apply([{ type: 'evidence', id: e.id, action: 'submit' }]);
          n++;
        }
        if (n) this.ui.hud.toast(`${n} kanıt merkeze teslim edildi.`, 'good');
        break;
      }
    }
  }

  private triggerExposure(): void {
    const m = this.runtime.mission;
    if (!m || this.session.flag(FlagKeys.exposed)) return;
    this.session.setFlag(FlagKeys.exposed);
    if (m.exposureBranch) {
      this.ui.hud.toast('Kimliğin deşifre oldu! Canını kurtar!', 'bad');
      this.runtime.setHostile('org');
      this.runtime.activateGroup('exposed_crew');
      this.audio.play('alert');
    }
  }

  // ───────────────────────────── Combat callbacks ─────────────────────────────

  private onDamage(e: DamageEvent): void {
    const p = this.runtime.player;
    const t = e.target;
    const fromPlayer = e.source === p;
    if (t === p) {
      this.ui.hud.hurt(e.amount);
      this.audio.play('hurt');
      this.camera.addShake(0.22);
      if (e.killed) {
        this.audio.play('death');
        p.setState(PlayerState.Dead);
        this.effects.setLaser(null);
      }
      return;
    }
    if (this.settings.showDamageNumbers && fromPlayer) this.ui.hud.floater(e.point, String(e.amount), e.killed ? 'dmg kill' : 'dmg', 0.8, 1.0);

    if (t instanceof Enemy) {
      if (fromPlayer && !t.hostile) {
        // Attacking a member of the organisation you supposedly work for.
        if (t.spawn.faction === 'org') {
          this.session.reputation.change('suspicion', 35, 'Örgüt üyesine saldırdın');
          this.session.reputation.change('mafia', -15);
          this.runtime.setHostile('org');
        } else this.runtime.setHostile(t.spawn.faction);
      }
      if (fromPlayer && t.alive && t.hostile && t.state !== AIState.Attacking) this.runtime.alertTo(t, p.pos);
      if (e.killed) {
        this.audio.play('death', 0.6);
        const w = this.session.state.world;
        if (!w.killed.includes(t.id)) w.killed.push(t.id);
        for (const tag of new Set([...t.tags, t.spawn.faction])) this.session.addCounter(FlagKeys.kill(tag), 1);
        for (const d of t.spawn.drops ?? []) this.runtime.spawnDrop(d.item, d.count, t.pos.x, t.pos.z);
        if (fromPlayer) this.session.progression.addXp(t.role === 'enforcer' ? 15 : 10);
        t.rig.setRing(null);
      }
      return;
    }
    if (t instanceof NPC) {
      if (t.spawn.civilian && fromPlayer) {
        if (e.killed) {
          this.session.reputation.change('police', -10, 'Sivil öldürüldü');
          this.session.reputation.change('integrity', -12);
          this.session.setFlag('story.civilian_killed');
        } else this.session.reputation.change('police', -3, 'Sivil yaralandı');
      }
      if (e.killed && !t.spawn.civilian) this.ui.hud.toast(`${this.npcName(t)} vuruldu!`, 'bad');
      if (t.spawn.civilian) scareNpcs(this.ctx, t.pos.x, t.pos.z, 8);
    }
  }

  private onNoise(x: number, z: number, radius: number, fromPlayer: boolean): void {
    let neutralOrgHeard = false;
    for (const e of this.runtime.enemies) {
      if (!e.alive || e.dormant) continue;
      if (Math.hypot(e.pos.x - x, e.pos.z - z) > radius) continue;
      this.ai.hearNoise(e, x, z, fromPlayer);
      if (!e.hostile && e.spawn.faction === 'org') neutralOrgHeard = true;
    }
    if (radius >= 10) scareNpcs(this.ctx, x, z, radius);
    // Firing a gun where the organisation can hear it, with no fight going on, raises eyebrows.
    if (fromPlayer && radius >= 10 && neutralOrgHeard && this.gunfireSuspicionCd <= 0) {
      const fighting = this.runtime.enemies.some((e) => e.alive && !e.dormant && e.hostile && e.state === AIState.Attacking);
      if (!fighting) {
        this.gunfireSuspicionCd = 8;
        this.session.reputation.change('suspicion', 4, 'Silah sesi dikkat çekti');
      }
    }
  }

  // ───────────────────────────── Objective markers ─────────────────────────────

  private markerPosition(): THREE.Vector3 | null {
    const m = this.runtime.mission;
    if (!m) return null;
    const views = this.missions.objectives().filter((o) => o.status === 'active' && o.def.marker);
    // Required objectives first.
    views.sort((a, b) => Number(!!a.def.optional) - Number(!!b.def.optional));
    for (const v of views) {
      const pos = this.resolveMarker(v.def.marker!);
      if (pos) return pos;
    }
    return null;
  }

  private resolveMarker(ref: MarkerRef): THREE.Vector3 | null {
    const m = this.runtime.mission!;
    if ('zone' in ref) {
      const z = m.zones.find((x) => x.id === ref.zone);
      return z ? new THREE.Vector3(z.x, 1.5, z.z) : null;
    }
    if ('npc' in ref) {
      const n = this.runtime.npc(ref.npc);
      return n && n.alive ? new THREE.Vector3(n.pos.x, n.rig.height + 0.6, n.pos.z) : null;
    }
    if ('interactable' in ref) {
      const o = this.runtime.objects.find((x) => x.spawn.id === ref.interactable);
      if (!o || !o.root.visible) return null;
      if (o.spawn.hiddenLead && !this.session.progression.hasSkill('inv_network')) return null;
      return new THREE.Vector3(o.pos.x, 1.4, o.pos.z);
    }
    if ('enemyTag' in ref) {
      const p = this.runtime.player.pos;
      let best: Enemy | null = null;
      for (const e of this.runtime.enemiesWithTag(ref.enemyTag)) {
        if (!e.alive || e.dormant) continue;
        if (!best || e.pos.distanceTo(p) < best.pos.distanceTo(p)) best = e;
      }
      if (best) return new THREE.Vector3(best.pos.x, best.rig.height + 0.6, best.pos.z);
      // Target is down: point at whatever mission item it dropped.
      const drop = this.runtime.objects.find((o) => o.autoPickup && o.spawn.effects.some((e) => e.type === 'giveItem' && ITEMS[e.item]?.missionItem));
      return drop ? new THREE.Vector3(drop.pos.x, 1.2, drop.pos.z) : null;
    }
    return new THREE.Vector3(ref.pos.x, 1.2, ref.pos.z);
  }

  // ───────────────────────────── Flow ─────────────────────────────

  private showBriefing(): void {
    const m = this.missions.active;
    if (!m) return this.toMainMenu();
    this.flow = 'briefing';
    this.ui.closeOverlays();
    this.ui.hud.show(false);
    this.ui.story.briefing(m);
  }

  newGame(): void {
    this.session.state = createNewGameState();
    this.missions.snapshot = null;
    this.runtime.clear();
    this.showBriefing();
  }

  continueGame(): void {
    const r = this.saves.load();
    if (!r.ok) {
      this.ui.hud.toast(r.error, 'bad');
      this.ui.menu.show();
      return;
    }
    this.session.state = r.save.state;
    this.missions.resume(r.save.snapshot);
    const m = this.missions.active;
    if (!m) {
      if (this.session.flag('story.finale_done')) return this.showEnding();
      return this.toMainMenu();
    }
    if (!this.session.state.player.position) return this.showBriefing();
    this.enterMission(false);
    this.ui.hud.toast(r.fromBackup ? 'Ana kayıt bozuktu; yedek kayıt yüklendi.' : 'Kayıt yüklendi.', r.fromBackup ? 'bad' : 'good');
  }

  startBriefedMission(): void {
    const m = this.missions.active;
    if (!m) return;
    this.missions.start(m.id);
    this.enterMission(true);
  }

  /** Spawn the active mission and switch to gameplay. */
  private enterMission(autosave: boolean): void {
    const m = this.missions.active!;
    this.effects.clear();
    this.ui.hud.clearTransient();
    this.time = 0;
    this.runtime.now = 0;
    this.deathTimer = 0;
    this.runtime.load(m);
    const p = this.runtime.player;
    p.object.visible = true;
    p.setState(PlayerState.Idle);
    p.invulnerable = false;
    p.lastDamageAt = -99;
    this.camera.snapTo(p.pos);
    this.ui.closeOverlays();
    this.ui.hud.show(true);
    this.flow = 'playing';
    this.input.flush();
    if (autosave) {
      const r = this.saves.save(this.session.state, this.missions.snapshot, `Görev ${m.index}: ${m.title}`);
      if (r.ok) this.ui.hud.toast('Otomatik kayıt yapıldı.');
    }
    this.ui.hud.toast(`GÖREV ${m.index}: ${m.title}`, 'info');
  }

  restartMission(): void {
    const m = this.missions.restart();
    if (!m) return this.toMainMenu();
    this.enterMission(false);
    this.ui.hud.toast('Görev yeniden başladı.');
  }

  private handleOutcome(o: MissionOutcome): void {
    this.lastOutcome = o;
    this.flow = 'result';
    this.effects.setLaser(null);
    this.ui.hud.setPrompt(null);
    this.ui.hud.show(false);
    this.ui.closeOverlays();
    this.audio.play(o.success ? 'success' : 'failure');
    if (o.success) {
      const st = this.session.state;
      st.player.position = null;
      st.player.health = st.player.maxHealth;
      this.missions.snapshot = null;
      const label = o.nextMission ? `Görev ${o.nextMission.index}: ${o.nextMission.title} (başlamadı)` : 'Operasyon tamamlandı';
      this.saves.save(st, null, label);
    }
    this.ui.story.result(o, o.success && !o.nextMission && this.session.flag('story.finale_done'));
  }

  continueAfterResult(): void {
    const o = this.lastOutcome;
    if (!o) return this.toMainMenu();
    if (o.success && !o.nextMission && this.session.flag('story.finale_done')) return this.showEnding();
    if (o.success && o.nextMission) {
      this.runtime.clear();
      return this.showBriefing();
    }
    this.toMainMenu();
  }

  private showEnding(): void {
    this.flow = 'ending';
    this.runtime.clear();
    this.runtime.player.object.visible = false;
    this.ui.closeOverlays();
    this.ui.hud.show(false);
    const s = this.session.state;
    this.ui.story.ending(computeEnding(s), {
      submitted: Object.values(s.evidence).filter((e) => e.status === 'submitted').length,
      mafia: s.reputation.mafia,
      police: s.reputation.police,
      integrity: s.reputation.integrity,
    });
  }

  toMainMenu(): void {
    this.flow = 'menu';
    this.dialogue.cancel();
    this.runtime.clear();
    this.effects.clear();
    this.runtime.player.object.visible = false;
    this.ui.closeOverlays();
    this.ui.hud.clearTransient();
    this.ui.hud.show(false);
    this.ui.menu.show();
  }

  openPause(): void {
    if (this.flow !== 'playing') return;
    this.flow = 'paused';
    this.effects.setLaser(null);
    this.ui.pause.show();
    this.input.flush();
  }

  resume(): void {
    this.ui.pause.hide();
    this.ui.closeOverlays();
    this.flow = 'playing';
    this.input.flush();
  }

  canSave(): { ok: boolean; reason?: string } {
    if (!this.runtime.mission || this.missions.isFinished) return { ok: false, reason: 'Şu an kaydedilemez' };
    if (!this.runtime.player.alive) return { ok: false, reason: 'Ölüyken kaydedilemez' };
    const combat = this.runtime.enemies.some((e) => e.alive && !e.dormant && e.hostile && (e.state === AIState.Alerted || e.state === AIState.Pursuing || e.state === AIState.Attacking));
    if (combat) return { ok: false, reason: 'Çatışma sırasında kaydedilemez' };
    return { ok: true };
  }

  saveGame(): void {
    const can = this.canSave();
    if (!can.ok) {
      this.ui.pause.setMessage(can.reason ?? '');
      return;
    }
    const st = this.session.state;
    const p = this.runtime.player;
    st.player.position = { x: p.pos.x, z: p.pos.z };
    st.player.facing = p.facing;
    st.player.health = Math.round(p.health);
    const m = this.missions.active!;
    const r = this.saves.save(st, this.missions.snapshot, `Görev ${m.index}: ${m.title}`);
    this.ui.pause.setMessage(r.ok ? `Oyun kaydedildi (${new Date().toLocaleTimeString('tr-TR')}).` : `Kayıt başarısız: ${r.error}`);
  }

  saveInfo(): { label: string; savedAt: number } | null {
    const r = this.saves.load();
    return r.ok ? { label: r.save.label, savedAt: r.save.savedAt } : null;
  }

  applySettings(s: Settings, persist = true): void {
    const qualityChanged = s.quality !== this.renderer.currentQuality;
    this.settings = s;
    if (persist) this.saves.saveSettings(s);
    this.audio.applySettings(s);
    if (qualityChanged || !persist) this.renderer.setQuality(s.quality);
    this.world.setQuality(s.quality);
    this.lighting.setQuality(s.quality);
    this.camera.setUserZoom(s.cameraZoom);
  }

  uiSound(kind: 'ui' | 'uiBack'): void {
    this.audio.play(kind);
  }

  // ───────────────────────────── Panels ─────────────────────────────

  openPanel(kind: 'inventory' | 'journal'): void {
    if (this.flow !== 'playing' && this.flow !== 'panel') return;
    this.flow = 'panel';
    this.effects.setLaser(null);
    this.ui.inventory.hide();
    this.ui.journal.hide();
    if (kind === 'inventory') this.ui.inventory.show();
    else this.ui.journal.show();
    this.audio.play('ui');
    this.input.flush();
  }

  closePanel(): void {
    this.ui.inventory.hide();
    this.ui.journal.hide();
    if (this.flow === 'panel') this.flow = 'playing';
    this.audio.play('uiBack');
    this.input.flush();
  }

  private refreshPanels(): void {
    if (this.ui.inventory.visible) this.ui.inventory.render();
    if (this.ui.journal.visible) this.ui.journal.render();
  }

  useItem(slot: number): void {
    const s = this.session.state.inventory.slots[slot];
    if (!s) return;
    const def = ITEMS[s.item];
    if (def?.category === 'medical') this.controller.useMedkit();
    else if (def?.use) {
      if (!this.session.check(def.use.requires)) this.ui.hud.toast(def.use.requiresText ?? 'Kullanılamaz.', 'bad');
      else this.session.apply(def.use.effects);
    }
    this.refreshPanels();
  }

  dropItem(slot: number): void {
    const s = this.session.state.inventory.slots[slot];
    if (!s) return;
    if (!this.session.inventory.drop(slot)) {
      this.ui.hud.toast('Bu eşya bırakılamaz.', 'bad');
      return;
    }
    this.ui.hud.toast(`${ITEMS[s.item]?.name ?? s.item} bırakıldı.`);
    if (ITEMS[s.item]?.weapon === this.runtime.player.weapon) this.controller.equip('fists');
    this.refreshPanels();
  }

  equipItem(slot: number): void {
    const s = this.session.state.inventory.slots[slot];
    const w = s && ITEMS[s.item]?.weapon;
    if (w) this.controller.equip(w);
    this.refreshPanels();
  }

  unlockSkill(id: string): void {
    if (this.session.progression.unlock(id)) {
      this.ui.hud.toast(`Beceri açıldı: ${SKILL_BY_ID[id].name}`, 'good');
      this.audio.play('success', 0.5);
    }
    this.refreshPanels();
  }

  submitEvidence(id: string): void {
    const before = this.session.evidence.status(id);
    this.session.apply([{ type: 'evidence', id, action: 'submit' }]);
    if (before === 'kept' && id === 'ev_ledger') this.session.reputation.change('suspicion', 6, 'Defter hiç teslim edilmedi');
    this.refreshPanels();
  }

  analyzeEvidence(id: string): void {
    if (!this.session.progression.hasSkill('inv_eye')) return;
    if (this.session.evidence.analyze(id)) this.ui.hud.toast(`Analiz tamamlandı: ${EVIDENCE[id].name}`, 'good');
    this.refreshPanels();
  }

  // ───────────────────────────── Evidence decision ─────────────────────────────

  private openDecision(): void {
    this.flow = 'decision';
    this.effects.setLaser(null);
    this.ui.hud.setPrompt(null);
    this.ui.story.decision(
      'Kayıp Defter',
      'Defter elinde. Haydar onu bekliyor; merkez ise yıllardır böyle bir kanıtın peşinde. Ne yapacaksın?',
      LEDGER_DECISION,
      (o) => this.session.check(o.conditions),
    );
    this.input.flush();
  }

  decide(optionId: string): void {
    const o = LEDGER_DECISION.find((x) => x.id === optionId);
    if (!o || !this.session.check(o.conditions) || this.session.flag('m.ledger_decided')) return;
    this.session.apply(o.effects);
    this.ui.story.hide();
    this.flow = 'playing';
    this.input.flush();
  }
}
