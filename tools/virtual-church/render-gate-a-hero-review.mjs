import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'
import {
  AnimationMixer,
  Vector3,
} from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'

// The review renderer samples geometry, skinning and authored material colours;
// it never rasterizes embedded texture pixels. Three's current GLTFLoader still
// resolves those images while parsing, so provide the minimal browser globals
// it expects when this deterministic review runs under Node.
globalThis.self ??= globalThis
globalThis.createImageBitmap ??= async () => ({
  width: 1,
  height: 1,
  close() {},
})

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = resolve(SCRIPT_DIR, '..', '..')
const RELEASE_ROOT = resolve(
  REPOSITORY_ROOT,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
)
const DEFAULT_INPUT = resolve(
  RELEASE_ROOT,
  'characters',
  'character-hero-female-high.glb',
)
const DEFAULT_MANIFEST = resolve(
  RELEASE_ROOT,
  'characters',
  'character-hero-female.manifest.json',
)
const DEFAULT_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-actual-turntable.svg',
)
const DEFAULT_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-actual-turntable.png',
)
const DEFAULT_FACE_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-actual-face-review.png',
)
const DEFAULT_ANIMATION_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-actual-animation-poses.png',
)
const DEFAULT_WALK_CYCLE_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-walk-cycle-review.png',
)
const DEFAULT_RUN_CYCLE_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-run-cycle-review.png',
)
const DEFAULT_COMPARISON_FACE_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-face-comparison.png',
)
const DEFAULT_COMPARISON_GAMEPLAY_PNG_OUTPUT = resolve(
  REPOSITORY_ROOT,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-female-hero-gameplay-distance-comparison.png',
)

const argumentValue = (name, fallback) => {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix))
  return argument ? resolve(REPOSITORY_ROOT, argument.slice(prefix.length)) : fallback
}

const numericArgument = (name, fallback) => {
  const prefix = `--${name}=`
  const argument = process.argv.slice(2).find((item) => item.startsWith(prefix))
  if (!argument) return fallback
  const value = Number(argument.slice(prefix.length))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--${name} must be a positive finite number.`)
  }
  return value
}

const reviewLod = process.argv
  .find((argument) => argument.startsWith('--lod='))
  ?.slice('--lod='.length) ?? 'high'
if (!['high', 'medium', 'low'].includes(reviewLod)) {
  throw new Error('--lod must be high, medium, or low.')
}
const gameplayViewportWidth = numericArgument('gameplay-viewport-width', 720)
const gameplayViewportHeight = numericArgument('gameplay-viewport-height', 405)
const unreleasedCandidate = process.argv.includes('--unreleased-candidate')

const inputPath = argumentValue('input', DEFAULT_INPUT)
const manifestPath = argumentValue('manifest', DEFAULT_MANIFEST)
const outputPath = argumentValue('output', DEFAULT_OUTPUT)
const pngOutputPath = argumentValue('png-output', DEFAULT_PNG_OUTPUT)
const facePngOutputPath = argumentValue('face-png-output', DEFAULT_FACE_PNG_OUTPUT)
const animationPngOutputPath = argumentValue(
  'animation-png-output',
  DEFAULT_ANIMATION_PNG_OUTPUT,
)
const walkCyclePngOutputPath = argumentValue(
  'walk-cycle-png-output',
  DEFAULT_WALK_CYCLE_PNG_OUTPUT,
)
const runCyclePngOutputPath = argumentValue(
  'run-cycle-png-output',
  DEFAULT_RUN_CYCLE_PNG_OUTPUT,
)
const comparisonInputPath = argumentValue('comparison-input', null)
const comparisonManifestPath = argumentValue('comparison-manifest', null)
const comparisonFacePngOutputPath = argumentValue(
  'comparison-face-png-output',
  DEFAULT_COMPARISON_FACE_PNG_OUTPUT,
)
const comparisonGameplayPngOutputPath = argumentValue(
  'comparison-gameplay-png-output',
  DEFAULT_COMPARISON_GAMEPLAY_PNG_OUTPUT,
)
if (unreleasedCandidate && !inputPath.startsWith(resolve(REPOSITORY_ROOT, '.tmp'))) {
  throw new Error('--unreleased-candidate inputs must stay inside the repository .tmp tree.')
}
if ((comparisonInputPath === null) !== (comparisonManifestPath === null)) {
  throw new Error(
    '--comparison-input and --comparison-manifest must be provided together.',
  )
}

const componentReaders = {
  5120: { bytes: 1, read: 'readInt8', normalize: (value) => Math.max(value / 127, -1) },
  5121: { bytes: 1, read: 'readUInt8', normalize: (value) => value / 255 },
  5122: { bytes: 2, read: 'readInt16LE', normalize: (value) => Math.max(value / 32767, -1) },
  5123: { bytes: 2, read: 'readUInt16LE', normalize: (value) => value / 65535 },
  5125: { bytes: 4, read: 'readUInt32LE', normalize: (value) => value / 4294967295 },
  5126: { bytes: 4, read: 'readFloatLE', normalize: (value) => value },
}

const typeComponents = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
}

const parseGlb = (buffer) => {
  if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Input is not a GLB 2 file.')
  }
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error('Input GLB header or declared length is invalid.')
  }

  let offset = 12
  let json
  let binary
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkLength
    if (chunkEnd > buffer.length) throw new Error('Input GLB contains a truncated chunk.')
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.toString('utf8', chunkStart, chunkEnd).replace(/\u0000+$/u, ''))
    } else if (chunkType === 0x004e4942) {
      binary = buffer.subarray(chunkStart, chunkEnd)
    }
    offset = chunkEnd
  }
  if (!json || !binary) throw new Error('Input GLB must contain JSON and BIN chunks.')
  return { json, binary }
}

const readAccessor = (gltf, binary, accessorIndex) => {
  const accessor = gltf.accessors?.[accessorIndex]
  if (!accessor || accessor.bufferView == null) {
    throw new Error(`Accessor ${accessorIndex} is missing or sparse-only.`)
  }
  const view = gltf.bufferViews?.[accessor.bufferView]
  const component = componentReaders[accessor.componentType]
  const components = typeComponents[accessor.type]
  if (!view || !component || !components) {
    throw new Error(`Accessor ${accessorIndex} uses an unsupported layout.`)
  }

  const elementBytes = component.bytes * components
  const stride = view.byteStride ?? elementBytes
  const firstByte = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  return Array.from({ length: accessor.count }, (_, row) =>
    Array.from({ length: components }, (_, column) => {
      const value = binary[component.read](firstByte + row * stride + column * component.bytes)
      return accessor.normalized ? component.normalize(value) : value
    }))
}

const vectorSubtract = (left, right) => [
  left[0] - right[0],
  left[1] - right[1],
  left[2] - right[2],
]

const cross = (left, right) => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]

const dot = (left, right) =>
  left[0] * right[0] + left[1] * right[1] + left[2] * right[2]

const normalized = (value) => {
  const length = Math.hypot(value[0], value[1], value[2]) || 1
  return value.map((component) => component / length)
}

const linearToSrgb = (value) =>
  value <= 0.0031308
    ? 12.92 * value
    : 1.055 * Math.pow(value, 1 / 2.4) - 0.055

const channelHex = (value) =>
  Math.round(Math.max(0, Math.min(1, linearToSrgb(value))) * 255)
    .toString(16)
    .padStart(2, '0')

const shadedColour = (linearColour, normal) => {
  const light = normalized([-0.42, 0.78, -0.46])
  const diffuse = Math.max(0, dot(normal, light))
  const shade = 0.58 + diffuse * 0.42
  return `#${linearColour.map((value) => channelHex(value * shade)).join('')}`
}

