import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const scriptDirectory = dirname(scriptPath)
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const require = createRequire(import.meta.url)

const defaultChurchPath = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
  'buildings',
  'church-hero.glb',
)
const decoderDirectory = resolve(
  repositoryRoot,
  'cloudflare',
  'alife-app',
  'node_modules',
  'three',
  'examples',
  'jsm',
  'libs',
  'draco',
  'gltf',
)
const decoderScriptPath = resolve(decoderDirectory, 'draco_decoder.js')
const decoderWasmPath = resolve(decoderDirectory, 'draco_decoder.wasm')

const parseGlb = (buffer) => {
  if (buffer.length < 20 || buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error('Church input is not a GLB 2 file.')
  }
  if (buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) {
    throw new Error('Church GLB header or declared length is invalid.')
  }

  let offset = 12
  let json
  let binary
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset)
    const chunkType = buffer.readUInt32LE(offset + 4)
    const chunkStart = offset + 8
    const chunkEnd = chunkStart + chunkLength
    if (chunkEnd > buffer.length) throw new Error('Church GLB contains a truncated chunk.')
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(
        buffer.toString('utf8', chunkStart, chunkEnd).replace(/\u0000+$/u, ''),
      )
    } else if (chunkType === 0x004e4942) {
      binary = buffer.subarray(chunkStart, chunkEnd)
    }
    offset = chunkEnd
  }
  if (!json || !binary) throw new Error('Church GLB must contain JSON and BIN chunks.')
  return { json, binary }
}

export const loadDracoDecoder = async () => {
  const [decoderSource, wasmBinary] = await Promise.all([
    readFile(decoderScriptPath, 'utf8'),
    readFile(decoderWasmPath),
  ])
  const module = { exports: {} }
  const loadCommonJsDecoder = new Function(
    'module',
    'exports',
    'require',
    '__filename',
    '__dirname',
    `${decoderSource}\nreturn module.exports;`,
  )
  const decoderFactory = loadCommonJsDecoder(
    module,
    module.exports,
    require,
    decoderScriptPath,
    decoderDirectory,
  )
  if (typeof decoderFactory !== 'function') {
    throw new Error('Fixed Draco decoder did not expose a module factory.')
  }
  return {
    module: await decoderFactory({ wasmBinary }),
    evidence: {
      scriptSha256: createHash('sha256').update(decoderSource).digest('hex'),
      wasmSha256: createHash('sha256').update(wasmBinary).digest('hex'),
    },
  }
}

const decodeFloatAttribute = (draco, decoder, mesh, uniqueId, label) => {
  const attribute = decoder.GetAttributeByUniqueId(mesh, uniqueId)
  if (!attribute?.ptr) throw new Error(`Draco mesh is missing ${label} attribute ${uniqueId}.`)
  const components = attribute.num_components()
  const values = new draco.DracoFloat32Array()
  try {
    if (!decoder.GetAttributeFloatForAllPoints(mesh, attribute, values)) {
      throw new Error(`Unable to decode ${label} attribute ${uniqueId}.`)
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
    const output = new Uint32Array(mesh.num_faces() * 3)
    for (let faceIndex = 0; faceIndex < mesh.num_faces(); faceIndex += 1) {
      if (!decoder.GetFaceFromMesh(mesh, faceIndex, face)) {
        throw new Error(`Unable to decode church face ${faceIndex}.`)
      }
      output[faceIndex * 3] = face.GetValue(0)
      output[faceIndex * 3 + 1] = face.GetValue(1)
      output[faceIndex * 3 + 2] = face.GetValue(2)
    }
    return output
  } finally {
    draco.destroy(face)
  }
}

const attributeBySemantic = (draco, decoder, mesh, extension, semantic) => {
  const uniqueId = extension.attributes?.[semantic]
  return uniqueId == null
    ? null
    : decodeFloatAttribute(draco, decoder, mesh, uniqueId, semantic)
}

const boundsFromPositions = (positions) => {
  const minimum = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY]
  const maximum = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY]
  for (let offset = 0; offset < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], positions[offset + axis])
      maximum[axis] = Math.max(maximum[axis], positions[offset + axis])
    }
  }
  return { minimum, maximum }
}

