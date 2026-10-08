import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync, deflateSync } from 'node:zlib'
import { AnimationMixer, Vector3 } from '../../cloudflare/alife-app/node_modules/three/build/three.module.js'
import { GLTFLoader } from '../../cloudflare/alife-app/node_modules/three/examples/jsm/loaders/GLTFLoader.js'
import ts from '../../cloudflare/alife-app/node_modules/typescript/lib/typescript.js'
import { decodeGateAChurchGeometry } from './gate-a-church-geometry.mjs'
import { decompressCharacterDraco } from './gate-a-character-geometry.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const appRoot = resolve(repositoryRoot, 'cloudflare', 'alife-app')
const releaseRoot = resolve(
  appRoot,
  'public',
  'virtual-church-assets',
  'v3',
  'releases',
  'gate-a-baseline-r9',
)
const churchPath = resolve(releaseRoot, 'buildings', 'church-hero.glb')
const churchBaseColourPath = resolve(
  releaseRoot,
  'textures',
  'church-material-atlas-basecolor.png',
)
const churchNormalPath = resolve(
  releaseRoot,
  'textures',
  'church-material-atlas-normal.png',
)
const churchOrmPath = resolve(
  releaseRoot,
  'textures',
  'church-material-atlas-orm.png',
)
const currentHeroPath = resolve(
  releaseRoot,
  'characters',
  'character-hero-female-high.glb',
)
const currentHeroManifestPath = resolve(
  releaseRoot,
  'characters',
  'character-hero-female.manifest.json',
)
const outputRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-faithful-entrance',
)
const outputPng = resolve(outputRoot, 'faithful-entrance-review.png')
const outputReport = resolve(outputRoot, 'faithful-entrance-review.json')
const scenePath = resolve(appRoot, 'src', 'views', 'virtualChurchScene.ts')
const viewPath = resolve(appRoot, 'src', 'views', 'VirtualChurchView.tsx')
const injectSharedSceneDrift = process.argv.includes('--inject-shared-scene-drift')

class NodeFileReader {
  result = null
  onloadend = null

  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result
      this.onloadend?.()
    })
  }
}

globalThis.FileReader ??= NodeFileReader

