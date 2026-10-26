import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDir, '..', '..')
const helperPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'virtualChurchCharacterWardrobe.ts',
)
const viewPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'VirtualChurchView.tsx',
)
const servicePath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'services',
  'virtualChurchService.ts',
)
const manifestPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
  'character-hero-female.manifest.json',
)
const pickerPortraitPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
  'character-hero-female-picker.webp',
)

const [helperSource, viewSource, serviceSource, manifestSource, pickerPortrait] = await Promise.all([
  readFile(helperPath, 'utf8'),
  readFile(viewPath, 'utf8'),
  readFile(servicePath, 'utf8'),
  readFile(manifestPath, 'utf8'),
  readFile(pickerPortraitPath),
])
const manifest = JSON.parse(manifestSource)
const transpiled = ts.transpileModule(helperSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: helperPath,
  reportDiagnostics: true,
})
const diagnostics = transpiled.diagnostics ?? []
if (diagnostics.length > 0) {
  const formatted = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => repoRoot,
    getNewLine: () => '\n',
  })
  throw new Error(`Unable to transpile Gate A wardrobe helper:\n${formatted}`)
}

const helperUrl = `data:text/javascript;base64,${Buffer.from(transpiled.outputText).toString('base64')}`
const helper = await import(helperUrl)
const errors = []
const expectedOutfits = ['classic', 'service', 'community']
const tintEntries = Object.entries(helper.GATE_A_OUTFIT_MATERIAL_TINTS)
const swatchEntries = Object.entries(helper.VIRTUAL_CHURCH_OUTFIT_SWATCHES)
const isHexColour = (value) => /^#[0-9a-f]{6}$/i.test(value)
const colourChannels = (value) => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
]

if (
  pickerPortrait.length < 10_000
  || pickerPortrait.subarray(0, 4).toString('ascii') !== 'RIFF'
  || pickerPortrait.subarray(8, 12).toString('ascii') !== 'WEBP'
) {
  errors.push('released character-picker portrait is missing or is not a production WebP asset')
}
const readUint24Le = (buffer, offset) =>
  buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
const pickerPortraitDimensions =
  pickerPortrait.subarray(12, 16).toString('ascii') === 'VP8X'
    ? {
        width: readUint24Le(pickerPortrait, 24) + 1,
        height: readUint24Le(pickerPortrait, 27) + 1,
      }
    : null
if (
  pickerPortraitDimensions?.width !== 768
  || pickerPortraitDimensions?.height !== 960
) {
  errors.push(
    `released character-picker portrait must be the reviewed 768x960 VP8X WebP, received ${JSON.stringify(pickerPortraitDimensions)}`,
  )
}

for (const [label, entries] of [
  ['material tints', tintEntries],
  ['selector swatches', swatchEntries],
]) {
  const keys = entries.map(([key]) => key)
  if (JSON.stringify(keys) !== JSON.stringify(expectedOutfits)) {
    errors.push(`${label} keys ${JSON.stringify(keys)} differ from ${JSON.stringify(expectedOutfits)}`)
  }
  for (const [outfitId, colour] of entries) {
    if (!isHexColour(colour)) errors.push(`${label}.${outfitId} is not a six-digit hex colour`)
  }
}

if (helper.gateAOutfitMaterialTint('classic') !== '#ffffff') {
  errors.push('classic wardrobe must preserve authored GLB vertex colours with a white material tint')
}
const nonDefaultTints = expectedOutfits
  .slice(1)
  .map((outfitId) => helper.gateAOutfitMaterialTint(outfitId))
if (new Set(nonDefaultTints).size !== nonDefaultTints.length) {
  errors.push('non-default wardrobe material tints must be distinct')
}
for (const [index, tint] of nonDefaultTints.entries()) {
  if (colourChannels(tint).some((channel) => channel < 200)) {
    errors.push(`${expectedOutfits[index + 1]} tint ${tint} is too strong for authored vertex colours`)
  }
}