const averageVector = (values) => {
  const total = values.reduce(
    (sum, value) => sum.map((component, index) => component + value[index]),
    Array(values[0].length).fill(0),
  )
  return total.map((component) => component / values.length)
}

const projectedRange = (values, project) => values.reduce(
  ([minimum, maximum], value) => {
    const projected = project(value)
    return [Math.min(minimum, projected), Math.max(maximum, projected)]
  },
  [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
)

const collectTriangles = (gltf, binary) => {
  const triangles = []
  for (const mesh of gltf.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.mode != null && primitive.mode !== 4) {
        throw new Error(`Mesh "${mesh.name ?? 'unnamed'}" is not a TRIANGLES primitive.`)
      }
      const positions = readAccessor(gltf, binary, primitive.attributes.POSITION)
      const colours = primitive.attributes.COLOR_0 == null
        ? positions.map(() => [1, 1, 1])
        : readAccessor(gltf, binary, primitive.attributes.COLOR_0)
      const indices = primitive.indices == null
        ? positions.map((_, index) => index)
        : readAccessor(gltf, binary, primitive.indices).flat()
      const materialFactor =
        gltf.materials?.[primitive.material]?.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3)
        ?? [1, 1, 1]

      for (let index = 0; index < indices.length; index += 3) {
        const vertexIndices = indices.slice(index, index + 3)
        const vertices = vertexIndices.map((vertexIndex) => positions[vertexIndex])
        const vertexColours = vertexIndices.map((vertexIndex) =>
          colours[vertexIndex].slice(0, 3).map(
            (channel, channelIndex) => channel * materialFactor[channelIndex],
          ))
        const normal = normalized(cross(
          vectorSubtract(vertices[1], vertices[0]),
          vectorSubtract(vertices[2], vertices[0]),
        ))
        triangles.push({
          vertices,
          colour: shadedColour(averageVector(vertexColours), normal),
        })
      }
    }
  }
  return triangles
}

const parseRuntimeGlb = (buffer) => new Promise((resolvePromise, rejectPromise) => {
  const arrayBuffer = buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  )
  new GLTFLoader().parse(arrayBuffer, '', resolvePromise, rejectPromise)
})

const collectRuntimeTriangles = (scene) => {
  scene.updateMatrixWorld(true)
  const triangles = []
  const vertices = []
  const vertex = new Vector3()

  scene.traverse((object) => {
    if (!object.isSkinnedMesh) return
    const position = object.geometry.getAttribute('position')
    const colour = object.geometry.getAttribute('color')
    const index = object.geometry.getIndex()
    if (!position || !index) {
      throw new Error(`Animated mesh "${object.name}" lacks position or index data.`)
    }
    const materials = Array.isArray(object.material) ? object.material : [object.material]
    const materialForOffset = (offset) => {
      const group = object.geometry.groups.find(
        (candidate) => offset >= candidate.start && offset < candidate.start + candidate.count,
      )
      return materials[group?.materialIndex ?? 0]
    }
    const deformed = Array.from({ length: position.count }, (_, vertexIndex) => {
      vertex.fromBufferAttribute(position, vertexIndex)
      object.applyBoneTransform(vertexIndex, vertex)
      vertex.applyMatrix4(object.matrixWorld)
      return [vertex.x, vertex.y, vertex.z]
    })
    const vertexOffset = vertices.length
    vertices.push(...deformed)

    for (let offset = 0; offset < index.count; offset += 3) {
      const vertexIndices = [
        index.getX(offset),
        index.getX(offset + 1),
        index.getX(offset + 2),
      ]
      const triangleVertices = vertexIndices.map((vertexIndex) => deformed[vertexIndex])
      const materialColour = materialForOffset(offset)?.color ?? { r: 1, g: 1, b: 1 }
      const vertexColours = vertexIndices.map((vertexIndex) => [
        (colour?.getX(vertexIndex) ?? 1) * materialColour.r,
        (colour?.getY(vertexIndex) ?? 1) * materialColour.g,
        (colour?.getZ(vertexIndex) ?? 1) * materialColour.b,
      ])
      const normal = normalized(cross(
        vectorSubtract(triangleVertices[1], triangleVertices[0]),
        vectorSubtract(triangleVertices[2], triangleVertices[0]),
      ))
      triangles.push({
        vertices: triangleVertices,
        colour: shadedColour(averageVector(vertexColours), normal),
        sourceVertexIndices: vertexIndices.map((vertexIndex) => vertexOffset + vertexIndex),
      })
    }
  })
  return { triangles, vertices }
}

const animationPoseSamples = [
  { clip: 'Idle_A', timeSeconds: 1, colour: '#5f7f75' },
  { clip: 'Idle_B', timeSeconds: 1.2, colour: '#7d715b' },
  { clip: 'Walk', timeSeconds: 0.25, colour: '#3d7f6c' },
  { clip: 'Run', timeSeconds: 0.2, colour: '#b67845' },
  { clip: 'Jump_Start', timeSeconds: 0.16, colour: '#c89a45' },
  { clip: 'Jump_Loop', timeSeconds: 0.25, colour: '#6e7f9b' },
  { clip: 'Jump_Land', timeSeconds: 0.16, colour: '#9b6e58' },
  { clip: 'Turn_L', timeSeconds: 0.35, colour: '#6f618d' },
  { clip: 'Turn_R', timeSeconds: 0.35, colour: '#7d638d' },
  { clip: 'Greet', timeSeconds: 0.75, colour: '#4d8a75' },
]

const sampleRuntimeAnimationPoses = async (buffer, expectedTriangles) => {
  const bindGltf = await parseRuntimeGlb(buffer)
  const bind = collectRuntimeTriangles(bindGltf.scene)
  if (bind.triangles.length !== expectedTriangles) {
    throw new Error(
      `Runtime bind pose has ${bind.triangles.length} triangles; expected ${expectedTriangles}.`,
    )
  }

  const poses = []
  for (const sample of animationPoseSamples) {
    const runtimeGltf = await parseRuntimeGlb(buffer)
    const clip = runtimeGltf.animations.find((animation) => animation.name === sample.clip)
    if (!clip) throw new Error(`Runtime GLB is missing animation "${sample.clip}".`)
    if (sample.timeSeconds < 0 || sample.timeSeconds > clip.duration) {
      throw new Error(
        `${sample.clip} sample ${sample.timeSeconds}s is outside duration ${clip.duration}s.`,
      )
    }
    const mixer = new AnimationMixer(runtimeGltf.scene)
    mixer.clipAction(clip).reset().play()
    mixer.update(sample.timeSeconds)
    runtimeGltf.scene.updateMatrixWorld(true)
    const pose = collectRuntimeTriangles(runtimeGltf.scene)
    if (pose.triangles.length !== expectedTriangles || pose.vertices.length !== bind.vertices.length) {
      throw new Error(`${sample.clip} changed the release mesh topology.`)
    }
    const squaredMotion = pose.vertices.reduce((sum, value, index) => {
      const baseline = bind.vertices[index]
      return sum
        + (value[0] - baseline[0]) ** 2
        + (value[1] - baseline[1]) ** 2
        + (value[2] - baseline[2]) ** 2
    }, 0)
    const rmsMotionMetres = Math.sqrt(squaredMotion / pose.vertices.length)
    if (rmsMotionMetres < 0.002) {
      throw new Error(`${sample.clip} sample is indistinguishable from the bind pose.`)
    }
    mixer.stopAllAction()
    poses.push({
      ...sample,
      durationSeconds: clip.duration,
      rmsMotionMetres: Number(rmsMotionMetres.toFixed(4)),
      triangles: pose.triangles,
      vertices: pose.vertices,
    })
  }
  return poses
}

