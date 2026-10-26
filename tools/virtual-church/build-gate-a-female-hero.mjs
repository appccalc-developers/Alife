import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  Bone,
  BoxGeometry,
  BufferAttribute,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  LatheGeometry,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  QuaternionKeyframeTrack,
  Scene,
  Skeleton,
  SkinnedMesh,
  SphereGeometry,
  Vector2,
  Vector3,
  VectorKeyframeTrack,
  AnimationClip,
} from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFExporter } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/exporters/GLTFExporter.js'
import { mergeGeometries } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/utils/BufferGeometryUtils.js'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDir = dirname(scriptPath)
const repoRoot = resolve(scriptDir, '..', '..')
const animationContractPath = resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'src',
  'views',
  'virtualChurchCharacterAnimationContract.json',
)
const animationContract = JSON.parse(
  await readFile(animationContractPath, 'utf8'),
)
const supportedLods = ['high', 'medium', 'low']
const requestedLod = process.argv
  .find((argument) => argument.startsWith('--lod='))
  ?.slice('--lod='.length)
const requestedCharactersOutputDir = process.argv
  .find((argument) => argument.startsWith('--characters-output-dir='))
  ?.slice('--characters-output-dir='.length)
const visualVariant = process.argv
  .find((argument) => argument.startsWith('--visual-variant='))
  ?.slice('--visual-variant='.length) ?? 'r6'
const animationVariant = process.argv
  .find((argument) => argument.startsWith('--animation-variant='))
  ?.slice('--animation-variant='.length) ?? 'r7-ground-clearance'
const lod = requestedLod ?? 'medium'
const supportedVisualVariants = [
  'r6',
  'face-readability-candidate',
  'face-readability-candidate-v3',
  'face-readability-candidate-v4',
]
const supportedAnimationVariants = ['r6', 'r7-ground-clearance']

if (!supportedLods.includes(lod)) {
  throw new Error(`Unsupported Hero LOD "${lod}". Expected ${supportedLods.join(', ')}.`)
}
if (!supportedVisualVariants.includes(visualVariant)) {
  throw new Error(
    `Unsupported Hero visual variant "${visualVariant}". `
    + `Expected ${supportedVisualVariants.join(', ')}.`,
  )
}
if (!supportedAnimationVariants.includes(animationVariant)) {
  throw new Error(
    `Unsupported Hero animation variant "${animationVariant}". `
    + `Expected ${supportedAnimationVariants.join(', ')}.`,
  )
}

const lodSegmentScale = {
  high: 1.3,
  medium: 1,
  low: 0.58,
}[lod]

const scaledSegments = (base, minimum) =>
  Math.max(minimum, Math.round(base * lodSegmentScale))

const capsuleGeometry = (radius, length, capSegments, radialSegments) =>
  new CapsuleGeometry(
    radius,
    length,
    scaledSegments(capSegments, 2),
    scaledSegments(radialSegments, 4),
  )

const sphereGeometry = (
  radius,
  widthSegments,
  heightSegments,
  phiStart = 0,
  phiLength = Math.PI * 2,
  thetaStart = 0,
  thetaLength = Math.PI,
) => new SphereGeometry(
  radius,
  scaledSegments(widthSegments, 5),
  scaledSegments(heightSegments, 4),
  phiStart,
  phiLength,
  thetaStart,
  thetaLength,
)

const smoothstep = (minimum, maximum, value) => {
  const normalized = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum)))
  return normalized * normalized * (3 - 2 * normalized)
}

