# Asset manifest

## Bundled assets

| Asset | Source | License | Attribution | Used for |
| --- | --- | --- | --- | --- |
| All 3D props, buildings, doors, characters | Generated in code (`src/world/PropFactory.ts`, `src/world/World.ts`, `src/entities/Humanoid.ts`, `src/world/Interactable.ts`) | Project code | — | Entire world |
| All textures (asphalt, brick, concrete, wood, tiles, signs, icons) | Canvas-generated (`src/rendering/TextureFactory.ts`) | Project code | — | Floors, walls, props, signs, alert icons |
| All sound effects and ambience | Web Audio synthesis (`src/audio/AudioManager.ts`) | Project code | — | Gunfire, footsteps, UI, ambience, drone pad |
| Three.js | https://threejs.org | MIT | Three.js authors | Rendering, GLTFLoader |
| Barlow / Barlow Condensed (web font, loaded from Google Fonts at runtime) | https://fonts.google.com/specimen/Barlow | SIL OFL 1.1 | Jeremy Tribby | UI typography; falls back to system fonts offline |

### Third-party 3D models (`public/assets/models/`)

All from Kenney (www.kenney.nl). Each kit's page and bundled `License.txt` were checked on
2026-10-20 and state Creative Commons CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/);
crediting Kenney is optional. Modification: textures that the kits ship as external
`Textures/*.png` files were embedded into the GLB with `scripts/embed-glb-textures.mjs`; geometry
is unchanged. Colours are adjusted at load time via the manifest (see below).

| File | Kenney kit (source) | Original model | License | Attribution | Replaces prop |
| --- | --- | --- | --- | --- | --- |
| `kenney-crate-strong.glb` | Platformer Kit — https://kenney.nl/assets/platformer-kit | `crate-strong.glb` | CC0 1.0 | Kenney (optional) | `crate` (4×) |
| `kenney-sedan.glb` | Car Kit 3.1 — https://kenney.nl/assets/car-kit | `sedan.glb` | CC0 1.0 | Kenney (optional) | `car` (8×) |
| `kenney-van.glb` | Car Kit 3.1 — https://kenney.nl/assets/car-kit | `van.glb` | CC0 1.0 | Kenney (optional) | `van` (1×) |
| `kenney-shipping-container-a.glb` | City Kit (Industrial) 2.0 — https://kenney.nl/assets/city-kit-industrial | `shipping-container-a.glb` | CC0 1.0 | Kenney (optional) | `container` (1×) |
| `kenney-dumpster-closed.glb` | Retro Urban Kit — https://kenney.nl/assets/retro-urban-kit | `detail-dumpster-closed.glb` | CC0 1.0 | Kenney (optional) | `dumpster` (4×) |
| `kenney-barrier-type-a.glb` | Retro Urban Kit — https://kenney.nl/assets/retro-urban-kit | `detail-barrier-type-a.glb` | CC0 1.0 | Kenney (optional) | `barrier` (1×) |
| `kenney-desk.glb` | Furniture Kit — https://kenney.nl/assets/furniture-kit | `desk.glb` | CC0 1.0 | Kenney (optional) | `desk` (4×) |
| `kenney-lounge-sofa.glb` | Furniture Kit — https://kenney.nl/assets/furniture-kit | `loungeSofa.glb` | CC0 1.0 | Kenney (optional) | `sofa` (2×) |
| `kenney-bookcase-closed-wide.glb` | Furniture Kit — https://kenney.nl/assets/furniture-kit | `bookcaseClosedWide.glb` | CC0 1.0 | Kenney (optional) | `cabinet` (6×) |

`crateStack` and all other props remain procedural. No third-party texture or audio file is included.

## Adding external models (optional)

`public/assets/manifest.json` lists optional GLB/GLTF models that replace procedural props visually.
Collision always keeps the authored footprint, so gameplay does not change.

```json
{
  "version": 1,
  "models": [
    {
      "file": "crate.glb",
      "replacesProp": "crate",
      "source": "https://kenney.nl/assets/...",
      "license": "CC0 1.0",
      "attribution": "Kenney (optional for CC0)"
    }
  ]
}
```

- Put the file in `public/assets/models/`.
- `replacesProp` must be one of the `PropKind` values in `src/world/DistrictMap.ts`
  (crate, crateStack, container, dumpster, car, van, desk, sofa, …).
- The model is scaled to fit the prop's footprint and placed on the ground.
- Optional per-model fields:
  - `rotY` — extra rotation in degrees before fitting (e.g. `180` for Kenney cars, which face +Z
    while procedural cars face −Z; `90` when the model's long side is on the wrong axis).
  - `fit` — `"contain"` (default, uniform scale inside the footprint) or `"stretch"` (fill width,
    depth and height; used for stubby low-poly cars, desks, sofas, barriers).
  - `grayscale` — strip the model's own hues (textures and colours) so the tint defines them.
  - `tint` — hex colour multiplied into every material, to match the scene palette.
  - `usePropColor` — also multiply by the prop's authored `color` in `DistrictMap.ts`
    (each car and the container keep their individual paint).
- GLBs must be self-contained. If a kit references external textures, embed them first:
  `node scripts/embed-glb-textures.mjs <kit>/Models/GLB\ format/x.glb public/assets/models/x.glb`
  (Kenney kits all name their atlas `Textures/colormap.png`, so shared files would clash).
- Check each asset's license individually before adding it, and record source, license and
  attribution in the table above.

Failure handling (verified): a missing manifest, a 404 or an unparsable file logs a console warning
and the procedural version stays. During testing a glTF crate fixture replaced all four crate props,
and a deliberately missing `does_not_exist.glb` left the procedural dumpster in place.
With the current manifest the console reports `[assets] 31 props replaced by GLB models.` and no
warnings (checked 2026-10-20 in the street, parking lot, warehouse, club and offices).
