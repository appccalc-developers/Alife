import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const reviewRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-style-slice-review',
)
const faithfulRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-faithful-entrance',
)
const heroEvidenceRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
)
const historicalV4Root = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  'face-readability-candidate-v4',
)
const parkingRoot = resolve(
  repositoryRoot,
  '.tmp',
  'virtual-church-art-direction',
  'gate-a-parking-layout',
)
const planPath = resolve(
  repositoryRoot,
  'docs',
  'virtual-church-visual-upgrade-plan.zh-CN.md',
)
const outputPng = resolve(reviewRoot, 'gate-a-style-slice-review.png')
const outputReport = resolve(reviewRoot, 'gate-a-style-slice-review.json')
const injectVisualScore = process.argv.includes('--inject-visual-score')

const inputs = {
  faithfulImage: resolve(faithfulRoot, 'faithful-entrance-review.png'),
  faithfulReport: resolve(faithfulRoot, 'faithful-entrance-review.json'),
  heroFace: resolve(heroEvidenceRoot, 'gate-a-female-hero-actual-face-review.png'),
  heroAnimation: resolve(heroEvidenceRoot, 'gate-a-female-hero-actual-animation-poses.png'),
  heroWalk: resolve(heroEvidenceRoot, 'gate-a-female-hero-walk-cycle-review.png'),
  heroRun: resolve(heroEvidenceRoot, 'gate-a-female-hero-run-cycle-review.png'),
  heroTurntable: resolve(heroEvidenceRoot, 'gate-a-female-hero-actual-turntable.png'),
  heroPicker: resolve(heroEvidenceRoot, 'gate-a-female-hero-runtime-picker.png'),
  heroPickerWebp: resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'public',
    'virtual-church-assets',
    'v3',
    'releases',
    'gate-a-baseline-r9',
    'characters',
    'character-hero-female-picker.webp',
  ),
  heroManifest: resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'public',
    'virtual-church-assets',
    'v3',
    'releases',
    'gate-a-baseline-r9',
    'characters',
    'character-hero-female.manifest.json',
  ),
  historicalV4Manifest: resolve(
    historicalV4Root,
    'characters',
    'character-hero-female.manifest.json',
  ),
  parkingReport: resolve(parkingRoot, 'parking-layout-review.json'),
  parkingSvg: resolve(parkingRoot, 'parking-layout-review.svg'),
  runtimeView: resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'src',
    'views',
    'VirtualChurchView.tsx',
  ),
  runtimeService: resolve(
    repositoryRoot,
    'cloudflare',
    'alife-app',
    'src',
    'services',
    'virtualChurchService.ts',
  ),
}