const connectedHairlineCrownGeometry = () => {
  const radius = 0.148
  const geometry = sphereGeometry(radius, 30, 22)
  const positions = geometry.getAttribute('position')

  for (let vertex = 0; vertex < positions.count; vertex += 1) {
    const x = positions.getX(vertex)
    const y = positions.getY(vertex)
    const z = positions.getZ(vertex)
    if (z >= 0) continue

    const normalizedX = Math.max(-1, Math.min(1, x / radius))
    const hairlineHeight = 0.028
      + 0.04 * normalizedX
      + 0.008 * Math.abs(normalizedX)
    const verticalBlend = smoothstep(hairlineHeight - 0.018, hairlineHeight + 0.04, y)
    const frontBlend = smoothstep(0.15, 0.9, -z / radius)
    const sideTaper = 0.72 + 0.28 * (1 - Math.abs(normalizedX))
    positions.setZ(
      vertex,
      z - 0.062 * verticalBlend * frontBlend * sideTaper,
    )
  }

  positions.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

const cylinderGeometry = (radiusTop, radiusBottom, height, radialSegments) =>
  new CylinderGeometry(
    radiusTop,
    radiusBottom,
    height,
    scaledSegments(radialSegments, 6),
    1,
    false,
  )

const latheGeometry = (profile, radialSegments) =>
  new LatheGeometry(
    profile.map(([radius, y]) => new Vector2(radius, y)),
    scaledSegments(radialSegments, 8),
  )

const charactersOutputDir = requestedCharactersOutputDir
  ? resolve(repoRoot, requestedCharactersOutputDir)
  : resolve(
  repoRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'characters',
  )
const reviewOutputRoot = resolve(repoRoot, '.tmp')
const reviewOutputRelativePath = relative(reviewOutputRoot, charactersOutputDir)
const outputIsInsideReviewRoot = reviewOutputRelativePath !== ''
  && reviewOutputRelativePath !== '..'
  && !reviewOutputRelativePath.startsWith(`..${sep}`)

if (visualVariant !== 'r6' && (
  !requestedCharactersOutputDir
  || !outputIsInsideReviewRoot
)) {
  throw new Error(
    `Visual candidate "${visualVariant}" must use an explicit `
    + '--characters-output-dir inside the repository .tmp directory.',
  )
}
const outputPath = resolve(
  charactersOutputDir,
  `character-hero-female-${lod}.glb`,
)

class NodeFileReader {
  result = null
  onloadend = null

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }

  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`
      this.onloadend?.()
    })
  }
}

globalThis.FileReader ??= NodeFileReader

const palette = {
  cream: '#f7edd8',
  jade: '#397768',
  gold: '#f4bc68',
  ink: '#32281f',
  skin: '#d9a67e',
  hair: '#352820',
  hairSoft: '#49342a',
  eye: '#493328',
  nose: '#c68f71',
  mouth: '#9b5447',
  cheek: '#d98f78',
}

const boneDefinitions = [
  { name: 'Root', parent: null, position: [0, 0, 0] },
  { name: 'Hips', parent: 'Root', position: [0, 0.9, 0] },
  { name: 'Torso', parent: 'Hips', position: [0, 0.31, 0] },
  { name: 'Head', parent: 'Torso', position: [0, 0.4, 0] },
  { name: 'HairBack', parent: 'Head', position: [0, 0, 0] },
  { name: 'UpperLeg.L', parent: 'Hips', position: [-0.12, -0.06, 0] },
  { name: 'LowerLeg.L', parent: 'UpperLeg.L', position: [0, -0.42, 0] },
  { name: 'UpperLeg.R', parent: 'Hips', position: [0.12, -0.06, 0] },
  { name: 'LowerLeg.R', parent: 'UpperLeg.R', position: [0, -0.42, 0] },
  { name: 'Shoulder.L', parent: 'Torso', position: [-0.29, 0.12, 0] },
  { name: 'Shoulder.R', parent: 'Torso', position: [0.29, 0.12, 0] },
  { name: 'Book', parent: 'Shoulder.L', position: [0, 0, 0] },
]

const bones = new Map(
  boneDefinitions.map(({ name, position }) => {
    const bone = new Bone()
    bone.name = name
    bone.position.fromArray(position)
    return [name, bone]
  }),
)

for (const definition of boneDefinitions) {
  if (definition.parent) bones.get(definition.parent).add(bones.get(definition.name))
}

const orderedBones = boneDefinitions.map(({ name }) => bones.get(name))
const boneIndex = new Map(orderedBones.map((bone, index) => [bone.name, index]))

const createPart = (
  geometry,
  {
    bone,
    color,
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = [1, 1, 1],
  },
) => {
  const part = geometry
  part.deleteAttribute('uv')

  const matrix = new Matrix4().compose(
    new Vector3().fromArray(position),
    new Quaternion().setFromEuler(new Euler().fromArray(rotation)),
    new Vector3().fromArray(scale),
  )
  part.applyMatrix4(matrix)

  const vertexCount = part.getAttribute('position').count
  const indices = new Uint16Array(vertexCount * 4)
  const weights = new Float32Array(vertexCount * 4)
  const colors = new Float32Array(vertexCount * 3)
  const resolvedColor = new Color(color)
  const resolvedBoneIndex = boneIndex.get(bone)
  if (resolvedBoneIndex == null) throw new Error(`Unknown skin bone "${bone}"`)

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    indices[vertex * 4] = resolvedBoneIndex
    weights[vertex * 4] = 1
    colors[vertex * 3] = resolvedColor.r
    colors[vertex * 3 + 1] = resolvedColor.g
    colors[vertex * 3 + 2] = resolvedColor.b
  }

  part.setAttribute('skinIndex', new BufferAttribute(indices, 4))
  part.setAttribute('skinWeight', new BufferAttribute(weights, 4))
  part.setAttribute('color', new BufferAttribute(colors, 3))
  part.computeBoundingBox()
  part.computeBoundingSphere()
  return part
}

const part = (geometry, bone, color, position, scale, rotation = [0, 0, 0]) =>
  createPart(geometry, { bone, color, position, scale, rotation })

const outfitParts = [
  part(latheGeometry([
    [0.2, -0.245],
    [0.21, -0.18],
    [0.18, 0.17],
    [0.165, 0.235],
  ], 16), 'Hips', palette.jade, [0, 0.79, 0], [1, 1, 0.72]),
  part(latheGeometry([
    [0.16, -0.24],
    [0.17, -0.16],
    [0.19, 0.11],
    [0.165, 0.24],
  ], 16), 'Torso', palette.cream, [0, 1.26, 0], [1, 1, 0.66]),
  part(capsuleGeometry(0.05, 0.35, 5, 9), 'Torso', palette.jade, [-0.158, 1.22, -0.126], [0.68, 1, 0.38], [0, 0, -0.035]),
  part(capsuleGeometry(0.05, 0.35, 5, 9), 'Torso', palette.jade, [0.158, 1.22, -0.126], [0.68, 1, 0.38], [0, 0, 0.035]),
  part(new BoxGeometry(0.31, 0.39, 0.035), 'Torso', palette.jade, [0, 1.24, 0.126], [1, 1, 1]),
  part(capsuleGeometry(0.022, 0.18, 5, 8), 'Torso', palette.jade, [-0.092, 1.35, -0.132], [0.62, 1, 0.32], [0, 0, -0.16]),
  part(capsuleGeometry(0.022, 0.18, 5, 8), 'Torso', palette.jade, [0.092, 1.35, -0.132], [0.62, 1, 0.32], [0, 0, 0.16]),
  part(sphereGeometry(0.024, 10, 8), 'Torso', palette.gold, [0, 1.405, -0.126], [0.68, 0.86, 0.32]),
  part(new BoxGeometry(0.36, 0.055, 0.06), 'Hips', palette.gold, [0, 1.005, -0.125], [1, 1, 1]),
  ...[-1, 1].flatMap((side) => {
    const suffix = side < 0 ? 'L' : 'R'
    const x = side * 0.12
    return [
      part(cylinderGeometry(0.075, 0.067, 0.38, 10), `UpperLeg.${suffix}`, palette.cream, [x, 0.65, 0], [1, 1, 0.92]),
      part(cylinderGeometry(0.065, 0.052, 0.34, 10), `LowerLeg.${suffix}`, palette.cream, [x, 0.29, 0], [1, 1, 0.92]),
      part(sphereGeometry(0.095, 10, 7), `LowerLeg.${suffix}`, palette.ink, [x, 0.062, -0.043], [1.05, 0.4, 1.25]),
    ]
  }),
  ...[-1, 1].map((side) => {
    const suffix = side < 0 ? 'L' : 'R'
    return [
      part(
        capsuleGeometry(0.047, 0.065, 5, 9),
        `Shoulder.${suffix}`,
        palette.jade,
        [side * 0.235, 1.385, 0],
        [1, 1, 0.86],
        [0, 0, Math.PI / 2],
      ),
      part(
        capsuleGeometry(0.054, 0.2, 5, 9),
        `Shoulder.${suffix}`,
        palette.jade,
        [side * 0.29, 1.245, 0],
        [1, 1, 0.86],
      ),
      part(
        capsuleGeometry(0.048, 0.19, 5, 9),
        `Shoulder.${suffix}`,
        palette.cream,
        [side * 0.29, 0.985, 0],
        [1, 1, 0.86],
      ),
    ]
  }).flat(),
  part(new BoxGeometry(0.2, 0.3, 0.06), 'Book', palette.jade, [-0.3, 0.96, -0.16], [1, 1, 1], [0.035, -0.055, -0.06]),
  part(new BoxGeometry(0.16, 0.26, 0.012), 'Book', palette.cream, [-0.3, 0.96, -0.195], [1, 1, 1], [0.035, -0.055, -0.06]),
  part(new BoxGeometry(0.155, 0.012, 0.008), 'Book', palette.gold, [-0.3, 0.96, -0.203], [1, 1, 1], [0.035, -0.055, -0.06]),
  part(new BoxGeometry(0.012, 0.068, 0.008), 'Book', palette.gold, [-0.3, 1.015, -0.204], [1, 1, 1], [0.035, -0.055, -0.06]),
  part(new BoxGeometry(0.052, 0.012, 0.008), 'Book', palette.gold, [-0.3, 1.028, -0.205], [1, 1, 1], [0.035, -0.055, -0.06]),
]

const skinParts = [
  part(capsuleGeometry(0.065, 0.08, 5, 8), 'Torso', palette.skin, [0, 1.47, 0], [0.78, 0.8, 0.72]),
  part(sphereGeometry(0.145, 18, 14), 'Head', palette.skin, [0, 1.63, 0], [0.92, 1.03, 0.88]),
  part(sphereGeometry(0.018, 8, 6), 'Head', palette.skin, [-0.132, 1.625, 0.008], [0.72, 1.06, 0.62]),
  part(sphereGeometry(0.018, 8, 6), 'Head', palette.skin, [0.132, 1.625, 0.008], [0.72, 1.06, 0.62]),
  part(sphereGeometry(0.052, 9, 7), 'Shoulder.L', palette.skin, [-0.29, 0.815, -0.008], [1, 1.06, 0.92]),
  part(sphereGeometry(0.052, 9, 7), 'Shoulder.R', palette.skin, [0.29, 0.815, -0.008], [1, 1.06, 0.92]),
]

const createR6HairFaceParts = () => [
  // Keep the main hair volume behind the face so the forehead edge is curved
  // rather than the former flat half-sphere "helmet" line.
  part(sphereGeometry(0.15, 16, 13), 'HairBack', palette.hair, [0, 1.66, 0.055], [1.02, 1.05, 0.9]),
  part(sphereGeometry(0.063, 12, 9), 'HairBack', palette.hair, [0, 1.69, 0.182], [1, 0.84, 0.82]),
  part(capsuleGeometry(0.04, 0.18, 5, 9), 'HairBack', palette.hair, [-0.132, 1.565, 0.012], [0.7, 1, 0.62], [0, 0, -0.1]),
  part(capsuleGeometry(0.04, 0.18, 5, 9), 'HairBack', palette.hair, [0.132, 1.565, 0.012], [0.7, 1, 0.62], [0, 0, 0.1]),
  // Two broad overlapping locks create a readable asymmetric side part. Their
  // depth bridges the rear hair volume and forehead instead of floating in
  // front of the face like separate strips.
  part(capsuleGeometry(0.03, 0.045, 5, 9), 'Head', palette.hairSoft, [-0.032, 1.718, -0.09], [0.85, 1, 0.36], [0, 0, -0.68]),
  part(capsuleGeometry(0.026, 0.035, 5, 9), 'Head', palette.hair, [0.043, 1.719, -0.09], [0.82, 1, 0.36], [0, 0, 0.54]),
  part(capsuleGeometry(0.0038, 0.026, 4, 7), 'Head', palette.hair, [-0.052, 1.662, -0.134], [1, 1, 0.62], [0, 0, Math.PI / 2]),
  part(capsuleGeometry(0.0038, 0.026, 4, 7), 'Head', palette.hair, [0.052, 1.662, -0.134], [1, 1, 0.62], [0, 0, Math.PI / 2]),
  part(sphereGeometry(0.008, 8, 6), 'Head', palette.eye, [-0.052, 1.637, -0.139], [1.12, 0.82, 0.38]),
  part(sphereGeometry(0.008, 8, 6), 'Head', palette.eye, [0.052, 1.637, -0.139], [1.12, 0.82, 0.38]),
  part(sphereGeometry(0.0022, 6, 5), 'Head', palette.cream, [-0.054, 1.64, -0.142], [1, 1, 0.5]),
  part(sphereGeometry(0.0022, 6, 5), 'Head', palette.cream, [0.05, 1.64, -0.142], [1, 1, 0.5]),
  part(capsuleGeometry(0.003, 0.008, 4, 7), 'Head', palette.nose, [0, 1.608, -0.14], [1, 1, 0.45]),
  part(capsuleGeometry(0.003, 0.018, 4, 7), 'Head', palette.mouth, [-0.012, 1.578, -0.139], [1, 1, 0.45], [0, 0, 1.32]),
  part(capsuleGeometry(0.003, 0.018, 4, 7), 'Head', palette.mouth, [0.012, 1.578, -0.139], [1, 1, 0.45], [0, 0, -1.32]),
]

const createR7FaceCandidateParts = (
  crownGeometry = sphereGeometry(0.148, 18, 14),
) => [
  // Preserve the r6 head scale and rear silhouette while reducing the heavy
  // side-profile hair mass and connecting the fringe to the crown.
  part(crownGeometry, 'HairBack', palette.hair, [0, 1.662, 0.055], [0.98, 1.03, 0.86]),
  part(sphereGeometry(0.056, 14, 10), 'HairBack', palette.hair, [0, 1.69, 0.176], [1, 0.8, 0.76]),
  part(capsuleGeometry(0.034, 0.175, 6, 10), 'HairBack', palette.hair, [-0.13, 1.57, 0.006], [0.66, 1, 0.58], [0, 0, -0.08]),
  part(capsuleGeometry(0.034, 0.175, 6, 10), 'HairBack', palette.hair, [0.13, 1.57, 0.006], [0.66, 1, 0.58], [0, 0, 0.08]),
  // The continuous crown supplies the hairline. Extra capsule fringe pieces
  // were rejected because the real close-up made them read as pasted-on bars.
  // Larger oval eyes and restrained highlights remain
  // readable at the normal third-person camera distance without becoming
  // childlike or adding a facial material slot.
  part(capsuleGeometry(0.0032, 0.025, 5, 8), 'Head', palette.hair, [-0.052, 1.659, -0.136], [1, 1, 0.55], [0, 0, Math.PI / 2]),
  part(capsuleGeometry(0.0032, 0.025, 5, 8), 'Head', palette.hair, [0.052, 1.659, -0.136], [1, 1, 0.55], [0, 0, Math.PI / 2]),
  part(sphereGeometry(0.0092, 10, 8), 'Head', palette.eye, [-0.052, 1.635, -0.141], [1.18, 1.08, 0.34]),
  part(sphereGeometry(0.0092, 10, 8), 'Head', palette.eye, [0.052, 1.635, -0.141], [1.18, 1.08, 0.34]),
  part(capsuleGeometry(0.0022, 0.018, 4, 7), 'Head', palette.eye, [-0.052, 1.643, -0.143], [1, 1, 0.4], [0, 0, Math.PI / 2]),
  part(capsuleGeometry(0.0022, 0.018, 4, 7), 'Head', palette.eye, [0.052, 1.643, -0.143], [1, 1, 0.4], [0, 0, Math.PI / 2]),
  part(sphereGeometry(0.0025, 7, 6), 'Head', palette.cream, [-0.055, 1.639, -0.144], [1, 1, 0.42]),
  part(sphereGeometry(0.0025, 7, 6), 'Head', palette.cream, [0.049, 1.639, -0.144], [1, 1, 0.42]),
  part(sphereGeometry(0.0075, 9, 7), 'Head', palette.cheek, [-0.086, 1.605, -0.139], [1.45, 0.52, 0.28]),
  part(sphereGeometry(0.0075, 9, 7), 'Head', palette.cheek, [0.086, 1.605, -0.139], [1.45, 0.52, 0.28]),
  part(sphereGeometry(0.0032, 7, 6), 'Head', palette.nose, [0, 1.608, -0.143], [0.9, 1.35, 0.34]),
  part(capsuleGeometry(0.0032, 0.022, 5, 8), 'Head', palette.mouth, [-0.014, 1.579, -0.141], [1, 1, 0.4], [0, 0, 1.28]),
  part(capsuleGeometry(0.0032, 0.022, 5, 8), 'Head', palette.mouth, [0.014, 1.579, -0.141], [1, 1, 0.4], [0, 0, -1.28]),
]

const createFriendlyExpressionFaceCandidateParts = () => [
  // Preserve the approved V3 continuous hairline and rear silhouette. V4 only
  // refines the facial read so the upper lids no longer flatten the oval eyes
  // into a sleepy expression at review distance.
  part(connectedHairlineCrownGeometry(), 'HairBack', palette.hair, [0, 1.662, 0.055], [0.98, 1.03, 0.86]),
  part(sphereGeometry(0.056, 14, 10), 'HairBack', palette.hair, [0, 1.69, 0.176], [1, 0.8, 0.76]),
  part(capsuleGeometry(0.034, 0.175, 6, 10), 'HairBack', palette.hair, [-0.13, 1.57, 0.006], [0.66, 1, 0.58], [0, 0, -0.08]),
  part(capsuleGeometry(0.034, 0.175, 6, 10), 'HairBack', palette.hair, [0.13, 1.57, 0.006], [0.66, 1, 0.58], [0, 0, 0.08]),
  // Slightly raised, mirrored eyebrow slopes keep the expression open without
  // increasing the face scale or adding a new material slot.
  part(capsuleGeometry(0.0028, 0.022, 5, 8), 'Head', palette.hair, [-0.052, 1.662, -0.136], [1, 1, 0.5], [0, 0, Math.PI / 2 - 0.1]),
  part(capsuleGeometry(0.0028, 0.022, 5, 8), 'Head', palette.hair, [0.052, 1.662, -0.136], [1, 1, 0.5], [0, 0, Math.PI / 2 + 0.1]),
  part(sphereGeometry(0.0091, 10, 8), 'Head', palette.eye, [-0.052, 1.635, -0.141], [1.16, 1.1, 0.34]),
  part(sphereGeometry(0.0091, 10, 8), 'Head', palette.eye, [0.052, 1.635, -0.141], [1.16, 1.1, 0.34]),
  // Short restrained upper lids retain direction without covering the eye.
  part(capsuleGeometry(0.0016, 0.01, 4, 7), 'Head', palette.eye, [-0.052, 1.644, -0.143], [1, 1, 0.35], [0, 0, Math.PI / 2 - 0.05]),
  part(capsuleGeometry(0.0016, 0.01, 4, 7), 'Head', palette.eye, [0.052, 1.644, -0.143], [1, 1, 0.35], [0, 0, Math.PI / 2 + 0.05]),
  part(sphereGeometry(0.0025, 7, 6), 'Head', palette.cream, [-0.055, 1.639, -0.144], [1, 1, 0.42]),
  part(sphereGeometry(0.0025, 7, 6), 'Head', palette.cream, [0.049, 1.639, -0.144], [1, 1, 0.42]),
  part(sphereGeometry(0.0072, 9, 7), 'Head', palette.cheek, [-0.086, 1.604, -0.139], [1.4, 0.5, 0.28]),
  part(sphereGeometry(0.0072, 9, 7), 'Head', palette.cheek, [0.086, 1.604, -0.139], [1.4, 0.5, 0.28]),
  part(sphereGeometry(0.0032, 7, 6), 'Head', palette.nose, [0, 1.608, -0.143], [0.9, 1.35, 0.34]),
  part(capsuleGeometry(0.0032, 0.023, 5, 8), 'Head', palette.mouth, [-0.0145, 1.579, -0.141], [1, 1, 0.4], [0, 0, 1.25]),
  part(capsuleGeometry(0.0032, 0.023, 5, 8), 'Head', palette.mouth, [0.0145, 1.579, -0.141], [1, 1, 0.4], [0, 0, -1.25]),
]

const hairFaceParts = visualVariant === 'face-readability-candidate-v4'
  ? createFriendlyExpressionFaceCandidateParts()
  : visualVariant === 'face-readability-candidate-v3'
    ? createR7FaceCandidateParts(connectedHairlineCrownGeometry())
  : visualVariant === 'face-readability-candidate'
    ? createR7FaceCandidateParts()
    : createR6HairFaceParts()

const createSkinnedMesh = (name, parts, roughness) => {
  const geometry = mergeGeometries(parts, false)
  parts.forEach((item) => item.dispose())
  if (!geometry) throw new Error(`Unable to merge ${name} geometry`)

  const material = new MeshStandardMaterial({
    name: `M_VC3_HeroFemale_${name}`,
    color: '#ffffff',
    vertexColors: true,
    roughness,
    metalness: 0,
  })
  const mesh = new SkinnedMesh(geometry, material)
  mesh.name = `HeroFemale_${name}`
  mesh.castShadow = true
  mesh.receiveShadow = true
  mesh.frustumCulled = false
  return mesh
}

const silhouetteContract = {
  profile: 'adult-stylized',
  visibleHeightMetres: { min: 1.76, max: 1.86 },
  visibleHeadsTall: { min: 5.8, max: 6.3 },
  hipHeightRatio: { min: 0.47, max: 0.52 },
  heightToShoulderWidth: { min: 2.35, max: 2.65 },
  groundClearanceMetres: { min: 0, max: 0.025 },
  leftRightFootDeltaMetres: { max: 0.002 },
  bodySymmetryOffsetMetres: { max: 0.02 },
  bookPlacement: {
    maximumRightEdgeX: -0.16,
    minimumBottomY: 0.72,
    maximumDepthCentreZ: -0.12,
  },
}

const emptyBounds = () => ({
  min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
  max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
  vertices: 0,
})

const includeVertex = (bounds, position, vertex) => {
  for (let axis = 0; axis < 3; axis += 1) {
    const value = position.getComponent(vertex, axis)
    bounds.min[axis] = Math.min(bounds.min[axis], value)
    bounds.max[axis] = Math.max(bounds.max[axis], value)
  }
  bounds.vertices += 1
}

const requireBounds = (bounds, label) => {
  if (bounds.vertices === 0) throw new Error(`Unable to measure ${label} silhouette bounds`)
  return bounds
}

const boundsSize = (bounds, axis) => bounds.max[axis] - bounds.min[axis]
const roundedMetric = (value) => Number(value.toFixed(4))

const calculateProportionMetrics = (characterMeshes) => {
  const overall = emptyBounds()
  const bodyWithoutBook = emptyBounds()
  const skinHead = emptyBounds()
  const shoulders = emptyBounds()
  const leftFoot = emptyBounds()
  const rightFoot = emptyBounds()
  const book = emptyBounds()

  for (const mesh of characterMeshes) {
    const position = mesh.geometry.getAttribute('position')
    const skinIndex = mesh.geometry.getAttribute('skinIndex')
    for (let vertex = 0; vertex < position.count; vertex += 1) {
      const weightedBone = orderedBones[skinIndex.getX(vertex)]?.name
      includeVertex(overall, position, vertex)
      if (weightedBone !== 'Book') includeVertex(bodyWithoutBook, position, vertex)
      if (mesh.name === 'HeroFemale_Skin' && weightedBone === 'Head') {
        includeVertex(skinHead, position, vertex)
      }
      if (weightedBone === 'Shoulder.L' || weightedBone === 'Shoulder.R') {
        includeVertex(shoulders, position, vertex)
      }
      if (weightedBone === 'LowerLeg.L') includeVertex(leftFoot, position, vertex)
      if (weightedBone === 'LowerLeg.R') includeVertex(rightFoot, position, vertex)
      if (weightedBone === 'Book') includeVertex(book, position, vertex)
    }
  }

  requireBounds(overall, 'overall')
  requireBounds(bodyWithoutBook, 'body')
  requireBounds(skinHead, 'skin head')
  requireBounds(shoulders, 'shoulders')
  requireBounds(leftFoot, 'left foot')
  requireBounds(rightFoot, 'right foot')
  requireBounds(book, 'book')

  const visibleHeight = boundsSize(overall, 1)
  const skinHeadHeight = boundsSize(skinHead, 1)
  const shoulderWidth = boundsSize(shoulders, 0)
  const hipsWorldPosition = new Vector3()
  bones.get('Hips').getWorldPosition(hipsWorldPosition)

  return {
    profile: silhouetteContract.profile,
    visibleHeightMetres: roundedMetric(visibleHeight),
    skinHeadHeightMetres: roundedMetric(skinHeadHeight),
    visibleHeadsTall: roundedMetric(visibleHeight / skinHeadHeight),
    hipHeightRatio: roundedMetric(
      (hipsWorldPosition.y - overall.min[1]) / visibleHeight,
    ),
    shoulderWidthMetres: roundedMetric(shoulderWidth),
    heightToShoulderWidth: roundedMetric(visibleHeight / shoulderWidth),
    groundClearanceMetres: roundedMetric(overall.min[1]),
    leftRightFootDeltaMetres: roundedMetric(
      Math.abs(leftFoot.min[1] - rightFoot.min[1]),
    ),
    bodySymmetryOffsetMetres: roundedMetric(
      Math.abs(bodyWithoutBook.min[0] + bodyWithoutBook.max[0]),
    ),
    bookPlacement: {
      maximumRightEdgeX: roundedMetric(book.max[0]),
      minimumBottomY: roundedMetric(book.min[1]),
      depthCentreZ: roundedMetric((book.min[2] + book.max[2]) / 2),
    },
  }
}

const validateProportionMetrics = (metrics, label) => {
  const errors = []
  const checkRange = (field, contract) => {
    if (metrics[field] < contract.min || metrics[field] > contract.max) {
      errors.push(
        `${label} ${field} ${metrics[field]} outside ${contract.min}–${contract.max}`,
      )
    }
  }

  checkRange('visibleHeightMetres', silhouetteContract.visibleHeightMetres)
  checkRange('visibleHeadsTall', silhouetteContract.visibleHeadsTall)
  checkRange('hipHeightRatio', silhouetteContract.hipHeightRatio)
  checkRange('heightToShoulderWidth', silhouetteContract.heightToShoulderWidth)
  checkRange('groundClearanceMetres', silhouetteContract.groundClearanceMetres)
  for (const [field, contract] of [
    ['leftRightFootDeltaMetres', silhouetteContract.leftRightFootDeltaMetres],
    ['bodySymmetryOffsetMetres', silhouetteContract.bodySymmetryOffsetMetres],
  ]) {
    if (metrics[field] > contract.max) {
      errors.push(`${label} ${field} ${metrics[field]} exceeds ${contract.max}`)
    }
  }
  if (
    metrics.bookPlacement.maximumRightEdgeX
    > silhouetteContract.bookPlacement.maximumRightEdgeX
  ) {
    errors.push(`${label} book is not fully placed on the character's left side`)
  }
  if (
    metrics.bookPlacement.minimumBottomY
    < silhouetteContract.bookPlacement.minimumBottomY
  ) {
    errors.push(`${label} book is below the approved holding range`)
  }
  if (
    metrics.bookPlacement.depthCentreZ
    > silhouetteContract.bookPlacement.maximumDepthCentreZ
  ) {
    errors.push(`${label} book is not held on the forward side of the torso`)
  }
  return errors
}

