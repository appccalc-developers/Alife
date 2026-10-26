import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AnimationMixer,
  LoopOnce,
  Vector3,
} from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import { loadDracoDecoder } from './gate-a-church-geometry.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..', '..')
const requestedCharactersDir = process.argv
  .find((argument) => argument.startsWith('--characters-dir='))
  ?.slice('--characters-dir='.length)
const requestedManifestPath = process.argv
  .find((argument) => argument.startsWith('--manifest='))
  ?.slice('--manifest='.length)
const requestedGlbPath = process.argv
  .find((argument) => argument.startsWith('--glb='))
  ?.slice('--glb='.length)
const unreleasedCandidate = process.argv.includes('--unreleased-candidate')
const diagnosticMode = process.argv.includes('--diagnostic')
const charactersDir = requestedCharactersDir
  ? resolve(repositoryRoot, requestedCharactersDir)
  : resolve(
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
const glbPath = requestedGlbPath
  ? resolve(repositoryRoot, requestedGlbPath)
  : resolve(charactersDir, 'character-hero-female-high.glb')
const manifestPath = requestedManifestPath
  ? resolve(repositoryRoot, requestedManifestPath)
  : resolve(charactersDir, 'character-hero-female.manifest.json')
if (unreleasedCandidate && requestedCharactersDir
  && !charactersDir.startsWith(resolve(repositoryRoot, '.tmp'))) {
  throw new Error('--unreleased-candidate characters must stay inside the repository .tmp tree.')
}
if (unreleasedCandidate && !glbPath.startsWith(resolve(repositoryRoot, '.tmp'))) {
  throw new Error('--unreleased-candidate GLB must stay inside the repository .tmp tree.')
}
const sampleIntervals = 120
const soleBindMaximumY = 0.13
// The VRoid platform shoes place the weighted sole probe surface above the
// armature origin. Keep the threshold aligned with the bind-pose probe gate.
const soleContactMaximumY = 0.13
const releasedLocomotion = {
  Walk: {
    speedMetresPerSecond: 1.5497,
    currentPlaybackScale: 1,
    minimumStanceTravelMetres: 0.08,
  },
  Run: {
    speedMetresPerSecond: 4.1015,
    currentPlaybackScale: 1,
    minimumStanceTravelMetres: 0.16,
  },
}
const maximumRmsSlipRatio = 0.1

const parseGlbDocument = (buffer) => {
  if (buffer.readUInt32LE(0) !== 0x46546c67
    || buffer.readUInt32LE(4) !== 2
    || buffer.readUInt32LE(8) !== buffer.byteLength) {
    throw new Error('Character input is not a valid GLB 2.0 file.')
  }
  const jsonLength = buffer.readUInt32LE(12)
  const jsonStart = 20
  const jsonEnd = jsonStart + jsonLength
  const binaryLength = buffer.readUInt32LE(jsonEnd)
  const binaryType = buffer.readUInt32LE(jsonEnd + 4)
  if (binaryType !== 0x004e4942) throw new Error('Character GLB has no BIN chunk.')
  return {
    json: JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString('utf8')),
    binary: buffer.subarray(jsonEnd + 8, jsonEnd + 8 + binaryLength),
  }
}

const buildGlb = (json, binary) => {
  json.buffers[0].byteLength = binary.byteLength
  const jsonSource = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonLength = Math.ceil(jsonSource.byteLength / 4) * 4
  const binaryLength = Math.ceil(binary.byteLength / 4) * 4
  const output = Buffer.alloc(12 + 8 + jsonLength + 8 + binaryLength)
  output.write('glTF', 0, 'ascii')
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(output.byteLength, 8)
  output.writeUInt32LE(jsonLength, 12)
  output.writeUInt32LE(0x4e4f534a, 16)
  output.fill(0x20, 20, 20 + jsonLength)
  jsonSource.copy(output, 20)
  const binaryHeader = 20 + jsonLength
  output.writeUInt32LE(binaryLength, binaryHeader)
  output.writeUInt32LE(0x004e4942, binaryHeader + 4)
  binary.copy(output, binaryHeader + 8)
  return output
}

const decodeAttribute = (draco, decoder, mesh, uniqueId, semantic) => {
  const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId)
  if (!attribute?.ptr) throw new Error(`Draco primitive lacks ${semantic}.`)
  const components = attribute.num_components()
  const values = new draco.DracoFloat32Array()
  try {
    if (!decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)) {
      throw new Error(`Unable to decode Draco ${semantic}.`)
    }
    const output = new Float32Array(mesh.num_points() * components)
    for (let index = 0; index < output.length; index += 1) {
      output[index] = values.GetValue(index)
    }
    return { components, values: output }
  } finally {
    draco.destroy(values)
  }
}