const jointAngleDegrees = (first, pivot, third) => {
  const incoming = normalized(vectorSubtract(first, pivot))
  const outgoing = normalized(vectorSubtract(third, pivot))
  return Math.acos(Math.max(-1, Math.min(1, dot(incoming, outgoing)))) * 180 / Math.PI
}

const motionReviewRatios = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]
const motionReviewJoints = [
  'J_Bip_C_Hips',
  'J_Bip_C_Spine',
  'J_Bip_C_Chest',
  'J_Bip_C_UpperChest',
  'J_Bip_C_Neck',
  'J_Bip_C_Head',
  'J_Bip_L_UpperArm',
  'J_Bip_L_LowerArm',
  'J_Bip_L_Hand',
  'J_Bip_R_UpperArm',
  'J_Bip_R_LowerArm',
  'J_Bip_R_Hand',
  'J_Bip_L_UpperLeg',
  'J_Bip_L_LowerLeg',
  'J_Bip_L_Foot',
  'J_Bip_L_ToeBase',
  'J_Bip_R_UpperLeg',
  'J_Bip_R_LowerLeg',
  'J_Bip_R_Foot',
  'J_Bip_R_ToeBase',
]
const motionReviewSegments = [
  ['J_Bip_C_Hips', 'J_Bip_C_Spine'],
  ['J_Bip_C_Spine', 'J_Bip_C_Chest'],
  ['J_Bip_C_Chest', 'J_Bip_C_UpperChest'],
  ['J_Bip_C_UpperChest', 'J_Bip_C_Neck'],
  ['J_Bip_C_Neck', 'J_Bip_C_Head'],
  ['J_Bip_C_UpperChest', 'J_Bip_L_UpperArm'],
  ['J_Bip_L_UpperArm', 'J_Bip_L_LowerArm'],
  ['J_Bip_L_LowerArm', 'J_Bip_L_Hand'],
  ['J_Bip_C_UpperChest', 'J_Bip_R_UpperArm'],
  ['J_Bip_R_UpperArm', 'J_Bip_R_LowerArm'],
  ['J_Bip_R_LowerArm', 'J_Bip_R_Hand'],
  ['J_Bip_C_Hips', 'J_Bip_L_UpperLeg'],
  ['J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg'],
  ['J_Bip_L_LowerLeg', 'J_Bip_L_Foot'],
  ['J_Bip_L_Foot', 'J_Bip_L_ToeBase'],
  ['J_Bip_C_Hips', 'J_Bip_R_UpperLeg'],
  ['J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg'],
  ['J_Bip_R_LowerLeg', 'J_Bip_R_Foot'],
  ['J_Bip_R_Foot', 'J_Bip_R_ToeBase'],
]

const collectRuntimeJointPositions = (scene) => Object.fromEntries(
  motionReviewJoints.map((name) => {
    const joint = scene.getObjectByName(name)
    if (!joint) throw new Error(`Motion review is missing joint "${name}".`)
    const position = joint.getWorldPosition(new Vector3())
    return [name, [position.x, position.y, position.z]]
  }),
)

const sampleRuntimeMotionCycle = async (buffer, expectedTriangles, clipName) => {
  const runtimeGltf = await parseRuntimeGlb(buffer)
  const clip = runtimeGltf.animations.find((animation) => animation.name === clipName)
  if (!clip) throw new Error(`Runtime GLB is missing motion-review clip "${clipName}".`)
  const mixer = new AnimationMixer(runtimeGltf.scene)
  mixer.clipAction(clip).reset().play()
  const poses = []
  for (const ratio of motionReviewRatios) {
    mixer.setTime(clip.duration * ratio)
    runtimeGltf.scene.updateMatrixWorld(true)
    const pose = collectRuntimeTriangles(runtimeGltf.scene)
    if (pose.triangles.length !== expectedTriangles) {
      throw new Error(`${clipName} review pose changed the release mesh topology.`)
    }
    poses.push({
      ratio,
      timeSeconds: clip.duration * ratio,
      durationSeconds: clip.duration,
      triangles: pose.triangles,
      vertices: pose.vertices,
      joints: collectRuntimeJointPositions(runtimeGltf.scene),
    })
  }
  mixer.stopAllAction()
  return poses
}

const views = [
  {
    key: 'front',
    label: '正面 · Front',
    horizontal: [-1, 0, 0],
    depth: [0, 0, 1],
  },
  {
    key: 'right',
    label: '右侧 · Right',
    horizontal: [0, 0, -1],
    depth: [-1, 0, 0],
  },
  {
    key: 'back',
    label: '背面 · Back',
    horizontal: [1, 0, 0],
    depth: [0, 0, -1],
  },
  {
    key: 'left',
    label: '左侧 · Left',
    horizontal: [0, 0, 1],
    depth: [1, 0, 0],
  },
]

const PANEL_WIDTH = 350
const PANEL_HEIGHT = 500
const PANEL_GAP = 18
const PAGE_MARGIN = 28
const HEADER_HEIGHT = 118
const MODEL_TOP = 42
const MODEL_BOTTOM = 446
const SVG_WIDTH = PAGE_MARGIN * 2 + views.length * PANEL_WIDTH + (views.length - 1) * PANEL_GAP
const SVG_HEIGHT = HEADER_HEIGHT + PANEL_HEIGHT + PAGE_MARGIN

const escapeXml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const renderView = (triangles, view, panelIndex, bounds) => {
  const panelX = PAGE_MARGIN + panelIndex * (PANEL_WIDTH + PANEL_GAP)
  const projectedWidth = bounds.maxX - bounds.minX
  const projectedHeight = bounds.maxY - bounds.minY
  const scale = Math.min(
    (PANEL_WIDTH - 34) / projectedWidth,
    (MODEL_BOTTOM - MODEL_TOP) / projectedHeight,
  )
  const modelCentreX = (bounds.minX + bounds.maxX) / 2
  const modelBottomY = bounds.minY
  const project = (vertex) => [
    panelX + PANEL_WIDTH / 2 + (dot(vertex, view.horizontal) - modelCentreX) * scale,
    HEADER_HEIGHT + MODEL_BOTTOM - (vertex[1] - modelBottomY) * scale,
  ]

  const ordered = triangles
    .map((triangle) => ({
      ...triangle,
      depth: averageVector(triangle.vertices.map((vertex) => [dot(vertex, view.depth)]))[0],
    }))
    .sort((left, right) => right.depth - left.depth)

  const polygons = ordered.map((triangle) => {
    const points = triangle.vertices
      .map(project)
      .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
      .join(' ')
    return `<polygon points="${points}" fill="${triangle.colour}"/>`
  }).join('')

  const groundY = HEADER_HEIGHT + MODEL_BOTTOM + 1
  return [
    `<g id="${view.key}">`,
    `<rect x="${panelX}" y="${HEADER_HEIGHT}" width="${PANEL_WIDTH}" height="${PANEL_HEIGHT}" rx="18" fill="#f5f1e9" stroke="#d8c9b5"/>`,
    `<ellipse cx="${panelX + PANEL_WIDTH / 2}" cy="${groundY + 3}" rx="82" ry="10" fill="#1f2b27" opacity="0.13"/>`,
    polygons,
    `<line x1="${panelX + 24}" y1="${groundY}" x2="${panelX + PANEL_WIDTH - 24}" y2="${groundY}" stroke="#c4b49f" stroke-width="1"/>`,
    `<text x="${panelX + PANEL_WIDTH / 2}" y="${HEADER_HEIGHT + 478}" text-anchor="middle" class="view-label">${escapeXml(view.label)}</text>`,
    '</g>',
  ].join('')
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  }
  return value >>> 0
})

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii')
  const payload = Buffer.concat([typeBuffer, data])
  let crc = 0xffffffff
  for (const byte of payload) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  const header = Buffer.alloc(4)
  header.writeUInt32BE(data.length)
  const footer = Buffer.alloc(4)
  footer.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([header, payload, footer])
}