const avatar = new Group()
avatar.name = `VC3_Character_HeroFemale_${lod[0].toUpperCase()}${lod.slice(1)}`
avatar.userData = {
  author: 'Alife project',
  license: 'Original project asset',
  metresPerUnit: 1,
  forwardAxis: '-Z',
  lod,
  sourceGenerator: 'tools/virtual-church/build-gate-a-female-hero.mjs',
  ...(visualVariant === 'r6' ? {} : { visualVariant }),
  ...(animationVariant === 'r6' ? {} : { animationVariant }),
}
avatar.add(bones.get('Root'))

const meshes = [
  createSkinnedMesh('Outfit', outfitParts, 0.88),
  createSkinnedMesh('Skin', skinParts, 0.82),
  createSkinnedMesh('HairFace', hairFaceParts, 0.9),
]
meshes.forEach((mesh) => avatar.add(mesh))

const scene = new Scene()
scene.name = 'VC3_GateA_HeroFemale'
scene.add(avatar)
scene.updateMatrixWorld(true)
const proportionMetrics = calculateProportionMetrics(meshes)
const authoredProportionErrors = validateProportionMetrics(
  proportionMetrics,
  `${lod} authored geometry`,
)
if (authoredProportionErrors.length > 0) {
  throw new Error(
    `Gate A female Hero silhouette validation failed:\n- ${authoredProportionErrors.join('\n- ')}`,
  )
}
avatar.userData.proportionMetrics = proportionMetrics