const decodeIndices = (draco, decoder, mesh) => {
  const face = new draco.DracoInt32Array()
  try {
    const output = new Uint16Array(mesh.num_faces() * 3)
    for (let index = 0; index < mesh.num_faces(); index += 1) {
      if (!decoder.GetFaceFromMesh(mesh, index, face)) {
        throw new Error(`Unable to decode character face ${index}.`)
      }
      output[index * 3] = face.GetValue(0)
      output[index * 3 + 1] = face.GetValue(1)
      output[index * 3 + 2] = face.GetValue(2)
    }
    return output
  } finally {
    draco.destroy(face)
  }
}

const typedArrayBuffer = (array) => Buffer.from(
  array.buffer,
  array.byteOffset,
  array.byteLength,
)

const decompressDracoForNodeValidation = async (buffer) => {
  const document = parseGlbDocument(buffer)
  if (!(document.json.extensionsRequired ?? []).includes('KHR_draco_mesh_compression')) {
    return buffer
  }
  const draco = await loadDracoDecoder()
  const binaryParts = [Buffer.from(document.binary)]
  let binaryLength = document.binary.byteLength
  const appendView = (source, target) => {
    const padding = (4 - (binaryLength % 4)) % 4
    if (padding > 0) binaryParts.push(Buffer.alloc(padding))
    const byteOffset = binaryLength + padding
    binaryParts.push(source)
    binaryLength = byteOffset + source.byteLength
    const viewIndex = document.json.bufferViews.length
    document.json.bufferViews.push({
      buffer: 0,
      byteOffset,
      byteLength: source.byteLength,
      target,
    })
    return viewIndex
  }

  for (const [meshIndex, meshDefinition] of (document.json.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (meshDefinition.primitives ?? []).entries()) {
      const extension = primitive.extensions?.KHR_draco_mesh_compression
      if (!extension) {
        throw new Error(`Character primitive ${meshIndex}:${primitiveIndex} is not Draco compressed.`)
      }
      const compressedView = document.json.bufferViews[extension.bufferView]
      const compressed = document.binary.subarray(
        compressedView.byteOffset ?? 0,
        (compressedView.byteOffset ?? 0) + compressedView.byteLength,
      )
      const decoderBuffer = new draco.module.DecoderBuffer()
      const decoder = new draco.module.Decoder()
      const mesh = new draco.module.Mesh()
      try {
        decoderBuffer.Init(new Int8Array(
          compressed.buffer,
          compressed.byteOffset,
          compressed.byteLength,
        ), compressed.byteLength)
        const status = decoder.DecodeBufferToMesh(decoderBuffer, mesh)
        if (!status.ok() || mesh.ptr === 0) {
          throw new Error(
            `Unable to decode character primitive ${meshIndex}:${primitiveIndex}: ${status.error_msg()}`,
          )
        }
        for (const [semantic, uniqueId] of Object.entries(extension.attributes ?? {})) {
          const accessorIndex = primitive.attributes[semantic]
          const accessor = document.json.accessors[accessorIndex]
          const decoded = decodeAttribute(draco.module, decoder, mesh, uniqueId, semantic)
          const expectedComponents = {
            SCALAR: 1,
            VEC2: 2,
            VEC3: 3,
            VEC4: 4,
          }[accessor.type]
          if (decoded.components !== expectedComponents) {
            throw new Error(`Character ${semantic} component count changed during Draco decode.`)
          }
          const values = semantic === 'JOINTS_0'
            ? Uint16Array.from(decoded.values, (value) => Math.round(value))
            : decoded.values
          accessor.bufferView = appendView(typedArrayBuffer(values), 34962)
          delete accessor.byteOffset
          accessor.componentType = semantic === 'JOINTS_0' ? 5123 : 5126
          accessor.count = mesh.num_points()
          delete accessor.normalized
          delete accessor.sparse
        }
        const indices = decodeIndices(draco.module, decoder, mesh)
        const indexAccessor = document.json.accessors[primitive.indices]
        indexAccessor.bufferView = appendView(typedArrayBuffer(indices), 34963)
        delete indexAccessor.byteOffset
        indexAccessor.componentType = 5123
        indexAccessor.count = indices.length
        delete indexAccessor.normalized
        delete indexAccessor.sparse
        delete primitive.extensions.KHR_draco_mesh_compression
        if (Object.keys(primitive.extensions).length === 0) delete primitive.extensions
      } finally {
        draco.module.destroy(mesh)
        draco.module.destroy(decoder)
        draco.module.destroy(decoderBuffer)
      }
    }
  }
  document.json.extensionsUsed = (document.json.extensionsUsed ?? []).filter(
    (extension) => extension !== 'KHR_draco_mesh_compression',
  )
  document.json.extensionsRequired = (document.json.extensionsRequired ?? []).filter(
    (extension) => extension !== 'KHR_draco_mesh_compression',
  )
  if (document.json.extensionsUsed.length === 0) delete document.json.extensionsUsed
  if (document.json.extensionsRequired.length === 0) delete document.json.extensionsRequired
  return buildGlb(document.json, Buffer.concat(binaryParts))
}