const encodePng = (width, height, pixels) => {
  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    rows[rowStart] = 0
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4)
      .copy(rows, rowStart + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const hexToRgba = (hex, alpha = 255) => [
  Number.parseInt(hex.slice(1, 3), 16),
  Number.parseInt(hex.slice(3, 5), 16),
  Number.parseInt(hex.slice(5, 7), 16),
  alpha,
]

const createRaster = (width, height, background) => {
  const pixels = new Uint8Array(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels.set(background, offset)
  }

  const setPixel = (x, y, colour) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return
    const offset = (y * width + x) * 4
    const alpha = colour[3] / 255
    pixels[offset] = Math.round(colour[0] * alpha + pixels[offset] * (1 - alpha))
    pixels[offset + 1] = Math.round(colour[1] * alpha + pixels[offset + 1] * (1 - alpha))
    pixels[offset + 2] = Math.round(colour[2] * alpha + pixels[offset + 2] * (1 - alpha))
    pixels[offset + 3] = 255
  }

  const fillRect = (x, y, rectWidth, rectHeight, colour) => {
    const firstX = Math.max(0, Math.floor(x))
    const lastX = Math.min(width, Math.ceil(x + rectWidth))
    const firstY = Math.max(0, Math.floor(y))
    const lastY = Math.min(height, Math.ceil(y + rectHeight))
    for (let row = firstY; row < lastY; row += 1) {
      for (let column = firstX; column < lastX; column += 1) setPixel(column, row, colour)
    }
  }

  const fillEllipse = (centreX, centreY, radiusX, radiusY, colour) => {
    for (let y = Math.floor(centreY - radiusY); y <= Math.ceil(centreY + radiusY); y += 1) {
      for (let x = Math.floor(centreX - radiusX); x <= Math.ceil(centreX + radiusX); x += 1) {
        const normalizedX = (x + 0.5 - centreX) / radiusX
        const normalizedY = (y + 0.5 - centreY) / radiusY
        if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) {
          setPixel(x, y, colour)
        }
      }
    }
  }

  const drawLine = (start, end, colour, thickness = 1) => {
    let x0 = Math.round(start[0])
    let y0 = Math.round(start[1])
    const x1 = Math.round(end[0])
    const y1 = Math.round(end[1])
    const deltaX = Math.abs(x1 - x0)
    const stepX = x0 < x1 ? 1 : -1
    const deltaY = -Math.abs(y1 - y0)
    const stepY = y0 < y1 ? 1 : -1
    let error = deltaX + deltaY
    while (true) {
      fillEllipse(x0, y0, thickness, thickness, colour)
      if (x0 === x1 && y0 === y1) break
      const doubledError = error * 2
      if (doubledError >= deltaY) {
        error += deltaY
        x0 += stepX
      }
      if (doubledError <= deltaX) {
        error += deltaX
        y0 += stepY
      }
    }
  }

  const fillTriangle = (
    points,
    colour,
    clip = { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 },
  ) => {
    const [first, second, third] = points
    const area = (second[0] - first[0]) * (third[1] - first[1])
      - (second[1] - first[1]) * (third[0] - first[0])
    if (Math.abs(area) < 0.0001) return
    const minX = Math.max(clip.minX, Math.floor(Math.min(first[0], second[0], third[0])))
    const maxX = Math.min(clip.maxX, Math.ceil(Math.max(first[0], second[0], third[0])))
    const minY = Math.max(clip.minY, Math.floor(Math.min(first[1], second[1], third[1])))
    const maxY = Math.min(clip.maxY, Math.ceil(Math.max(first[1], second[1], third[1])))
    const edge = (left, right, x, y) =>
      (x - left[0]) * (right[1] - left[1]) - (y - left[1]) * (right[0] - left[0])
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const sampleX = x + 0.5
        const sampleY = y + 0.5
        const firstEdge = edge(first, second, sampleX, sampleY)
        const secondEdge = edge(second, third, sampleX, sampleY)
        const thirdEdge = edge(third, first, sampleX, sampleY)
        if (
          (firstEdge >= 0 && secondEdge >= 0 && thirdEdge >= 0)
          || (firstEdge <= 0 && secondEdge <= 0 && thirdEdge <= 0)
        ) {
          setPixel(x, y, colour)
        }
      }
    }
  }

  return { pixels, fillRect, fillEllipse, fillTriangle, drawLine }
}

const renderPng = (triangles, viewBounds) => {
  const raster = createRaster(SVG_WIDTH, SVG_HEIGHT, hexToRgba('#ece5d9'))
  raster.fillRect(PAGE_MARGIN, 30, 232, 8, hexToRgba('#b67845'))
  raster.fillRect(PAGE_MARGIN, 48, 420, 5, hexToRgba('#3d7f6c'))
  views.forEach((view, panelIndex) => {
    const bounds = viewBounds[panelIndex]
    const panelX = PAGE_MARGIN + panelIndex * (PANEL_WIDTH + PANEL_GAP)
    const projectedWidth = bounds.maxX - bounds.minX
    const projectedHeight = bounds.maxY - bounds.minY
    const scale = Math.min(
      (PANEL_WIDTH - 34) / projectedWidth,
      (MODEL_BOTTOM - MODEL_TOP) / projectedHeight,
    )
    const modelCentreX = (bounds.minX + bounds.maxX) / 2
    const modelBottomY = bounds.minY
    const project = (vertex) => [
      panelX + PANEL_WIDTH / 2 + (dot(vertex, view.horizontal) - modelCentreX) * scale,
      HEADER_HEIGHT + MODEL_BOTTOM - (vertex[1] - modelBottomY) * scale,
    ]
    raster.fillRect(panelX, HEADER_HEIGHT, PANEL_WIDTH, PANEL_HEIGHT, hexToRgba('#f5f1e9'))
    raster.fillEllipse(
      panelX + PANEL_WIDTH / 2,
      HEADER_HEIGHT + MODEL_BOTTOM + 4,
      82,
      10,
      hexToRgba('#1f2b27', 34),
    )
    triangles
      .map((triangle) => ({
        ...triangle,
        depth: averageVector(triangle.vertices.map((vertex) => [dot(vertex, view.depth)]))[0],
      }))
      .sort((left, right) => right.depth - left.depth)
      .forEach((triangle) =>
        raster.fillTriangle(triangle.vertices.map(project), hexToRgba(triangle.colour)))
    raster.fillRect(
      panelX,
      HEADER_HEIGHT + PANEL_HEIGHT - 18,
      PANEL_WIDTH,
      18,
      hexToRgba(panelIndex % 2 === 0 ? '#b67845' : '#3d7f6c'),
    )
  })
  return encodePng(SVG_WIDTH, SVG_HEIGHT, raster.pixels)
}