const skeleton = new Skeleton(orderedBones)
meshes.forEach((mesh) => mesh.bind(skeleton))
scene.updateMatrixWorld(true)

const quaternionValues = (angles) => angles.flatMap(([x, y, z]) => {
  const quaternion = new Quaternion().setFromEuler(new Euler(x, y, z))
  return quaternion.toArray()
})

const quaternionTrack = (boneName, times, angles) =>
  new QuaternionKeyframeTrack(`${boneName}.quaternion`, times, quaternionValues(angles))

const idleTimes = [0, 1, 2]
const walkTimes = [0, 0.25, 0.5, 0.75, 1]
const runTimes = [0, 0.2, 0.4, 0.6, 0.8]
const runHipsTimes = animationVariant === 'r7-ground-clearance'
  ? [0, 0.1, 0.2, 0.4, 0.5, 0.6, 0.8]
  : runTimes
const runHipsPositions = animationVariant === 'r7-ground-clearance'
  ? [
      0, 0.79, 0,
      0, 0.8545, 0,
      0, 0.9, 0,
      0, 0.79, 0,
      0, 0.8545, 0,
      0, 0.9, 0,
      0, 0.79, 0,
    ]
  : [
      0, 0.79, 0,
      0, 0.9, 0,
      0, 0.79, 0,
      0, 0.9, 0,
      0, 0.79, 0,
    ]

