# Architecture

## Layers

```
input/  ──► PlayerIntent ──►  gameplay/ (controller, AI, combat)  ──►  GameSession (state + rules)
                                    │                                       │
                                    ▼                                       ▼
                             world/ (collision, nav,               missions/, dialogue/, persistence/
                             MissionRuntime entities)                       │
                                    │                                       ▼
                                    └──────────► rendering/, ui/, audio/ (presentation only)
```

- **`GameSession`** (`src/game/GameSession.ts`) owns the serialisable `GameStateData` and the rule
  systems (`ReputationSystem`, `EvidenceSystem`, `InventorySystem`, `ProgressionSystem`). It evaluates
  data `Condition`s and applies data `Effect`s. It has no Three.js or DOM dependency and is unit tested.
- **`MissionManager`** evaluates objectives from flags/counters (`ObjectiveHandlers.ts`), handles
  branches (`activeIf`), ordering (`after`), failure, rewards and the restart snapshot.
- **`DialogueManager`** runs `DialogueDef` graphs; all consequences are effects applied through the session.
- **`MissionRuntime`** spawns the mission's entities and objects from `MissionDef` data and translates
  world events (`activate`, `hostile`, `follow`, `hide`, `injure`) into entity changes.
- **`CharacterController`** is the player's state machine (Idle, Walking, Running, Aiming, Attacking,
  Reloading, Dodging, Interacting, Stunned, Dead). **`EnemyAI`** is the enemy FSM (Idle, Patrol,
  Suspicious, Investigating, Alerted, Pursuing, Attacking, Searching, Returning, Dead).
- **`CombatSystem`** is the single place where hits are resolved and damage is applied.
- **`Game`** wires everything, runs the frame loop and the flow state machine
  (menu → briefing → playing ⇄ paused/panel/dialogue/decision → result → ending).
- **UI** reads through the `GameFacade` interface and never mutates state directly.

World events, flags and counters follow naming conventions so missions stay data-only:
`m.zone.<id>`, `m.dlg.<id>`, `m.int.<id>`, `m.kill.<tag>` (mission-scoped, cleared on mission start)
and `story.*` (persistent across missions).

## Save data

`SaveFile { version, savedAt, label, state, snapshot }`. `state` is the full `GameStateData`;
`snapshot` is the state at mission start so "restart mission" works after loading. `migrateState`
upgrades older versions step by step; `validateState` rejects malformed data before it is written or
loaded; the previous valid save is kept as a backup.

## Future co-op (not implemented)

The MVP is single-player. These seams were chosen so two-player online co-op can be added:

| System | Today | For co-op |
| --- | --- | --- |
| Input | `InputManager` produces a `PlayerIntent` per frame | Remote clients send intents; the server simulates each player's controller |
| Player | One `Player` in `MissionRuntime.player` | Make `players: Player[]`; AI target selection already goes through `chooseTarget` |
| Combat / damage | `CombatSystem.fire/melee/applyDamage` | **Server-authoritative**: clients send fire intents, the server resolves hits and broadcasts `DamageEvent`s |
| Enemy AI | `EnemyAI` per enemy, deterministic given positions | Runs only on the server; clients interpolate snapshots |
| Mission state | `MissionManager` over session flags/counters | **Server-authoritative**; shared progression, per-player objective markers |
| Reputation | `ReputationSystem.change` is the only mutator | **Server-authoritative**; decide whether trust is per player or shared per cover identity |
| Evidence | `EvidenceSystem.apply` with one-time transitions | **Server-authoritative**; choose shared vs. individually tracked evidence |
| Inventory / loot | `InventorySystem` per session | Per-player inventories validated by the server (drops, pickups, ammo) |
| World objects / doors | `MissionRuntime.objects`, `World.doors` | Server owns door state and pickups; clients request interactions |
| Saves | `localStorage` | Host or server persistence |

Additional co-op features to design: downed/revive state (add to the player FSM), dialogue ownership
(who chooses), and a vote or host rule for mission-critical decisions such as the ledger.

## Performance notes

- Shared geometry/material caches (`Materials.ts`), world-scaled UVs so one material tiles any wall.
- Pooled tracers/sprites; flash lights always exist with intensity 0 to avoid shader recompiles.
- LOS ray casts are throttled per enemy; A* re-plans at most every ~0.6 s per agent.
- HUD text updates are throttled (~8 Hz); floaters/markers update per frame.
- Quality presets: Low (no shadows, DPR 1, fewer lights), Medium (1024 shadows, DPR ≤ 1.5), High
  (2048 shadows, DPR ≤ 2, all lights). Measured CPU time ≈ 2 ms/frame at Medium with 5 active enemies,
  ~160 draw calls and ~7k triangles (desktop, Chromium).
- The loop stops rendering while the tab is hidden and the game auto-pauses.
