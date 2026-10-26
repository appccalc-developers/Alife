# Virtual Church Blender Asset Pipeline

This directory contains the reproducible VC-02 entrance source and VC-04 PBR
atlas/compression pipeline. The scripts use metres and mirror the local
coordinate contract already used by `VirtualChurchView.tsx`.

The public trial PR distributes the runtime assets and pipeline scripts, not
the original authoring binaries or raw motion packs. The `.blend` workfiles
and atlas input listed below remain local authoring inputs and must be supplied
at the indicated paths before running authoring/export checks. DCC checks are
not release-CI gates, and a successful runtime build does not prove that those
local authoring inputs were included or regenerated.

## Build

Use Blender 4.5 LTS:

```powershell
& '<path-to-blender.exe>' --background --python .\tools\blender\virtual_church\prepare_vc04_texture_atlas.py
& '<path-to-blender.exe>' --background --python .\tools\blender\virtual_church\build_virtual_church_assets.py
node .\tools\blender\virtual_church\externalize_vc04_glb_textures.mjs
```

Generated project files:

- `church-hero-source.blend`
- `cloudflare/alife-app/public/virtual-church-assets/buildings/church-hero.glb`
- `cloudflare/alife-app/public/virtual-church-assets/buildings/church-hero-medium.glb`
- `cloudflare/alife-app/public/virtual-church-assets/buildings/church-hero-low.glb`
- `cloudflare/alife-app/public/virtual-church-assets/buildings/church-props.glb`
- `cloudflare/alife-app/public/virtual-church-assets/textures/church-material-atlas-basecolor.png`
- `cloudflare/alife-app/public/virtual-church-assets/textures/church-material-atlas-orm.png`
- `cloudflare/alife-app/public/virtual-church-assets/textures/church-material-atlas-normal.png`
- `C:\Data\Alife\Temp\virtual-church\vc-02-church-hero-preview.png` (generated, disposable)

The entrance/interior evidence hierarchy is deliberately conservative. The
user-supplied ten-photo set is primary; the Structex, Alloyfold, and Leighs
Construction galleries for this exact Wigram project are secondary. They
confirm the double-height foyer and the building programme, and show the
auditorium's timber acoustic lining, pale acoustic ceiling, modular carpet, and
movable seating. They do not provide a public floor plan, so stairs, the service
window, corridor doors, and the auditorium connection stay deferred. Flags and
other event decorations are a temporary runtime layer, never baked into the
permanent architectural GLB.

The accepted Gate A female Hero is the fair-warm `vroid-fair-v1` VRoid asset.
Its canonical editable source is:

- `v3/character-hero-female-beauty-source.blend`

Export each runtime LOD from that source with Blender 4.5 LTS. The export script
expects `<lod> <max-texture-size> <output.glb> <report.json>` after `--`:

```powershell
& '<path-to-blender.exe>' .\tools\blender\virtual_church\v3\character-hero-female-beauty-source.blend --background --python .\tools\blender\virtual_church\v3\export_vroid_gate_a_female_hero.py -- high 2048 '<output.glb>' '<ignored-report.json>'
```