const renderFacePng = (triangles) => {
  const faceViews = [
    views[0],
    {
      key: 'three-quarter',
      horizontal: normalized([-0.835, 0, 0.55]),
      depth: normalized([0.55, 0, 0.835]),
    },
    views[1],
  ]
  const width = 1316
  const height = 560
  const margin = 28
  const gap = 18
  const header = 70
  const panelWidth = 408
  const panelHeight = 462
  const cropMinY = 1.42
  const cropMaxY = 1.82
  const visibleTriangles = triangles.filter((triangle) =>
    triangle.vertices.some((vertex) => vertex[1] >= cropMinY))
  const cropVertices = visibleTriangles
    .flatMap((triangle) => triangle.vertices)
    .filter((vertex) => vertex[1] >= cropMinY)
  const raster = createRaster(width, height, hexToRgba('#ece5d9'))
  raster.fillRect(margin, 24, 188, 7, hexToRgba('#b67845'))
  raster.fillRect(margin, 40, 340, 5, hexToRgba('#3d7f6c'))

  faceViews.forEach((view, panelIndex) => {
    const panelX = margin + panelIndex * (panelWidth + gap)
    const [minHorizontal, maxHorizontal] = projectedRange(
      cropVertices,
      (vertex) => dot(vertex, view.horizontal),
    )
    const centreHorizontal = (minHorizontal + maxHorizontal) / 2
    const scale = Math.min(
      (panelWidth - 54) / (maxHorizontal - minHorizontal),
      (panelHeight - 42) / (cropMaxY - cropMinY),
    )
    const project = (vertex) => [
      panelX + panelWidth / 2 + (dot(vertex, view.horizontal) - centreHorizontal) * scale,
      header + panelHeight - 24 - (vertex[1] - cropMinY) * scale,
    ]
    const clip = {
      minX: panelX,
      minY: header,
      maxX: panelX + panelWidth - 1,
      maxY: header + panelHeight - 1,
    }
    raster.fillRect(panelX, header, panelWidth, panelHeight, hexToRgba('#f5f1e9'))
    visibleTriangles
      .map((triangle) => ({
        ...triangle,
        depth: averageVector(triangle.vertices.map((vertex) => [dot(vertex, view.depth)]))[0],
      }))
      .sort((left, right) => right.depth - left.depth)
      .forEach((triangle) =>
        raster.fillTriangle(
          triangle.vertices.map(project),
          hexToRgba(triangle.colour),
          clip,
        ))
    raster.fillRect(
      panelX,
      header + panelHeight - 14,
      panelWidth,
      14,
      hexToRgba(panelIndex === 1 ? '#3d7f6c' : '#b67845'),
    )
  })
  return encodePng(width, height, raster.pixels)
}

const pixelFont5x7 = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  J: ['00111', '00010', '00010', '00010', '10010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
}

const drawPixelText = (raster, text, centreX, top, scale, colour) => {
  const normalizedText = text.toUpperCase().replaceAll('_', ' ')
  const glyphWidth = 5
  const spacing = 1
  const width = (
    normalizedText.length * glyphWidth
    + Math.max(0, normalizedText.length - 1) * spacing
  ) * scale
  const startX = Math.round(centreX - width / 2)

  Array.from(normalizedText).forEach((character, characterIndex) => {
    const glyph = pixelFont5x7[character]
    if (!glyph) return
    glyph.forEach((row, rowIndex) => {
      Array.from(row).forEach((pixel, columnIndex) => {
        if (pixel !== '1') return
        raster.fillRect(
          startX + characterIndex * (glyphWidth + spacing) * scale + columnIndex * scale,
          top + rowIndex * scale,
          scale,
          scale,
          colour,
        )
      })
    })
  })
}

const renderFaceComparisonPng = (releaseTriangles, candidateTriangles) => {
  const faceViews = [
    views[0],
    {
      key: 'three-quarter',
      horizontal: normalized([-0.835, 0, 0.55]),
      depth: normalized([0.55, 0, 0.835]),
    },
    views[1],
  ]
  const width = 1316
  const height = 1148
  const margin = 28
  const gap = 18
  const rowHeight = 574
  const header = 70
  const panelWidth = 408
  const panelHeight = 462
  const cropMinY = 1.42
  const cropMaxY = 1.82
  const raster = createRaster(width, height, hexToRgba('#ece5d9'))
  const rows = [
    {
      label: 'RELEASE',
      triangles: releaseTriangles,
      accent: '#b67845',
    },
    {
      label: 'CANDIDATE',
      triangles: candidateTriangles,
      accent: '#3d7f6c',
    },
  ]

  rows.forEach((row, rowIndex) => {
    const rowTop = rowIndex * rowHeight
    const visibleTriangles = row.triangles.filter((triangle) =>
      triangle.vertices.some((vertex) => vertex[1] >= cropMinY))
    const cropVertices = visibleTriangles
      .flatMap((triangle) => triangle.vertices)
      .filter((vertex) => vertex[1] >= cropMinY)

    raster.fillRect(margin, rowTop + 24, 188, 7, hexToRgba(row.accent))
    raster.fillRect(margin, rowTop + 40, 340, 5, hexToRgba('#3d7f6c'))
    drawPixelText(
      raster,
      row.label,
      width - 170,
      rowTop + 20,
      3,
      hexToRgba('#342d26'),
    )

    faceViews.forEach((view, panelIndex) => {
      const panelX = margin + panelIndex * (panelWidth + gap)
      const panelY = rowTop + header
      const minHorizontal = Math.min(
        ...cropVertices.map((vertex) => dot(vertex, view.horizontal)),
      )
      const maxHorizontal = Math.max(
        ...cropVertices.map((vertex) => dot(vertex, view.horizontal)),
      )
      const centreHorizontal = (minHorizontal + maxHorizontal) / 2
      const scale = Math.min(
        (panelWidth - 54) / (maxHorizontal - minHorizontal),
        (panelHeight - 42) / (cropMaxY - cropMinY),
      )
      const project = (vertex) => [
        panelX + panelWidth / 2
          + (dot(vertex, view.horizontal) - centreHorizontal) * scale,
        panelY + panelHeight - 24 - (vertex[1] - cropMinY) * scale,
      ]
      const clip = {
        minX: panelX,
        minY: panelY,
        maxX: panelX + panelWidth - 1,
        maxY: panelY + panelHeight - 1,
      }
      raster.fillRect(
        panelX,
        panelY,
        panelWidth,
        panelHeight,
        hexToRgba('#f5f1e9'),
      )
      visibleTriangles
        .map((triangle) => ({
          ...triangle,
          depth: averageVector(
            triangle.vertices.map((vertex) => [dot(vertex, view.depth)]),
          )[0],
        }))
        .sort((left, right) => right.depth - left.depth)
        .forEach((triangle) =>
          raster.fillTriangle(
            triangle.vertices.map(project),
            hexToRgba(triangle.colour),
            clip,
          ))
      raster.fillRect(
        panelX,
        panelY + panelHeight - 14,
        panelWidth,
        14,
        hexToRgba(row.accent),
      )
    })
  })

  return encodePng(width, height, raster.pixels)
}