const stripVisualPayloadForNodeValidation = (buffer) => {
  const jsonLength = buffer.readUInt32LE(12)
  const jsonStart = 20
  const jsonEnd = jsonStart + jsonLength
  const document = JSON.parse(buffer.subarray(jsonStart, jsonEnd).toString('utf8').trim())
  for (const mesh of document.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) delete primitive.material
  }
  delete document.materials
  delete document.textures
  delete document.images
  delete document.samplers
  const visualExtensions = new Set([
    'EXT_texture_webp',
    'KHR_materials_clearcoat',
    'KHR_materials_specular',
  ])
  document.extensionsUsed = (document.extensionsUsed ?? []).filter(
    (extension) => !visualExtensions.has(extension),
  )
  document.extensionsRequired = (document.extensionsRequired ?? []).filter(
    (extension) => !visualExtensions.has(extension),
  )
  if (document.extensionsUsed.length === 0) delete document.extensionsUsed
  if (document.extensionsRequired.length === 0) delete document.extensionsRequired

  const jsonSource = Buffer.from(JSON.stringify(document), 'utf8')
  const paddedJsonLength = Math.ceil(jsonSource.length / 4) * 4
  const jsonChunk = Buffer.alloc(8 + paddedJsonLength, 0x20)
  jsonChunk.writeUInt32LE(paddedJsonLength, 0)
  jsonChunk.writeUInt32LE(0x4e4f534a, 4)
  jsonSource.copy(jsonChunk, 8)
  const remainingChunks = buffer.subarray(jsonEnd)
  const header = Buffer.alloc(12)
  header.write('glTF', 0, 'ascii')
  header.writeUInt32LE(2, 4)
  header.writeUInt32LE(12 + jsonChunk.length + remainingChunks.length, 8)
  return Buffer.concat([header, jsonChunk, remainingChunks])
}

const parseGlb = async (buffer) => {
  const decompressed = await decompressDracoForNodeValidation(buffer)
  const validationBuffer = stripVisualPayloadForNodeValidation(decompressed)
  const arrayBuffer = validationBuffer.buffer.slice(
    validationBuffer.byteOffset,
    validationBuffer.byteOffset + validationBuffer.byteLength,
  )
  return new Promise((resolvePromise, rejectPromise) => {
    new GLTFLoader().parse(arrayBuffer, '', resolvePromise, rejectPromise)
  })
}

const average = (values) =>
  values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)

const rounded = (value, decimals = 4) => Number(value.toFixed(decimals))

const rmsDistance = (left, right) => Math.sqrt(
  left.reduce((sum, value, index) => {
    const other = right[index]
    return sum
      + (value[0] - other[0]) ** 2
      + (value[1] - other[1]) ** 2
      + (value[2] - other[2]) ** 2
  }, 0) / left.length,
)