const animations = [
  new AnimationClip('Idle_A', 2, [
    new VectorKeyframeTrack('Hips.position', idleTimes, [0, 0.9, 0, 0, 0.91, 0, 0, 0.9, 0]),
    quaternionTrack('Torso', idleTimes, [[0, 0, 0], [-0.018, 0.018, 0], [0, 0, 0]]),
    quaternionTrack('Head', idleTimes, [[0, 0, 0], [0, -0.045, 0], [0, 0, 0]]),
    quaternionTrack('HairBack', idleTimes, [[0, 0, 0], [0.018, 0, -0.025], [0, 0, 0]]),
    quaternionTrack('Book', idleTimes, [[0, 0, 0], [-0.012, 0.008, 0.018], [0, 0, 0]]),
  ]),
  new AnimationClip('Idle_B', 2.4, [
    quaternionTrack('Torso', [0, 0.8, 1.6, 2.4], [[0, 0, 0], [0.01, -0.05, 0], [0.005, 0.04, 0], [0, 0, 0]]),
    quaternionTrack('Head', [0, 0.8, 1.6, 2.4], [[0, 0, 0], [-0.02, 0.12, 0.025], [0.015, -0.1, -0.02], [0, 0, 0]]),
    quaternionTrack('Shoulder.L', [0, 1.2, 2.4], [[0, 0, 0], [-0.08, 0, -0.04], [0, 0, 0]]),
    quaternionTrack('HairBack', [0, 0.8, 1.6, 2.4], [[0, 0, 0], [0.02, -0.02, -0.035], [-0.015, 0.015, 0.03], [0, 0, 0]]),
    quaternionTrack('Book', [0, 1.2, 2.4], [[0, 0, 0], [-0.025, 0.015, 0.025], [0, 0, 0]]),
  ]),
  new AnimationClip('Walk', 1, [
    new VectorKeyframeTrack('Hips.position', walkTimes, [
      0, 0.82, 0,
      0, 0.9, 0,
      0, 0.82, 0,
      0, 0.9, 0,
      0, 0.82, 0,
    ]),
    quaternionTrack('UpperLeg.L', walkTimes, [[0.46, 0, 0], [-0.1, 0, 0], [-0.46, 0, 0], [0, 0, 0], [0.46, 0, 0]]),
    quaternionTrack('UpperLeg.R', walkTimes, [[-0.46, 0, 0], [0, 0, 0], [0.46, 0, 0], [-0.1, 0, 0], [-0.46, 0, 0]]),
    quaternionTrack('LowerLeg.L', walkTimes, [[0, 0, 0], [0, 0, 0], [1.2, 0, 0], [0.75, 0, 0], [0, 0, 0]]),
    quaternionTrack('LowerLeg.R', walkTimes, [[1.2, 0, 0], [0.75, 0, 0], [0, 0, 0], [0, 0, 0], [1.2, 0, 0]]),
    quaternionTrack('Shoulder.L', walkTimes, [[-0.22, 0, 0], [0, 0, 0], [0.22, 0, 0], [0, 0, 0], [-0.22, 0, 0]]),
    quaternionTrack('Shoulder.R', walkTimes, [[0.22, 0, 0], [0, 0, 0], [-0.22, 0, 0], [0, 0, 0], [0.22, 0, 0]]),
    quaternionTrack('HairBack', walkTimes, [[-0.035, 0, 0.025], [0.01, 0, 0], [0.035, 0, -0.025], [0.01, 0, 0], [-0.035, 0, 0.025]]),
    quaternionTrack('Book', walkTimes, [[0.018, 0, -0.018], [0, 0, 0], [-0.018, 0, 0.018], [0, 0, 0], [0.018, 0, -0.018]]),
  ]),
  new AnimationClip('Run', 0.8, [
    new VectorKeyframeTrack('Hips.position', runHipsTimes, runHipsPositions),
    quaternionTrack('UpperLeg.L', runTimes, [[0.56, 0, 0], [-0.1, 0, 0], [-0.56, 0, 0], [0, 0, 0], [0.56, 0, 0]]),
    quaternionTrack('UpperLeg.R', runTimes, [[-0.56, 0, 0], [0, 0, 0], [0.56, 0, 0], [-0.1, 0, 0], [-0.56, 0, 0]]),
    quaternionTrack('LowerLeg.L', runTimes, [[0, 0, 0], [0, 0, 0], [1.3, 0, 0], [1.05, 0, 0], [0, 0, 0]]),
    quaternionTrack('LowerLeg.R', runTimes, [[1.3, 0, 0], [1.05, 0, 0], [0, 0, 0], [0, 0, 0], [1.3, 0, 0]]),
    quaternionTrack('Shoulder.L', runTimes, [[-0.36, 0, 0], [0, 0, 0], [0.36, 0, 0], [0, 0, 0], [-0.36, 0, 0]]),
    quaternionTrack('Shoulder.R', runTimes, [[0.36, 0, 0], [0, 0, 0], [-0.36, 0, 0], [0, 0, 0], [0.36, 0, 0]]),
    quaternionTrack('Torso', runTimes, [[-0.06, 0, 0], [-0.08, 0, 0], [-0.06, 0, 0], [-0.08, 0, 0], [-0.06, 0, 0]]),
    quaternionTrack('HairBack', runTimes, [[-0.06, 0, 0.04], [0.025, 0, 0], [0.06, 0, -0.04], [0.025, 0, 0], [-0.06, 0, 0.04]]),
    quaternionTrack('Book', runTimes, [[0.03, 0, -0.025], [0, 0, 0], [-0.03, 0, 0.025], [0, 0, 0], [0.03, 0, -0.025]]),
  ]),
  new AnimationClip('Jump_Start', 0.28, [
    new VectorKeyframeTrack('Hips.position', [0, 0.16, 0.28], [
      0, 0.9, 0,
      0, 0.85, 0,
      0, 0.9, 0,
    ]),
    quaternionTrack('UpperLeg.L', [0, 0.16, 0.28], [[0, 0, 0], [-0.3, 0, 0], [-0.4, 0, 0]]),
    quaternionTrack('UpperLeg.R', [0, 0.16, 0.28], [[0, 0, 0], [-0.3, 0, 0], [-0.34, 0, 0]]),
    quaternionTrack('LowerLeg.L', [0, 0.16, 0.28], [[0, 0, 0], [0.5, 0, 0], [0.52, 0, 0]]),
    quaternionTrack('LowerLeg.R', [0, 0.16, 0.28], [[0, 0, 0], [0.5, 0, 0], [0.46, 0, 0]]),
    quaternionTrack('Torso', [0, 0.16, 0.28], [[0, 0, 0], [0.12, 0, 0], [-0.08, 0, 0]]),
    quaternionTrack('HairBack', [0, 0.16, 0.28], [[0, 0, 0], [0.055, 0, 0], [0.07, 0, 0.02]]),
    quaternionTrack('Book', [0, 0.16, 0.28], [[0, 0, 0], [-0.035, 0, 0.02], [-0.045, 0, 0.025]]),
  ]),
  new AnimationClip('Jump_Loop', 0.5, [
    quaternionTrack('UpperLeg.L', [0, 0.25, 0.5], [[-0.4, 0, 0], [-0.36, 0, 0], [-0.4, 0, 0]]),
    quaternionTrack('UpperLeg.R', [0, 0.25, 0.5], [[-0.34, 0, 0], [-0.38, 0, 0], [-0.34, 0, 0]]),
    quaternionTrack('LowerLeg.L', [0, 0.25, 0.5], [[0.52, 0, 0], [0.48, 0, 0], [0.52, 0, 0]]),
    quaternionTrack('LowerLeg.R', [0, 0.25, 0.5], [[0.46, 0, 0], [0.5, 0, 0], [0.46, 0, 0]]),
    quaternionTrack('Torso', [0, 0.25, 0.5], [[-0.08, 0, 0], [-0.06, 0, 0], [-0.08, 0, 0]]),
    quaternionTrack('HairBack', [0, 0.25, 0.5], [[0.07, 0, 0.02], [0.055, 0, -0.015], [0.07, 0, 0.02]]),
    quaternionTrack('Book', [0, 0.25, 0.5], [[-0.045, 0, 0.025], [-0.035, 0, -0.02], [-0.045, 0, 0.025]]),
  ]),
  new AnimationClip('Jump_Land', 0.32, [
    new VectorKeyframeTrack('Hips.position', [0, 0.16, 0.32], [0, 0.9, 0, 0, 0.85, 0, 0, 0.9, 0]),
    quaternionTrack('UpperLeg.L', [0, 0.16, 0.32], [[-0.4, 0, 0], [-0.3, 0, 0], [0, 0, 0]]),
    quaternionTrack('UpperLeg.R', [0, 0.16, 0.32], [[-0.34, 0, 0], [-0.3, 0, 0], [0, 0, 0]]),
    quaternionTrack('LowerLeg.L', [0, 0.16, 0.32], [[0.52, 0, 0], [0.5, 0, 0], [0, 0, 0]]),
    quaternionTrack('LowerLeg.R', [0, 0.16, 0.32], [[0.46, 0, 0], [0.5, 0, 0], [0, 0, 0]]),
    quaternionTrack('Torso', [0, 0.16, 0.32], [[-0.08, 0, 0], [0.14, 0, 0], [0, 0, 0]]),
    quaternionTrack('HairBack', [0, 0.16, 0.32], [[0.07, 0, 0.02], [-0.045, 0, 0], [0, 0, 0]]),
    quaternionTrack('Book', [0, 0.16, 0.32], [[-0.045, 0, 0.025], [0.03, 0, 0.02], [0, 0, 0]]),
  ]),
  new AnimationClip('Turn_L', 0.7, [
    quaternionTrack('Torso', [0, 0.35, 0.7], [[0, 0, 0], [0, 0.22, 0], [0, 0, 0]]),
    quaternionTrack('Head', [0, 0.35, 0.7], [[0, 0, 0], [0, 0.32, 0], [0, 0, 0]]),
  ]),
  new AnimationClip('Turn_R', 0.7, [
    quaternionTrack('Torso', [0, 0.35, 0.7], [[0, 0, 0], [0, -0.22, 0], [0, 0, 0]]),
    quaternionTrack('Head', [0, 0.35, 0.7], [[0, 0, 0], [0, -0.32, 0], [0, 0, 0]]),
  ]),
  new AnimationClip('Greet', 1.4, [
    quaternionTrack('Shoulder.R', [0, 0.35, 0.7, 1.05, 1.4], [
      [0, 0, 0],
      [-0.18, 0, -1.08],
      [-0.18, 0.18, -1.18],
      [-0.18, -0.18, -1.08],
      [0, 0, 0],
    ]),
    quaternionTrack('Head', [0, 0.7, 1.4], [[0, 0, 0], [0.04, -0.06, 0.04], [0, 0, 0]]),
    quaternionTrack('HairBack', [0, 0.7, 1.4], [[0, 0, 0], [0.025, 0, -0.04], [0, 0, 0]]),
    quaternionTrack('Book', [0, 0.7, 1.4], [[0, 0, 0], [-0.02, 0.01, 0.025], [0, 0, 0]]),
  ]),
]

const splitTrackName = (trackName) => {
  const separator = trackName.lastIndexOf('.')
  if (separator <= 0) throw new Error(`Invalid animation track name "${trackName}"`)
  return {
    target: trackName.slice(0, separator),
    path: trackName.slice(separator + 1),
  }
}