export const decodeGateAChurchGeometry = async (inputPath = defaultChurchPath) => {
  const [glbBuffer, decoder] = await Promise.all([
    readFile(inputPath),
    loadDracoDecoder(),
  ])
  const { json, binary } = parseGlb(glbBuffer)
  if (!json.extensionsRequired?.includes('KHR_draco_mesh_compression')) {
    throw new Error('Church GLB no longer requires the reviewed Draco geometry path.')
  }

  const decodedPrimitives = []
  for (const [meshIndex, meshDefinition] of (json.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of (meshDefinition.primitives ?? []).entries()) {
      const extension = primitive.extensions?.KHR_draco_mesh_compression
      if (!extension) {
        throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} is not Draco compressed.`)
      }
      const bufferView = json.bufferViews?.[extension.bufferView]
      if (!bufferView) throw new Error(`Missing Draco bufferView ${extension.bufferView}.`)
      const compressed = binary.subarray(
        bufferView.byteOffset ?? 0,
        (bufferView.byteOffset ?? 0) + bufferView.byteLength,
      )
      const decoderBuffer = new decoder.module.DecoderBuffer()
      const geometryDecoder = new decoder.module.Decoder()
      const decodedMesh = new decoder.module.Mesh()
      try {
        decoderBuffer.Init(new Int8Array(
          compressed.buffer,
          compressed.byteOffset,
          compressed.byteLength,
        ), compressed.byteLength)
        if (geometryDecoder.GetEncodedGeometryType(decoderBuffer) !== decoder.module.TRIANGULAR_MESH) {
          throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} is not a triangular Draco mesh.`)
        }
        const status = geometryDecoder.DecodeBufferToMesh(decoderBuffer, decodedMesh)
        if (!status.ok() || decodedMesh.ptr === 0) {
          throw new Error(
            `Unable to decode church mesh ${meshIndex}:${primitiveIndex}: ${status.error_msg()}`,
          )
        }
        const position = attributeBySemantic(
          decoder.module,
          geometryDecoder,
          decodedMesh,
          extension,
          'POSITION',
        )
        const normal = attributeBySemantic(
          decoder.module,
          geometryDecoder,
          decodedMesh,
          extension,
          'NORMAL',
        )
        const texcoord0 = attributeBySemantic(
          decoder.module,
          geometryDecoder,
          decodedMesh,
          extension,
          'TEXCOORD_0',
        )
        const texcoord1 = attributeBySemantic(
          decoder.module,
          geometryDecoder,
          decodedMesh,
          extension,
          'TEXCOORD_1',
        )
        if (!position || position.components !== 3) {
          throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} lacks VEC3 positions.`)
        }
        if (!normal || normal.components !== 3) {
          throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} lacks VEC3 normals.`)
        }
        if (texcoord0 && texcoord0.components !== 2) {
          throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} has invalid TEXCOORD_0 components.`)
        }
        if (texcoord1 && texcoord1.components !== 2) {
          throw new Error(`Church mesh ${meshIndex}:${primitiveIndex} has invalid TEXCOORD_1 components.`)
        }
        decodedPrimitives.push({
          meshIndex,
          primitiveIndex,
          meshName: meshDefinition.name ?? `mesh-${meshIndex}`,
          materialIndex: primitive.material ?? null,
          materialName: json.materials?.[primitive.material]?.name ?? null,
          position: position.values,
          normal: normal.values,
          texcoord0: texcoord0?.values ?? null,
          texcoord1: texcoord1?.values ?? null,
          indices: decodeIndices(decoder.module, geometryDecoder, decodedMesh),
        })
      } finally {
        decoder.module.destroy(decodedMesh)
        decoder.module.destroy(geometryDecoder)
        decoder.module.destroy(decoderBuffer)
      }
    }
  }

  const triangleCount = decodedPrimitives.reduce(
    (sum, primitive) => sum + primitive.indices.length / 3,
    0,
  )
  if (triangleCount !== 14904) {
    throw new Error(`Decoded church has ${triangleCount} triangles; expected the current photo-backed High total of 14,904.`)
  }
  const rootNode = json.nodes?.find((node) => node.name === 'ChurchHero_High')
  const canonical = rootNode?.extras
  if (
    canonical?.lod !== 'high'
    || canonical?.metresPerUnit !== 1
    || !Array.isArray(canonical?.canonicalWorldPosition)
    || !Number.isFinite(canonical?.canonicalRotationY)
    || canonical?.interiorRepresentation !== 'photo-backed-shallow-foyer-v2'
    || canonical?.containsWalkableInterior !== false
    || canonical?.interiorDepthMetres !== 6.92
  ) {
    throw new Error('Church GLB lost its canonical placement metadata.')
  }

  return {
    inputPath,
    glbSha256: createHash('sha256').update(glbBuffer).digest('hex'),
    decoder: decoder.evidence,
    json,
    primitives: decodedPrimitives,
    triangleCount,
    canonical: {
      worldPosition: canonical.canonicalWorldPosition,
      rotationY: canonical.canonicalRotationY,
      metresPerUnit: canonical.metresPerUnit,
      coordinateContract: canonical.coordinateContract,
    },
  }
}

if (resolve(process.argv[1] ?? '') === scriptPath) {
  const decoded = await decodeGateAChurchGeometry()
  process.stdout.write(`${JSON.stringify({
    input: decoded.inputPath.slice(repositoryRoot.length + 1).replaceAll('\\', '/'),
    glbSha256: decoded.glbSha256,
    decoder: decoded.decoder,
    triangles: decoded.triangleCount,
    canonical: decoded.canonical,
    primitives: decoded.primitives.map((primitive) => ({
      mesh: primitive.meshName,
      material: primitive.materialName,
      vertices: primitive.position.length / 3,
      triangles: primitive.indices.length / 3,
      hasNormals: primitive.normal.length > 0,
      hasTexcoord0: primitive.texcoord0 !== null,
      hasTexcoord1: primitive.texcoord1 !== null,
      bounds: boundsFromPositions(primitive.position),
    })),
    passed: true,
  }, null, 2)}\n`)
}
