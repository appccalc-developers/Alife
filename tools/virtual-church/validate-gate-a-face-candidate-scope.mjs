import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..', '..')
const baselineCharactersDir = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
)
const candidateVariant = process.argv
  .find((argument) => argument.startsWith('--candidate-variant='))
  ?.slice('--candidate-variant='.length) ?? 'face-readability-candidate'
if (!/^face-readability-candidate(?:-v\d+)?$/u.test(candidateVariant)) {
  throw new Error(`Unsupported isolated face candidate variant "${candidateVariant}".`)
}
const candidateRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  candidateVariant,
)
const candidateCharactersDir = resolve(candidateRoot, 'characters')
const lods = ['high', 'medium', 'low']
const expectedMeshes = [
  'HeroFemale_HairFace',
  'HeroFemale_Outfit',
  'HeroFemale_Skin',
]
const unchangedMeshes = ['HeroFemale_Outfit', 'HeroFemale_Skin']
const changedMeshes = ['HeroFemale_HairFace']
const animationVariant = 'r7-ground-clearance'
const errors = []

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const jsonEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const assertEqual = (label, baseline, candidate) => {
  if (!jsonEqual(baseline, candidate)) {
    errors.push(`${label} differs between the r7 release and the face candidate`)
  }
}

const parseGlb = (buffer) => new Promise((resolvePromise, rejectPromise) => {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
  new GLTFLoader().parse(arrayBuffer, '', resolvePromise, rejectPromise)
})

const typedArraySignature = (array) => ({
  type: array.constructor.name,
  length: array.length,
  sha256: sha256(Buffer.from(array.buffer, array.byteOffset, array.byteLength)),
})

const attributeSignature = (attribute) => ({
  itemSize: attribute.itemSize,
  count: attribute.count,
  normalized: attribute.normalized,
  usage: attribute.usage,
  array: typedArraySignature(attribute.array),
})

const geometrySignature = (geometry) => ({
  attributes: Object.fromEntries(
    Object.entries(geometry.attributes)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, attribute]) => [name, attributeSignature(attribute)]),
  ),
  index: geometry.index ? attributeSignature(geometry.index) : null,
  groups: geometry.groups,
  drawRange: geometry.drawRange,
})

const materialSignature = (material) => ({
  name: material.name,
  type: material.type,
  color: material.color?.getHexString() ?? null,
  emissive: material.emissive?.getHexString() ?? null,
  roughness: material.roughness ?? null,
  metalness: material.metalness ?? null,
  opacity: material.opacity,
  transparent: material.transparent,
  alphaTest: material.alphaTest,
  side: material.side,
  vertexColors: material.vertexColors,
  depthTest: material.depthTest,
  depthWrite: material.depthWrite,
  blending: material.blending,
})

const transformSignature = (object) => ({
  position: object.position.toArray(),
  quaternion: object.quaternion.toArray(),
  scale: object.scale.toArray(),
  matrixAutoUpdate: object.matrixAutoUpdate,
})

const skeletonSignature = (skeleton) => ({
  bones: skeleton.bones.map((bone) => bone.name),
  boneInverses: skeleton.boneInverses.map((matrix) => matrix.toArray()),
})

const meshSignature = (mesh) => ({
  transform: transformSignature(mesh),
  geometry: geometrySignature(mesh.geometry),
  material: Array.isArray(mesh.material)
    ? mesh.material.map(materialSignature)
    : materialSignature(mesh.material),
  bindMode: mesh.bindMode,
  bindMatrix: mesh.bindMatrix.toArray(),
  bindMatrixInverse: mesh.bindMatrixInverse.toArray(),
  skeleton: skeletonSignature(mesh.skeleton),
})

const animationSignature = (animations) => animations
  .map((clip) => ({
    name: clip.name,
    duration: clip.duration,
    blendMode: clip.blendMode,
    tracks: clip.tracks.map((track) => ({
      name: track.name,
      type: track.constructor.name,
      interpolation: track.getInterpolation(),
      times: typedArraySignature(track.times),
      values: typedArraySignature(track.values),
    })),
  }))
  .sort((left, right) => left.name.localeCompare(right.name))

const boneSignature = (scene) => {
  const bones = []
  scene.traverse((object) => {
    if (!object.isBone) return
    bones.push({
      name: object.name,
      parent: object.parent?.name ?? null,
      transform: transformSignature(object),
    })
  })
  return bones.sort((left, right) => left.name.localeCompare(right.name))
}