const parseGlbChunks = (buffer) => {
  if (
    buffer.readUInt32LE(0) !== 0x46546c67
    || buffer.readUInt32LE(4) !== 2
    || buffer.readUInt32LE(8) !== buffer.byteLength
  ) {
    throw new Error('Faithful entrance Hero is not a valid GLB 2.0 file.')
  }
  const jsonLength = buffer.readUInt32LE(12)
  const jsonStart = 20
  const jsonEnd = jsonStart + jsonLength
  const binaryLength = buffer.readUInt32LE(jsonEnd)
  if (buffer.readUInt32LE(jsonEnd + 4) !== 0x004e4942) {
    throw new Error('Faithful entrance Hero GLB has no BIN chunk.')
  }
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

const sRgbHexToLinear = (value) => {
  const channels = value.match(/[0-9a-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255)
  if (!channels || channels.length !== 3) throw new Error(`Invalid review colour ${value}.`)
  return channels.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4)
}

const heroReviewColour = (materialName = '') => {
  if (materialName.includes('_SKIN')) return '#DFAB94'
  if (materialName.includes('Hair')) return '#F1ECE5'
  if (materialName.includes('EyeWhite') || materialName.includes('EyeHighlight')) return '#F8F4EC'
  if (materialName.includes('EyeIris')) return '#6D4B32'
  if (materialName.includes('FaceMouth')) return '#955C5D'
  if (materialName.includes('FaceBrow') || materialName.includes('FaceEyeline')) return '#59433A'
  if (materialName.includes('Shoes')) return '#3E3029'
  if (materialName.includes('Tops_01_CLOTH_01')) return '#2F6F62'
  if (materialName.includes('Onepiece_00_CLOTH_01')) return '#E37B63'
  if (materialName.includes('Tops_01_CLOTH_02')) return '#D9B36C'
  if (materialName.includes('Tops_01_CLOTH_03')) return '#F7EFE2'
  if (materialName.includes('Tops_01_CLOTH_04')) return '#18332D'
  if (materialName.includes('Onepiece_00_CLOTH_02')) return '#F5D798'
  return '#D8D0C4'
}

const createTexturelessHeroReviewGlb = async (sourceBuffer) => {
  const decompressed = await decompressCharacterDraco(sourceBuffer)
  const { json, binary } = parseGlbChunks(decompressed)
  for (const material of json.materials ?? []) {
    material.pbrMetallicRoughness = {
      baseColorFactor: [...sRgbHexToLinear(heroReviewColour(material.name)), 1],
      metallicFactor: 0,
      roughnessFactor: 0.82,
    }
    material.alphaMode = 'OPAQUE'
    delete material.alphaCutoff
    delete material.normalTexture
    delete material.occlusionTexture
    delete material.emissiveTexture
    delete material.emissiveFactor
    delete material.extensions
  }
  delete json.images
  delete json.textures
  delete json.samplers
  json.extensionsUsed = (json.extensionsUsed ?? []).filter(
    (extension) => extension !== 'EXT_texture_webp',
  )
  json.extensionsRequired = (json.extensionsRequired ?? []).filter(
    (extension) => extension !== 'EXT_texture_webp',
  )
  if (json.extensionsUsed.length === 0) delete json.extensionsUsed
  if (json.extensionsRequired.length === 0) delete json.extensionsRequired
  return buildGlb(json, binary)
}

const [sceneSource, viewSource] = await Promise.all([
  readFile(scenePath, 'utf8'),
  readFile(viewPath, 'utf8'),
])
for (const forbidden of [
  'EntranceWelcomeBoard',
  'WELCOME_BOARD_CONTRACT',
  'approachBoardSupports',
  'entrancePlanterBoxes',
  'CARPARK_SPINE_GARDEN',
]) {
  if (viewSource.includes(forbidden)) {
    throw new Error(`Faithful entrance review found removed physical object ${forbidden}.`)
  }
}
const requiredViewFragments = [
  '<ClosedVehicleGate left={[-38.2, 4.5]} right={[-33.6, 8.3]} visualVersion={visualVersion} fenceSegments={visualVersion === \'v3\' ? SITE_FENCE_SEGMENTS : undefined} />',
  "useAutomaticDoor('vehicle', [midX, midZ], 7, progress => {",
  'createAutomaticVehicleGateAndFenceMatrixWriter(fenceParts, gateParts, leafParts, length, gateWorldMatrix)',
  '<ParkingRowsField rows={PARKING_ROWS} accessible={{',
  'const depthOffset = side * (row.bayDepth / 2 - 0.58)',
]
for (const fragment of requiredViewFragments) {
  if (!viewSource.includes(fragment)) {
    throw new Error(`Faithful entrance review lost runtime fragment ${fragment}.`)
  }
}

const transpiledScene = ts.transpileModule(sceneSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2023,
  },
  fileName: scenePath,
  reportDiagnostics: true,
})
if ((transpiledScene.diagnostics ?? []).length > 0) {
  throw new Error(ts.formatDiagnosticsWithColorAndContext(
    transpiledScene.diagnostics,
    {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => repositoryRoot,
      getNewLine: () => '\n',
    },
  ))
}
const scene = await import(
  `data:text/javascript;base64,${Buffer.from(transpiledScene.outputText).toString('base64')}`
)
const gateRightRow = scene.PARKING_ROWS.find((row) => row.id === 'entry-gate-right')
if (
  !gateRightRow
  || gateRightRow.bays !== 6
  || gateRightRow.layoutAuthority !== 'user-confirmed-overhead-view'
) {
  throw new Error('Faithful entrance review requires the confirmed six-bay gate-right row.')
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  return upDistance <= upperLeftDistance ? up : upperLeft
}
const decodePng = (png) => {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error('Church BaseColor has an invalid PNG signature.')
  }
  let offset = PNG_SIGNATURE.length
  let header
  const imageData = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') header = data
    if (type === 'IDAT') imageData.push(data)
    offset += 12 + length
    if (type === 'IEND') break
  }
  if (!header) throw new Error('Church BaseColor PNG has no IHDR.')
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const bitDepth = header[8]
  const colourType = header[9]
  if (bitDepth !== 8 || ![2, 6].includes(colourType) || header[12] !== 0) {
    throw new Error('Church BaseColor must be non-interlaced 8-bit RGB/RGBA.')
  }
  const sourceChannels = colourType === 6 ? 4 : 3
  const rowBytes = width * sourceChannels
  const filtered = inflateSync(Buffer.concat(imageData))
  const decoded = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (rowBytes + 1)]
    const sourceStart = y * (rowBytes + 1) + 1
    const targetStart = y * rowBytes
    for (let x = 0; x < rowBytes; x += 1) {
      const value = filtered[sourceStart + x]
      const left = x >= sourceChannels ? decoded[targetStart + x - sourceChannels] : 0
      const up = y > 0 ? decoded[targetStart + x - rowBytes] : 0
      const upperLeft = y > 0 && x >= sourceChannels
        ? decoded[targetStart + x - rowBytes - sourceChannels]
        : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = Math.floor((left + up) / 2)
      else if (filter === 4) predictor = paeth(left, up, upperLeft)
      else if (filter !== 0) throw new Error(`Unsupported PNG filter ${filter}.`)
      decoded[targetStart + x] = (value + predictor) & 0xff
    }
  }
  const rgba = new Uint8Array(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    rgba[pixel * 4] = decoded[pixel * sourceChannels]
    rgba[pixel * 4 + 1] = decoded[pixel * sourceChannels + 1]
    rgba[pixel * 4 + 2] = decoded[pixel * sourceChannels + 2]
    rgba[pixel * 4 + 3] = sourceChannels === 4
      ? decoded[pixel * sourceChannels + 3]
      : 255
  }
  return { width, height, rgba }
}

const clamp = (value, minimum = 0, maximum = 1) =>
  Math.max(minimum, Math.min(maximum, value))