const renderGameplayDistanceComparisonPng = (
  releaseTriangles,
  candidateTriangles,
  sourceViewport,
) => {
  const reviewViews = [
    views[0],
    {
      key: 'three-quarter',
      horizontal: normalized([-0.835, 0, 0.55]),
      depth: normalized([0.55, 0, 0.835]),
    },
    views[1],
  ]
  const [sourceViewportWidth, sourceViewportHeight] = sourceViewport
  const verticalFovRadians = 47 * Math.PI / 180
  const cameraDistanceMetres = Math.hypot(7, 2.4 - 1.4)
  const pixelsPerMetre = sourceViewportHeight
    / (2 * cameraDistanceMetres * Math.tan(verticalFovRadians / 2))
  const margin = 20
  const gap = 12
  const header = 40
  const panelWidth = 210
  const sharedVertices = [...releaseTriangles, ...candidateTriangles]
    .flatMap((triangle) => triangle.vertices)
  const [sharedMinimumY, sharedMaximumY] = projectedRange(
    sharedVertices,
    (vertex) => vertex[1],
  )
  const panelHeight = Math.max(
    160,
    Math.ceil((sharedMaximumY - sharedMinimumY) * pixelsPerMetre + 42),
  )
  const rowHeight = header + panelHeight + 10
  const width = 694
  const height = rowHeight * 2
  const raster = createRaster(width, height, hexToRgba('#ece5d9'))
  const rows = [
    { label: 'RELEASE', triangles: releaseTriangles, accent: '#b67845' },
    { label: 'CANDIDATE', triangles: candidateTriangles, accent: '#3d7f6c' },
  ]

  rows.forEach((row, rowIndex) => {
    const rowTop = rowIndex * rowHeight
    raster.fillRect(margin, rowTop + 18, 126, 6, hexToRgba(row.accent))
    drawPixelText(
      raster,
      row.label,
      width - 92,
      rowTop + 14,
      2,
      hexToRgba('#342d26'),
    )

    reviewViews.forEach((view, panelIndex) => {
      const panelX = margin + panelIndex * (panelWidth + gap)
      const panelY = rowTop + header
      const minHorizontal = Math.min(
        ...sharedVertices.map((vertex) => dot(vertex, view.horizontal)),
      )
      const maxHorizontal = Math.max(
        ...sharedVertices.map((vertex) => dot(vertex, view.horizontal)),
      )
      const centreHorizontal = (minHorizontal + maxHorizontal) / 2
      const groundY = panelY + panelHeight - 16
      const project = (vertex) => [
        panelX + panelWidth / 2
          + (dot(vertex, view.horizontal) - centreHorizontal) * pixelsPerMetre,
        groundY - (vertex[1] - sharedMinimumY) * pixelsPerMetre,
      ]
      const clip = {
        minX: panelX,
        minY: panelY,
        maxX: panelX + panelWidth - 1,
        maxY: panelY + panelHeight - 1,
      }
      raster.fillRect(panelX, panelY, panelWidth, panelHeight, hexToRgba('#f5f1e9'))
      raster.fillEllipse(
        panelX + panelWidth / 2,
        groundY + 3,
        32,
        5,
        hexToRgba('#1f2b27', 34),
      )
      row.triangles
        .map((triangle) => ({
          ...triangle,
          depth: averageVector(
            triangle.vertices.map((vertex) => [dot(vertex, view.depth)]),
          )[0],
        }))
        .sort((left, right) => right.depth - left.depth)
        .forEach((triangle) => raster.fillTriangle(
          triangle.vertices.map(project),
          hexToRgba(triangle.colour),
          clip,
        ))
      raster.fillRect(
        panelX,
        panelY + panelHeight - 7,
        panelWidth,
        7,
        hexToRgba(row.accent),
      )
    })
  })

  return {
    png: encodePng(width, height, raster.pixels),
    evidence: {
      sourceViewport: [sourceViewportWidth, sourceViewportHeight],
      verticalFovDegrees: 47,
      horizontalBoomMetres: 7,
      cameraHeightMetres: 2.4,
      lookAtHeightMetres: 1.4,
      cameraDistanceMetres: Number(cameraDistanceMetres.toFixed(4)),
      pixelsPerMetre: Number(pixelsPerMetre.toFixed(4)),
    },
  }
}

const renderAnimationPosePng = (poses) => {
  const width = 1778
  const height = 1090
  const margin = 28
  const gap = 18
  const header = 70
  const columns = 5
  const panelWidth = 330
  const panelHeight = 480
  const poseView = {
    horizontal: normalized([-0.835, 0, 0.55]),
    depth: normalized([0.55, 0, 0.835]),
  }
  const allVertices = poses.flatMap((pose) => pose.vertices)
  const [minHorizontal, maxHorizontal] = projectedRange(
    allVertices,
    (value) => dot(value, poseView.horizontal),
  )
  const [minY, maxY] = projectedRange(allVertices, (value) => value[1])
  const centreHorizontal = (minHorizontal + maxHorizontal) / 2
  const scale = Math.min(
    (panelWidth - 42) / (maxHorizontal - minHorizontal),
    (panelHeight - 52) / (maxY - minY),
  )
  const raster = createRaster(width, height, hexToRgba('#ece5d9'))
  raster.fillRect(margin, 24, 214, 7, hexToRgba('#b67845'))
  raster.fillRect(margin, 40, 392, 5, hexToRgba('#3d7f6c'))

  poses.forEach((pose, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const panelX = margin + column * (panelWidth + gap)
    const panelY = header + row * (panelHeight + gap)
    const project = (value) => [
      panelX + panelWidth / 2 + (dot(value, poseView.horizontal) - centreHorizontal) * scale,
      panelY + panelHeight - 30 - (value[1] - minY) * scale,
    ]
    const clip = {
      minX: panelX,
      minY: panelY,
      maxX: panelX + panelWidth - 1,
      maxY: panelY + panelHeight - 1,
    }
    raster.fillRect(panelX, panelY, panelWidth, panelHeight, hexToRgba('#f5f1e9'))
    raster.fillRect(panelX + 8, panelY + 8, panelWidth - 16, 22, hexToRgba('#e8e0d4'))
    drawPixelText(
      raster,
      pose.clip,
      panelX + panelWidth / 2,
      panelY + 12,
      2,
      hexToRgba('#342d26'),
    )
    raster.fillEllipse(
      panelX + panelWidth / 2,
      panelY + panelHeight - 27,
      74,
      9,
      hexToRgba('#1f2b27', 34),
    )
    pose.triangles
      .map((triangle) => ({
        ...triangle,
        depth: averageVector(
          triangle.vertices.map((value) => [dot(value, poseView.depth)]),
        )[0],
      }))
      .sort((left, right) => right.depth - left.depth)
      .forEach((triangle) =>
        raster.fillTriangle(
          triangle.vertices.map(project),
          hexToRgba(triangle.colour),
          clip,
        ))
    raster.fillRect(
      panelX,
      panelY + panelHeight - 14,
      panelWidth,
      14,
      hexToRgba(pose.colour),
    )
  })
  return encodePng(width, height, raster.pixels)
}

