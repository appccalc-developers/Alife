import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { createHash } from 'node:crypto'

const repoRoot = path.resolve(import.meta.dirname, '..', '..')
const assetRoot = path.join(
  repoRoot,
  'cloudflare',
  'alife-app',
  'public',
  'virtual-church-assets',
)
const sourceTextureDir = path.join(assetRoot, 'textures')
const sourceBuildingDir = path.join(assetRoot, 'buildings')
const outputRoot = path.join(
  assetRoot,
  'v3',
  'releases',
  'gate-a-baseline-r9',
)
const outputTextureDir = path.join(outputRoot, 'textures')
const outputBuildingDir = path.join(outputRoot, 'buildings')

const textureJobs = [
  {
    file: 'church-material-atlas-basecolor.png',
    kind: 'basecolor',
  },
  {
    file: 'church-material-atlas-normal.png',
    kind: 'normal',
  },
  {
    file: 'church-material-atlas-orm.png',
    kind: 'linear',
  },
]

const buildingFiles = [
  'church-hero.glb',
  'church-hero-medium.glb',
  'church-hero-low.glb',
]

const TARGET_TEXTURE_SIZE = 1024

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const listPngChunks = (png) => {
  const chunks = []
  let offset = PNG_SIGNATURE.length
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    chunks.push(type)
    offset += 12 + length
    if (type === 'IEND') break
  }
  return chunks
}
const summarizePngChunks = (png) => Object.fromEntries(
  [...listPngChunks(png).reduce((counts, type) => {
    counts.set(type, (counts.get(type) ?? 0) + 1)
    return counts
  }, new Map()).entries()],
)
const COLOR_MANAGEMENT_CHUNKS = ['cHRM', 'gAMA', 'iCCP', 'sRGB']
const assertNoColourManagementChunks = (chunkSummary, label) => {
  const present = COLOR_MANAGEMENT_CHUNKS.filter((type) => chunkSummary[type])
  if (present.length > 0) {
    throw new Error(
      `${label}: cannot strip colour-management chunks ${present.join(', ')} during lossless re-encode`,
    )
  }
}
const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) !== 0
      ? 0xedb88320 ^ (value >>> 1)
      : value >>> 1
  }
  return value >>> 0
})

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const value of buffer) {
    crc = CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft
  const leftDistance = Math.abs(prediction - left)
  const upDistance = Math.abs(prediction - up)
  const upperLeftDistance = Math.abs(prediction - upperLeft)
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left
  if (upDistance <= upperLeftDistance) return up
  return upperLeft
}