const sampleTexture = (texture, uv) => {
  const u = ((uv[0] % 1) + 1) % 1
  const v = ((uv[1] % 1) + 1) % 1
  const sourceX = u * texture.width - 0.5
  const sourceY = v * texture.height - 0.5
  const x0 = Math.floor(sourceX)
  const y0 = Math.floor(sourceY)
  const xBlend = sourceX - x0
  const yBlend = sourceY - y0
  const read = (x, y) => {
    const wrappedX = ((x % texture.width) + texture.width) % texture.width
    const wrappedY = ((y % texture.height) + texture.height) % texture.height
    const offset = (wrappedY * texture.width + wrappedX) * 4
    return [
      texture.rgba[offset] / 255,
      texture.rgba[offset + 1] / 255,
      texture.rgba[offset + 2] / 255,
    ]
  }
  const topLeft = read(x0, y0)
  const topRight = read(x0 + 1, y0)
  const bottomLeft = read(x0, y0 + 1)
  const bottomRight = read(x0 + 1, y0 + 1)
  return topLeft.map((channel, index) => {
    const top = channel + (topRight[index] - channel) * xBlend
    const bottom = bottomLeft[index]
      + (bottomRight[index] - bottomLeft[index]) * xBlend
    return top + (bottom - top) * yBlend
  })
}
const add = (left, right) => left.map((value, index) => value + right[index])
const subtract = (left, right) => left.map((value, index) => value - right[index])
const scale = (value, amount) => value.map((component) => component * amount)
const dot = (left, right) => left.reduce(
  (sum, value, index) => sum + value * right[index],
  0,
)
const cross = (left, right) => [
  left[1] * right[2] - left[2] * right[1],
  left[2] * right[0] - left[0] * right[2],
  left[0] * right[1] - left[1] * right[0],
]
const normalized = (value) => {
  const length = Math.hypot(...value) || 1
  return scale(value, 1 / length)
}
const average = (values) => scale(
  values.reduce((sum, value) => add(sum, value), Array(values[0].length).fill(0)),
  1 / values.length,
)
const rotateY = ([x, y, z], rotation) => [
  Math.cos(rotation) * x + Math.sin(rotation) * z,
  y,
  -Math.sin(rotation) * x + Math.cos(rotation) * z,
]
const sourceToWorld = ([x, y, z]) => [x, y, -z]
const linearToSrgb = (value) => value <= 0.0031308
  ? 12.92 * value
  : 1.055 * Math.pow(value, 1 / 2.4) - 0.055
const toByte = (value) => Math.round(clamp(value) * 255)
const lightDirection = normalized([-0.42, 0.78, 0.46])
const shadedBytes = (colour, normal, sourceIsLinear = false) => {
  const diffuse = Math.max(0, dot(normal, lightDirection))
  const shade = 0.7 + diffuse * 0.3
  return colour.map((channel) => toByte(
    (sourceIsLinear ? linearToSrgb(channel) : channel) * shade,
  ))
}

const church = await decodeGateAChurchGeometry(churchPath)
if (church.glbSha256 !== '56d8a74edc790bb45b7491c5c24525a61412a0175cc75aa9d0849090dfc1d4f8') {
  throw new Error('Faithful entrance review refused an unknown church GLB.')
}
const [
  baseColourBuffer,
  normalBuffer,
  ormBuffer,
  currentHeroBuffer,
  currentHeroManifest,
] = await Promise.all([
  readFile(churchBaseColourPath),
  readFile(churchNormalPath),
  readFile(churchOrmPath),
  readFile(currentHeroPath),
  readFile(currentHeroManifestPath, 'utf8').then(JSON.parse),
])
const baseColour = decodePng(baseColourBuffer)
const normalTexture = decodePng(normalBuffer)
const ormTexture = decodePng(ormBuffer)
const baseColourSha256 = createHash('sha256').update(baseColourBuffer).digest('hex')
const normalSha256 = createHash('sha256').update(normalBuffer).digest('hex')
const ormSha256 = createHash('sha256').update(ormBuffer).digest('hex')
if (
  [baseColour, normalTexture, ormTexture]
    .some((texture) => texture.width !== 1024 || texture.height !== 1024)
) {
  throw new Error('Faithful entrance review requires the frozen 1024px church texture set.')
}
if (baseColourSha256 !== '9253bab3f84f775edd7c5d762f88308935dc32f4cb5cf7717d7a107ed9bbedda') {
  throw new Error('Faithful entrance review refused an unknown church BaseColor.')
}
if (normalSha256 !== '9784142967b8275604142be0f71653f785058f6ab210cf6fe4695869b338b732') {
  throw new Error('Faithful entrance review refused an unknown church Normal texture.')
}
if (ormSha256 !== '297463a43bb93c8bb50cd803271c93049636c56b84a56ea80f3dc7a01b77eee5') {
  throw new Error('Faithful entrance review refused an unknown church ORM texture.')
}
const currentHeroHigh = currentHeroManifest.lods?.find((entry) => entry.lod === 'high')
const currentHeroSha256 = createHash('sha256').update(currentHeroBuffer).digest('hex')
if (
  currentHeroManifest.visualVariant !== 'vroid-fair-v1'
  || currentHeroHigh?.sha256 !== currentHeroSha256
) {
  throw new Error('Faithful entrance review Hero does not match the current release manifest.')
}