const renderMotionCyclePng = (clipName, poses) => {
  const reviewViews = [
    { ...views[0], reviewLabel: 'FRONT' },
    { ...views[1], reviewLabel: 'RIGHT' },
    { ...views[2], reviewLabel: 'BACK' },
  ]
  const margin = 26
  const rowLabelWidth = 92
  const gap = 10
  const panelWidth = 196
  const panelHeight = 330
  const rowHeader = 34
  const titleHeight = 62
  const width = margin * 2 + rowLabelWidth
    + poses.length * panelWidth + (poses.length - 1) * gap
  const height = titleHeight
    + reviewViews.length * (rowHeader + panelHeight + gap)
    + margin
  const raster = createRaster(width, height, hexToRgba('#e7e1d7'))
  raster.fillRect(margin, 20, 260, 7, hexToRgba('#3d7f6c'))
  drawPixelText(
    raster,
    `${clipName.toUpperCase()} CYCLE 8 PHASES`,
    width - 210,
    18,
    2,
    hexToRgba('#342d26'),
  )

  const allVertices = poses.flatMap((pose) => pose.vertices)
  const [minimumY, maximumY] = projectedRange(allVertices, (vertex) => vertex[1])
  const tintedMotionColour = (colour) => {
    const [red, green, blue] = hexToRgba(colour)
    return [
      Math.max(48, Math.round(red * 0.62)),
      Math.max(54, Math.round(green * 0.64)),
      Math.max(52, Math.round(blue * 0.6)),
      255,
    ]
  }

  reviewViews.forEach((view, rowIndex) => {
    const rowTop = titleHeight + rowIndex * (rowHeader + panelHeight + gap)
    drawPixelText(
      raster,
      view.reviewLabel,
      margin + rowLabelWidth / 2,
      rowTop + rowHeader + panelHeight / 2,
      2,
      hexToRgba('#342d26'),
    )
    const [minimumHorizontal, maximumHorizontal] = projectedRange(
      allVertices,
      (vertex) => dot(vertex, view.horizontal),
    )
    const centreHorizontal = (minimumHorizontal + maximumHorizontal) / 2
    const scale = Math.min(
      (panelWidth - 24) / (maximumHorizontal - minimumHorizontal),
      (panelHeight - 32) / (maximumY - minimumY),
    )

    poses.forEach((pose, columnIndex) => {
      const panelX = margin + rowLabelWidth + columnIndex * (panelWidth + gap)
      const panelY = rowTop + rowHeader
      const groundY = panelY + panelHeight - 17
      const project = (vertex) => [
        panelX + panelWidth / 2
          + (dot(vertex, view.horizontal) - centreHorizontal) * scale,
        groundY - (vertex[1] - minimumY) * scale,
      ]
      const clip = {
        minX: panelX,
        minY: panelY,
        maxX: panelX + panelWidth - 1,
        maxY: panelY + panelHeight - 1,
      }
      raster.fillRect(panelX, panelY, panelWidth, panelHeight, hexToRgba('#f7f3ec'))
      drawPixelText(
        raster,
        `${Math.round(pose.ratio * 100)}%`,
        panelX + panelWidth / 2,
        rowTop + 9,
        2,
        hexToRgba('#5e5348'),
      )
      raster.fillEllipse(
        panelX + panelWidth / 2,
        groundY + 4,
        54,
        7,
        hexToRgba('#1f2b27', 30),
      )
      pose.triangles
        .map((triangle) => ({
          ...triangle,
          depth: averageVector(
            triangle.vertices.map((vertex) => [dot(vertex, view.depth)]),
          )[0],
        }))
        .sort((left, right) => right.depth - left.depth)
        .forEach((triangle) => raster.fillTriangle(
          triangle.vertices.map(project),
          tintedMotionColour(triangle.colour),
          clip,
        ))
      motionReviewSegments.forEach(([startName, endName]) => {
        const segmentColour = startName.includes('_L_') || endName.includes('_L_')
          ? hexToRgba('#d8843f', 218)
          : startName.includes('_R_') || endName.includes('_R_')
            ? hexToRgba('#2f8b79', 218)
            : hexToRgba('#4d3f66', 210)
        raster.drawLine(
          project(pose.joints[startName]),
          project(pose.joints[endName]),
          segmentColour,
          1.25,
        )
      })
      for (const [jointName, position] of Object.entries(pose.joints)) {
        const jointColour = jointName.includes('_L_')
          ? hexToRgba('#d8843f', 235)
          : jointName.includes('_R_')
            ? hexToRgba('#2f8b79', 235)
            : hexToRgba('#4d3f66', 225)
        const [jointX, jointY] = project(position)
        raster.fillEllipse(jointX, jointY, 2.2, 2.2, jointColour)
      }
    })
  })

  return encodePng(width, height, raster.pixels)
}

const sourceGlbBuffer = await readFile(inputPath)
const glbBuffer = await decompressCharacterDraco(sourceGlbBuffer)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
const { json: gltf, binary } = parseGlb(glbBuffer)
const triangles = collectTriangles(gltf, binary)
const reviewedLodManifest = manifest.lods?.find((item) => item.lod === reviewLod)
const sha256 = createHash('sha256').update(sourceGlbBuffer).digest('hex')

const errors = []
if (!inputPath.endsWith(`-${reviewLod}.glb`)) {
  errors.push(`input filename does not match requested ${reviewLod} LOD`)
}
if (!reviewedLodManifest) errors.push(`manifest has no ${reviewLod} LOD entry`)
if (!unreleasedCandidate && reviewedLodManifest?.sha256 !== sha256) {
  errors.push('input SHA-256 differs from the release manifest')
}
if (reviewedLodManifest?.triangles !== triangles.length) {
  errors.push(`rendered ${triangles.length} triangles but manifest declares ${reviewedLodManifest?.triangles}`)
}
if ((gltf.meshes?.length ?? 0) !== reviewedLodManifest?.skinnedMeshes) {
  errors.push('rendered mesh count differs from the release manifest')
}
if (errors.length > 0) {
  throw new Error(`Actual-asset review render validation failed:\n- ${errors.join('\n- ')}`)
}

const allVertices = triangles.flatMap((triangle) => triangle.vertices)
const renderBounds = (view) => {
  const [minX, maxX] = projectedRange(
    allVertices,
    (vertex) => dot(vertex, view.horizontal),
  )
  const [minY, maxY] = projectedRange(allVertices, (vertex) => vertex[1])
  return { minX, maxX, minY, maxY }
}

const panels = views.map((view, index) =>
  renderView(triangles, view, index, renderBounds(view))).join('')
const viewBounds = views.map(renderBounds)
const animationPoses = await sampleRuntimeAnimationPoses(glbBuffer, triangles.length)
const walkCyclePoses = await sampleRuntimeMotionCycle(glbBuffer, triangles.length, 'Walk')
const runCyclePoses = await sampleRuntimeMotionCycle(glbBuffer, triangles.length, 'Run')
const sourceLabel = inputPath.slice(REPOSITORY_ROOT.length + 1).replaceAll('\\', '/')
const svg = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_WIDTH}" height="${SVG_HEIGHT}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}">`,
  '<style>',
  'text{font-family:"Segoe UI","Microsoft YaHei",sans-serif;fill:#342d26}',
  '.title{font-size:24px;font-weight:700}',
  '.subtitle{font-size:14px;fill:#6c5c4d}',
  '.view-label{font-size:15px;font-weight:650}',
  '</style>',
  `<rect width="${SVG_WIDTH}" height="${SVG_HEIGHT}" fill="#ece5d9"/>`,
  `<text x="${PAGE_MARGIN}" y="38" class="title">Gate A 女性 Hero · 实际发布 GLB 四视图</text>`,
  `<text x="${PAGE_MARGIN}" y="66" class="subtitle">${reviewLod.toUpperCase()} LOD · bind pose · ${triangles.length.toLocaleString('en-NZ')} triangles · ${unreleasedCandidate ? '隔离候选，未接入运行时' : '正式发布资产，不是 AI 概念图'}</text>`,
  `<text x="${PAGE_MARGIN}" y="90" class="subtitle">Source: ${escapeXml(sourceLabel)} · SHA-256 ${sha256.slice(0, 16)}…</text>`,
  panels,
  '</svg>',
  '',
].join('\n')

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, svg, 'utf8')
await mkdir(dirname(pngOutputPath), { recursive: true })
await writeFile(pngOutputPath, renderPng(triangles, viewBounds))
await mkdir(dirname(facePngOutputPath), { recursive: true })
await writeFile(facePngOutputPath, renderFacePng(triangles))
await mkdir(dirname(animationPngOutputPath), { recursive: true })
await writeFile(animationPngOutputPath, renderAnimationPosePng(animationPoses))
await mkdir(dirname(walkCyclePngOutputPath), { recursive: true })
await writeFile(walkCyclePngOutputPath, renderMotionCyclePng('Walk', walkCyclePoses))
await mkdir(dirname(runCyclePngOutputPath), { recursive: true })
await writeFile(runCyclePngOutputPath, renderMotionCyclePng('Run', runCyclePoses))