const summarizeAuthoredAnimations = (clips) => Object.fromEntries(
  clips.map((clip) => [
    clip.name,
    {
      duration: clip.duration,
      tracks: clip.tracks.map((track) => ({
        ...splitTrackName(track.name),
        times: Array.from(track.times),
        values: Array.from(track.values),
        valueSize: track.getValueSize(),
      })).sort((left, right) =>
        `${left.target}.${left.path}`.localeCompare(`${right.target}.${right.path}`)),
    },
  ]),
)

const gltfAnimationPath = {
  translation: 'position',
  rotation: 'quaternion',
  scale: 'scale',
  weights: 'weights',
}

const readGlbAccessor = (buffer, gltf, accessorIndex) => {
  const accessor = gltf.accessors[accessorIndex]
  const bufferView = gltf.bufferViews[accessor.bufferView]
  if (accessor.componentType !== 5126) {
    throw new Error(`Animation accessor ${accessorIndex} is not Float32`)
  }
  const components = {
    SCALAR: 1,
    VEC2: 2,
    VEC3: 3,
    VEC4: 4,
  }[accessor.type]
  if (!components) throw new Error(`Unsupported animation accessor type ${accessor.type}`)

  const jsonChunkLength = buffer.readUInt32LE(12)
  const binaryStart = 20 + jsonChunkLength + 8
  const stride = bufferView.byteStride ?? components * 4
  const start = binaryStart + (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, component) =>
      buffer.readFloatLE(start + row * stride + component * 4)))
}

const summarizeExportedAnimations = (buffer, gltf) => Object.fromEntries(
  (gltf.animations ?? []).map((animation) => {
    const tracks = (animation.channels ?? []).map((channel) => {
      const sampler = animation.samplers[channel.sampler]
      const times = readGlbAccessor(buffer, gltf, sampler.input).flat()
      const outputValues = readGlbAccessor(buffer, gltf, sampler.output)
      return {
        target: gltf.nodes[channel.target.node]?.name ?? '',
        path: gltfAnimationPath[channel.target.path] ?? channel.target.path,
        times,
        values: outputValues.flat(),
        valueSize: outputValues[0]?.length ?? 0,
      }
    }).sort((left, right) =>
      `${left.target}.${left.path}`.localeCompare(`${right.target}.${right.path}`))
    return [
      animation.name,
      {
        duration: Math.max(...tracks.flatMap((track) => track.times)),
        tracks,
      },
    ]
  }),
)

const quaternionSeamMatches = (track, tolerance) => {
  const lastOffset = track.values.length - track.valueSize
  let dot = 0
  let firstLength = 0
  let lastLength = 0
  for (let component = 0; component < track.valueSize; component += 1) {
    const first = track.values[component]
    const last = track.values[lastOffset + component]
    dot += first * last
    firstLength += first * first
    lastLength += last * last
  }
  return Math.abs(dot / Math.sqrt(firstLength * lastLength)) >= 1 - tolerance
}

const linearSeamMatches = (track, tolerance) => {
  const lastOffset = track.values.length - track.valueSize
  for (let component = 0; component < track.valueSize; component += 1) {
    if (Math.abs(
      track.values[component] - track.values[lastOffset + component],
    ) > tolerance) return false
  }
  return true
}

const animationMetrics = (summary) => ({
  clips: Object.fromEntries(Object.entries(summary).map(([clipName, clip]) => {
    let maximumQuaternionAngle = 0
    let maximumHorizontalTranslation = 0
    for (const track of clip.tracks) {
      if (track.path === 'quaternion') {
        for (let offset = 0; offset < track.values.length; offset += 4) {
          const [x, y, z, w] = track.values.slice(offset, offset + 4)
          const length = Math.hypot(x, y, z, w)
          maximumQuaternionAngle = Math.max(
            maximumQuaternionAngle,
            2 * Math.acos(Math.min(1, Math.abs(w / length))),
          )
        }
      }
      if (track.path === 'position') {
        for (let offset = 0; offset < track.values.length; offset += 3) {
          maximumHorizontalTranslation = Math.max(
            maximumHorizontalTranslation,
            Math.hypot(track.values[offset], track.values[offset + 2]),
          )
        }
      }
    }
    const looping = animationContract.loopingClips.includes(clipName)
    const seamlessLoop = looping
      ? clip.tracks.every((track) =>
        track.path === 'quaternion'
          ? quaternionSeamMatches(track, animationContract.loopSeamTolerance)
          : linearSeamMatches(track, animationContract.loopSeamTolerance))
      : null
    return [
      clipName,
      {
        durationSeconds: roundedMetric(clip.duration),
        tracks: clip.tracks.length,
        targets: [...new Set(clip.tracks.map((track) => track.target))].sort(),
        maximumQuaternionAngleRadians: roundedMetric(maximumQuaternionAngle),
        maximumHorizontalTranslationMetres: roundedMetric(
          maximumHorizontalTranslation,
        ),
        seamlessLoop,
      },
    ]
  })),
})

const validateAnimationSummary = (summary, label) => {
  const errors = []
  const expectedNames = Object.keys(animationContract.durationsSeconds)
  const actualNames = Object.keys(summary)
  for (const name of expectedNames) {
    const clip = summary[name]
    if (!clip) {
      errors.push(`${label} is missing ${name}`)
      continue
    }
    const expectedDuration = animationContract.durationsSeconds[name]
    if (Math.abs(clip.duration - expectedDuration) > 0.0001) {
      errors.push(
        `${label} ${name} duration ${clip.duration} differs from ${expectedDuration}`,
      )
    }
    const targets = new Set(clip.tracks.map((track) => track.target))
    for (const target of animationContract.requiredTargets[name]) {
      if (!targets.has(target)) errors.push(`${label} ${name} does not target ${target}`)
    }
    for (const track of clip.tracks) {
      if (!['position', 'quaternion'].includes(track.path)) {
        errors.push(`${label} ${name} uses forbidden ${track.path} track`)
      }
      if (track.target === 'Root') {
        errors.push(`${label} ${name} animates Root and introduces root motion`)
      }
      if (
        track.times.length === 0
        || Math.abs(track.times[0]) > 0.0001
        || Math.abs(track.times.at(-1) - expectedDuration) > 0.0001
      ) {
        errors.push(`${label} ${name} ${track.target}.${track.path} does not span the clip`)
      }
      if (
        track.times.some((time, index) =>
          !Number.isFinite(time) || (index > 0 && time <= track.times[index - 1]))
      ) {
        errors.push(`${label} ${name} ${track.target}.${track.path} has invalid times`)
      }
      if (
        track.values.some((value) => !Number.isFinite(value))
        || track.values.length !== track.times.length * track.valueSize
      ) {
        errors.push(`${label} ${name} ${track.target}.${track.path} has invalid values`)
      }
      if (track.path === 'position') {
        if (track.target !== animationContract.allowedTranslationTarget) {
          errors.push(`${label} ${name} translates forbidden target ${track.target}`)
        }
        for (let offset = 0; offset < track.values.length; offset += 3) {
          const [x, y, z] = track.values.slice(offset, offset + 3)
          if (
            Math.hypot(x, z)
            > animationContract.maximumHorizontalTranslationMetres + 0.00001
          ) {
            errors.push(`${label} ${name} has horizontal translation`)
          }
          if (
            y < animationContract.hipsVerticalRangeMetres.min - 0.0001
            || y > animationContract.hipsVerticalRangeMetres.max + 0.0001
          ) {
            errors.push(`${label} ${name} Hips height ${y} is outside the contract`)
          }
        }
      }
      if (track.path === 'quaternion') {
        for (let offset = 0; offset < track.values.length; offset += 4) {
          const [x, y, z, w] = track.values.slice(offset, offset + 4)
          const length = Math.hypot(x, y, z, w)
          if (Math.abs(length - 1) > 0.0001) {
            errors.push(`${label} ${name} contains a non-normalized quaternion`)
          }
          const angle = 2 * Math.acos(Math.min(1, Math.abs(w / length)))
          if (angle > animationContract.maximumQuaternionAngleRadians + 0.0001) {
            errors.push(`${label} ${name} rotation ${angle} exceeds the contract`)
          }
        }
      }
      if (animationContract.loopingClips.includes(name)) {
        const seamless = track.path === 'quaternion'
          ? quaternionSeamMatches(track, animationContract.loopSeamTolerance)
          : linearSeamMatches(track, animationContract.loopSeamTolerance)
        if (!seamless) {
          errors.push(`${label} ${name} ${track.target}.${track.path} has a loop seam`)
        }
      }
    }
  }
  for (const name of actualNames) {
    if (!expectedNames.includes(name)) errors.push(`${label} has unexpected clip ${name}`)
  }
  return errors
}

const authoredAnimationSummary = summarizeAuthoredAnimations(animations)
const authoredAnimationErrors = validateAnimationSummary(
  authoredAnimationSummary,
  `${lod} authored animation`,
)
if (authoredAnimationErrors.length > 0) {
  throw new Error(
    `Gate A female Hero animation validation failed:\n- ${authoredAnimationErrors.join('\n- ')}`,
  )
}
const authoredAnimationMetrics = animationMetrics(authoredAnimationSummary)
avatar.userData.animationContract = animationContract
avatar.userData.animationMetrics = authoredAnimationMetrics

const exporter = new GLTFExporter()
const arrayBuffer = await exporter.parseAsync(scene, {
  animations,
  binary: true,
  onlyVisible: true,
  trs: true,
})
const output = Buffer.from(arrayBuffer)

