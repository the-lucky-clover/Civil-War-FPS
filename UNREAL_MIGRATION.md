# Gettysburg FPS — Unreal Engine 5 Migration Blueprint

**Status: PLAN ONLY.** This document is a faithful migration plan, not a port.
No UE5 project has been built or compiled: this machine has no GPU and no Unreal
Engine installed, so anything resembling a "recreated" project produced here would
be unverifiable scaffolding. Per the project's no-simulations rule, the actual port
happens in UE5 on a real machine — this blueprint is what makes that port fast.

## Why UE5 is worth it for this game

- **Photorealism by default:** Lumen global illumination + Nanite geometry do what
  the Three.js build strains to fake with one directional light.
- **Humans:** MetaHumans (or a Civil War marketplace pack) replace procedural
  box-soldiers with real faces, cloth, and animation.
- **Smoke and weather:** Niagara handles powder smoke, canister cones, and the
  July 1–3 storm natively; no hand-rolled particle math.
- **Multiplayer:** UE replication + dedicated servers replace the bespoke `ws`
  protocol (`server.ts`).
- **Audio:** MetaSounds with occlusion and volumes replace the Web Audio synth.

## Systems map — where everything lives today, where it goes in UE5

| System | Today | UE5 home |
|---|---|---|
| Renderer / world | `src/game/threeEngine.ts` | `AGameMode` + Level (`Gettysburg.umap`), World Partition |
| Terrain (Gettysburg heightfield) | `gettysburgHeight()` math | Landscape import — bake the height function to a heightmap PNG once, import as Landscape |
| Sky / sun / fog | `updateAtmosphereAndWeather()` | Sky Atmosphere + Directional Light + Exponential Height Fog, driven by a `UGettysburgWeather` component |
| Historical weather (Jul 1–3) | `src/game/gettysburgWeather.ts` | Port the timeline 1:1 — keyframes, `sampleGettysburgWeather()`, sun math all transfer verbatim |
| Musket + 9-step drill | `createViewmodelGun()` + drill keyframes | Skeletal mesh + Anim Montage; drill stages become montage sections (LOAD/HANDLE/TEAR/CHARGE/DRAW/RAM/RETURN/PRIME/SHOULDER) |
| Drill foley | `audioService.playReloadStage()` | MetaSound cues per montage section; same stage list (POWDER/TEAR/BALL/RAMROD/CAP/PRIMER) |
| Cannon mount/aim/fire | `handleInteractKey()` / `fireMountedCannon()` | Interactable Actor + `Possess`-style control; canister = projectile or radial damage, replicated |
| Netcode | `server.ts` (`ws` rooms, JSON) | Dedicated server + replication; `cannon_fired` etc. become RepNotifies/Multicast RPCs |
| AI enemies | `EnemyNPC` update loop | Behavior Trees + EQS (find cover at the stone wall, advance in lines) |
| Band duel audio | `bandMelodies.ts` + Web Audio | MetaSound music system; note data ports directly |
| Missions / waves | `campaignData.ts` | Data Assets (`UDataAsset`) per mission; wave spawners |
| HUD | React `GameHUD.tsx` | UMG widgets; the layout spec ports 1:1 |

## Asset inventory — what to build or buy first

1. **Soldier** (highest visibility): MetaHuman base + Civil War uniform pack
   (marketplace) beats modeling from scratch. Spec: sack coat / butternut,
   kepi, cartridge box, cap pouch, canteen, bedroll — the current procedural
   model's part list is the shopping list.
2. **Springfield 1861** (viewmodel): needs real modeling — ~40" barrel, three
   bands, lock plate, hammer, ramrod, trigger guard. Commission or marketplace.
3. **12-pounder Napoleon**: bronze barrel profile, spoked wheels, split trail —
   current procedural dimensions are a usable spec sheet.
4. **Terrain**: bake `gettysburgHeight()` to a 2048px heightmap; 1 unit = 8 m.
   Landmark placement (Angle, Copse, Little Round Top, Wheatfield) already
   audited in `4fd6976`.
5. **Stone wall / fences / barn**: modular static meshes; the irregular-course
   wall logic ports to a procedural mesh or a 3-course modular set.

## Phased plan (walking skeleton first)

- **Phase 0:** UE 5.5+ install, blank Third Person template, source control (Git LFS).
- **Phase 1:** Import heightmap Landscape + Sky Atmosphere; port
  `gettysburgWeather.ts` to a C++ component; verify July 1/2/3 look right.
- **Phase 2:** Viewmodel musket + 9-step drill montage + foley. This is the
  game's signature — nail it before anything else.
- **Phase 3:** One AI enemy type + hitscan musket + kill/respawn loop.
- **Phase 4:** Cannon interactable + canister, replicated.
- **Phase 5:** Missions/waves, HUD, band duel, dedicated server, playtest.

## Decisions for Steven (not made here)

- **Blueprint vs C++:** gameplay in Blueprint is faster to iterate; netcode and
  the weather component deserve C++.
- **Marketplace vs custom:** uniforms and terrain props are buyable; the
  Springfield viewmodel and the drill animation are custom work.
- **Multiplayer scope:** start with listen-server co-op vs AI before dedicated
  PvP servers.

## What NOT to do

- Do not "port" by auto-translating the Three.js code — the engine paradigms
  (replication, animation blueprints, Niagara) replace whole subsystems.
- Do not skip Phase 1 weather verification: the recorded July 1–3 timeline is
  a design pillar, and Lumen will make it sing.