Use `medium 1024` and `low 1024` for the other two LODs. Reports and experimental
exports belong under `C:\Data\Alife\Temp\virtual-church\`. Generate the exact picker portrait
from a released GLB with `v3/render_vroid_character_picker.py`; it accepts
`<released-character.glb> <output.webp>` after `--`. The reviewed picker contract
is a transparent 768 x 960 WebP rendered from the released medium GLB, so the
selection card and the runtime avatar always show the same face, skin tone,
hair, costume, and proportions.

The rejected procedural Hero, isolated face-candidate, AI visual-target and
manual-sculpt bootstrap tools were removed. They were not the source of
`vroid-fair-v1` and must not be recreated or used to overwrite the accepted
source.

## Validate

```powershell
node .\tools\blender\virtual_church\validate_virtual_church_glb.mjs
node .\tools\virtual-church\validate-gate-a-animation-runtime.mjs
node .\tools\virtual-church\validate-gate-a-hero-dcc-source.mjs
& '<path-to-blender.exe>' --background --python .\tools\blender\virtual_church\validate_virtual_church_import.py
```

The validator checks GLB structure, triangle order, material limits, file-size
budgets, external shared PBR textures, Draco coverage, animations, and local
bounds. It writes `C:\Data\Alife\Temp\virtual-church\vc-04-asset-report.json` so generated
reports stay out of the source tree. The Blender import check
independently decodes all four deliverables and verifies their real-world
dimensions. The Gate A runtime validator transpiles the pure TypeScript action
mapper, reads the same animation-contract JSON as the GLB builder, and verifies
state mapping, playback modes, jump/landing speed alignment, transition times,
full phase timers, wrapped shortest-angle turning, and non-instant Turn_L/R
state selection without starting a browser.

Before retargeting an external humanoid motion source, enumerate the actual
package instead of relying on catalogue names. Keep generated JSON under
`C:\Data\Alife\Temp\virtual-church\`:

```powershell
& '<path-to-blender.exe>' --background --python .\tools\blender\virtual_church\v3\inspect_animation_source.py -- --source '<source.glb>' --output 'C:\Data\Alife\Temp\virtual-church\animation-source-report.json'
```

The report records the source hash, scene evaluation FPS, per-action sampling
interval, armature and bone names, action timings, locomotion candidates,
probable Root Motion, loop seam displacement, humanoid semantic-bone mapping,
each action's missing core locomotion targets, and a rest-pose Forward/Up/Right
axis estimate backed by the foot-to-toe direction. It
supports GLB, glTF, FBX, and Blend sources and never exports over the input.
Pass `--reference-report <r8-report.json>` to also produce a semantic
source-to-target bone map, median skeleton scale ratio, axis alignment, and an
explicit `forwardReversed` warning before retargeting.

Inspection reports use schema 2 world-space metres (including FBX object
rotation/scale and scene units). Regenerate older reference reports before
comparison; travelling loops also report their root-relative seam.

For the locally supplied Mixamo pack, bake **review-only** Walk/Run actions
onto an approved VRoid Blend without changing its rest meshes:

```powershell
& '<path-to-blender.exe>' --background --python-exit-code 1 --python .\tools\blender\virtual_church\v3\retarget_mixamo_locomotion.py -- --target '<approved.blend>' --source-directory '<extracted-pack>' --output '<new-candidate.blend>' --report 'C:\Data\Alife\Temp\virtual-church\retarget-review.json'
```

Keep the source pack and its provenance outside public assets. The script
requires `walking.fbx` and `standard run.fbx`; it does not assume Jogging or
start/stop clips exist. It preserves the original file, fingerprints rest
geometry/material assignments, transfers world rotations, solves ankle
targets with fixed leg lengths, removes linear root travel and records the
matching controller speed. A saved candidate is **not a passing contact or
aesthetic review**: reach clamps, actual skinned soles, cloth/hair motion and
transitions still need inspection before export. It never updates releases.
For connected VRoid Hips, the candidate releases only the connection flag
while retaining the parent and rest matrices; otherwise Blender ignores the
pelvis location keys. Actual hips displacement is checked during baking.
Ground calibration samples skinned shoes at 60 Hz and applies one shared
vertical offset to both clips (at most 30 mm, targeting 2 mm minimum clearance).
It does not stretch legs, flatten running flight, or certify stance/foot sliding.
Parent-first pose conversion evaluates the skeleton once per mapped pose rather
than once per bone, retaining Blender's inheritance and local-location rules.
To prepare the same-source standing reference for transitions, use
`--append-idle` with the existing candidate as `--target` and a **new** output.
This adds the full `idle.fbx` as `Idle_A`, reuses the existing shared ground
offset, and verifies exact Walk/Run channel fingerprints remain unchanged.
It does not author or approve start/stop clips; those still need planted-foot
transitions and controller displacement checks.
Both inspection and retarget scripts accept `--self-test` in place of inputs.

The female Mixamo review profile can additionally refine heel/toe contacts and
author isolated `Walk_Start` / `Walk_Stop` clips with
`v3/refine_mixamo_locomotion.py -- --target <walk-run-idle.blend> --output
<new-review.blend> --report <ignored.json>` through the same Blender invocation.
It checks the recorded FBX hashes, clip timings, female rig and 30 Hz convention;
it does not assume these contact timings apply to another source or the male rig.
The profile blends contact corrections during swing, permits small pelvis
settling with fixed leg lengths, and checks actual skinned shoe clearance.
Walk start takes 0.6 seconds and stop takes 0.8 seconds; both join the loop at
phase 0.375, **not phase zero**. Their controller speed uses smoothstep
acceleration/deceleration, with displacement equal to half of speed × duration.
Stopping retains the supporting foot until the other lands, then gathers it.
The original input, rest skeleton and mesh/material assignments are preserved.
`--self-test` checks travel, endpoint velocities and landing-curve tangents.
This is a review-only authoring profile, not a release approval or a drop-in
replacement for the r8 runtime contract. Post-save 120 Hz checks, continuous
multi-angle playback and actual-input review are still required. Running
start/stop can be appended to this refined candidate with
`--append-run-transitions` and a new output/report. This preserves every
existing action and adds a 0.4-second `Run_Start` and 0.85-second `Run_Stop`,
joining Run at phase 0.375 with the same smoothstep controller convention.
Braking uses progressively shorter steps rather than holding the initial foot
through the full stopping distance. Running transitions transfer the knee's
bend plane instead of its full thigh vector, preventing a side/back knee flip
when the target ankle differs from the source. They are baked at 120 Hz and
checked against actual skinned shoes at 240 Hz, including between baked keys.
`sample_shoe_contacts` accepts an explicit sampling rate; existing retarget
ground calibration still uses its unchanged 60 Hz default. Braking toe-roll
presentation, running style, turning, hand/outfit clearance, secondary motion
and actual-input review remain open. Numerical checks alone do not approve motion.

After a complete locomotion candidate has been reviewed, use
`refine_mixamo_locomotion.py -- --polish-run-stop-first-brake --target
<complete.blend> --output <new-review.blend> --report <ignored.json>` to isolate
the first `Run_Stop` toe contact. Add `--profile male` for the approved 126-bone
male rig. The profile pins only the left toe during normalized time 0–0.18 at
240 Hz with exact 0.18/0.28 boundary keys, then fades the final reachable local
rotation correction through 0.28;
it does not chase the lifting foot with an unreachable ground target. The input
`Run_Stop` is retained as `Run_Stop_FirstBrakeSource`, every unrelated action
fingerprint and the appearance/rest rig must remain unchanged, and the output
is marked review-only. Post-save contact, join, ground-clearance and continuous
visual checks are required before any GLB export or runtime mapping change.

The retarget module also has a review-only `bake_clip(..., turn_angle=±pi/2)`
primitive for the supplied stationary quarter-turn sources. It bakes at 120 Hz
and counter-rotates absolute foot positions and world rotations against a
smoothstep controller yaw; it does not normalize the captured pelvis angle
or treat a turn as a loop. The right source's pelvis rotates about 103 degrees,
although its filename says 90. Its local anticipation/settling must be retained
while controller heading remains exactly 90 degrees. Self-tests cover signed
heading, cancellation of controller yaw and invalid/non-finite turn parameters.
Existing locomotion and idle CLI behavior is unchanged.

Use `refine_mixamo_locomotion.py -- --append-turns --target <start-stop.blend>
--source-directory <local-extracted-pack> --output <new-review.blend> --report
<ignored.json>` to append the female review profile, or add `--profile male`
for the approved male boot/126-bone rig. It checks both FBX hashes,
keeps all existing actions, and adds `Turn_L` (0.9 s), `Turn_R` (28/30 s), and
their two `_Source` references. Do not export source/reference actions. Each
shoe holds its world footprint outside its swing window, including toe pose;
captured swing arcs are adapted to the same Idle footprint after the quarter
turn. Small pelvis settling preserves leg lengths. Both local endpoints match
the existing Idle pose across the full rig. The controller must apply the
recorded signed smoothstep yaw envelope; applying the clip alone, double yaw,
or the old runtime's duration-only turn mapping is not supported. Partial-angle
turns and chained/interruptible turns still require runtime design and input
verification. This is not a runtime release or user aesthetic approval.
Raw retargeting resets pose bases, so the append workflow restores the input
pose before sampling the existing Idle. Local scales and unkeyed accessories
must not inherit a raw retarget pose. Preserve all pre-existing action curves
and verify sampled poses as well as channel fingerprints after saving.

The approved male boots/126-bone rig use an explicit `--profile male` with
the unrefined Walk/Run/Idle candidate and new output/report paths. This profile
checks the recorded heel/toe probe layout, refines both loops, grounds the full
Idle clip and adds all four Walk/Run starts/stops in one review candidate.
Male contacts and transitions bake at 120 Hz; motion clearance is checked at
240 Hz and the slow Idle at 60 Hz. Solved boot surfaces get small per-foot
clearance corrections after IK, rather than a whole-body lift. Male transition
timings remain 0.6/0.8 seconds for walking and 0.4/0.85 seconds for running,
joining the loops at phase 0.375 with each character's calibrated speed.
Bone-matrix assignment must retain the original local pose scales; inherited
near-unit scale/rotation decomposition must not accumulate into new scaling.
The female profile remains the default. Male quarter turns can now be appended
to this start/stop candidate through `--profile male --append-turns`, with the
same source-relative swing windows and independently checked boot contact.
No runtime assets are exported.

## Scope boundaries

- The high, medium, and low roots have the same local origin and metre scale.
- The photo-backed foyer replaces the old warm planes with the verified first
  view through the entrance glass: warm timber floor, off-white shell, charcoal
  wall lines, timber feature wall and cross, linear lights, and woven-pendant
  silhouettes. It is still a shallow visual volume, not a walkable interior;
  stairs, service-window placement, corridor doors, and room connections remain
  deferred until measured.
- VC-04 uses one shared 1024 px base-color/ORM/normal atlas and Draco-compressed
  geometry; the atlas remains PNG because the current authoring pipeline does
  not provide a reproducible KTX2 encoder.
- Scene loading, LOD selection, collision preservation, and guide regression
  belong to VC-03.
- The accepted Gate A Hero remains a style-slice asset. Its DCC validator binds
  the source blend, VRoid provenance, three released LODs, manifest identity,
  fair-warm appearance and animation contract.
