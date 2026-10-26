// Byte-preserving promotion of the user-approved V14 candidate. Never rewrites
// r9, original VRoid/Blender inputs, or the DEV-only review files.
import assert from 'node:assert/strict'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const source = 'C:/Data/Alife/Temp/virtual-church-character-review'
const release = 'male-hero-v14-r1'
const destination = resolve(root, 'cloudflare/alife-app/public/virtual-church-assets/v3/releases', release, 'characters')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const files = [
  ['high', '78b7691f91c295b6cced45c0d47e5305baeedb580247174ea1d50912fb7d0acd'],
  ['medium', '8b0bf32035612c5b97d900a2218b94c7218ae5c3017ba709a94b291a2832b492'],
  ['low', 'f1ed9ec38b214a110b4ac65211310398d698dc50879d50832e8779a1b19bbc4a'],
]
const sourceVroid = await readFile('C:/Data/Alife/Sources/Characters/MaleHero/AlifeMaleHero-v2.vroid')
assert.equal(hash(sourceVroid), 'eedd4c7920b4e1c9e06b94c91ad81f734d60630279ddeb054ff04023cf782328')
const assets = {}
const pending = []
for (const [quality, expected] of files) {
  const bytes = await readFile(resolve(source, `character-hero-male-v14-wave-${quality}.glb`))
  assert.equal(hash(bytes), expected, `Unexpected ${quality} candidate`)
  const report = JSON.parse(await readFile(resolve(source, `character-hero-male-v14-wave-${quality}.export.json`), 'utf8'))
  assert.equal(report.sha256, expected)
  assert.equal(report.bones, 126)
  const name = `character-hero-male-${quality}.glb`
  assets[quality] = { path: name, bytes: bytes.length, sha256: expected, triangles: report.triangles, bones: report.bones }
  pending.push([name, bytes])
}
const picker = await readFile(resolve(source, 'character-hero-male-v14-picker.webp'))
assert.equal(hash(picker), '0fd884b6f8d170f31602bbe7706658acb1775dd89fc91db19ab55ead8fbe9d86')
assets.picker = { path: 'character-hero-male-picker.webp', bytes: picker.length, sha256: hash(picker) }
pending.push([assets.picker.path, picker])
const manifest = {
  schemaVersion: 1, release, assetId: 'alife-v3-male-hero', motionProfile: 'male-v14',
  state: 'runtime-candidate-awaiting-full-v3-gates', deploymentApproved: false,
  userApproval: { publicCharacterSelection: true, date: '2026-10-06', appearanceAndMotionPreserved: true },
  provenance: { sourceModel: 'AvatarSample_C', sourceCreator: 'pixiv VRoid Project', adaptation: 'Alife project',
    sourceVroidSha256: hash(sourceVroid), sourceVroid: 'C:/Data/Alife/Sources/Characters/MaleHero/AlifeMaleHero-v2.vroid',
    sourceBlend: 'C:/Data/Alife/Temp/virtual-church-character-review/AlifeMaleHero-motion-v14-retargeted-wave.blend',
    motionAdaptation: 'Adobe Mixamo locomotion retargeted and refined; character-local jump, idle and greet adaptations' },
  license: { name: 'VRoidPreset_A-Z sample-model conditions', cc0: false,
    url: 'https://vroid.pixiv.help/hc/en-us/articles/4402394424089-VRoidPreset-A-Z',
    modelUrl: 'https://hub.vroid.com/en/characters/1248981995540129234/models/8640547963669442173',
    motionUrl: 'https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html', checkedOn: '2026-10-06',
    note: 'Official sample conditions and retained source chain are the basis for this derivative, not CC0. The retained intermediate VRM has conflicting generic export flags; originals remain unchanged. No standalone motion-library resale or implied pixiv endorsement.' },
  rig: { bones: 126, sharedAcrossLods: true, sharedWithFemale: false },
  appearance: { skinTone: 'fair-warm', wardrobe: 'warm-white long coat' },
  assets,
  remainingGates: ['cross-character-shared-rig', 'production-switch-residency', 'full-motion-and-visual-review', 'desktop-mobile-performance', 'Android-iOS', 'publication-approval'],
}
pending.push(['character-hero-male.manifest.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)])
await mkdir(destination, { recursive: true })
for (const [name, bytes] of pending) {
  const path = resolve(destination, name)
  try { await writeFile(path, bytes, { flag: 'wx' }) }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
    assert.equal(hash(await readFile(path)), hash(bytes), `Immutable release differs: ${name}`)
  }
}
console.log(JSON.stringify({ release, destination, bytesPreserved: true, assets, deploymentApproved: false }, null, 2))