const churchTriangles = []
const readTextureCoordinates = (primitive, textureInfo, indices, materialName) => {
  if (!textureInfo) return null
  const coordinateSet = textureInfo.texCoord ?? 0
  const attribute = coordinateSet === 0
    ? primitive.texcoord0
    : coordinateSet === 1
      ? primitive.texcoord1
      : null
  if (!attribute) {
    throw new Error(
      `Church material ${materialName ?? 'unknown'} requires unavailable TEXCOORD_${coordinateSet}.`,
    )
  }
  return indices.map((index) => Array.from(
    attribute.subarray(index * 2, index * 2 + 2),
  ))
}
const tangentBasisFromTriangle = (vertices, textureCoordinates, faceNormal) => {
  if (!textureCoordinates) return null
  const firstEdge = subtract(vertices[1], vertices[0])
  const secondEdge = subtract(vertices[2], vertices[0])
  const firstUvEdge = subtract(textureCoordinates[1], textureCoordinates[0])
  const secondUvEdge = subtract(textureCoordinates[2], textureCoordinates[0])
  const determinant = firstUvEdge[0] * secondUvEdge[1]
    - firstUvEdge[1] * secondUvEdge[0]
  if (Math.abs(determinant) < 1e-8) return null
  let tangent = scale(subtract(
    scale(firstEdge, secondUvEdge[1]),
    scale(secondEdge, firstUvEdge[1]),
  ), 1 / determinant)
  let bitangent = scale(subtract(
    scale(secondEdge, firstUvEdge[0]),
    scale(firstEdge, secondUvEdge[0]),
  ), 1 / determinant)
  tangent = normalized(subtract(tangent, scale(faceNormal, dot(tangent, faceNormal))))
  bitangent = normalized(subtract(bitangent, scale(faceNormal, dot(bitangent, faceNormal))))
  if (dot(cross(tangent, bitangent), faceNormal) < 0) {
    bitangent = scale(bitangent, -1)
  }
  return { tangent, bitangent }
}
for (const primitive of church.primitives) {
  const material = church.json.materials?.[primitive.materialIndex] ?? {}
  const factor = material.pbrMetallicRoughness?.baseColorFactor?.slice(0, 3) ?? [1, 1, 1]
  const baseColourTextureInfo = material.pbrMetallicRoughness?.baseColorTexture ?? null
  const normalTextureInfo = material.normalTexture ?? null
  const ormTextureInfo = material.pbrMetallicRoughness?.metallicRoughnessTexture ?? null
  for (let offset = 0; offset < primitive.indices.length; offset += 3) {
    const indices = Array.from(primitive.indices.subarray(offset, offset + 3))
    const localVertices = indices.map((index) => Array.from(
      primitive.position.subarray(index * 3, index * 3 + 3),
    ))
    const worldVertices = localVertices.map((vertex) => sourceToWorld(add(
      rotateY(vertex, church.canonical.rotationY),
      church.canonical.worldPosition,
    )))
    const faceNormal = normalized(scale(cross(
      subtract(worldVertices[1], worldVertices[0]),
      subtract(worldVertices[2], worldVertices[0]),
    ), -1))
    const baseTextureCoordinates = readTextureCoordinates(
      primitive,
      baseColourTextureInfo,
      indices,
      material.name,
    )
    const normalTextureCoordinates = readTextureCoordinates(
      primitive,
      normalTextureInfo,
      indices,
      material.name,
    )
    const ormTextureCoordinates = readTextureCoordinates(
      primitive,
      ormTextureInfo,
      indices,
      material.name,
    )
    churchTriangles.push({
      vertices: worldVertices,
      churchSurface: true,
      baseColourTexture: baseTextureCoordinates ? baseColour : null,
      baseTextureCoordinates,
      normalTexture: normalTextureCoordinates ? normalTexture : null,
      normalTextureCoordinates,
      ormTexture: ormTextureCoordinates ? ormTexture : null,
      ormTextureCoordinates,
      baseColourFactor: factor,
      normalScale: material.normalTexture?.scale ?? 1,
      roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor ?? 1,
      metallicFactor: material.pbrMetallicRoughness?.metallicFactor ?? 1,
      tangentBasis: tangentBasisFromTriangle(
        worldVertices,
        normalTextureCoordinates,
        faceNormal,
      ),
      faceNormal,
    })
  }
}
if (churchTriangles.length !== 14904) throw new Error('Church render triangle closure drifted.')

const reviewHeroBuffer = await createTexturelessHeroReviewGlb(currentHeroBuffer)
const currentHeroGltf = await new Promise((resolvePromise, rejectPromise) => {
  const arrayBuffer = reviewHeroBuffer.buffer.slice(
    reviewHeroBuffer.byteOffset,
    reviewHeroBuffer.byteOffset + reviewHeroBuffer.byteLength,
  )
  new GLTFLoader().parse(arrayBuffer, '', resolvePromise, rejectPromise)
})
const reviewIdleClip = currentHeroGltf.animations.find((clip) => clip.name === 'Idle_A')
if (!reviewIdleClip) throw new Error('Faithful entrance current Hero has no Idle_A clip.')
const reviewMixer = new AnimationMixer(currentHeroGltf.scene)
reviewMixer.clipAction(reviewIdleClip).play()
reviewMixer.setTime(reviewIdleClip.duration * 0.25)
currentHeroGltf.scene.updateMatrixWorld(true)
const heroLocalTriangles = []
const temporaryVertex = new Vector3()
currentHeroGltf.scene.traverse((object) => {
  if (!object.isSkinnedMesh) return
  const position = object.geometry.getAttribute('position')
  const colour = object.geometry.getAttribute('color')
  const index = object.geometry.getIndex()
  if (!position || !index) throw new Error(`Hero mesh ${object.name} is incomplete.`)
  const materialColour = object.material.color
  for (let offset = 0; offset < index.count; offset += 3) {
    const indices = [index.getX(offset), index.getX(offset + 1), index.getX(offset + 2)]
    const vertices = indices.map((vertexIndex) => {
      temporaryVertex.fromBufferAttribute(position, vertexIndex)
      object.applyBoneTransform(vertexIndex, temporaryVertex)
      temporaryVertex.applyMatrix4(object.matrixWorld)
      return [temporaryVertex.x, temporaryVertex.y, temporaryVertex.z]
    })
    const faceNormal = normalized(cross(
      subtract(vertices[1], vertices[0]),
      subtract(vertices[2], vertices[0]),
    ))
    const vertexColours = indices.map((vertexIndex) => colour
      ? [
          colour.getX(vertexIndex) * materialColour.r,
          colour.getY(vertexIndex) * materialColour.g,
          colour.getZ(vertexIndex) * materialColour.b,
        ]
      : [materialColour.r, materialColour.g, materialColour.b])
    heroLocalTriangles.push({
      vertices,
      colour: shadedBytes(average(vertexColours), faceNormal, true),
    })
  }
})
if (heroLocalTriangles.length !== currentHeroHigh.triangles) {
  throw new Error('Faithful entrance Hero triangle closure drifted.')
}

