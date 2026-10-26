import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { runInNewContext } from 'node:vm'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'
import animationContract from '../../cloudflare/alife-app/src/views/virtualChurchCharacterAnimationContract.json' with { type: 'json' }

const digest = value => createHash('sha256').update(value).digest('hex')

// Inspect release mappings, not DEV-only review URLs or historical plan text.
export function productionHeroMappings(serviceSource) {
  const source = serviceSource
    .replace(/^import .*virtualChurchUsesMobileBudget.*$/m, '')
    .replaceAll('import.meta.env', 'productionEnvironment')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText
  const exports = {}
  runInNewContext(compiled, {
    exports,
    productionEnvironment: { DEV: false, VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT: 'v3' },
    virtualChurchUsesMobileBudget: () => false,
  })
  return exports.get3DConfig('v3').characters
}

function glbIdentity(bytes) {
  if (bytes.length < 28 || bytes.toString('ascii', 0, 4) !== 'glTF'
    || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length
    || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid GLB 2.0')
  const end = 20 + bytes.readUInt32LE(12)
  if (end + 8 > bytes.length || bytes.readUInt32LE(end + 4) !== 0x004e4942
    || end + 8 + bytes.readUInt32LE(end) !== bytes.length) throw new Error('Invalid BIN chunk')
  const json = JSON.parse(bytes.subarray(20, end).toString())
  const binary = bytes.subarray(end + 8)
  const accessors = (json.skins ?? []).map(skin => {
    const joints = skin.joints.map(index => {
      const node = json.nodes[index]
      return { name: node.name, translation: node.translation, rotation: node.rotation,
        scale: node.scale, matrix: node.matrix,
        children: (node.children ?? []).map(child => json.nodes[child].name) }
    })
    const accessor = json.accessors[skin.inverseBindMatrices]
    const view = json.bufferViews[accessor.bufferView]
    if (accessor.componentType !== 5126 || accessor.type !== 'MAT4'
      || accessor.count !== joints.length || view.byteStride) throw new Error('Unsupported inverse binds')
    const offset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
    const length = accessor.count * 64
    if (offset + length > binary.length) throw new Error('Truncated inverse binds')
    return { joints, inverseBinds: digest(binary.subarray(offset, offset + length)) }
  })
  if (!accessors.length || !accessors.every(skin => skin.joints.length)) throw new Error('Missing rig')
  // A character can have multiple meshes borrowing the same rig.
  const rigs = [...new Set(accessors.map(skin => JSON.stringify(skin)))].sort()
  return { sha256: digest(bytes), bytes: bytes.length,
    bones: accessors[0].joints.length, rigDigest: digest(JSON.stringify(rigs)),
    clips: (json.animations ?? []).map(animation => animation.name).sort() }
}

export async function auditProductionHeroDelivery(mappings, loadAsset) {
  const heroes = [], missing = []
  for (const gender of ['Female', 'Male']) {
    const assets = {}, errors = []
    for (const quality of ['High', 'Medium', 'Low', 'Picker']) {
      const key = `gateA${gender}${quality}`
      const url = mappings[key]
      if (typeof url !== 'string'
        || !/^\/virtual-church-assets\/v3\/releases\/[^/]+\/characters\//.test(url)) {
        errors.push(`${key}: no production release mapping`)
        continue
      }
      try {
        const bytes = await loadAsset(url)
        if (quality === 'Picker') {
          if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
            throw new Error('Invalid WebP portrait')
          }
          assets[quality.toLowerCase()] = { url, bytes: bytes.length, sha256: digest(bytes) }
        } else {
          const identity = glbIdentity(bytes)
          const absent = Object.keys(animationContract.durationsSeconds).filter(name => !identity.clips.includes(name))
          if (absent.length) throw new Error(`Missing required clips: ${absent.join(', ')}`)
          assets[quality.toLowerCase()] = { url, ...identity }
        }
      } catch (error) { errors.push(`${key}: ${error.message}`) }
    }
    const lods = ['high', 'medium', 'low'].map(quality => assets[quality]).filter(Boolean)
    if (lods.length === 3 && new Set(lods.map(lod => lod.rigDigest)).size !== 1) {
      errors.push(`${gender}: LOD rigs differ`)
    }
    if (lods.length === 3 && new Set(lods.map(lod => JSON.stringify(lod.clips))).size !== 1) {
      errors.push(`${gender}: LOD clip names differ`)
    }
    heroes.push({ id: gender.toLowerCase(), assets, errors, complete: errors.length === 0 })
    missing.push(...errors)
  }
  const complete = heroes.filter(hero => hero.complete)
  if (complete.length === 2 && complete[0].assets.medium.sha256 === complete[1].assets.medium.sha256) {
    missing.push('Two hero mappings resolve to the same model, not two appearances')
  }
  const sharedRig = complete.length === 2
    && complete[0].assets.medium.rigDigest === complete[1].assets.medium.rigDigest
  if (complete.length === 2 && !sharedRig) missing.push('Released male/female rigs differ')
  return { inspectionScope: 'current production source mapping and public asset metadata; not a rebuilt artifact or reachable runtime selector',
    requiredHeroes: 2, completeReleasedHeroes: complete.length, heroes, sharedRig,
    assetScopePassed: missing.length === 0, missing,
    // Asset inventory cannot certify a reachable picker, acceptable motion,
    // licensing, residency, performance, or user approval.
    remainingVerification: ['production-selector-and-bilingual-cards', 'continuous-motion-and-appearance',
      'license-provenance', 'selected-only-loading-and-switch-release', 'performance-and-real-devices'],
    fullV3CharacterPassed: false }
}

export async function auditProductionHeroSource(serviceSource, publicRoot) {
  const root = resolve(publicRoot)
  return auditProductionHeroDelivery(productionHeroMappings(serviceSource), url => {
    const target = resolve(root, `.${url}`)
    if (!target.startsWith(`${root}${sep}`)) throw new Error('Asset escapes public root')
    return readFile(target)
  })
}
