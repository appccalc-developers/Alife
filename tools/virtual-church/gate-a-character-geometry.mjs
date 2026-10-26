import { loadDracoDecoder } from './gate-a-church-geometry.mjs'

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

export const decompressCharacterDraco = async (buffer, { allowUncompressed = false } = {}) => {
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
        // Offline atlas candidates can retain original compressed parts beside
        // a new lossless raw batch. Keep strict release validation as default.
        if (allowUncompressed) continue
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