const camera = [-35, 2.15, 25.8]
const cameraTarget = [-5.5, 2.4, 17.5]
const cameraForward = normalized(subtract(cameraTarget, camera))
const cameraRight = normalized(cross(cameraForward, [0, 1, 0]))
const cameraUp = normalized(cross(cameraRight, cameraForward))
const entranceReviewAnchor = sourceToWorld(scene.SCENE_LANDMARKS.entranceApproachPoint)
const heroReviewOffsetMetres = 12
const heroReviewDirection = normalized([
  camera[0] - entranceReviewAnchor[0],
  0,
  camera[2] - entranceReviewAnchor[2],
])
const heroPosition = add(
  entranceReviewAnchor,
  scale(heroReviewDirection, heroReviewOffsetMetres),
)
const heroDirection = normalized(subtract(camera, heroPosition))
const heroYaw = Math.atan2(-heroDirection[0], -heroDirection[2])
const heroTriangles = heroLocalTriangles.map((triangle) => ({
  ...triangle,
  vertices: triangle.vertices.map((vertex) => add(
    rotateY(vertex, heroYaw),
    heroPosition,
  )),
}))

const groundTriangles = []
const pushQuad = (corners, colour) => {
  groundTriangles.push(
    { vertices: [corners[0], corners[1], corners[2]], colour },
    { vertices: [corners[0], corners[2], corners[3]], colour },
  )
}
pushQuad([
  [-75, -0.03, 80], [65, -0.03, 80], [65, -0.03, -80], [-75, -0.03, -80],
], [103, 126, 99])
const mainCarpark = [
  [-31, 10], [-40, 7], [-48, -3], [-50, -25], [-39, -42], [-24, -52],
  [4, -49], [19, -26], [4, -22], [-7, -14], [-16, -3], [-24, 10],
]
const carparkCentre = average(mainCarpark)
for (let index = 0; index < mainCarpark.length; index += 1) {
  const next = (index + 1) % mainCarpark.length
  groundTriangles.push({
    vertices: [carparkCentre, mainCarpark[index], mainCarpark[next]]
      .map(([x, z]) => sourceToWorld([x, 0.01, z])),
    colour: [48, 57, 56],
  })
}
for (const row of scene.PARKING_ROWS) {
  const u = [Math.cos(row.angle), Math.sin(row.angle)]
  const v = [-Math.sin(row.angle), Math.cos(row.angle)]
  for (let stripe = 0; stripe <= row.bays; stripe += 1) {
    const centre = [
      row.start[0] + u[0] * row.bayWidth * stripe,
      row.start[1] + u[1] * row.bayWidth * stripe,
    ]
    const halfWidth = 0.045
    const halfDepth = row.bayDepth / 2
    const corners = [
      [centre[0] - u[0] * halfWidth - v[0] * halfDepth, centre[1] - u[1] * halfWidth - v[1] * halfDepth],
      [centre[0] + u[0] * halfWidth - v[0] * halfDepth, centre[1] + u[1] * halfWidth - v[1] * halfDepth],
      [centre[0] + u[0] * halfWidth + v[0] * halfDepth, centre[1] + u[1] * halfWidth + v[1] * halfDepth],
      [centre[0] - u[0] * halfWidth + v[0] * halfDepth, centre[1] - u[1] * halfWidth + v[1] * halfDepth],
    ].map(([x, z]) => sourceToWorld([x, 0.035, z]))
    pushQuad(corners, [232, 229, 214])
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
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
  for (const byte of payload) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
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

const PANEL_WIDTH = 720
const PANEL_HEIGHT = 405
const HEADER_HEIGHT = 48
const GAP = 12
const MARGIN = 20
const WIDTH = MARGIN * 2 + PANEL_WIDTH * 2 + GAP
const HEIGHT = HEADER_HEIGHT + PANEL_HEIGHT + MARGIN
const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
const depth = new Float64Array(WIDTH * HEIGHT)
depth.fill(Number.NEGATIVE_INFINITY)
for (let offset = 0; offset < pixels.length; offset += 4) {
  pixels[offset] = 141
  pixels[offset + 1] = 168
  pixels[offset + 2] = 188
  pixels[offset + 3] = 255
}
const setPixel = (x, y, colour, inverseDepth = Number.POSITIVE_INFINITY) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
  const pixelIndex = y * WIDTH + x
  if (inverseDepth < depth[pixelIndex]) return
  depth[pixelIndex] = inverseDepth
  const offset = pixelIndex * 4
  pixels[offset] = colour[0]
  pixels[offset + 1] = colour[1]
  pixels[offset + 2] = colour[2]
  pixels[offset + 3] = 255
}
const fillRect = (x, y, width, height, colour) => {
  for (let row = Math.max(0, Math.floor(y)); row < Math.min(HEIGHT, Math.ceil(y + height)); row += 1) {
    for (let column = Math.max(0, Math.floor(x)); column < Math.min(WIDTH, Math.ceil(x + width)); column += 1) {
      setPixel(column, row, colour)
    }
  }
}
const project = (vertex, panelX) => {
  const relative = subtract(vertex, camera)
  const cameraDepth = dot(relative, cameraForward)
  if (cameraDepth <= 0.1) return null
  const tanHalfFov = Math.tan(47 * Math.PI / 360)
  const normalizedX = dot(relative, cameraRight)
    / (cameraDepth * tanHalfFov * (PANEL_WIDTH / PANEL_HEIGHT))
  const normalizedY = dot(relative, cameraUp) / (cameraDepth * tanHalfFov)
  return [
    panelX + (normalizedX + 1) * PANEL_WIDTH / 2,
    HEADER_HEIGHT + (1 - normalizedY) * PANEL_HEIGHT / 2,
    1 / cameraDepth,
  ]
}
const perspectiveInterpolate = (values, weights, projected, inverseDepth) =>
  values[0].map((_, component) => (
    weights[0] * values[0][component] * projected[0][2]
    + weights[1] * values[1][component] * projected[1][2]
    + weights[2] * values[2][component] * projected[2][2]
  ) / inverseDepth)
const shadeChurchSurface = ({
  baseColour: surfaceColour,
  normal,
  roughness,
  metallic,
  viewDirection,
}) => {
  const diffuse = Math.max(0, dot(normal, lightDirection))
  const halfDirection = normalized(add(lightDirection, viewDirection))
  const specularAngle = Math.max(0, dot(normal, halfDirection))
  const specularPower = 2 + Math.pow(1 - roughness, 2) * 96
  const specular = Math.pow(specularAngle, specularPower)
    * (0.12 + (1 - roughness) * 0.42)
  const diffuseScale = 0.64 + diffuse * (0.36 - metallic * 0.16)
  return surfaceColour.map((channel) => toByte(
    channel * diffuseScale
    + (0.04 * (1 - metallic) + channel * metallic) * specular,
  ))
}
const rasterTriangle = (triangle, panelX) => {
  const projected = triangle.vertices.map((vertex) => project(vertex, panelX))
  if (projected.some((vertex) => vertex === null)) return
  const [first, second, third] = projected
  const area = (second[0] - first[0]) * (third[1] - first[1])
    - (second[1] - first[1]) * (third[0] - first[0])
  if (Math.abs(area) < 0.0001) return
  const minimumX = Math.max(panelX, Math.floor(Math.min(first[0], second[0], third[0])))
  const maximumX = Math.min(panelX + PANEL_WIDTH - 1, Math.ceil(Math.max(first[0], second[0], third[0])))
  const minimumY = Math.max(HEADER_HEIGHT, Math.floor(Math.min(first[1], second[1], third[1])))
  const maximumY = Math.min(HEADER_HEIGHT + PANEL_HEIGHT - 1, Math.ceil(Math.max(first[1], second[1], third[1])))
  const edge = (left, right, x, y) =>
    (x - left[0]) * (right[1] - left[1]) - (y - left[1]) * (right[0] - left[0])
  for (let y = minimumY; y <= maximumY; y += 1) {
    for (let x = minimumX; x <= maximumX; x += 1) {
      const sampleX = x + 0.5
      const sampleY = y + 0.5
      const firstEdge = edge(second, third, sampleX, sampleY)
      const secondEdge = edge(third, first, sampleX, sampleY)
      const thirdEdge = edge(first, second, sampleX, sampleY)
      if (
        !((firstEdge >= 0 && secondEdge >= 0 && thirdEdge >= 0)
          || (firstEdge <= 0 && secondEdge <= 0 && thirdEdge <= 0))
      ) continue
      const firstWeight = firstEdge / -area
      const secondWeight = secondEdge / -area
      const thirdWeight = thirdEdge / -area
      const inverseDepth = firstWeight * first[2]
        + secondWeight * second[2]
        + thirdWeight * third[2]
      let colour = triangle.colour
      if (triangle.churchSurface) {
        const weights = [firstWeight, secondWeight, thirdWeight]
        const projectedVertices = [first, second, third]
        const baseTextureCoordinate = triangle.baseTextureCoordinates
          ? perspectiveInterpolate(
              triangle.baseTextureCoordinates,
              weights,
              projectedVertices,
              inverseDepth,
            )
          : null
        const sampledBaseColour = triangle.baseColourTexture && baseTextureCoordinate
          ? sampleTexture(triangle.baseColourTexture, baseTextureCoordinate)
          : [1, 1, 1]
        const surfaceColour = sampledBaseColour.map(
          (channel, index) => channel * triangle.baseColourFactor[index],
        )
        let surfaceNormal = triangle.faceNormal
        if (
          triangle.normalTexture
          && triangle.normalTextureCoordinates
          && triangle.tangentBasis
        ) {
          const normalTextureCoordinate = perspectiveInterpolate(
            triangle.normalTextureCoordinates,
            weights,
            projectedVertices,
            inverseDepth,
          )
          const sampledNormal = sampleTexture(
            triangle.normalTexture,
            normalTextureCoordinate,
          )
          const tangentNormal = normalized([
            (sampledNormal[0] * 2 - 1) * triangle.normalScale,
            (sampledNormal[1] * 2 - 1) * triangle.normalScale,
            sampledNormal[2] * 2 - 1,
          ])
          surfaceNormal = normalized(add(
            add(
              scale(triangle.tangentBasis.tangent, tangentNormal[0]),
              scale(triangle.tangentBasis.bitangent, tangentNormal[1]),
            ),
            scale(triangle.faceNormal, tangentNormal[2]),
          ))
        }
        let roughness = triangle.roughnessFactor
        let metallic = triangle.metallicFactor
        if (triangle.ormTexture && triangle.ormTextureCoordinates) {
          const ormTextureCoordinate = perspectiveInterpolate(
            triangle.ormTextureCoordinates,
            weights,
            projectedVertices,
            inverseDepth,
          )
          const sampledOrm = sampleTexture(triangle.ormTexture, ormTextureCoordinate)
          roughness *= sampledOrm[1]
          metallic *= sampledOrm[2]
        }
        const worldPosition = perspectiveInterpolate(
          triangle.vertices,
          weights,
          projectedVertices,
          inverseDepth,
        )
        colour = shadeChurchSurface({
          baseColour: surfaceColour,
          normal: surfaceNormal,
          roughness: clamp(roughness),
          metallic: clamp(metallic),
          viewDirection: normalized(subtract(camera, worldPosition)),
        })
      }
      setPixel(
        x,
        y,
        colour,
        inverseDepth,
      )
    }
  }
}

const pixelFont = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
}
const drawText = (value, centreX, top, pixelScale, colour) => {
  const characters = Array.from(value)
  const width = (characters.length * 6 - 1) * pixelScale
  const startX = Math.round(centreX - width / 2)
  characters.forEach((character, characterIndex) => {
    const glyph = pixelFont[character]
    if (!glyph) return
    glyph.forEach((row, rowIndex) => Array.from(row).forEach((pixel, columnIndex) => {
      if (pixel !== '1') return
      fillRect(
        startX + (characterIndex * 6 + columnIndex) * pixelScale,
        top + rowIndex * pixelScale,
        pixelScale,
        pixelScale,
        colour,
      )
    }))
  })
}