const manifestMaterialNames = manifest.materials?.names ?? []
if (!helper.gateAIsOutfitMaterial(helper.GATE_A_OUTFIT_MATERIAL_NAME)) {
  errors.push('authored outfit material is not recognised')
}
const recognisedOutfitMaterials = manifestMaterialNames.filter(
  helper.gateAIsOutfitMaterial,
)
if (recognisedOutfitMaterials.length < 1) {
  errors.push('manifest does not contain a recognised outfit material')
}
for (const materialName of manifestMaterialNames.filter(
  (name) => /_(?:SKIN|HAIR|FACE|EYE)(?:_| \()/.test(name),
)) {
  if (helper.gateAIsOutfitMaterial(materialName)) {
    errors.push(`non-outfit material ${materialName} is incorrectly recoloured`)
  }
}
const recognisedSkinMaterials = manifestMaterialNames.filter(
  helper.gateAIsSkinMaterial,
)
if (recognisedSkinMaterials.length !== 2) {
  errors.push(`expected exactly two VRoid skin materials, found ${recognisedSkinMaterials.length}`)
}
const opaqueAlphaMaterials = manifestMaterialNames.filter(
  helper.gateAUsesOpaqueAlphaPath,
)
if (
  opaqueAlphaMaterials.length !== helper.GATE_A_OPAQUE_ALPHA_MATERIAL_NAMES.length
  || opaqueAlphaMaterials.some((name, index) =>
    name !== helper.GATE_A_OPAQUE_ALPHA_MATERIAL_NAMES[index])
) {
  errors.push('opaque-alpha material contract no longer matches the protected release manifest')
}
if (helper.GATE_A_SKIN_UNLIT_COLOR !== '#ffffff') {
  errors.push('fair-skin unlit colour contract changed')
}
if (manifest.materials?.sharedSlotCount !== manifestMaterialNames.length) {
  errors.push('manifest shared material-slot count does not match its material names')
}
if (manifest.runtime?.desktopLod !== 'medium' || manifest.runtime?.mobileLod !== 'low') {
  errors.push('runtime character LOD contract must use medium on desktop and low on mobile')
}
const characterAssetUrls = [...serviceSource.matchAll(
  /['"](?<url>\/characters\/[^'"]+\.(?:glb|gltf))['"]/g,
)].map((match) => match.groups.url)
const wardrobeSpecificAssetUrls = characterAssetUrls.filter((url) =>
  expectedOutfits.some((outfitId) => url.toLowerCase().includes(outfitId)),
)
if (wardrobeSpecificAssetUrls.length > 0) {
  errors.push(`wardrobe presets load separate character assets: ${wardrobeSpecificAssetUrls.join(', ')}`)
}

for (const requiredUsage of [
  'gateAOutfitMaterialTint(outfitId)',
  'gateAIsOutfitMaterial(item.name)',
  'gateAIsSkinMaterial(material.name)',
  'gateAUsesOpaqueAlphaPath(clonedMaterial.name)',
  'new MeshBasicMaterial({',
  'color: GATE_A_SKIN_UNLIT_COLOR',
  'toneMapped: false',
  '<GateAHeroAssetBoundary',
  '<GateASkinnedFemaleHero',
  'movementRef={movementRef}',
  'outfitId={outfitId}',
  "isGateAPreview={config3D.visualVersion === 'v3'}",
  'isGateAPreview ? t.gateAWardrobeNote : t.characterNote',
  'src={CHARACTER_HERO_PICKER_PATH}',
  'alt={t.gateAHeroPortraitAlt}',
  'width="768"',
  'height="960"',
  'className="absolute left-1/2 top-[-8px] w-80 max-w-none -translate-x-1/2"',
  'aria-hidden="true">',
  'mt-7 shrink-0 overflow-hidden',
  "gateAHeroAppearance: '浅暖肤色 · 银白长发 · 绿色眼睛'",
  "gateAHeroWardrobe: '象牙白、翡翠绿与金色礼服'",
]) {
  if (!viewSource.includes(requiredUsage)) {
    errors.push(`VirtualChurchView is missing wardrobe integration: ${requiredUsage}`)
  }
}
if (viewSource.includes("{ id: 'wizard', label: t.wizard }")) {
  errors.push('retired Wizard remains selectable in the character picker')
}
if (viewSource.includes("saved === 'ranger' || saved === 'wizard'")) {
  errors.push('retired RPG class selection can still be restored from session storage')
}

const gateASkinnedHeroSource = viewSource.slice(
  viewSource.indexOf('const GateASkinnedFemaleHero ='),
  viewSource.indexOf('class GateAHeroAssetBoundary'),
)
// Inspect JSX props, not a stale single-line spelling: review assets add
// explicit assetPath/characterReview props to the same skinned component.
const viewAst = ts.createSourceFile(viewPath, viewSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
let skinnedWardrobeBound = false
function inspectJsx(node) {
  if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node))
    && node.tagName.getText(viewAst) === 'GateASkinnedFemaleHero') {
    const props = node.attributes.properties.filter(ts.isJsxAttribute)
    skinnedWardrobeBound ||= ['movementRef', 'outfitId'].every(name => props.some(prop =>
      prop.name.getText(viewAst) === name && prop.initializer && ts.isJsxExpression(prop.initializer)
      && prop.initializer.expression?.getText(viewAst) === name))
  }
  ts.forEachChild(node, inspectJsx)
}
inspectJsx(viewAst)
if (!skinnedWardrobeBound) errors.push('Skinned Hero must receive the live movementRef and outfitId props')
for (const requiredReviewUsage of [
  'if (!characterReview) return colors',
  'colors.set(item, item.color.clone())',
  'gateAApplyOutfitMaterialTint(colorMaterial.color, tint, reviewOutfitBaseColors.get(item))',
]) {
  if (!gateASkinnedHeroSource.includes(requiredReviewUsage)) {
    errors.push(`Missing authored review material preservation: ${requiredReviewUsage}`)
  }
}
if (!gateASkinnedHeroSource.includes('mesh.castShadow = false')) {
  errors.push('Gate A skinned Hero must not submit its 18 material groups to the shadow pass')
}
for (const requiredOptimization of [
  'new MeshStandardMaterial().copy(material)',
  'clonedMaterial.emissiveMap = null',
  "clonedMaterial.emissive.set('#000000')",
  'clonedMaterial.alphaTest = 0',
]) {
  if (!gateASkinnedHeroSource.includes(requiredOptimization)) {
    errors.push(`Gate A skinned Hero is missing material optimization: ${requiredOptimization}`)
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ passed: false, errors }, null, 2))
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    outfits: expectedOutfits,
    classicPreservesAuthoredColours: true,
    materialTints: Object.fromEntries(tintEntries),
    authoredOutfitMaterial: helper.GATE_A_OUTFIT_MATERIAL_NAME,
    sharedMaterialSlots: manifest.materials.sharedSlotCount,
    recolouredMaterialSlots: recognisedOutfitMaterials.length,
    skinReadabilityMaterialSlots: recognisedSkinMaterials.length,
    opaqueAlphaMaterialSlots: opaqueAlphaMaterials.length,
    skinMaterialType: 'MeshBasicMaterial',
    skinUnlitColour: helper.GATE_A_SKIN_UNLIT_COLOR,
    runtimeLods: manifest.runtime,
    skinnedHeroCastsShadow: false,
    zeroStrengthPhysicalExtensionsUseStandardRuntimeMaterial: true,
    inertNonSkinEmissiveMapsDisabled: true,
    impossibleAlphaDiscardBranchesDisabled: true,
    wardrobeSpecificAssetUrls,
    gateAPreviewLocksUnimplementedIdentities: true,
    releasedPickerPortrait: {
      file: 'character-hero-female-picker.webp',
      bytes: pickerPortrait.length,
      dimensions: pickerPortraitDimensions,
      matchesRuntimeHero: true,
    },
    retiredWizardSelectable: false,
    source: new URL(`file://${helperPath.replaceAll('\\', '/')}`).href,
    passed: true,
  }, null, 2))
}