const collectProbeRecords = (scene) => {
  scene.updateMatrixWorld(true)
  const vertices = []
  const soles = { L: [], R: [] }
  const dominantBoneCounts = new Map()
  const skeletonBoneNames = new Set()
  const value = new Vector3()

  scene.traverse((object) => {
    if (!object.isSkinnedMesh) return
    const position = object.geometry.getAttribute('position')
    const skinIndex = object.geometry.getAttribute('skinIndex')
    const skinWeight = object.geometry.getAttribute('skinWeight')
    if (!position || !skinIndex || !skinWeight) {
      throw new Error(`Skinned mesh "${object.name}" lacks probe attributes.`)
    }
    object.skeleton.bones.forEach((bone) => skeletonBoneNames.add(bone.name))

    for (let index = 0; index < position.count; index += 1) {
      const record = { object, index }
      vertices.push(record)

      const weights = [
        skinWeight.getX(index),
        skinWeight.getY(index),
        skinWeight.getZ(index),
        skinWeight.getW(index),
      ]
      const joints = [
        skinIndex.getX(index),
        skinIndex.getY(index),
        skinIndex.getZ(index),
        skinIndex.getW(index),
      ]
      const dominantSlot = weights.reduce(
        (best, weight, slot) => weight > weights[best] ? slot : best,
        0,
      )
      const boneName = object.skeleton.bones[joints[dominantSlot]]?.name
      dominantBoneCounts.set(
        boneName ?? '(missing)',
        (dominantBoneCounts.get(boneName ?? '(missing)') ?? 0) + 1,
      )
      const side = ['LowerLegL', 'J_Bip_L_Foot', 'J_Bip_L_ToeBase'].includes(boneName)
        ? 'L'
        : ['LowerLegR', 'J_Bip_R_Foot', 'J_Bip_R_ToeBase'].includes(boneName)
          ? 'R'
          : null
      if (side === null) continue

      value.fromBufferAttribute(position, index)
      object.applyBoneTransform(index, value)
      value.applyMatrix4(object.matrixWorld)
      if (value.y <= soleBindMaximumY) soles[side].push(record)
    }
  })

  if (vertices.length === 0 || soles.L.length < 8 || soles.R.length < 8) {
    throw new Error(
      `Unable to identify release mesh probes (${vertices.length} vertices, `
      + `${soles.L.length}/${soles.R.length} sole probes; skeleton `
      + `${[...skeletonBoneNames].join(', ')}; dominant `
      + `${JSON.stringify(Object.fromEntries(dominantBoneCounts))}).`,
    )
  }
  return { vertices, soles }
}

const sampleRecords = (records) => {
  const value = new Vector3()
  return records.map(({ object, index }) => {
    const position = object.geometry.getAttribute('position')
    value.fromBufferAttribute(position, index)
    object.applyBoneTransform(index, value)
    value.applyMatrix4(object.matrixWorld)
    return [value.x, value.y, value.z]
  })
}

const boundsFor = (vertices) => ({
  min: [
    Math.min(...vertices.map((value) => value[0])),
    Math.min(...vertices.map((value) => value[1])),
    Math.min(...vertices.map((value) => value[2])),
  ],
  max: [
    Math.max(...vertices.map((value) => value[0])),
    Math.max(...vertices.map((value) => value[1])),
    Math.max(...vertices.map((value) => value[2])),
  ],
})

const sampleClip = async (buffer, clipName) => {
  const gltf = await parseGlb(buffer)
  const clip = gltf.animations.find((candidate) => candidate.name === clipName)
  if (!clip) throw new Error(`Release GLB is missing animation "${clipName}".`)
  const probes = collectProbeRecords(gltf.scene)
  const mixer = new AnimationMixer(gltf.scene)
  const action = mixer.clipAction(clip)
  action.reset()
  action.clampWhenFinished = true
  action.setLoop(LoopOnce, 1)
  action.play()

  const samples = []
  for (let index = 0; index <= sampleIntervals; index += 1) {
    const timeSeconds = clip.duration * index / sampleIntervals
    mixer.setTime(timeSeconds)
    gltf.scene.updateMatrixWorld(true)
    const vertices = sampleRecords(probes.vertices)
    const soleVertices = {
      L: sampleRecords(probes.soles.L),
      R: sampleRecords(probes.soles.R),
    }
    samples.push({
      timeSeconds,
      vertices,
      bounds: boundsFor(vertices),
      soles: Object.fromEntries(Object.entries(soleVertices).map(([side, values]) => [
        side,
        {
          centre: [
            average(values.map((value) => value[0])),
            average(values.map((value) => value[1])),
            average(values.map((value) => value[2])),
          ],
          minimumY: Math.min(...values.map((value) => value[1])),
        },
      ])),
    })
  }
  mixer.stopAllAction()
  return { clip, samples, soleProbeCounts: {
    L: probes.soles.L.length,
    R: probes.soles.R.length,
  } }
}

const normalizedSampleTime = (samples, index) =>
  samples[index].timeSeconds / samples.at(-1).timeSeconds

const sampleIsInsideContactWindow = (samples, index, contactWindow) => {
  const phase = normalizedSampleTime(samples, index)
  return phase >= contactWindow[0] && phase <= contactWindow[1]
}