const sharedSceneTriangles = [...groundTriangles, ...churchTriangles]
const panels = [
  { x: MARGIN, label: 'CURRENT CHURCH' },
  { x: MARGIN + PANEL_WIDTH + GAP, label: 'CURRENT RELEASE HERO' },
]
for (const panel of panels) {
  fillRect(panel.x, 0, PANEL_WIDTH, HEADER_HEIGHT, [238, 231, 218])
  drawText(panel.label, panel.x + PANEL_WIDTH / 2, 14, 3, [52, 45, 38])
}
for (const triangle of sharedSceneTriangles) rasterTriangle(triangle, panels[0].x)

const copyPanelScene = (sourceX, targetX) => {
  for (let row = 0; row < PANEL_HEIGHT; row += 1) {
    const y = HEADER_HEIGHT + row
    const sourcePixelStart = (y * WIDTH + sourceX) * 4
    const targetPixelStart = (y * WIDTH + targetX) * 4
    pixels.copyWithin(
      targetPixelStart,
      sourcePixelStart,
      sourcePixelStart + PANEL_WIDTH * 4,
    )
    const sourceDepthStart = y * WIDTH + sourceX
    const targetDepthStart = y * WIDTH + targetX
    depth.copyWithin(
      targetDepthStart,
      sourceDepthStart,
      sourceDepthStart + PANEL_WIDTH,
    )
  }
}
copyPanelScene(panels[0].x, panels[1].x)
if (injectSharedSceneDrift) {
  const injectedOffset = ((HEADER_HEIGHT + 1) * WIDTH + panels[1].x + 1) * 4
  pixels[injectedOffset] ^= 1
}