const jsonLength = output.readUInt32LE(12)
const json = JSON.parse(output.toString('utf8', 20, 20 + jsonLength).trim())
const exportedAnimationSummary = summarizeExportedAnimations(output, json)
const exportedAnimationMetrics = animationMetrics(exportedAnimationSummary)
const primitiveTriangleCount = (primitive) => {
  const accessor = json.accessors[primitive.indices ?? primitive.attributes.POSITION]
  return Math.floor(accessor.count / 3)
}
const primitives = (json.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
const triangles = primitives.reduce((sum, primitive) => sum + primitiveTriangleCount(primitive), 0)
const jointNodes = new Set((json.skins ?? []).flatMap((skin) => skin.joints ?? []))
const jointNames = new Set([...jointNodes].map((nodeIndex) => json.nodes[nodeIndex]?.name))
const animationNames = new Set((json.animations ?? []).map((animation) => animation.name))
const animationTargets = new Map((json.animations ?? []).map((animation) => [
  animation.name,
  new Set((animation.channels ?? []).map((channel) => json.nodes[channel.target.node]?.name)),
]))
const requiredAnimations = Object.keys(animationContract.durationsSeconds)
const requiredSecondaryBones = ['HairBack', 'Book']
const secondaryMotionAnimations = [
  'Idle_A',
  'Idle_B',
  'Walk',
  'Run',
  'Jump_Start',
  'Jump_Loop',
  'Jump_Land',
  'Greet',
]
const exportedRootNode = (json.nodes ?? []).find((node) =>
  node.name === avatar.name)
const exportedProportionMetrics = exportedRootNode?.extras?.proportionMetrics
const embeddedAnimationContract = exportedRootNode?.extras?.animationContract
const embeddedAnimationMetrics = exportedRootNode?.extras?.animationMetrics
const errors = []
const maximumBytes = {
  high: 2.5 * 1024 * 1024,
  medium: 1.5 * 1024 * 1024,
  low: 0.75 * 1024 * 1024,
}[lod]
const maximumTriangles = {
  high: 18_000,
  medium: 10_000,
  low: 5_000,
}[lod]

if (output.toString('utf8', 0, 4) !== 'glTF') errors.push('invalid GLB magic')
if (output.readUInt32LE(4) !== 2) errors.push('expected glTF 2')
if (output.byteLength > maximumBytes) errors.push(`file exceeds ${lod} character budget`)
if (triangles <= 0 || triangles > maximumTriangles) {
  errors.push(`triangle count ${triangles} outside ${lod} prototype budget`)
}
if ((json.meshes?.length ?? 0) > 3) errors.push(`SkinnedMesh count ${json.meshes?.length ?? 0} exceeds 3`)
if ((json.materials?.length ?? 0) > 3) errors.push(`material count ${json.materials?.length ?? 0} exceeds 3`)
if (jointNodes.size > 55) errors.push(`bone count ${jointNodes.size} exceeds mobile budget`)
if (primitives.some((primitive) => primitive.indices == null)) {
  errors.push('one or more primitives are not indexed')
}
if (primitives.some((primitive) => primitive.attributes.JOINTS_0 == null || primitive.attributes.WEIGHTS_0 == null)) {
  errors.push('one or more primitives are not skinned')
}
for (const animationName of requiredAnimations) {
  if (!animationNames.has(animationName)) errors.push(`missing animation ${animationName}`)
}
for (const boneName of requiredSecondaryBones) {
  if (!jointNames.has(boneName)) errors.push(`missing secondary-motion bone ${boneName}`)
}
for (const animationName of secondaryMotionAnimations) {
  const targets = animationTargets.get(animationName)
  for (const boneName of requiredSecondaryBones) {
    if (!targets?.has(boneName)) {
      errors.push(`${animationName} does not animate ${boneName}`)
    }
  }
}
errors.push(...validateAnimationSummary(exportedAnimationSummary, `${lod} exported GLB`))
if (JSON.stringify(embeddedAnimationContract) !== JSON.stringify(animationContract)) {
  errors.push('exported root node does not preserve the animation contract')
}
if (
  JSON.stringify(embeddedAnimationMetrics)
  !== JSON.stringify(exportedAnimationMetrics)
) {
  errors.push('exported root node animation metrics differ from exported curves')
}
if (JSON.stringify(exportedProportionMetrics) !== JSON.stringify(proportionMetrics)) {
  errors.push('exported root node does not preserve the authored proportion metrics')
}
if (exportedProportionMetrics) {
  errors.push(...validateProportionMetrics(exportedProportionMetrics, `${lod} exported GLB`))
}

if (errors.length > 0) {
  throw new Error(`Gate A female Hero validation failed:\n- ${errors.join('\n- ')}`)
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, output)

process.stdout.write(`${JSON.stringify({
  file: outputPath,
  lod,
  visualVariant,
  animationVariant,
  bytes: output.byteLength,
  triangles,
  skinnedMeshes: json.meshes?.length ?? 0,
  materials: json.materials?.length ?? 0,
  bones: jointNodes.size,
  animations: [...animationNames],
  animationMetrics: exportedAnimationMetrics,
  proportions: exportedProportionMetrics,
  generator: json.asset?.generator ?? null,
  passed: true,
}, null, 2)}\n`)

if (!requestedLod) {
  for (const siblingLod of supportedLods.filter((item) => item !== lod)) {
    const result = spawnSync(
      process.execPath,
      [
        scriptPath,
        `--lod=${siblingLod}`,
        ...(requestedCharactersOutputDir
          ? [`--characters-output-dir=${requestedCharactersOutputDir}`]
          : []),
        `--visual-variant=${visualVariant}`,
        `--animation-variant=${animationVariant}`,
      ],
      { stdio: 'inherit' },
    )
    if (result.status !== 0) {
      throw new Error(`Failed to build ${siblingLod} female Hero LOD.`)
    }
  }

  const summaries = await Promise.all(supportedLods.map(async (item) => {
    const path = resolve(
      charactersOutputDir,
      `character-hero-female-${item}.glb`,
    )
    const buffer = await readFile(path)
    const itemJsonLength = buffer.readUInt32LE(12)
    const itemJson = JSON.parse(buffer.toString('utf8', 20, 20 + itemJsonLength).trim())
    const itemPrimitives = (itemJson.meshes ?? []).flatMap((mesh) => mesh.primitives ?? [])
    const bounds = itemPrimitives.reduce((result, primitive) => {
      const accessor = itemJson.accessors[primitive.attributes.POSITION]
      for (let axis = 0; axis < 3; axis += 1) {
        result.min[axis] = Math.min(result.min[axis], accessor.min[axis])
        result.max[axis] = Math.max(result.max[axis], accessor.max[axis])
      }
      return result
    }, {
      min: [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY],
      max: [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY],
    })
    const itemTriangles = itemPrimitives.reduce((sum, primitive) => {
      const accessor = itemJson.accessors[primitive.indices ?? primitive.attributes.POSITION]
      return sum + Math.floor(accessor.count / 3)
    }, 0)
    const itemJointNames = [...new Set(
      (itemJson.skins ?? [])
        .flatMap((skin) => skin.joints ?? [])
        .map((nodeIndex) => itemJson.nodes[nodeIndex]?.name),
    )].sort()
    const itemSecondaryCoverage = Object.fromEntries(
      (itemJson.animations ?? []).map((animation) => [
        animation.name,
        [...new Set((animation.channels ?? [])
          .map((channel) => itemJson.nodes[channel.target.node]?.name)
          .filter((name) => requiredSecondaryBones.includes(name)))].sort(),
      ]),
    )
    const itemAnimationSummary = summarizeExportedAnimations(buffer, itemJson)
    const itemAnimationMetrics = animationMetrics(itemAnimationSummary)
    const itemAnimationErrors = validateAnimationSummary(
      itemAnimationSummary,
      `${item} exported GLB`,
    )

    const itemRootNode = (itemJson.nodes ?? []).find((node) =>
      node.name?.startsWith('VC3_Character_HeroFemale_'))
    if (
      JSON.stringify(itemRootNode?.extras?.animationContract)
      !== JSON.stringify(animationContract)
    ) {
      itemAnimationErrors.push(`${item} embedded animation contract differs`)
    }
    if (
      JSON.stringify(itemRootNode?.extras?.animationMetrics)
      !== JSON.stringify(itemAnimationMetrics)
    ) {
      itemAnimationErrors.push(`${item} embedded animation metrics differ from curves`)
    }

    return {
      lod: item,
      bytes: buffer.byteLength,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      triangles: itemTriangles,
      skinnedMeshes: itemJson.meshes?.length ?? 0,
      materials: itemJson.materials?.length ?? 0,
      bones: itemJointNames,
      animations: (itemJson.animations ?? []).map((animation) => animation.name).sort(),
      animationMetrics: itemAnimationMetrics,
      animationErrors: itemAnimationErrors,
      secondaryCoverage: itemSecondaryCoverage,
      proportions: itemRootNode?.extras?.proportionMetrics ?? null,
      rootNode: itemRootNode?.name ?? null,
      size: bounds.max.map((maximum, axis) =>
        Number((maximum - bounds.min[axis]).toFixed(4))),
    }
  }))

  const [highSummary, mediumSummary, lowSummary] = summaries
  const lodErrors = []
  if (!(highSummary.triangles > mediumSummary.triangles
    && mediumSummary.triangles > lowSummary.triangles)) {
    lodErrors.push('triangle counts must strictly decrease from high to medium to low')
  }
  if (!(highSummary.bytes > mediumSummary.bytes && mediumSummary.bytes > lowSummary.bytes)) {
    lodErrors.push('file sizes must strictly decrease from high to medium to low')
  }

  const referenceBones = JSON.stringify(mediumSummary.bones)
  const referenceAnimations = JSON.stringify(mediumSummary.animations)
  const referenceAnimationMetrics = JSON.stringify(mediumSummary.animationMetrics)
  const referenceSecondaryCoverage = JSON.stringify(mediumSummary.secondaryCoverage)
  for (const summary of summaries) {
    if (summary.skinnedMeshes !== mediumSummary.skinnedMeshes) {
      lodErrors.push(`${summary.lod} SkinnedMesh count differs from medium`)
    }
    if (summary.materials !== mediumSummary.materials) {
      lodErrors.push(`${summary.lod} material count differs from medium`)
    }
    if (JSON.stringify(summary.bones) !== referenceBones) {
      lodErrors.push(`${summary.lod} skeleton differs from medium`)
    }
    if (JSON.stringify(summary.animations) !== referenceAnimations) {
      lodErrors.push(`${summary.lod} animation set differs from medium`)
    }
    lodErrors.push(...summary.animationErrors)
    if (JSON.stringify(summary.animationMetrics) !== referenceAnimationMetrics) {
      lodErrors.push(`${summary.lod} animation curve metrics differ from medium`)
    }
    if (JSON.stringify(summary.secondaryCoverage) !== referenceSecondaryCoverage) {
      lodErrors.push(`${summary.lod} secondary-motion tracks differ from medium`)
    }
    if (!summary.proportions) {
      lodErrors.push(`${summary.lod} is missing proportion metrics`)
    } else {
      lodErrors.push(...validateProportionMetrics(
        summary.proportions,
        `${summary.lod} exported GLB`,
      ))
    }
    for (const animationName of secondaryMotionAnimations) {
      const targets = summary.secondaryCoverage[animationName] ?? []
      for (const boneName of requiredSecondaryBones) {
        if (!targets.includes(boneName)) {
          lodErrors.push(`${summary.lod} ${animationName} does not animate ${boneName}`)
        }
      }
    }
    if (!summary.rootNode?.endsWith(
      `${summary.lod[0].toUpperCase()}${summary.lod.slice(1)}`,
    )) {
      lodErrors.push(`${summary.lod} root node does not identify its LOD`)
    }
    summary.size.forEach((dimension, axis) => {
      if (Math.abs(dimension - mediumSummary.size[axis]) > 0.03) {
        lodErrors.push(`${summary.lod} dimension ${axis} differs from medium by more than 3 cm`)
      }
    })
    if (summary.proportions && mediumSummary.proportions) {
      for (const [field, tolerance] of [
        ['visibleHeadsTall', 0.08],
        ['hipHeightRatio', 0.01],
        ['heightToShoulderWidth', 0.05],
        ['groundClearanceMetres', 0.015],
        ['bodySymmetryOffsetMetres', 0.015],
      ]) {
        if (Math.abs(
          summary.proportions[field] - mediumSummary.proportions[field],
        ) > tolerance) {
          lodErrors.push(
            `${summary.lod} ${field} differs from medium by more than ${tolerance}`,
          )
        }
      }
    }
  }

  if (lodErrors.length > 0) {
    throw new Error(`Gate A female Hero LOD-set validation failed:\n- ${lodErrors.join('\n- ')}`)
  }

  const manifestPath = resolve(
    charactersOutputDir,
    'character-hero-female.manifest.json',
  )
  const manifest = {
    schemaVersion: 1,
    ...(visualVariant === 'r6' ? {} : { visualVariant }),
    ...(animationVariant === 'r6' ? {} : { animationVariant }),
    assetId: 'alife-v3-gate-a-female-hero',
    displayName: {
      en: 'Alife Gate A Female Hero',
      zh: 'Alife Gate A 女性 Hero',
    },
    provenance: {
      sourceType: 'project-authored',
      creator: 'Alife project',
      externalMeshTextureOrAnimationInputs: [],
      generator: {
        path: 'tools/virtual-church/build-gate-a-female-hero.mjs',
        gltfExporter: json.asset?.generator ?? 'THREE.GLTFExporter',
      },
    },
    license: {
      name: 'Project-authored asset; copyright retained by the project owner',
      terms: 'No separate redistribution license has been granted.',
      thirdPartyContentEmbedded: false,
    },
    coordinateSystem: {
      metresPerUnit: 1,
      forwardAxis: '-Z',
      rootOrigin: [0, 0, 0],
    },
    silhouette: {
      contract: silhouetteContract,
      measuredFrom: 'exported skinned geometry in bind pose',
    },
    rig: {
      sharedAcrossLods: true,
      bones: mediumSummary.bones,
      secondaryMotionBones: requiredSecondaryBones,
    },
    animation: {
      sharedAcrossLods: true,
      clips: requiredAnimations,
      secondaryMotionClips: secondaryMotionAnimations,
      contract: animationContract,
      measuredFrom: 'exported GLB animation input/output accessors',
    },
    materials: {
      sharedSlotCount: mediumSummary.materials,
      names: [
        'M_VC3_HeroFemale_Outfit',
        'M_VC3_HeroFemale_Skin',
        'M_VC3_HeroFemale_HairFace',
      ],
      externalTextures: [],
    },
    lods: summaries.map((summary) => ({
      lod: summary.lod,
      file: `character-hero-female-${summary.lod}.glb`,
      sha256: summary.sha256,
      bytes: summary.bytes,
      triangles: summary.triangles,
      skinnedMeshes: summary.skinnedMeshes,
      materials: summary.materials,
      bones: summary.bones.length,
      animations: summary.animations.length,
      animationMetrics: summary.animationMetrics,
      rootNode: summary.rootNode,
      sizeMetres: summary.size,
      proportionMetrics: summary.proportions,
    })),
    runtime: {
      desktopLod: 'high',
      mobileLod: 'low',
      fallback: 'Procedural GateAFemaleHeroAvatar',
    },
  }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)

  const persistedManifest = JSON.parse(await readFile(manifestPath, 'utf8'))
  const manifestErrors = []
  for (const summary of summaries) {
    const entry = persistedManifest.lods?.find((candidate) => candidate.lod === summary.lod)
    if (!entry) {
      manifestErrors.push(`manifest is missing ${summary.lod} LOD`)
      continue
    }
    for (const field of ['sha256', 'bytes', 'triangles', 'skinnedMeshes', 'materials']) {
      if (entry[field] !== summary[field]) {
        manifestErrors.push(`manifest ${summary.lod}.${field} does not match GLB`)
      }
    }
    if (entry.bones !== summary.bones.length) {
      manifestErrors.push(`manifest ${summary.lod}.bones does not match GLB`)
    }
    if (entry.animations !== summary.animations.length) {
      manifestErrors.push(`manifest ${summary.lod}.animations does not match GLB`)
    }
    if (
      JSON.stringify(entry.animationMetrics)
      !== JSON.stringify(summary.animationMetrics)
    ) {
      manifestErrors.push(`manifest ${summary.lod}.animationMetrics does not match GLB`)
    }
    if (JSON.stringify(entry.sizeMetres) !== JSON.stringify(summary.size)) {
      manifestErrors.push(`manifest ${summary.lod}.sizeMetres does not match GLB`)
    }
    if (
      JSON.stringify(entry.proportionMetrics)
      !== JSON.stringify(summary.proportions)
    ) {
      manifestErrors.push(`manifest ${summary.lod}.proportionMetrics does not match GLB`)
    }
  }
  if (
    JSON.stringify(persistedManifest.silhouette?.contract)
    !== JSON.stringify(silhouetteContract)
  ) {
    manifestErrors.push('manifest silhouette contract does not match the builder')
  }
  if (
    JSON.stringify(persistedManifest.animation?.contract)
    !== JSON.stringify(animationContract)
  ) {
    manifestErrors.push('manifest animation contract does not match the builder')
  }
  if (persistedManifest.license?.thirdPartyContentEmbedded !== false) {
    manifestErrors.push('manifest must explicitly state that no third-party content is embedded')
  }
  if (manifestErrors.length > 0) {
    throw new Error(`Gate A female Hero manifest validation failed:\n- ${manifestErrors.join('\n- ')}`)
  }

  process.stdout.write(`${JSON.stringify({
    lodSet: summaries.map((summary) => ({
      lod: summary.lod,
      bytes: summary.bytes,
      triangles: summary.triangles,
      skinnedMeshes: summary.skinnedMeshes,
      materials: summary.materials,
      bones: summary.bones.length,
      animations: summary.animations.length,
      animationMetrics: summary.animationMetrics,
      rootNode: summary.rootNode,
      sizeMetres: summary.size,
      proportionMetrics: summary.proportions,
    })),
    sharedSkeleton: true,
    sharedAnimationSet: true,
    sharedSecondaryMotionTracks: true,
    sharedAdultSilhouetteContract: true,
    sharedAnimationCurveContract: true,
    manifest: manifestPath,
    manifestValidated: true,
    passed: true,
  }, null, 2)}\n`)
}