let comparison = null
if (comparisonInputPath !== null && comparisonManifestPath !== null) {
  const [comparisonSourceBuffer, comparisonManifest] = await Promise.all([
    readFile(comparisonInputPath),
    readFile(comparisonManifestPath, 'utf8').then(JSON.parse),
  ])
  const comparisonBuffer = await decompressCharacterDraco(comparisonSourceBuffer)
  const { json: comparisonGltf, binary: comparisonBinary } = parseGlb(comparisonBuffer)
  const comparisonTriangles = collectTriangles(comparisonGltf, comparisonBinary)
  const comparisonLodManifest = comparisonManifest.lods?.find(
    (item) => item.lod === reviewLod,
  )
  const comparisonSha256 = createHash('sha256')
    .update(comparisonSourceBuffer)
    .digest('hex')
  const comparisonErrors = []
  if (!comparisonInputPath.endsWith(`-${reviewLod}.glb`)) {
    comparisonErrors.push(`comparison filename does not match requested ${reviewLod} LOD`)
  }
  if (!comparisonLodManifest) {
    comparisonErrors.push(`comparison manifest has no ${reviewLod} LOD entry`)
  }
  if (comparisonLodManifest?.sha256 !== comparisonSha256) {
    comparisonErrors.push('comparison input SHA-256 differs from its manifest')
  }
  if (comparisonLodManifest?.triangles !== comparisonTriangles.length) {
    comparisonErrors.push(
      'comparison triangle count differs from its manifest',
    )
  }
  if (
    (comparisonGltf.meshes?.length ?? 0)
    !== comparisonLodManifest?.skinnedMeshes
  ) {
    comparisonErrors.push('comparison mesh count differs from its manifest')
  }
  if (comparisonErrors.length > 0) {
    throw new Error(
      `Face comparison validation failed:\n- ${comparisonErrors.join('\n- ')}`,
    )
  }

  await mkdir(dirname(comparisonFacePngOutputPath), { recursive: true })
  await writeFile(
    comparisonFacePngOutputPath,
    renderFaceComparisonPng(triangles, comparisonTriangles),
  )
  const gameplayComparison = renderGameplayDistanceComparisonPng(
    triangles,
    comparisonTriangles,
    [gameplayViewportWidth, gameplayViewportHeight],
  )
  const gameplayPixelsPerMetre = gameplayComparison.evidence.pixelsPerMetre
  gameplayComparison.evidence.releaseVisibleHeightPixels = Number(
    (reviewedLodManifest.sizeMetres[1] * gameplayPixelsPerMetre).toFixed(2),
  )
  gameplayComparison.evidence.candidateVisibleHeightPixels = Number(
    (comparisonLodManifest.sizeMetres[1] * gameplayPixelsPerMetre).toFixed(2),
  )
  gameplayComparison.evidence.releaseSkinHeadHeightPixels = Number(
    (reviewedLodManifest.proportionMetrics.skinHeadHeightMetres * gameplayPixelsPerMetre).toFixed(2),
  )
  gameplayComparison.evidence.candidateSkinHeadHeightPixels = Number(
    (comparisonLodManifest.proportionMetrics.skinHeadHeightMetres * gameplayPixelsPerMetre).toFixed(2),
  )
  await mkdir(dirname(comparisonGameplayPngOutputPath), { recursive: true })
  await writeFile(comparisonGameplayPngOutputPath, gameplayComparison.png)
  comparison = {
    input: comparisonInputPath
      .slice(REPOSITORY_ROOT.length + 1)
      .replaceAll('\\', '/'),
    output: comparisonFacePngOutputPath
      .slice(REPOSITORY_ROOT.length + 1)
      .replaceAll('\\', '/'),
    gameplayDistanceOutput: comparisonGameplayPngOutputPath
      .slice(REPOSITORY_ROOT.length + 1)
      .replaceAll('\\', '/'),
    gameplayDistanceOutputSha256: createHash('sha256')
      .update(gameplayComparison.png)
      .digest('hex'),
    gameplayProjection: gameplayComparison.evidence,
    sha256: comparisonSha256,
    triangles: comparisonTriangles.length,
    manifestMatched: true,
  }
}

process.stdout.write(`${JSON.stringify({
  input: sourceLabel,
  lod: reviewLod,
  output: outputPath.slice(REPOSITORY_ROOT.length + 1).replaceAll('\\', '/'),
  pngOutput: pngOutputPath.slice(REPOSITORY_ROOT.length + 1).replaceAll('\\', '/'),
  facePngOutput: facePngOutputPath.slice(REPOSITORY_ROOT.length + 1).replaceAll('\\', '/'),
  animationPngOutput: animationPngOutputPath
    .slice(REPOSITORY_ROOT.length + 1)
    .replaceAll('\\', '/'),
  walkCyclePngOutput: walkCyclePngOutputPath
    .slice(REPOSITORY_ROOT.length + 1)
    .replaceAll('\\', '/'),
  runCyclePngOutput: runCyclePngOutputPath
    .slice(REPOSITORY_ROOT.length + 1)
    .replaceAll('\\', '/'),
  sha256,
  triangles: triangles.length,
  meshes: gltf.meshes?.length ?? 0,
  views: views.map((view) => view.key),
  animationPoses: animationPoses.map((pose) => ({
    clip: pose.clip,
    timeSeconds: pose.timeSeconds,
    durationSeconds: pose.durationSeconds,
    rmsMotionMetres: pose.rmsMotionMetres,
  })),
  motionCycleReview: {
    views: ['front', 'right', 'back'],
    sampleRatios: motionReviewRatios,
    walkDurationSeconds: walkCyclePoses[0].durationSeconds,
    runDurationSeconds: runCyclePoses[0].durationSeconds,
    walkElbowAnglesDegrees: walkCyclePoses.map((pose) => ({
      left: Number(jointAngleDegrees(
        pose.joints.J_Bip_L_UpperArm,
        pose.joints.J_Bip_L_LowerArm,
        pose.joints.J_Bip_L_Hand,
      ).toFixed(2)),
      right: Number(jointAngleDegrees(
        pose.joints.J_Bip_R_UpperArm,
        pose.joints.J_Bip_R_LowerArm,
        pose.joints.J_Bip_R_Hand,
      ).toFixed(2)),
    })),
    runElbowAnglesDegrees: runCyclePoses.map((pose) => ({
      left: Number(jointAngleDegrees(
        pose.joints.J_Bip_L_UpperArm,
        pose.joints.J_Bip_L_LowerArm,
        pose.joints.J_Bip_L_Hand,
      ).toFixed(2)),
      right: Number(jointAngleDegrees(
        pose.joints.J_Bip_R_UpperArm,
        pose.joints.J_Bip_R_LowerArm,
        pose.joints.J_Bip_R_Hand,
      ).toFixed(2)),
    })),
  },
  comparison,
  reviewStatus: unreleasedCandidate ? 'unreleased-candidate' : 'released-manifest-matched',
  releaseManifestMatched: !unreleasedCandidate,
}, null, 2)}\n`)
