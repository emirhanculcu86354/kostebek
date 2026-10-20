# KÖSTEBEK: KARANLIK KİMLİK

An isometric 3D action RPG / crime thriller for desktop and mobile browsers. You are an undercover
police officer ("Murat Kaya") inside the Karaca crime family, balancing the organisation's trust,
headquarters' trust and your own conscience while collecting evidence across five connected missions.

All player-facing text is Turkish. Code and technical docs are English.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve dist/ on http://localhost:4173
npm run test       # Vitest: reputation, evidence, missions, save, world/nav integrity
```

Requires Node 18+ (developed on Node 24). No backend; saves go to `localStorage`.

## Controls

| Action | Desktop | Mobile |
| --- | --- | --- |
| Move | WASD / arrows (camera-relative) | Left virtual stick |
| Run | Shift | "Koş" toggle / push stick fully |
| Aim | Mouse; hold right button for precise aim + laser | Right stick (fires when pushed to the edge) |
| Attack / shoot | Left mouse | "Saldır" (auto-targets the nearest visible hostile) |
| Interact | E | Contextual "E" button |
| Reload | R | "Şarjör" |
| Dodge | Space | "Kaç" |
| Switch weapon | Q | "Silah" |
| Use medkit | H | "Tedavi" |
| Character (inventory / skills / reputation) | Tab or I | ▤ button |
| Journal (mission / evidence / completed) | J | ✎ button |
| Pause | Esc / P | ☰ button |
| Zoom | Mouse wheel; camera distance in Settings | Settings |

Dialogue choices: click/tap or press 1–9; Enter skips the typewriter effect.

## What is in the prototype

- **Five playable missions** (`src/missions/MissionData.ts`): YENİ KİMLİK, ARKA MASA, KAYIP DEFTER,
  SADAKAT TESTİ, KÖSTEBEK — each with map-based objectives, optional objectives, failure conditions and
  branches. Mission 4 has three paths (comply / stage a fake beating and smuggle the victim out unseen /
  openly protect him); mission 5 ends in one of several confrontations and computes an epilogue.
- **Undercover identity**: Örgüt Güveni, Emniyet Güveni, Şüphe (plus hidden Vicdan) in a central
  `ReputationSystem`. Suspicion tiers (30/60/85) change guard detection speed and dialogue; crossing
  critical mid-mission exposes you (mission failure, or an escape branch in mission 5).
- **Stealth**: organisation guards ignore you until you trespass in restricted zones (vision cone +
  line of sight + detection meter); gunfire near them raises suspicion; attacking one turns the whole
  organisation hostile.
- **Combat**: hitscan pistol and shotgun with wall-blocked line of sight, melee, reload, dodge with
  i-frames, stuns, damage numbers, muzzle flash/tracers. Three enemy roles (guard, gangster that seeks
  cover and keeps distance, enforcer that charges and punches) running a 10-state FSM with A* pathing.
- **Evidence**: 8 evidence items with one-time submit/return/keep rules, analysis via skill, and the
  mission 3 ledger decision (send to HQ / photograph & return / return / keep for later).
- **Data-driven dialogue** with conditions, effects, skill-gated and evidence-gated options.
- **Inventory** (capacity, stacks, mission-item protection, use/equip/drop), **9 skills** in three
  branches, XP and levels.
- **Versioned save** with validation, migration (v1→v2), backup fallback, autosave at mission start
  and on completion, manual save when out of combat.
- **Desktop + mobile UI**: responsive HUD, twin-stick multitouch controls with safe-area support,
  landscape and portrait layouts.
- **Procedural audio** (Web Audio) and **procedural 3D assets**; optional GLB overrides via
  `public/assets/manifest.json` (see `docs/ASSETS.md`).

## Project layout

```
src/
  main.ts                 boot
  game/                   Game orchestrator, GameSession (authoritative state + rules), types, ending
  rendering/              renderer, iso camera, lighting, textures, materials, effects, AssetManager
  world/                  district map data, collision + nav grid, props, doors, mission runtime
  entities/               Player, Enemy, NPC, procedural humanoid rig
  gameplay/               controller, combat, enemy AI, reputation, evidence, inventory, progression
  missions/               mission types, data, manager, objective handlers
  dialogue/               dialogue types, data, manager
  persistence/            save schema + manager
  input/                  keyboard/mouse, touch, merged PlayerIntent
  ui/                     HUD, menus, panels, dialogue box
  audio/                  synthesized sound
  debug/                  dev-only automation harness (excluded from production builds)
tests/                    Vitest suites
docs/                     ARCHITECTURE.md (incl. co-op plan), ASSETS.md
```

See `docs/ARCHITECTURE.md` for system boundaries and the future co-op plan.

## Development notes

- In `npm run dev`, `window.dev` exposes automation helpers (`dev.startMission('m3')`,
  `dev.walkTo(x, z)`, `dev.fight()`, `dev.talk()`), and `window.__kostebek.advance(seconds)` steps the
  simulation deterministically. Neither exists in production builds.
- If the dev server ever serves stale code after edits (seen once with the non-ASCII project path),
  restart `npm run dev`.

## Known limitations

- No external 3D models or audio files are bundled; everything is procedural. Characters use a
  code-animated low-poly rig rather than skeletal animation.
- Single-player only. The architecture is prepared for co-op but there is no network layer.
- Audio is synthesized at runtime; it was exercised in code paths but not listened to during automated testing.