const collectMeshes = (scene) => {
  const meshes = new Map()
  scene.traverse((object) => {
    if (!object.isSkinnedMesh) return
    if (meshes.has(object.name)) {
      throw new Error(`Duplicate skinned mesh name "${object.name}".`)
    }
    meshes.set(object.name, object)
  })
  return meshes
}

const triangleCount = (mesh) => {
  const elementCount = mesh.geometry.index?.count
    ?? mesh.geometry.getAttribute('position')?.count
    ?? 0
  return Math.floor(elementCount / 3)
}

const baselineManifestPath = resolve(
  baselineCharactersDir,
  'character-hero-female.manifest.json',
)
const candidateManifestPath = resolve(
  candidateCharactersDir,
  'character-hero-female.manifest.json',
)
const [baselineManifest, candidateManifest] = await Promise.all([
  readFile(baselineManifestPath, 'utf8').then(JSON.parse),
  readFile(candidateManifestPath, 'utf8').then(JSON.parse),
])

if (baselineManifest.visualVariant != null) {
  errors.push('the formal r7 release unexpectedly declares a visual candidate variant')
}
if (baselineManifest.animationVariant !== animationVariant) {
  errors.push(`the formal r7 release is not using ${animationVariant}`)
}
if (candidateManifest.visualVariant !== candidateVariant) {
  errors.push(`the candidate manifest must declare ${candidateVariant}`)
}
if (candidateManifest.animationVariant !== animationVariant) {
  errors.push(`the candidate manifest must declare ${animationVariant}`)
}

for (const key of [
  'assetId',
  'displayName',
  'provenance',
  'license',
  'coordinateSystem',
  'silhouette',
  'rig',
  'animation',
  'materials',
  'runtime',
]) {
  assertEqual(`manifest.${key}`, baselineManifest[key], candidateManifest[key])
}

const results = []
for (const lod of lods) {
  const file = `character-hero-female-${lod}.glb`
  const baselinePath = resolve(baselineCharactersDir, file)
  const candidatePath = resolve(candidateCharactersDir, file)
  const [baselineBuffer, candidateBuffer] = await Promise.all([
    readFile(baselinePath),
    readFile(candidatePath),
  ])
  const [baselineGltf, candidateGltf] = await Promise.all([
    parseGlb(baselineBuffer),
    parseGlb(candidateBuffer),
  ])
  const baselineMeshes = collectMeshes(baselineGltf.scene)
  const candidateMeshes = collectMeshes(candidateGltf.scene)
  const baselineNames = [...baselineMeshes.keys()].sort()
  const candidateNames = [...candidateMeshes.keys()].sort()

  assertEqual(`${lod} mesh names`, baselineNames, expectedMeshes)
  assertEqual(`${lod} candidate mesh names`, candidateNames, expectedMeshes)
  assertEqual(
    `${lod} animation curves`,
    animationSignature(baselineGltf.animations),
    animationSignature(candidateGltf.animations),
  )
  assertEqual(
    `${lod} bone hierarchy and bind transforms`,
    boneSignature(baselineGltf.scene),
    boneSignature(candidateGltf.scene),
  )

  for (const meshName of unchangedMeshes) {
    const baselineMesh = baselineMeshes.get(meshName)
    const candidateMesh = candidateMeshes.get(meshName)
    if (!baselineMesh || !candidateMesh) continue
    assertEqual(
      `${lod} ${meshName} mesh`,
      meshSignature(baselineMesh),
      meshSignature(candidateMesh),
    )
  }

  const baselineHairFace = baselineMeshes.get('HeroFemale_HairFace')
  const candidateHairFace = candidateMeshes.get('HeroFemale_HairFace')
  if (baselineHairFace && candidateHairFace) {
    assertEqual(
      `${lod} HairFace transform`,
      transformSignature(baselineHairFace),
      transformSignature(candidateHairFace),
    )
    assertEqual(
      `${lod} HairFace material`,
      materialSignature(baselineHairFace.material),
      materialSignature(candidateHairFace.material),
    )
    assertEqual(
      `${lod} HairFace skeleton`,
      skeletonSignature(baselineHairFace.skeleton),
      skeletonSignature(candidateHairFace.skeleton),
    )
    if (jsonEqual(
      geometrySignature(baselineHairFace.geometry),
      geometrySignature(candidateHairFace.geometry),
    )) {
      errors.push(`${lod} HairFace geometry did not change`)
    }
  }

  const baselineLod = baselineManifest.lods?.find((entry) => entry.lod === lod)
  const candidateLod = candidateManifest.lods?.find((entry) => entry.lod === lod)
  if (!baselineLod || !candidateLod) {
    errors.push(`${lod} manifest entry is missing`)
  } else {
    for (const key of [
      'skinnedMeshes',
      'materials',
      'bones',
      'animations',
      'animationMetrics',
      'rootNode',
    ]) {
      assertEqual(`${lod} manifest.${key}`, baselineLod[key], candidateLod[key])
    }
    if (candidateLod.sha256 !== sha256(candidateBuffer)) {
      errors.push(`${lod} candidate manifest SHA-256 does not match its GLB`)
    }
    if (candidateLod.bytes !== candidateBuffer.byteLength) {
      errors.push(`${lod} candidate manifest byte count does not match its GLB`)
    }
  }

  const baselineTriangles = [...baselineMeshes.values()]
    .reduce((sum, mesh) => sum + triangleCount(mesh), 0)
  const candidateTriangles = [...candidateMeshes.values()]
    .reduce((sum, mesh) => sum + triangleCount(mesh), 0)
  results.push({
    lod,
    meshNames: baselineNames,
    baseline: {
      sha256: sha256(baselineBuffer),
      bytes: baselineBuffer.byteLength,
      triangles: baselineTriangles,
    },
    candidate: {
      sha256: sha256(candidateBuffer),
      bytes: candidateBuffer.byteLength,
      triangles: candidateTriangles,
    },
    unchangedMeshes,
    changedMeshes,
    animationCurvesByteEquivalent: jsonEqual(
      animationSignature(baselineGltf.animations),
      animationSignature(candidateGltf.animations),
    ),
  })
}

