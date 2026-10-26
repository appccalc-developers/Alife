import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(import.meta.dirname, '..', '..', '..')
const assetDir = path.join(repoRoot, 'cloudflare', 'alife-app', 'public', 'virtual-church-assets')
const buildingDir = path.join(assetDir, 'buildings')
const textureDir = path.join(assetDir, 'textures')

const targets = [
  'church-hero.glb',
  'church-hero-medium.glb',
  'church-hero-low.glb',
  'church-props.glb',
]

const imageUris = new Map([
  ['church-material-atlas-basecolor', '../textures/church-material-atlas-basecolor.png'],
  ['church-material-atlas-orm', '../textures/church-material-atlas-orm.png'],
  ['church-material-atlas-normal', '../textures/church-material-atlas-normal.png'],
])

const align4 = (value) => (value + 3) & ~3

function readGlb(filePath) {
  const buffer = fs.readFileSync(filePath)
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${filePath}: invalid GLB magic`)
  const jsonLength = buffer.readUInt32LE(12)
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength).trim())
  const binHeaderOffset = 20 + jsonLength
  const binLength = buffer.readUInt32LE(binHeaderOffset)
  const binType = buffer.readUInt32LE(binHeaderOffset + 4)
  if (binType !== 0x004e4942) throw new Error(`${filePath}: second chunk is not BIN`)
  const binary = buffer.subarray(binHeaderOffset + 8, binHeaderOffset + 8 + binLength)
  return { buffer, json, binary }
}

function remapBufferViewReferences(value, mapping) {
  if (Array.isArray(value)) {
    value.forEach((item) => remapBufferViewReferences(item, mapping))
    return
  }
  if (!value || typeof value !== 'object') return

  for (const [key, child] of Object.entries(value)) {
    if (key === 'bufferView' && typeof child === 'number') {
      const next = mapping.get(child)
      if (next == null) throw new Error(`Unmapped retained bufferView reference ${child}`)
      value[key] = next
    } else {
      remapBufferViewReferences(child, mapping)
    }
  }
}

function buildGlb(json, binary) {
  const jsonSource = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonLength = align4(jsonSource.byteLength)
  const jsonChunk = Buffer.alloc(jsonLength, 0x20)
  jsonSource.copy(jsonChunk)

  const binLength = align4(binary.byteLength)
  const binChunk = Buffer.alloc(binLength)
  binary.copy(binChunk)

  const totalLength = 12 + 8 + jsonChunk.byteLength + 8 + binChunk.byteLength
  const output = Buffer.alloc(totalLength)
  output.write('glTF', 0, 4, 'utf8')
  output.writeUInt32LE(2, 4)
  output.writeUInt32LE(totalLength, 8)
  output.writeUInt32LE(jsonChunk.byteLength, 12)
  output.writeUInt32LE(0x4e4f534a, 16)
  jsonChunk.copy(output, 20)

  const binHeaderOffset = 20 + jsonChunk.byteLength
  output.writeUInt32LE(binChunk.byteLength, binHeaderOffset)
  output.writeUInt32LE(0x004e4942, binHeaderOffset + 4)
  binChunk.copy(output, binHeaderOffset + 8)
  return output
}

function externalize(file) {
  const filePath = path.join(buildingDir, file)
  const { buffer, json, binary } = readGlb(filePath)
  const excludedViews = new Set()

  for (const image of json.images ?? []) {
    const uri = imageUris.get(image.name)
    if (!uri) throw new Error(`${file}: unknown embedded image ${image.name}`)
    const texturePath = path.resolve(buildingDir, uri)
    if (!texturePath.startsWith(textureDir) || !fs.existsSync(texturePath)) {
      throw new Error(`${file}: missing or out-of-scope shared texture ${texturePath}`)
    }
    excludedViews.add(image.bufferView)
    delete image.bufferView
    delete image.mimeType
    image.uri = uri.replaceAll('\\', '/')
  }

  const mapping = new Map()
  const nextViews = []
  const chunks = []
  let nextOffset = 0

  for (const [index, view] of (json.bufferViews ?? []).entries()) {
    if (excludedViews.has(index)) continue
    const alignedOffset = align4(nextOffset)
    if (alignedOffset > nextOffset) chunks.push(Buffer.alloc(alignedOffset - nextOffset))
    const sourceOffset = view.byteOffset ?? 0
    const source = binary.subarray(sourceOffset, sourceOffset + view.byteLength)
    chunks.push(source)
    mapping.set(index, nextViews.length)
    nextViews.push({ ...view, byteOffset: alignedOffset })
    nextOffset = alignedOffset + source.byteLength
  }

  json.bufferViews = nextViews
  remapBufferViewReferences(json, mapping)
  const nextBinary = Buffer.concat(chunks)
  json.buffers[0].byteLength = nextBinary.byteLength
  const output = buildGlb(json, nextBinary)
  fs.writeFileSync(filePath, output)

  return {
    file,
    beforeBytes: buffer.byteLength,
    afterBytes: output.byteLength,
    savedBytes: buffer.byteLength - output.byteLength,
    externalImages: json.images.map((image) => image.uri),
  }
}

const report = targets.map(externalize)
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