const decodePngBuffer = (png, label) => {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${label}: invalid PNG signature`)
  }

  let offset = PNG_SIGNATURE.length
  let ihdr
  const idat = []
  while (offset < png.length) {
    const length = png.readUInt32BE(offset)
    const type = png.toString('ascii', offset + 4, offset + 8)
    const data = png.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') ihdr = data
    if (type === 'IDAT') idat.push(data)
    offset += 12 + length
    if (type === 'IEND') break
  }

  if (!ihdr) throw new Error(`${label}: missing IHDR`)
  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  const bitDepth = ihdr[8]
  const colorType = ihdr[9]
  const compression = ihdr[10]
  const filterMethod = ihdr[11]
  const interlace = ihdr[12]
  if (
    bitDepth !== 8
    || (colorType !== 2 && colorType !== 6)
    || compression !== 0
    || filterMethod !== 0
    || interlace !== 0
  ) {
    throw new Error(
      `${label}: expected non-interlaced 8-bit RGB/RGBA PNG, got `
      + `depth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`,
    )
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3
  const rowBytes = width * bytesPerPixel
  const filtered = zlib.inflateSync(Buffer.concat(idat))
  const expectedLength = (rowBytes + 1) * height
  if (filtered.length !== expectedLength) {
    throw new Error(`${label}: inflated ${filtered.length} bytes, expected ${expectedLength}`)
  }

  const decoded = Buffer.alloc(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    const filter = filtered[y * (rowBytes + 1)]
    const sourceStart = y * (rowBytes + 1) + 1
    const targetStart = y * rowBytes
    for (let x = 0; x < rowBytes; x += 1) {
      const source = filtered[sourceStart + x]
      const left = x >= bytesPerPixel ? decoded[targetStart + x - bytesPerPixel] : 0
      const up = y > 0 ? decoded[targetStart + x - rowBytes] : 0
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? decoded[targetStart + x - rowBytes - bytesPerPixel]
        : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = Math.floor((left + up) / 2)
      else if (filter === 4) predictor = paeth(left, up, upperLeft)
      else if (filter !== 0) throw new Error(`${label}: unsupported PNG filter ${filter}`)
      decoded[targetStart + x] = (source + predictor) & 0xff
    }
  }

  if (colorType === 6) return { width, height, rgba: decoded }
  const rgba = Buffer.alloc(width * height * 4)
  for (let sourceOffset = 0, targetOffset = 0; sourceOffset < decoded.length; sourceOffset += 3, targetOffset += 4) {
    rgba[targetOffset] = decoded[sourceOffset]
    rgba[targetOffset + 1] = decoded[sourceOffset + 1]
    rgba[targetOffset + 2] = decoded[sourceOffset + 2]
    rgba[targetOffset + 3] = 255
  }
  return { width, height, rgba }
}

const decodePng = (filePath) => decodePngBuffer(fs.readFileSync(filePath), filePath)

const signedByteCost = (buffer) => {
  let cost = 0
  for (const value of buffer) cost += Math.abs(value < 128 ? value : value - 256)
  return cost
}

const filterRow = (row, previousRow, bytesPerPixel, filter) => {
  const output = Buffer.alloc(row.length)
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0
    const up = previousRow?.[index] ?? 0
    const upperLeft = index >= bytesPerPixel ? previousRow?.[index - bytesPerPixel] ?? 0 : 0
    let predictor = 0
    if (filter === 1) predictor = left
    else if (filter === 2) predictor = up
    else if (filter === 3) predictor = Math.floor((left + up) / 2)
    else if (filter === 4) predictor = paeth(left, up, upperLeft)
    output[index] = (row[index] - predictor + 256) & 0xff
  }
  return output
}

const pngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, 'ascii')
  const output = Buffer.alloc(data.length + 12)
  output.writeUInt32BE(data.length, 0)
  typeBuffer.copy(output, 4)
  data.copy(output, 8)
  output.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), data.length + 8)
  return output
}

const encodePng = ({ width, height, rgba }) => {
  let opaque = true
  for (let offset = 3; offset < rgba.length; offset += 4) {
    if (rgba[offset] !== 255) {
      opaque = false
      break
    }
  }
  const bytesPerPixel = opaque ? 3 : 4
  const rowBytes = width * bytesPerPixel
  const rows = []
  let previousRow
  for (let y = 0; y < height; y += 1) {
    let row
    if (opaque) {
      row = Buffer.alloc(rowBytes)
      const sourceStart = y * width * 4
      for (let x = 0; x < width; x += 1) {
        const sourceOffset = sourceStart + x * 4
        const targetOffset = x * 3
        row[targetOffset] = rgba[sourceOffset]
        row[targetOffset + 1] = rgba[sourceOffset + 1]
        row[targetOffset + 2] = rgba[sourceOffset + 2]
      }
    } else {
      row = rgba.subarray(y * rowBytes, (y + 1) * rowBytes)
    }
    let bestFilter = 0
    let bestRow = Buffer.from(row)
    let bestCost = signedByteCost(bestRow)
    for (let filter = 1; filter <= 4; filter += 1) {
      const candidate = filterRow(row, previousRow, bytesPerPixel, filter)
      const cost = signedByteCost(candidate)
      if (cost < bestCost) {
        bestFilter = filter
        bestRow = candidate
        bestCost = cost
      }
    }
    rows.push(Buffer.from([bestFilter]), bestRow)
    previousRow = row
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = opaque ? 2 : 6
  const idat = zlib.deflateSync(Buffer.concat(rows), { level: 9 })
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const sha256 = (filePath) => createHash('sha256')
  .update(fs.readFileSync(filePath))
  .digest('hex')

const analyzeOnly = process.argv.includes('--analyze')
if (analyzeOnly) {
  const analysis = textureJobs.map(({ file, kind }) => {
    const sourcePath = path.join(sourceTextureDir, file)
    const source = decodePng(sourcePath)
    const uniquePixels = new Set()
    const uniqueChannels = Array.from({ length: 4 }, () => new Set())
    let transparentPixels = 0
    for (let offset = 0; offset < source.rgba.length; offset += 4) {
      const red = source.rgba[offset]
      const green = source.rgba[offset + 1]
      const blue = source.rgba[offset + 2]
      const alpha = source.rgba[offset + 3]
      uniquePixels.add(
        red
        | (green << 8)
        | (blue << 16)
        | (alpha << 24),
      )
      uniqueChannels[0].add(red)
      uniqueChannels[1].add(green)
      uniqueChannels[2].add(blue)
      uniqueChannels[3].add(alpha)
      if (alpha !== 255) transparentPixels += 1
    }
    const sourceBytes = fs.statSync(sourcePath).size
    const sourceChunks = summarizePngChunks(fs.readFileSync(sourcePath))
    assertNoColourManagementChunks(sourceChunks, file)
    const losslessReencode = encodePng(source)
    return {
      file,
      kind,
      dimensions: `${source.width}x${source.height}`,
      pixels: source.width * source.height,
      uniqueRgbaPixels: uniquePixels.size,
      uniqueChannelValues: uniqueChannels.map((values) => values.size),
      transparentPixels,
      sourceChunks,
      sourceBytes,
      losslessReencodeBytes: losslessReencode.byteLength,
      losslessReductionPercent: Number(
        ((1 - losslessReencode.byteLength / sourceBytes) * 100).toFixed(1),
      ),
      decodedPixelsIdentical: decodePngBuffer(losslessReencode, `${file}:lossless-reencode`).rgba.equals(source.rgba),
    }
  })
  process.stdout.write(`${JSON.stringify({ mode: 'analyze', textures: analysis }, null, 2)}\n`)
  process.exit(0)
}

const validateOnly = process.argv.includes('--validate')
if (validateOnly) {
  const validation = textureJobs.map(({ file }) => {
    const sourcePath = path.join(sourceTextureDir, file)
    const outputPath = path.join(outputTextureDir, file)
    const source = decodePng(sourcePath)
    const output = decodePng(outputPath)
    const sourceChunks = summarizePngChunks(fs.readFileSync(sourcePath))
    const outputChunks = summarizePngChunks(fs.readFileSync(outputPath))
    assertNoColourManagementChunks(sourceChunks, file)
    const dimensionsIdentical = source.width === output.width && source.height === output.height
    const decodedPixelsIdentical = dimensionsIdentical && source.rgba.equals(output.rgba)
    if (!decodedPixelsIdentical) {
      throw new Error(`${file}: v3 output is not pixel-identical to the v2 production texture`)
    }
    const sourceBytes = fs.statSync(sourcePath).size
    const outputBytes = fs.statSync(outputPath).size
    return {
      file,
      dimensions: `${output.width}x${output.height}`,
      decodedPixelsIdentical,
      sourceChunks,
      outputChunks,
      sourceBytes,
      outputBytes,
      reductionPercent: Number(((1 - outputBytes / sourceBytes) * 100).toFixed(1)),
      sourceSha256: sha256(sourcePath),
      outputSha256: sha256(outputPath),
      decodedRgbaSha256: createHash('sha256').update(output.rgba).digest('hex'),
    }
  })
  process.stdout.write(`${JSON.stringify({ mode: 'validate', textures: validation }, null, 2)}\n`)
  process.exit(0)
}

fs.mkdirSync(outputTextureDir, { recursive: true })
fs.mkdirSync(outputBuildingDir, { recursive: true })

const textureReport = textureJobs.map(({ file, kind }) => {
  const sourcePath = path.join(sourceTextureDir, file)
  const outputPath = path.join(outputTextureDir, file)
  const source = decodePng(sourcePath)
  const sourceChunks = summarizePngChunks(fs.readFileSync(sourcePath))
  assertNoColourManagementChunks(sourceChunks, file)
  if (source.width !== 1024 || source.height !== 1024) {
    throw new Error(`${file}: expected 1024x1024 source, got ${source.width}x${source.height}`)
  }
  fs.writeFileSync(outputPath, encodePng(source))
  const decodedOutput = decodePng(outputPath)
  if (
    decodedOutput.width !== TARGET_TEXTURE_SIZE
    || decodedOutput.height !== TARGET_TEXTURE_SIZE
  ) {
    throw new Error(`${file}: generated invalid output dimensions`)
  }
  const decodedPixelsIdentical = source.rgba.equals(decodedOutput.rgba)
  if (!decodedPixelsIdentical) {
    throw new Error(`${file}: lossless output pixels differ from v2 source`)
  }
  return {
    file,
    kind,
    sourceBytes: fs.statSync(sourcePath).size,
    outputBytes: fs.statSync(outputPath).size,
    dimensions: `${decodedOutput.width}x${decodedOutput.height}`,
    decodedPixelsIdentical,
  }
})

const buildingReport = buildingFiles.map((file) => {
  const sourcePath = path.join(sourceBuildingDir, file)
  const outputPath = path.join(outputBuildingDir, file)
  fs.copyFileSync(sourcePath, outputPath)
  const sourceHash = sha256(sourcePath)
  const outputHash = sha256(outputPath)
  if (sourceHash !== outputHash) throw new Error(`${file}: copied GLB hash mismatch`)
  return {
    file,
    bytes: fs.statSync(outputPath).size,
    sha256: outputHash,
    byteIdenticalToV2: true,
  }
})

const sourceTextureBytes = textureReport.reduce((total, item) => total + item.sourceBytes, 0)
const outputTextureBytes = textureReport.reduce((total, item) => total + item.outputBytes, 0)

process.stdout.write(`${JSON.stringify({
  textures: textureReport,
  buildings: buildingReport,
  textureTotals: {
    sourceBytes: sourceTextureBytes,
    outputBytes: outputTextureBytes,
    reductionPercent: Number(
      ((1 - outputTextureBytes / sourceTextureBytes) * 100).toFixed(1),
    ),
  },
}, null, 2)}\n`)