const runtimeFiles = [
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'src', 'services', 'virtualChurchService.ts'),
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'src', 'views', 'VirtualChurchView.tsx'),
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'vite.config.ts'),
  resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'public',
    'virtual-church-cache-maintenance.js',
  ),
  resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'public',
    'virtual-church-assets',
    'ASSET-LICENSES.md',
  ),
]
const runtimeContents = await Promise.all(runtimeFiles.map((path) => readFile(path, 'utf8')))
if (runtimeContents.some((content) => content.includes(candidateVariant))) {
  errors.push('the face candidate is referenced by a runtime or public asset source')
}

const publicReleaseDir = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
)
const publicReleases = (await readdir(publicReleaseDir)).sort()
assertEqual('public V3 release directories', publicReleases, ['gate-a-baseline-r8', 'gate-a-baseline-r9'])
if (!candidateRoot.includes(`${resolve(repositoryRoot, '.tmp')}\\`)) {
  errors.push('the face candidate is not isolated under the ignored .tmp directory')
}

const builderSource = await readFile(
  resolve(repositoryRoot, 'tools', 'virtual-church', 'build-gate-a-female-hero.mjs'),
  'utf8',
)
for (const isolationFragment of [
  "const reviewOutputRoot = resolve(repoRoot, '.tmp')",
  "if (visualVariant !== 'r6'",
  '!requestedCharactersOutputDir',
  '!outputIsInsideReviewRoot',
  'must use an explicit',
]) {
  if (!builderSource.includes(isolationFragment)) {
    errors.push(`candidate output isolation guard drifted: ${isolationFragment}`)
  }
}

process.stdout.write(`${JSON.stringify({
  baselineRelease: 'gate-a-baseline-r9',
  candidate: candidateVariant,
  animationVariant,
  candidateRoot,
  publicReleases,
  scope: {
    unchangedMeshes,
    changedMeshes,
    skeletonUnchanged: !errors.some((error) => error.includes('skeleton')),
    animationsUnchanged: !errors.some((error) => error.includes('animation')),
    runtimeReferenced: runtimeContents.some((content) => content.includes(candidateVariant)),
    candidateOutputRestrictedToIgnoredTmp: !errors.some(
      (error) => error.includes('candidate output isolation guard'),
    ),
  },
  lods: results,
  errors,
  passed: errors.length === 0,
}, null, 2)}\n`)

if (errors.length > 0) process.exitCode = 1