const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const CURRENT_HERO_HIGH_SHA256 = '1f4afcfe0713ed0b16abbe0512197e67d3119d9831ae3c04d0d4a81bc19f1bd6'
const HISTORICAL_V4_HIGH_SHA256 = 'c5c73bb48eda4e0871a01725575b4d388d58438f4bc158d16e9c7f2d6e2e76d5'
const CURRENT_HERO_EVIDENCE_SHA256 = {
  heroAnimation: 'c3b6ac5de268abafff3a310152848d2fc310cbc1be4a9f32b1ded1ec1e7a71be',
  heroFace: 'bdfaa01593f092e6e2ba90b7be2a0390ec671132369f814210df06f881cae8d5',
  heroPicker: '4ae0eb0da3aece6f7bef86181e973304a79b040c6688b3b5db8ab73adae24883',
  heroPickerWebp: 'd56d8f2846f2d12ebf145d37bae6996d95f984dc834acaa9cae38ae1d3d1a861',
  heroRun: '830327bcb6b36953bd8aab2eeaff2ff0c66c6b020ff7858ef3722586d81e386f',
  heroTurntable: '1312f22674dddd9f73f6c8ac2305d892896e4f3e05132508e9df21852bfeb3ec',
  heroWalk: '683fe74491569a18c147e539127d4e7f8bc39cfa63c48818420c5a2fd79a7821',
}
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const paeth = (left, up, upperLeft) => {
  const prediction = left + up - upperLeft
  const distances = [
    Math.abs(prediction - left),
    Math.abs(prediction - up),
    Math.abs(prediction - upperLeft),
  ]
  if (distances[0] <= distances[1] && distances[0] <= distances[2]) return left
  return distances[1] <= distances[2] ? up : upperLeft
}
const decodePng = (png, label) => {
  if (!png.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${label} is not a PNG.`)
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
  if (!header) throw new Error(`${label} has no PNG header.`)
  const width = header.readUInt32BE(0)
  const height = header.readUInt32BE(4)
  const bitDepth = header[8]
  const colourType = header[9]
  if (bitDepth !== 8 || ![2, 6].includes(colourType) || header[12] !== 0) {
    throw new Error(`${label} must be a non-interlaced 8-bit RGB/RGBA PNG.`)
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
      else if (filter !== 0) throw new Error(`${label} uses unsupported PNG filter ${filter}.`)
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
    Buffer.from(pixels.buffer, pixels.byteOffset + y * width * 4, width * 4)
      .copy(rows, y * (width * 4 + 1) + 1)
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(rows, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const parseColour = (value, fallback = [0, 0, 0, 255]) => {
  if (!value || value === 'none') return null
  const match = /^#([0-9a-f]{6})$/iu.exec(value)
  if (!match) return fallback
  const numeric = Number.parseInt(match[1], 16)
  return [(numeric >> 16) & 0xff, (numeric >> 8) & 0xff, numeric & 0xff, 255]
}
const PARKING_CLASSES = {
  site: { fill: '#303938', stroke: '#53605d', strokeWidth: 2 },
  'church-footprint': { fill: '#d7d0c2', stroke: '#756b5c', strokeWidth: 2.5 },
  'main-entrance': { stroke: '#ce742d', strokeWidth: 8 },
  'entrance-trigger': { fill: '#f2c867', fillOpacity: 0.12, stroke: '#ce742d', strokeWidth: 2 },
  fence: { stroke: '#141b1a', strokeWidth: 5 },
  gate: { stroke: '#df8a3b', strokeWidth: 7 },
  'parking-row': { fillOpacity: 0.18, stroke: '#dce4df', strokeWidth: 1.4 },
  'parking-stripe': { stroke: '#f4f0dc', strokeWidth: 2.2 },
  'accessible-stripe': { stroke: '#f1cf52', strokeWidth: 2.8 },
  'wheel-stop': { stroke: '#e4e0d2', strokeWidth: 5 },
  dimension: { stroke: '#f0b84c', strokeWidth: 2.5 },
}
const rasterizeParkingSvg = (svgSource) => {
  const source = svgSource.split('<g transform="translate(850 90)">')[0]
  const crop = { x: 40, y: 70, width: 800, height: 680 }
  const rgba = new Uint8Array(crop.width * crop.height * 4)
  const blendPixel = (x, y, colour, opacity = 1) => {
    const roundedX = Math.round(x - crop.x)
    const roundedY = Math.round(y - crop.y)
    if (roundedX < 0 || roundedY < 0 || roundedX >= crop.width || roundedY >= crop.height) return
    const offset = (roundedY * crop.width + roundedX) * 4
    const alpha = opacity * ((colour?.[3] ?? 255) / 255)
    for (let channel = 0; channel < 3; channel += 1) {
      rgba[offset + channel] = Math.round(
        (colour?.[channel] ?? 0) * alpha + rgba[offset + channel] * (1 - alpha),
      )
    }
    rgba[offset + 3] = 255
  }
  const fillBackground = (colour) => {
    for (let offset = 0; offset < rgba.length; offset += 4) {
      rgba[offset] = colour[0]
      rgba[offset + 1] = colour[1]
      rgba[offset + 2] = colour[2]
      rgba[offset + 3] = 255
    }
  }
  fillBackground(parseColour('#f4efe4'))
  const drawDisk = (x, y, radius, colour, opacity = 1) => {
    const minimumX = Math.floor(x - radius)
    const maximumX = Math.ceil(x + radius)
    const minimumY = Math.floor(y - radius)
    const maximumY = Math.ceil(y + radius)
    for (let row = minimumY; row <= maximumY; row += 1) {
      for (let column = minimumX; column <= maximumX; column += 1) {
        if (Math.hypot(column - x, row - y) <= radius) {
          blendPixel(column, row, colour, opacity)
        }
      }
    }
  }
  const drawLine = (x1, y1, x2, y2, colour, width, opacity = 1) => {
    const distance = Math.hypot(x2 - x1, y2 - y1)
    const steps = Math.max(1, Math.ceil(distance * 1.5))
    for (let step = 0; step <= steps; step += 1) {
      const amount = step / steps
      drawDisk(
        x1 + (x2 - x1) * amount,
        y1 + (y2 - y1) * amount,
        Math.max(0.5, width / 2),
        colour,
        opacity,
      )
    }
  }
  const fillPolygon = (points, colour, opacity = 1) => {
    const minimumY = Math.floor(Math.min(...points.map((point) => point[1])))
    const maximumY = Math.ceil(Math.max(...points.map((point) => point[1])))
    for (let y = minimumY; y <= maximumY; y += 1) {
      const intersections = []
      for (let index = 0; index < points.length; index += 1) {
        const current = points[index]
        const next = points[(index + 1) % points.length]
        if ((current[1] > y) === (next[1] > y)) continue
        intersections.push(
          current[0] + (y - current[1]) * (next[0] - current[0])
            / (next[1] - current[1]),
        )
      }
      intersections.sort((left, right) => left - right)
      for (let index = 0; index + 1 < intersections.length; index += 2) {
        for (let x = Math.ceil(intersections[index]); x <= Math.floor(intersections[index + 1]); x += 1) {
          blendPixel(x, y, colour, opacity)
        }
      }
    }
  }
  const strokePolygon = (points, colour, width, opacity = 1) => {
    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length]
      drawLine(point[0], point[1], next[0], next[1], colour, width, opacity)
    })
  }
  const attributesFrom = (sourceAttributes) => Object.fromEntries(
    Array.from(sourceAttributes.matchAll(/([\w-]+)="([^"]*)"/gu))
      .map((match) => [match[1], match[2]]),
  )
  const resolveStyle = (attributes) => ({
    ...(PARKING_CLASSES[attributes.class] ?? {}),
    ...(attributes.fill ? { fill: attributes.fill } : {}),
    ...(attributes.stroke ? { stroke: attributes.stroke } : {}),
    ...(attributes['stroke-width'] ? { strokeWidth: Number(attributes['stroke-width']) } : {}),
    ...(attributes['fill-opacity'] ? { fillOpacity: Number(attributes['fill-opacity']) } : {}),
    ...(attributes['stroke-opacity'] ? { strokeOpacity: Number(attributes['stroke-opacity']) } : {}),
  })
  for (const match of source.matchAll(/<(rect|polygon|line|circle)\b([^>]*)\/?\s*>/gu)) {
    const [, type, sourceAttributes] = match
    const attributes = attributesFrom(sourceAttributes)
    const style = resolveStyle(attributes)
    const fill = parseColour(style.fill)
    const stroke = parseColour(style.stroke)
    if (type === 'rect') {
      const x = Number(attributes.x ?? 0)
      const y = Number(attributes.y ?? 0)
      const width = Number(attributes.width ?? 1200)
      const height = Number(attributes.height ?? 800)
      if (fill && x === 0 && y === 0 && width >= 1200 && height >= 800) {
        fillBackground(fill)
      }
      continue
    }
    if (type === 'polygon') {
      const points = attributes.points.trim().split(/\s+/u).map((entry) =>
        entry.split(',').map(Number))
      if (fill) fillPolygon(points, fill, style.fillOpacity ?? 1)
      if (stroke) strokePolygon(points, stroke, style.strokeWidth ?? 1, style.strokeOpacity ?? 1)
      continue
    }
    if (type === 'line') {
      if (stroke) {
        drawLine(
          Number(attributes.x1),
          Number(attributes.y1),
          Number(attributes.x2),
          Number(attributes.y2),
          stroke,
          style.strokeWidth ?? 1,
          style.strokeOpacity ?? 1,
        )
      }
      continue
    }
    if (type === 'circle') {
      const centreX = Number(attributes.cx)
      const centreY = Number(attributes.cy)
      const radius = Number(attributes.r)
      if (fill) drawDisk(centreX, centreY, radius, fill, style.fillOpacity ?? 1)
      if (stroke) {
        const steps = Math.max(24, Math.ceil(radius * Math.PI * 2))
        for (let index = 0; index < steps; index += 1) {
          const firstAngle = index / steps * Math.PI * 2
          const secondAngle = (index + 1) / steps * Math.PI * 2
          drawLine(
            centreX + Math.cos(firstAngle) * radius,
            centreY + Math.sin(firstAngle) * radius,
            centreX + Math.cos(secondAngle) * radius,
            centreY + Math.sin(secondAngle) * radius,
            stroke,
            style.strokeWidth ?? 1,
          )
        }
      }
    }
  }
  return {
    width: crop.width,
    height: crop.height,
    rgba,
    sourceCrop: crop,
    mode: 'controlled-svg-geometry-raster-no-text',
  }
}

const scoreDimensions = [
  ['CHARACTER APPEAL', '角色吸引力'],
  ['CHARACTER SILHOUETTE', '角色轮廓'],
  ['BUILDING ACCURACY + FINISH', '建筑准确与质感'],
  ['MATERIAL AND COLOR', '材质与色彩'],
  ['WORLD COHESION', '世界协调度'],
  ['UI INTEGRATION', 'UI 融合度'],
]
const visualScoreDimensions = scoreDimensions.map(([label, chineseLabel], index) => ({
  label,
  chineseLabel,
  score: injectVisualScore && index === 0 ? 1 : null,
}))
if (visualScoreDimensions.some((dimension) => dimension.score !== null)) {
  throw new Error('Gate A review sheet refused a prefilled visual score.')
}
const plan = await readFile(planPath, 'utf8')
for (const [, chineseLabel] of scoreDimensions) {
  if (!plan.includes(`| ${chineseLabel} |`)) {
    throw new Error(`Master plan lost Gate A score dimension ${chineseLabel}.`)
  }
}
for (const fragment of ['总分至少 10/12', '任一维度不得为 0 分', '用户明确确认 v3 风格切片']) {
  if (!plan.includes(fragment)) throw new Error(`Master plan lost Gate A rule: ${fragment}`)
}

const entries = await Promise.all(Object.entries(inputs).map(async ([name, path]) => {
  const buffer = await readFile(path)
  return [name, { path, buffer, sha256: sha256(buffer) }]
}))
const evidence = Object.fromEntries(entries)
const faithfulReport = JSON.parse(evidence.faithfulReport.buffer.toString('utf8'))
const heroManifest = JSON.parse(evidence.heroManifest.buffer.toString('utf8'))
const historicalV4Manifest = JSON.parse(evidence.historicalV4Manifest.buffer.toString('utf8'))
const parkingReport = JSON.parse(evidence.parkingReport.buffer.toString('utf8'))
if (
  faithfulReport.passed !== true
  || faithfulReport.gateAPassed !== false
  || faithfulReport.church?.assetChanged !== false
  || faithfulReport.church?.sharedScenePixelsByteIdentical !== true
  || faithfulReport.church?.sharedSceneDepthByteIdentical !== true
  || faithfulReport.layout?.gateRightBays !== 6
  || faithfulReport.layout?.entranceHasPhysicalPlanterOrWelcomeBoard !== false
  || faithfulReport.currentHero?.variant !== 'vroid-fair-v1'
  || faithfulReport.currentHero?.sha256 !== CURRENT_HERO_HIGH_SHA256
  || faithfulReport.currentHero?.runtimeReferenced !== true
  || faithfulReport.currentHero?.reviewStatus !== 'current-release-composition-only'
) {
  throw new Error('Faithful entrance evidence no longer satisfies the review-sheet contract.')
}
if (
  heroManifest.visualVariant !== 'vroid-fair-v1'
  || heroManifest.animationVariant !== 'vroid-fair-motion-v14'
  || heroManifest.appearance?.skinTone !== 'fair-warm'
  || heroManifest.appearance?.skinBaseColor !== '#DFAB94'
  || heroManifest.lods?.find((entry) => entry.lod === 'high')?.sha256
    !== CURRENT_HERO_HIGH_SHA256
  || heroManifest.lods?.find((entry) => entry.lod === 'high')?.triangles !== 42_397
  || heroManifest.runtime?.desktopLod !== 'medium'
  || heroManifest.runtime?.mobileLod !== 'low'
) {
  throw new Error('Current Hero manifest no longer identifies the released fair r9 Hero.')
}
if (
  historicalV4Manifest.visualVariant !== 'face-readability-candidate-v4'
  || historicalV4Manifest.lods?.find((entry) => entry.lod === 'high')?.sha256
    !== HISTORICAL_V4_HIGH_SHA256
) {
  throw new Error('Historical V4 rejection evidence changed unexpectedly.')
}
for (const [name, expectedHash] of Object.entries(CURRENT_HERO_EVIDENCE_SHA256)) {
  if (evidence[name].sha256 !== expectedHash) {
    throw new Error(`${name} no longer matches the current deterministic Hero review.`)
  }
}
for (const sourceName of ['runtimeView', 'runtimeService']) {
  const source = evidence[sourceName].buffer.toString('utf8')
  if (
    source.includes('face-readability-candidate-v4')
    || source.includes(HISTORICAL_V4_HIGH_SHA256)
  ) {
    throw new Error(`Historical V4 candidate leaked into ${sourceName}.`)
  }
}
const runtimeServiceSource = evidence.runtimeService.buffer.toString('utf8')
for (const fragment of [
  "const V3_ASSET_RELEASE = 'gate-a-baseline-r9'",
  '/characters/character-hero-female-high.glb',
  '/characters/character-hero-female-medium.glb',
  '/characters/character-hero-female-low.glb',
]) {
  if (!runtimeServiceSource.includes(fragment)) {
    throw new Error(`Current r9 Hero is no longer referenced by runtime service: ${fragment}`)
  }
}
if (
  parkingReport.passed !== true
  || parkingReport.referenceAuthority?.layoutRelationships !== 'user-confirmed-overhead-view'
  || parkingReport.parkingRows?.find((row) => row.id === 'entry-gate-right')?.bays !== 6
  || parkingReport.assertions?.entryRightSeparatedFromCentralParking !== true
  || parkingReport.assertions?.entryRightRelationshipUserConfirmed !== true
  || parkingReport.assertions?.centralCrossAisleHasNoPlantingIsland !== true
  || parkingReport.assertions?.entranceHasNoPhysicalPlantersOrWelcomeBoards !== true
  || parkingReport.assertions?.churchAssetChanged !== false
  || parkingReport.output?.svgSha256 !== evidence.parkingSvg.sha256
) {
  throw new Error('Parking evidence no longer matches the user-confirmed overhead relationship.')
}

const images = Object.fromEntries([
  'faithfulImage',
  'heroFace',
  'heroAnimation',
  'heroPicker',
  'heroWalk',
  'heroRun',
  'heroTurntable',
].map((name) => [name, decodePng(evidence[name].buffer, name)]))
const parkingDiagram = rasterizeParkingSvg(evidence.parkingSvg.buffer.toString('utf8'))

const WIDTH = 2200
const HEIGHT = 2520
const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
const setPixel = (x, y, colour) => {
  if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return
  const offset = (y * WIDTH + x) * 4
  pixels[offset] = colour[0]
  pixels[offset + 1] = colour[1]
  pixels[offset + 2] = colour[2]
  pixels[offset + 3] = colour[3] ?? 255
}
const fillRect = (x, y, width, height, colour) => {
  for (let row = Math.max(0, y); row < Math.min(HEIGHT, y + height); row += 1) {
    for (let column = Math.max(0, x); column < Math.min(WIDTH, x + width); column += 1) {
      setPixel(column, row, colour)
    }
  }
}
fillRect(0, 0, WIDTH, HEIGHT, [31, 39, 39, 255])

const blitContain = (image, x, y, width, height, background = [22, 29, 29, 255]) => {
  fillRect(x, y, width, height, background)
  const scale = Math.min(width / image.width, height / image.height)
  const drawWidth = Math.max(1, Math.round(image.width * scale))
  const drawHeight = Math.max(1, Math.round(image.height * scale))
  const startX = x + Math.floor((width - drawWidth) / 2)
  const startY = y + Math.floor((height - drawHeight) / 2)
  for (let targetY = 0; targetY < drawHeight; targetY += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor(targetY / scale))
    for (let targetX = 0; targetX < drawWidth; targetX += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor(targetX / scale))
      const sourceOffset = (sourceY * image.width + sourceX) * 4
      setPixel(startX + targetX, startY + targetY, [
        image.rgba[sourceOffset],
        image.rgba[sourceOffset + 1],
        image.rgba[sourceOffset + 2],
        image.rgba[sourceOffset + 3],
      ])
    }
  }
}

const FONT = {
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  A: ['01110','10001','10001','11111','10001','10001','10001'],
  B: ['11110','10001','10001','11110','10001','10001','11110'],
  C: ['01111','10000','10000','10000','10000','10000','01111'],
  D: ['11110','10001','10001','10001','10001','10001','11110'],
  E: ['11111','10000','10000','11110','10000','10000','11111'],
  F: ['11111','10000','10000','11110','10000','10000','10000'],
  G: ['01111','10000','10000','10111','10001','10001','01111'],
  H: ['10001','10001','10001','11111','10001','10001','10001'],
  I: ['11111','00100','00100','00100','00100','00100','11111'],
  J: ['00111','00010','00010','00010','10010','10010','01100'],
  K: ['10001','10010','10100','11000','10100','10010','10001'],
  L: ['10000','10000','10000','10000','10000','10000','11111'],
  M: ['10001','11011','10101','10101','10001','10001','10001'],
  N: ['10001','11001','10101','10011','10001','10001','10001'],
  O: ['01110','10001','10001','10001','10001','10001','01110'],
  P: ['11110','10001','10001','11110','10000','10000','10000'],
  Q: ['01110','10001','10001','10001','10101','10010','01101'],
  R: ['11110','10001','10001','11110','10100','10010','10001'],
  S: ['01111','10000','10000','01110','00001','00001','11110'],
  T: ['11111','00100','00100','00100','00100','00100','00100'],
  U: ['10001','10001','10001','10001','10001','10001','01110'],
  V: ['10001','10001','10001','10001','10001','01010','00100'],
  W: ['10001','10001','10001','10101','10101','11011','10001'],
  X: ['10001','10001','01010','00100','01010','10001','10001'],
  Y: ['10001','10001','01010','00100','00100','00100','00100'],
  Z: ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'],
  '/': ['00001','00010','00010','00100','01000','01000','10000'],
  ':': ['00000','00110','00110','00000','00110','00110','00000'],
}
const drawText = (value, x, y, scale, colour, align = 'left') => {
  const characters = Array.from(value.toUpperCase())
  const width = Math.max(0, (characters.length * 6 - 1) * scale)
  const startX = align === 'center'
    ? Math.round(x - width / 2)
    : align === 'right'
      ? x - width
      : x
  for (let characterIndex = 0; characterIndex < characters.length; characterIndex += 1) {
    const glyph = FONT[characters[characterIndex]] ?? FONT[' ']
    for (let row = 0; row < glyph.length; row += 1) {
      for (let column = 0; column < glyph[row].length; column += 1) {
        if (glyph[row][column] !== '1') continue
        fillRect(
          startX + (characterIndex * 6 + column) * scale,
          y + row * scale,
          scale,
          scale,
          colour,
        )
      }
    }
  }
}
const frame = (x, y, width, height, title) => {
  fillRect(x - 3, y - 42, width + 6, height + 45, [68, 83, 80, 255])
  fillRect(x, y, width, height, [22, 29, 29, 255])
  drawText(title, x + 14, y - 31, 3, [232, 220, 188, 255])
}

fillRect(0, 0, WIDTH, 82, [47, 59, 56, 255])
drawText('GATE A STYLE SLICE REVIEW', 40, 18, 6, [244, 228, 186, 255])
drawText('CURRENT RELEASE - USER APPROVAL PENDING', WIDTH - 40, 25, 4, [244, 213, 143, 255], 'right')

frame(40, 128, 1500, 475, 'FAITHFUL ENTRANCE - CURRENT CHURCH AND HERO')
blitContain(images.faithfulImage, 40, 128, 1500, 475)

frame(1580, 128, 580, 475, 'NORTH UP - 6 BAYS - NO PROPS')
blitContain(parkingDiagram, 1580, 128, 580, 330, [244, 239, 228, 255])
fillRect(1580, 458, 580, 145, [22, 29, 29, 255])
drawText('CROSS DRIVE AISLE 12.70 M', 1602, 480, 2, [244, 213, 143, 255])
drawText('CENTRAL TREE NONE', 1602, 520, 2, [164, 184, 178, 255])
drawText('ENTRANCE PLANTER AND BOARD NONE', 1602, 554, 2, [164, 184, 178, 255])
drawText('WHEEL STOPS INSIDE', 1602, 580, 2, [164, 184, 178, 255])

frame(40, 650, 1050, 880, 'CURRENT HERO - FOURTEEN MOTION POSES')
blitContain(images.heroAnimation, 40, 650, 1050, 880)
frame(1120, 650, 1040, 400, 'CURRENT HERO - FOUR VIEW SILHOUETTE')
blitContain(images.heroTurntable, 1120, 650, 1040, 400)
frame(1120, 1090, 500, 440, 'ACTUAL R9 HERO LOOK')
blitContain(images.heroPicker, 1120, 1090, 500, 440)
frame(1650, 1090, 510, 440, 'FACE GEOMETRY CHECK')
blitContain(images.heroFace, 1650, 1090, 510, 440)

frame(40, 1580, 1050, 520, 'CURRENT HERO - WALK CYCLE THREE VIEWS')
blitContain(images.heroWalk, 40, 1580, 1050, 520)
frame(1120, 1580, 1040, 520, 'CURRENT HERO - RUN CYCLE THREE VIEWS')
blitContain(images.heroRun, 1120, 1580, 1040, 520)

drawText('CURRENT GATE A SCORE - USER APPROVAL PENDING', 40, 2160, 4, [244, 228, 186, 255])
scoreDimensions.forEach(([label], index) => {
  const column = index % 3
  const row = Math.floor(index / 3)
  const x = 40 + column * 720
  const y = 2205 + row * 120
  fillRect(x, y, 680, 92, [47, 59, 56, 255])
  drawText(label, x + 22, y + 16, 3, [217, 225, 218, 255])
  drawText('PENDING / 2', x + 650, y + 50, 3, [244, 213, 143, 255], 'right')
})
drawText('PASS REQUIRES 10/12 - NO ZERO - FUNCTION PERFORMANCE AND USER APPROVAL ARE SEPARATE', 1100, 2470, 3, [174, 193, 186, 255], 'center')

const png = encodePng(WIDTH, HEIGHT, pixels)
await mkdir(reviewRoot, { recursive: true })
await writeFile(outputPng, png)
const report = {
  schemaVersion: 1,
  status: 'awaiting-user-visual-scoring',
  release: 'gate-a-baseline-r9',
  sourceEvidence: Object.fromEntries(Object.entries(evidence).map(([name, entry]) => [
    name,
    {
      path: entry.path.slice(repositoryRoot.length + 1).replaceAll('\\', '/'),
      sha256: entry.sha256,
    },
  ])),
  invariants: {
    exactChurchAssetPreserved: true,
    churchAssetChanged: false,
    layoutAuthority: parkingReport.referenceAuthority.layoutRelationships,
    overheadDiagramEmbeddedFromAuthoritativeSvg: true,
    overheadDiagramMode: parkingDiagram.mode,
    parkingSvgSha256: evidence.parkingSvg.sha256,
    gateRightBays: 6,
    entryRightSeparatedFromCentralParking: true,
    centralCrossAisleHasNoPlantingIsland: true,
    entranceHasNoPhysicalPlantersOrWelcomeBoards: true,
    currentHero: heroManifest.visualVariant,
    currentHeroAnimation: heroManifest.animationVariant,
    currentHeroHighSha256: CURRENT_HERO_HIGH_SHA256,
    currentHeroTriangles: heroManifest.lods.find((entry) => entry.lod === 'high').triangles,
    currentHeroSkinTone: heroManifest.appearance.skinTone,
    currentHeroRuntimeReferenced: true,
    currentHeroStatus: 'released-manifest-matched',
    currentHeroDeterministicEvidenceHashesMatched: true,
    historicalRejectedCandidate: historicalV4Manifest.visualVariant,
    historicalRejectedCandidateHighSha256: HISTORICAL_V4_HIGH_SHA256,
    historicalRejectedCandidateRuntimeReferenced: false,
    historicalRejectedCandidateStatus: 'user-rejected-not-runtime',
  },
  visualScoring: {
    scale: '0-2',
    requiredTotal: 10,
    maximumTotal: 12,
    zeroScoreAllowed: false,
    dimensions: visualScoreDimensions,
    total: null,
    userApproved: false,
  },
  output: {
    png: '.tmp/virtual-church-art-direction/gate-a-style-slice-review/gate-a-style-slice-review.png',
    width: WIDTH,
    height: HEIGHT,
    bytes: png.length,
    sha256: sha256(png),
    rawRgbaSha256: sha256(pixels),
  },
  parkingDiagram: {
    mode: parkingDiagram.mode,
    sourceCrop: parkingDiagram.sourceCrop,
    sourceSvgSha256: evidence.parkingSvg.sha256,
    textRenderedFromSvg: false,
  },
  limitations: [
    'This sheet assembles existing deterministic evidence; it does not create or approve a new church design.',
    'The parking panel deterministically rasterizes controlled geometry from the machine-checked overhead SVG; the full SVG remains the coordinate audit authority for labels and dimensions.',
    'The actual-release-look panel is an unretouched PNG decode of the current r9 picker WebP; both source and local review-derivative hashes are locked by this sheet.',
    'The remaining Hero panels use the current released r9 skinned geometry and animation clips; the deterministic technical renderer does not reproduce embedded WebP face, hair, eye, or wardrobe texture pixels.',
    'The real browser renderer remains the visual authority for beauty, material finish, responsive composition, and final user scoring.',
    'The rejected V4 study is checked only as historical non-runtime isolation evidence and is intentionally not displayed as the current design.',
    'All six visual scores and overall approval remain unset and must not be inferred from machine checks.',
    'Browser function, matched performance, and real-device evidence remain independent Gate A requirements.',
  ],
  gateAPassed: false,
  passed: true,
}
await writeFile(outputReport, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