const extractPanelPixels = (panelX) => {
  const result = Buffer.alloc(PANEL_WIDTH * PANEL_HEIGHT * 4)
  for (let row = 0; row < PANEL_HEIGHT; row += 1) {
    const sourceStart = ((HEADER_HEIGHT + row) * WIDTH + panelX) * 4
    Buffer.from(pixels.buffer, pixels.byteOffset + sourceStart, PANEL_WIDTH * 4)
      .copy(result, row * PANEL_WIDTH * 4)
  }
  return result
}
const extractPanelDepth = (panelX) => {
  const result = new Float64Array(PANEL_WIDTH * PANEL_HEIGHT)
  for (let row = 0; row < PANEL_HEIGHT; row += 1) {
    const sourceStart = (HEADER_HEIGHT + row) * WIDTH + panelX
    result.set(depth.subarray(sourceStart, sourceStart + PANEL_WIDTH), row * PANEL_WIDTH)
  }
  return Buffer.from(result.buffer)
}

const leftSharedPixels = extractPanelPixels(panels[0].x)
const rightSharedPixels = extractPanelPixels(panels[1].x)
const leftSharedDepth = extractPanelDepth(panels[0].x)
const rightSharedDepth = extractPanelDepth(panels[1].x)
const sharedScenePixelsByteIdentical = leftSharedPixels.equals(rightSharedPixels)
const sharedSceneDepthByteIdentical = leftSharedDepth.equals(rightSharedDepth)
if (!sharedScenePixelsByteIdentical || !sharedSceneDepthByteIdentical) {
  throw new Error(
    'Faithful entrance shared scene drifted between comparison panels '
    + `(pixels=${sharedScenePixelsByteIdentical}, depth=${sharedSceneDepthByteIdentical}).`,
  )
}
const sharedScenePixelSha256 = createHash('sha256').update(leftSharedPixels).digest('hex')
const sharedSceneDepthSha256 = createHash('sha256').update(leftSharedDepth).digest('hex')

for (const triangle of heroTriangles) rasterTriangle(triangle, panels[1].x)
for (const panel of panels) {
  fillRect(panel.x, HEADER_HEIGHT + PANEL_HEIGHT - 6, PANEL_WIDTH, 6, panel === panels[0]
    ? [182, 120, 69]
    : [61, 127, 108])
}