const locomotionSlipMetric = (
  samples,
  speedMetresPerSecond,
  playbackScale,
  contactWindows,
) => {
  const clipStep = samples[1].timeSeconds - samples[0].timeSeconds
  const worldSpeeds = []

  for (let index = 1; index < samples.length - 1; index += 1) {
    for (const side of ['L', 'R']) {
      const contactWindow = contactWindows[side]
      if (
        !sampleIsInsideContactWindow(samples, index - 1, contactWindow)
        || !sampleIsInsideContactWindow(samples, index, contactWindow)
        || !sampleIsInsideContactWindow(samples, index + 1, contactWindow)
      ) {
        continue
      }
      const previous = samples[index - 1].soles[side]
      const current = samples[index].soles[side]
      const next = samples[index + 1].soles[side]
      if (
        previous.minimumY > soleContactMaximumY
        || current.minimumY > soleContactMaximumY
        || next.minimumY > soleContactMaximumY
      ) {
        continue
      }

      const localVelocityPerClipSecond =
        (next.centre[2] - previous.centre[2]) / (2 * clipStep)
      // The released VRoid faces +Z. A planted foot therefore moves toward
      // local -Z while the controller advances the character toward local +Z.
      // The old subtraction was inherited from the legacy -Z avatar and made
      // a physically correct backward stance sweep appear twice as fast.
      const controllerVelocityInLocalZ = manifest.coordinateSystem.forwardAxis === '+Z'
        ? speedMetresPerSecond
        : -speedMetresPerSecond
      worldSpeeds.push(
        localVelocityPerClipSecond * playbackScale + controllerVelocityInLocalZ,
      )
    }
  }

  if (worldSpeeds.length < 12) {
    throw new Error(
      `Locomotion clip provides only ${worldSpeeds.length} stable grounded sole samples.`,
    )
  }
  return {
    contactSamples: worldSpeeds.length,
    rmsSlipMetresPerSecond: Math.sqrt(
      average(worldSpeeds.map((value) => value ** 2)),
    ),
    meanSlipMetresPerSecond: average(worldSpeeds),
  }
}

const locomotionContactTravel = (samples, side, contactWindow) => {
  const contactZ = samples
    .filter((sample, index) =>
      sampleIsInsideContactWindow(samples, index, contactWindow)
      && sample.soles[side].minimumY <= soleContactMaximumY)
    .map((sample) => sample.soles[side].centre[2])
  if (contactZ.length < 6) {
    throw new Error(
      `Locomotion clip provides only ${contactZ.length} ${side} contact positions.`,
    )
  }
  return Math.max(...contactZ) - Math.min(...contactZ)
}

const bestPlaybackScale = (samples, speedMetresPerSecond, contactWindows) => {
  let best = null
  for (let scale = 0.4; scale <= 4.0001; scale += 0.01) {
    const metric = locomotionSlipMetric(
      samples,
      speedMetresPerSecond,
      scale,
      contactWindows,
    )
    if (best === null || metric.rmsSlipMetresPerSecond < best.rmsSlipMetresPerSecond) {
      best = { scale, ...metric }
    }
  }
  return best
}

const bestSymmetricContactWindows = (
  samples,
  speedMetresPerSecond,
  playbackScale,
) => {
  let best = null
  for (let start = 0; start <= 0.2; start += 0.025) {
    for (let end = start + 0.1; end <= 0.4; end += 0.025) {
      const contactWindows = {
        L: [start, end],
        R: [start + 0.5, end + 0.5],
      }
      try {
        const metric = locomotionSlipMetric(
          samples,
          speedMetresPerSecond,
          playbackScale,
          contactWindows,
        )
        if (best === null || metric.rmsSlipMetresPerSecond < best.rmsSlipMetresPerSecond) {
          best = { contactWindows, ...metric }
        }
      } catch {
        // Some narrow windows have too few grounded sole probes. They are not
        // viable contracts and are simply excluded from calibration.
      }
    }
  }
  return best
}

const [buffer, manifest] = await Promise.all([
  readFile(glbPath),
  readFile(manifestPath, 'utf8').then(JSON.parse),
])
const candidateLocomotionQuality = manifest.animation?.contract?.locomotionQuality
const candidateSpeeds = candidateLocomotionQuality?.controllerTranslationSpeedMetresPerSecond
const candidatePlaybackScales = candidateLocomotionQuality?.playbackScaleAtFullInput
const locomotion = Object.fromEntries(Object.entries(releasedLocomotion).map(([clipName, config]) => {
  const speedMetresPerSecond = Number(candidateSpeeds?.[clipName])
  const currentPlaybackScale = Number(candidatePlaybackScales?.[clipName])
  if (!Number.isFinite(speedMetresPerSecond) || speedMetresPerSecond <= 0
    || !Number.isFinite(currentPlaybackScale) || currentPlaybackScale <= 0) {
    throw new Error(
      `${clipName} manifest must declare positive controller speed and playback scale.`,
    )
  }
  return [clipName, {
    ...config,
    speedMetresPerSecond,
    currentPlaybackScale,
  }]
}))
const high = manifest.lods.find((lod) => lod.lod === 'high')
const sha256 = createHash('sha256').update(buffer).digest('hex')
if (!high || (!unreleasedCandidate && high.sha256 !== sha256) || high.animations !== 14) {
  throw new Error('High release GLB does not match its manifest animation identity.')
}

