# Virtual Church Asset Licenses

## Alife v3 Male Hero V14 — runtime candidate

- Immutable assets: `v3/releases/male-hero-v14-r1/characters/character-hero-male-{high,medium,low}.glb`, `character-hero-male-picker.webp`; manifest in that same directory.
- Source: VRoid Studio built-in `AvatarSample_C`, pixiv VRoid Project / pixiv Inc.; Alife face, eyes, wardrobe and motion adaptations. Retained source hashes match the original authoring record in the visual-upgrade plan. This is a derivative, **not CC0** and not an entirely original model.
- Conditions checked 2026-10-06: [official sample-model conditions](https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z) and [official AvatarSample_C model](https://hub.vroid.com/en/characters/1248981995540129234/models/8640547963669442173). Respect the prohibited conduct, redistribution restrictions and no-implied-endorsement rules. The retained intermediate VRM has conflicting generic export flags; originals are not rewritten. The publisher's model-specific sample conditions are recorded separately rather than silently treating those flags as permissive.
- Motions: Mixamo-derived locomotion, locally refined and retargeted; [Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html). Embedded in the project character, not sold or redistributed as a standalone animation library.
- Current public-role scope was approved by the user on 2026-10-06. This permits local integration, **not deployment**. Same approved candidate bytes and portrait; independent 126-bone rig shared across its three LODs, not yet shared with the female rig. Full V3 visual, motion, switch-residency, performance and real-device gates remain open.
- Reproduction: `tools/virtual-church/prepare-male-hero-release.mjs` verifies exact original/candidate hashes and refuses to overwrite a differing release.

## Alife v3 Gate A Female Hero

- Assets: `v3/releases/gate-a-baseline-r9/characters/character-hero-female-high.glb`, `v3/releases/gate-a-baseline-r9/characters/character-hero-female-medium.glb`, `v3/releases/gate-a-baseline-r9/characters/character-hero-female-low.glb`, `v3/releases/gate-a-baseline-r9/characters/character-hero-female-picker.webp`
- Machine-readable manifest: `v3/releases/gate-a-baseline-r9/characters/character-hero-female.manifest.json`
- Historical rollback assets: the corresponding High/Medium/Low GLBs, picker portrait, and manifest under `v3/releases/gate-a-baseline-r8/characters/` share the same VRoid sample-model provenance; r9 additionally contains retargeted Mixamo motion.
- Source model: VRoid Studio sample model `AvatarSample_Q`
- Source creator: pixiv VRoid Project
- Alife adaptation: fair-skin calibration, web LODs, texture/geometry compression, and runtime animation clips
- Source workfile: `tools/blender/virtual_church/v3/character-hero-female-beauty-source.blend`
- Export pipeline: `tools/blender/virtual_church/v3/export_vroid_gate_a_female_hero.py`
- Picker portrait pipeline: `tools/blender/virtual_church/v3/render_vroid_character_picker.py`
- License: VRoidPreset_A-Z sample-model conditions of use
- License URL: https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z
- r9 motion source: Adobe Mixamo animation library, retargeted and locally refined for the Alife character; see the r9 machine-readable manifest's `provenance.motionAdaptation` field.
- Motion-use guidance: [Adobe Mixamo FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html) permits royalty-free use of animations in personal, commercial, and non-profit projects, including games. [Adobe's Mixamo licensing discussion](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400?lang=en) distinguishes use within a project from offering raw character or animation files as an asset product. Alife uses the motion within its interactive scene; it does not offer these GLBs as a reusable asset pack. This records provenance and the published guidance, not a legal determination about web-delivered model files.
- Project use: Complete stylized female guide character with a shared 187-bone VRoid rig, three web LODs, runtime motion clips, and a transparent picker portrait rendered from the same released High GLB.

The official sample-model conditions allow for-profit and non-profit use,
editing, and redistribution without mandatory attribution. The source is not
CC0 and must not be represented or redistributed as CC0. The machine-readable
manifest records the derivative provenance, license URL, GLB hashes, LOD
budgets, rig, materials, compression extensions, and animation set.

## Alife VC-02/VC-04 Church Entrance

- Assets: `buildings/church-hero.glb`, `buildings/church-hero-medium.glb`, `buildings/church-hero-low.glb`, `buildings/church-props.glb`, `textures/church-material-atlas-basecolor.png`, `textures/church-material-atlas-orm.png`, `textures/church-material-atlas-normal.png`; the three church GLBs and three atlases also have release-scoped copies under both `v3/releases/gate-a-baseline-r8/` and `v3/releases/gate-a-baseline-r9/`.
- Creator: Alife project
- Source: `tools/blender/virtual_church/build_virtual_church_assets.py`, `tools/blender/virtual_church/prepare_vc04_texture_atlas.py`
- License: Project-authored asset; copyright retained by the project owner; no separate redistribution license has been granted
- Project use: Real-scale church entrance hero LODs, reusable church-specific props, and their shared PBR atlas.

The meshes were authored for Alife from the approved VC-01 direction. The
VC-04 atlas source was generated specifically for this project with OpenAI's
built-in image generation tool, then transformed locally into base-color,
occlusion/roughness/metallic, and normal maps. The complete prompt and source
path are retained in the source pipeline and the single v3 master plan. No third-party mesh or
texture content is embedded in the GLBs.

The r8/r9 release-scoped church GLBs are byte-identical to their unversioned
counterparts. Their atlases use lossless PNG re-encoding: the release files
match each other byte-for-byte and have decoded RGBA pixels identical to the
unversioned atlases, as checked by `validate-gate-a-church-baseline.mjs`.

## Alife V3 Foyer Oak Floor Candidate

- Superseded v1 candidate: `C:\Data\Alife\Backups\VirtualChurch\foyer-oak-basecolor-v1.webp` (512 × 512, 12,740 bytes); no longer distributed or requested at runtime
- Creator: Alife project, using OpenAI's built-in image generation tool for a synthetic material swatch
- Source candidate: `C:\Data\Alife\Temp\virtual-church-oak-floor-review\light-oak-material-candidate.png`
- Conversion: local FFmpeg WebP quality 60; no third-party photo or scanned wood texture
- Asset: `v3/foyer-oak-basecolor-v2.webp` (512 × 512, 17,666 bytes)
- Creator: Alife project, using OpenAI's built-in image generation tool for a synthetic continuous oak board-grain swatch; user-supplied foyer/corridor photos were material references, not copied into the asset
- Retained editable source: `C:\Data\Alife\Sources\VirtualChurch\GeneratedTextures\foyer-oak-board-grain-v2-source.png`
- Conversion: local FFmpeg WebP quality 45; V3-only candidate, original photos and immutable church GLBs unchanged
- License: Project-authored asset; copyright retained by the project owner; no separate redistribution license has been granted
- Project use: V3-only optional base-colour layer over the foyer's existing floor geometry. It is not a photograph of this church or an approved floor-finish specification.

Generation prompt: “Create one square, seamless, tileable BASE-COLOR texture for a real church foyer's light natural oak plank floor. This is a material swatch for a 3D engine, NOT a room render or an installed floor. Orthographic straight-down view, full-frame pale warm oak wood surface with subtle fine lengthwise grain running vertically, lightly varied honey-beige and soft grey-beige fibers. Neutral flat albedo with no directional illumination, no shadows, no specular shine, no vignetting, no perspective. Continuous wood grain across all four edges so it tiles cleanly. Do not include board outlines, gaps, grooves, end joints, objects, text, logo, or watermark; the 3D geometry supplies individual plank seams. Do not make it dark cedar, orange varnish, rustic reclaimed wood, or busy knots. The style should read as restrained contemporary interior oak seen in natural daylight, suitable for a modest New Zealand church lobby.”

## User-Supplied Foyer Reference Photos

- Assets: `v3/foyer-courtyard-reference-01.jpg`, `v3/foyer-courtyard-reference-04.jpg`
- Source: church-site reference photos supplied by the user for this Alife virtual-church work. `foyer-courtyard-reference-01.jpg` is the byte-for-byte copy of `C:\Data\Alife\Sources\VirtualChurch\InteriorReferences\01-corridor-window-right.jpg`; `foyer-courtyard-reference-04.jpg` is the byte-for-byte copy of `C:\Data\Alife\Sources\VirtualChurch\InteriorReferences\04-foyer-entry-stair.jpg`.
- Rights: on 2026-09-28, the user who supplied these two photos explicitly confirmed that these two images may be used on the public Alife website, and reconfirmed that approval on 2026-09-29. This records project-specific public-use permission for the two files below; it is not a blanket license for other supplied photos, unrelated reuse, or third-party redistribution.
- Exact approved files (SHA-256): `foyer-courtyard-reference-01.jpg` = `95577FC7CF33815C8845B1C2AF276FFA1A97E6370ED6C7F20AD17224FB0FBA78`; `foyer-courtyard-reference-04.jpg` = `23E8B825364DDC06F47CC7703613966DB3E700E657F54F90280087981538BE01`. Both public files match the retained local source copies byte-for-byte.
- Project use: narrowly cropped, flat scenic views behind the left-corridor courtyard window and opposite foyer glazing in the V3 review scene. The crops are not surveyed 3D depth, cannot be entered, and do not establish the exact corridor branch or window dimensions.

## Google Draco Decoder

- Assets: `draco/draco_decoder.js`, `draco/draco_decoder.wasm`, `draco/draco_wasm_wrapper.js`
- Creator: Google
- Source: Three.js distribution of Google Draco (`three/examples/jsm/libs/draco/gltf`)
- Upstream: https://github.com/google/draco
- License: Apache License 2.0
- License URL: https://github.com/google/draco/blob/master/LICENSE
- Project use: Browser-side decoding of the VC-04 Draco-compressed church GLBs.

## RPG Character Pack — Cleric, Ranger, and Wizard

- Assets: `characters/cleric.gltf`, `characters/ranger.gltf`, `characters/wizard.gltf`
- Creator: Quaternius
- Source: https://quaternius.com/packs/rpgcharacters.html
- Original pack: RPG Character Pack (November 2020)
- License: Creative Commons CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Project use: Retained only as legacy scene/controller compatibility assets; these RPG classes are no longer exposed by the character picker.

The upstream pack is published for personal and commercial use under CC0.
Attribution is not required by CC0, but this record is retained for asset
provenance and portfolio review.

## Kenney Nature Kit — Optimized site landscaping

- Assets: `nature/tree-broadleaf.glb`, `nature/tree-oak.glb`, `nature/tree-pine.glb`, `nature/flower-purple.glb`, `nature/flower-yellow.glb`, `nature/grass-clump.glb`, `nature/rock-large-a.glb`, `nature/rock-large-c.glb`, `nature/rock-flat.glb`
- Creator: Kenney
- Source: https://kenney.nl/assets/nature-kit
- Original pack: Nature Kit 1.0
- License: Creative Commons CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Project use: Broadleaf, oak and pine tree silhouettes; entrance flower and grass clusters; landscape rocks.

Only nine compact, single-file GLB models were retained from the 330-model
source pack. Together they add approximately 108 KB to the on-demand scene
asset cache.

## Kenney Car Kit — Parking-area vehicles

- Assets: `vehicles/sedan.glb`, `vehicles/suv.glb`, `vehicles/van.glb`, `vehicles/Textures/colormap.png`
- Creator: Kenney
- Source: https://kenney.nl/assets/car-kit
- Original pack: Car Kit 3.1
- License: Creative Commons CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Project use: Correctly scaled sedan, SUV and van silhouettes in the church parking area.

Only three compact GLB models and their shared 12 KB color atlas were retained.
Their combined transfer size is approximately 568 KB and they remain excluded
from PWA precaching.

## Ultimate Modular Men and Women — Church community characters

- Assets: `characters/pastor.gltf`, `characters/believer-man.gltf`, `characters/sister.gltf`, `characters/believer-woman.gltf`
- Preview assets: `thumbnails/modular-men-preview.jpg`, `thumbnails/modular-women-preview.jpg`
- Creator: Quaternius
- Sources: https://quaternius.com/packs/ultimatemodularcharacters.html and https://quaternius.com/packs/ultimatemodularwomen.html
- Original packs: Ultimate Modular Men Pack and Ultimate Modular Women Pack (February 2022)
- License: Creative Commons CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Project use: Distinct pastor, sister, male believer, and female believer avatars with embedded rigs and 24-animation libraries; official pack previews are used as picker thumbnails.

The role names and wardrobe palettes are Alife presentation presets. They do
not imply that the upstream models were authored as religious figures.

## Ultimate Stylized Nature Pack — Bush Large

- Assets: `nature/Bush_Large.gltf`, `nature/Bush_Large.bin`, `nature/Bush_Leaves.png`
- Creator: Quaternius
- Source: https://quaternius.com/packs/ultimatestylizednature.html
- Original pack: Ultimate Stylized Nature Pack (May 2022)
- License: Creative Commons CC0 1.0 Universal
- License URL: https://creativecommons.org/publicdomain/zero/1.0/
- Project use: Detailed entrance planting with textured alpha leaves.