let compositionChangedPixels = 0
let changedMinimumX = Number.POSITIVE_INFINITY
let changedMinimumY = Number.POSITIVE_INFINITY
let changedMaximumX = Number.NEGATIVE_INFINITY
let changedMaximumY = Number.NEGATIVE_INFINITY
for (let y = HEADER_HEIGHT; y < HEADER_HEIGHT + PANEL_HEIGHT - 6; y += 1) {
  for (let x = 0; x < PANEL_WIDTH; x += 1) {
    const leftOffset = (y * WIDTH + MARGIN + x) * 4
    const rightOffset = (y * WIDTH + MARGIN + PANEL_WIDTH + GAP + x) * 4
    if (
      pixels[leftOffset] !== pixels[rightOffset]
      || pixels[leftOffset + 1] !== pixels[rightOffset + 1]
      || pixels[leftOffset + 2] !== pixels[rightOffset + 2]
    ) {
      compositionChangedPixels += 1
      changedMinimumX = Math.min(changedMinimumX, x)
      changedMinimumY = Math.min(changedMinimumY, y - HEADER_HEIGHT)
      changedMaximumX = Math.max(changedMaximumX, x)
      changedMaximumY = Math.max(changedMaximumY, y - HEADER_HEIGHT)
    }
  }
}
if (compositionChangedPixels < 300) {
  throw new Error(
    `Faithful entrance Hero is not visibly represented (${compositionChangedPixels} changed pixels).`,
  )
}

const png = encodePng(WIDTH, HEIGHT, pixels)
await mkdir(outputRoot, { recursive: true })
await writeFile(outputPng, png)
const report = {
  schemaVersion: 2,
  status: 'faithful-composition-review-not-runtime',
  release: 'gate-a-baseline-r9',
  church: {
    glbSha256: church.glbSha256,
    triangles: church.triangleCount,
    baseColourSha256,
    normalSha256,
    ormSha256,
    textureSize: [baseColour.width, baseColour.height],
    normalMappedTriangles: churchTriangles.filter(
      (triangle) => triangle.normalTexture && triangle.tangentBasis,
    ).length,
    roughnessMetallicMappedTriangles: churchTriangles.filter(
      (triangle) => triangle.ormTexture,
    ).length,
    identicalTrianglesReusedAcrossPanels: true,
    sharedScenePixelsByteIdentical,
    sharedSceneDepthByteIdentical,
    sharedScenePixelSha256,
    sharedSceneDepthSha256,
    assetChanged: false,
  },
  currentHero: {
    variant: currentHeroManifest.visualVariant,
    sha256: currentHeroSha256,
    triangles: heroTriangles.length,
    placement: heroPosition,
    entranceReviewAnchor,
    reviewOffsetTowardCameraMetres: heroReviewOffsetMetres,
    pose: {
      clip: reviewIdleClip.name,
      normalizedTime: 0.25,
    },
    compositionChangedPixels,
    compositionChangedBounds: {
      x: changedMinimumX,
      y: changedMinimumY,
      width: changedMaximumX - changedMinimumX + 1,
      height: changedMaximumY - changedMinimumY + 1,
    },
    compositionOnly: true,
    runtimeReferenced: true,
    textureTreatment: 'manifest-palette-on-current-skinned-geometry',
    reviewStatus: 'current-release-composition-only',
  },
  layout: {
    source: 'runtime virtualChurchScene.ts + VirtualChurchView.tsx',
    gateRightBays: gateRightRow.bays,
    entranceHasPhysicalPlanterOrWelcomeBoard: false,
  },
  camera: {
    position: camera,
    lookAt: cameraTarget,
    verticalFovDegrees: 47,
    panelViewport: [PANEL_WIDTH, PANEL_HEIGHT],
  },
  textureSampling: {
    baseColour: 'perspective-correct-bilinear-per-pixel',
    normal: 'perspective-correct-bilinear-tangent-space',
    orm: 'perspective-correct-bilinear-roughness-metallic',
    sourceTextureCoordinateSetsRespected: true,
    occlusion: 'not-connected-by-source-gltf',
    lighting: 'deterministic-pbr-lite-review-approximation',
    materialFactorApplied: true,
    churchAssetModified: false,
  },
  output: {
    png: '.tmp/virtual-church-art-direction/gate-a-faithful-entrance/faithful-entrance-review.png',
    width: WIDTH,
    height: HEIGHT,
    bytes: png.length,
    sha256: createHash('sha256').update(png).digest('hex'),
    rawRgbaSha256: createHash('sha256').update(pixels).digest('hex'),
  },
  limitations: [
    'The right panel uses the current released vroid-fair-v1 High skinned geometry and manifest palette; embedded WebP texture detail is intentionally omitted from this deterministic software composition review.',
    'The software raster uses the real BaseColor, Normal and roughness/metallic channels, but its deterministic PBR-lite lighting does not reproduce the browser renderer, environment reflections, shadows, bloom, AO, antialiasing, terrain height, vehicles, trees, or responsive UI.',
    'The source glTF does not connect the ORM red channel as an occlusion texture, so this review does not invent ambient occlusion from it.',
    'The Hero placement is review-only and is not a runtime coordinate change; face, hair and wardrobe quality must be judged in the real browser renderer.',
    'This evidence cannot pass Gate A without browser, device, performance, and user approval.',
  ],
  gateAPassed: false,
  passed: true,
}
await writeFile(outputReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