const clipNames = manifest.animation.clips
const looping = new Set(manifest.animation.contract.loopingClips)
const errors = []
const metrics = []
const clipEndpoints = new Map()

for (const clipName of clipNames) {
  const { clip, samples, soleProbeCounts } = await sampleClip(buffer, clipName)
  const first = samples[0]
  const last = samples.at(-1)
  const allMinimumY = Math.min(...samples.map((sample) => sample.bounds.min[1]))
  const allMaximumY = Math.max(...samples.map((sample) => sample.bounds.max[1]))
  const minimumEnvelopeSample = samples.reduce(
    (lowest, sample) =>
      sample.bounds.min[1] < lowest.bounds.min[1] ? sample : lowest,
    samples[0],
  )
  const maximumWidth = Math.max(...samples.map(
    (sample) => sample.bounds.max[0] - sample.bounds.min[0],
  ))
  const maximumDepth = Math.max(...samples.map(
    (sample) => sample.bounds.max[2] - sample.bounds.min[2],
  ))
  const frameRmsSpeeds = samples.slice(1).map((sample, index) => ({
    timeSeconds: sample.timeSeconds,
    speed: rmsDistance(sample.vertices, samples[index].vertices)
      / (sample.timeSeconds - samples[index].timeSeconds),
  }))
  const maximumFrameRmsSpeedSample = frameRmsSpeeds.reduce(
    (maximum, sample) => sample.speed > maximum.speed ? sample : maximum,
    frameRmsSpeeds[0],
  )
  const maximumFrameRmsSpeed = maximumFrameRmsSpeedSample.speed
  const loopSeamRmsMetres = rmsDistance(first.vertices, last.vertices)
  clipEndpoints.set(clipName, {
    first: first.vertices,
    last: last.vertices,
    authoredLoopJoin: samples[Math.round(sampleIntervals * 0.375)].vertices,
  })

  if (
    !Number.isFinite(allMinimumY)
    || !Number.isFinite(allMaximumY)
    || !Number.isFinite(maximumFrameRmsSpeed)
  ) {
    errors.push(`${clipName} produces non-finite deformed geometry`)
  }
  if (allMinimumY < -0.025 || allMaximumY > 2.1) {
    errors.push(
      `${clipName} leaves the safe vertical envelope (${allMinimumY}–${allMaximumY} m)`,
    )
  }
  if (
    clipName === 'Run'
    && manifest.animationVariant === 'r7-ground-clearance'
    && allMinimumY < -0.001
  ) {
    errors.push(
      `Run ground-clearance candidate penetrates ${Math.abs(allMinimumY)} m; `
      + 'the candidate limit is 0.001 m',
    )
  }
  if (maximumWidth > 1.35 || maximumDepth > 1.45) {
    errors.push(
      `${clipName} leaves the safe horizontal envelope (${maximumWidth} × ${maximumDepth} m)`,
    )
  }
  if (maximumFrameRmsSpeed > 5) {
    errors.push(`${clipName} has a deformed-vertex speed spike of ${maximumFrameRmsSpeed} m/s`)
  }
  const loopSeamTolerance = Number(manifest.animation.contract.loopSeamTolerance)
  if (
    looping.has(clipName)
    && (!Number.isFinite(loopSeamTolerance) || loopSeamRmsMetres > loopSeamTolerance)
  ) {
    errors.push(`${clipName} has a deformed loop seam of ${loopSeamRmsMetres} m RMS`)
  }

  const baseLocomotionConfig = locomotion[clipName]
  const contactWindows =
    manifest.animation.contract.locomotionContactWindows?.[clipName]
  const locomotionConfig = baseLocomotionConfig && contactWindows
    ? { ...baseLocomotionConfig, contactWindows }
    : null
  if (baseLocomotionConfig && !contactWindows) {
    errors.push(`${clipName} is missing locomotion contact windows`)
  }
  if (diagnosticMode && baseLocomotionConfig) {
    process.stderr.write(`${JSON.stringify({
      clip: clipName,
      diagnosticSoleSeries: samples
        .filter((_, sampleIndex) => sampleIndex % 5 === 0)
        .map((sample) => ({
          phase: rounded(sample.timeSeconds / clip.duration),
          left: {
            minimumY: rounded(sample.soles.L.minimumY),
            centreZ: rounded(sample.soles.L.centre[2]),
          },
          right: {
            minimumY: rounded(sample.soles.R.minimumY),
            centreZ: rounded(sample.soles.R.centre[2]),
          },
        })),
    })}\n`)
  }
  const locomotionMetrics = locomotionConfig
    ? {
        current: locomotionSlipMetric(
          samples,
          locomotionConfig.speedMetresPerSecond,
          locomotionConfig.currentPlaybackScale,
          locomotionConfig.contactWindows,
        ),
        best: bestPlaybackScale(
          samples,
          locomotionConfig.speedMetresPerSecond,
          locomotionConfig.contactWindows,
        ),
      }
    : null

  if (locomotionMetrics) {
    for (const expectedGroundedSide of ['L', 'R']) {
      const contactWindow = locomotionConfig.contactWindows[expectedGroundedSide]
      const contactMidpoint = (contactWindow[0] + contactWindow[1]) / 2
      const sampleIndex = Math.round(contactMidpoint * sampleIntervals)
      const sample = samples[sampleIndex]
      const otherSide = expectedGroundedSide === 'L' ? 'R' : 'L'
      const grounded = sample.soles[expectedGroundedSide]
      const swing = sample.soles[otherSide]
      if (grounded.minimumY > soleContactMaximumY) {
        errors.push(
          `${clipName} ${expectedGroundedSide} stance sole is `
          + `${grounded.minimumY} m above ground at contact-window midpoint`,
        )
      }
      if (swing.minimumY - grounded.minimumY < 0.012) {
        errors.push(
          `${clipName} does not lift the ${otherSide} swing sole at the `
          + `${expectedGroundedSide} contact-window midpoint`,
        )
      }
    }
    const leftStanceTravel = locomotionContactTravel(
      samples,
      'L',
      locomotionConfig.contactWindows.L,
    )
    const rightStanceTravel = locomotionContactTravel(
      samples,
      'R',
      locomotionConfig.contactWindows.R,
    )
    if (
      leftStanceTravel < locomotionConfig.minimumStanceTravelMetres
      || rightStanceTravel < locomotionConfig.minimumStanceTravelMetres
    ) {
      errors.push(
        `${clipName} stance travel ${leftStanceTravel}/${rightStanceTravel} m `
        + `is below ${locomotionConfig.minimumStanceTravelMetres} m`,
      )
    }
    if (
      locomotionMetrics.current.rmsSlipMetresPerSecond
      / locomotionConfig.speedMetresPerSecond
      > maximumRmsSlipRatio
    ) {
      errors.push(
        `${clipName} RMS foot slip exceeds ${maximumRmsSlipRatio} of movement speed`,
      )
    }
  }

  metrics.push({
    clip: clipName,
    durationSeconds: rounded(clip.duration),
    samples: samples.length,
    soleProbeCounts,
    verticalEnvelopeMetres: [
      rounded(allMinimumY),
      rounded(allMaximumY),
    ],
    minimumEnvelopeSample: {
      timeSeconds: rounded(minimumEnvelopeSample.timeSeconds),
      normalizedPhase: rounded(
        minimumEnvelopeSample.timeSeconds / clip.duration,
      ),
      geometryMinimumY: rounded(minimumEnvelopeSample.bounds.min[1]),
      leftSoleMinimumY: rounded(minimumEnvelopeSample.soles.L.minimumY),
      rightSoleMinimumY: rounded(minimumEnvelopeSample.soles.R.minimumY),
    },
    maximumHorizontalEnvelopeMetres: [
      rounded(maximumWidth),
      rounded(maximumDepth),
    ],
    maximumFrameRmsSpeedMetresPerSecond: rounded(maximumFrameRmsSpeed),
    maximumFrameRmsSpeedSampleSeconds: rounded(maximumFrameRmsSpeedSample.timeSeconds),
    loopSeamRmsMetres: rounded(loopSeamRmsMetres, 8),
    locomotion: locomotionMetrics && {
      speedMetresPerSecond: locomotionConfig.speedMetresPerSecond,
      currentPlaybackScale: locomotionConfig.currentPlaybackScale,
      currentContactSamples: locomotionMetrics.current.contactSamples,
      currentRmsSlipMetresPerSecond: rounded(
        locomotionMetrics.current.rmsSlipMetresPerSecond,
      ),
      currentRmsSlipRatio: rounded(
        locomotionMetrics.current.rmsSlipMetresPerSecond
        / locomotionConfig.speedMetresPerSecond,
      ),
      currentMeanSlipMetresPerSecond: rounded(
        locomotionMetrics.current.meanSlipMetresPerSecond,
      ),
      contactTravelMetres: {
        left: rounded(locomotionContactTravel(
          samples,
          'L',
          locomotionConfig.contactWindows.L,
        )),
        right: rounded(locomotionContactTravel(
          samples,
          'R',
          locomotionConfig.contactWindows.R,
        )),
      },
      bestPlaybackScale: rounded(locomotionMetrics.best.scale, 2),
      bestRmsSlipMetresPerSecond: rounded(
        locomotionMetrics.best.rmsSlipMetresPerSecond,
      ),
      contactWindowCalibration: bestSymmetricContactWindows(
        samples,
        locomotionConfig.speedMetresPerSecond,
        locomotionConfig.currentPlaybackScale,
      ),
      scaleCandidates: [1, 1.5, 2, 2.5, 3].map((scale) => ({
        scale,
        rmsSlipMetresPerSecond: rounded(
          locomotionSlipMetric(
            samples,
            locomotionConfig.speedMetresPerSecond,
            scale,
            locomotionConfig.contactWindows,
          ).rmsSlipMetresPerSecond,
        ),
      })),
      quarterCycleSoles: [0, 30, 60, 90, 120].map((sampleIndex) => ({
        timeSeconds: rounded(samples[sampleIndex].timeSeconds),
        left: {
          minimumY: rounded(samples[sampleIndex].soles.L.minimumY),
          centreZ: rounded(samples[sampleIndex].soles.L.centre[2]),
        },
        right: {
          minimumY: rounded(samples[sampleIndex].soles.R.minimumY),
          centreZ: rounded(samples[sampleIndex].soles.R.centre[2]),
        },
      })),
      diagnosticSoleSeries: diagnosticMode
        ? samples.filter((_, sampleIndex) => sampleIndex % 5 === 0).map((sample) => ({
            phase: rounded(sample.timeSeconds / clip.duration),
            left: {
              minimumY: rounded(sample.soles.L.minimumY),
              centreZ: rounded(sample.soles.L.centre[2]),
            },
            right: {
              minimumY: rounded(sample.soles.R.minimumY),
              centreZ: rounded(sample.soles.R.centre[2]),
            },
          }))
        : undefined,
    },
  })
}

const transitionSeams = [
  ['Walk_Start', 'Walk'],
  ['Walk_Stop', 'Idle_A'],
  ['Run_Start', 'Run'],
  ['Run_Stop', 'Idle_A'],
  ['Jump_Start', 'Jump_Loop'],
  ['Jump_Loop', 'Jump_Land'],
  ['Jump_Land', 'Idle_A'],
  ['Turn_L', 'Idle_A'],
  ['Turn_R', 'Idle_A'],
].map(([from, to]) => {
  const targetVertices = (
    (from === 'Walk_Start' && to === 'Walk')
    || (from === 'Run_Start' && to === 'Run')
  )
    ? clipEndpoints.get(to).authoredLoopJoin
    : clipEndpoints.get(to).first
  const rmsMetres = rmsDistance(
    clipEndpoints.get(from).last,
    targetVertices,
  )
  const transitionSeamTolerance = Number(
    manifest.animation.contract.transitionSeamToleranceMetres,
  )
  if (!Number.isFinite(transitionSeamTolerance) || rmsMetres > transitionSeamTolerance) {
    errors.push(`${from} → ${to} has a ${rmsMetres} m deformed transition seam`)
  }
  return { from, to, rmsMetres: rounded(rmsMetres, 8) }
})

if (errors.length > 0 && !diagnosticMode) {
  throw new Error(`Gate A animation kinematics validation failed:\n- ${errors.join('\n- ')}`)
}

process.stdout.write(`${JSON.stringify({
  release: requestedCharactersDir || requestedGlbPath
    ? manifest.animationVariant ?? manifest.visualVariant ?? 'custom-character-directory'
    : 'gate-a-baseline-r9',
  glb: requestedGlbPath ? glbPath.slice(repositoryRoot.length + 1) : 'character-hero-female-high.glb',
  sha256,
  reviewStatus: unreleasedCandidate ? 'unreleased-candidate' : 'released-manifest-matched',
  sampling: {
    intervalsPerClip: sampleIntervals,
    totalDeformedPoses: clipNames.length * (sampleIntervals + 1),
    source: 'Three.js r185 GLTFLoader + AnimationMixer + SkinnedMesh.applyBoneTransform',
  },
  transitionSeams,
  metrics,
  errors,
  passed: errors.length === 0,
}, null, 2)}\n`)

if (errors.length > 0) process.exitCode = 1
