import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const referenceDefinitions = [
  {
    id: 'hero-visual-target-v1',
    role: 'beauty-and-costume-direction',
    path: '.tmp/virtual-church-art-direction/hero-visual-target-v1/hero-visual-target.png',
    sha256: '88cd4245da0d50e4c10d1dc0fcf96d5b395b643fbdcc80e7b23f3db826a386f4',
    dimensions: [1536, 1024],
  },
  {
    id: 'hero-turnaround-v1',
    role: 'orthographic-front-left-back',
    path: '.tmp/virtual-church-art-direction/hero-visual-target-v1/hero-turnaround-v1.png',
    sha256: 'aa4aa2a67380a050b7f3fa66ccb504fc7d3f4598117fa20a47895362aab29da2',
    dimensions: [1536, 1024],
  },
  {
    id: 'hero-face-hair-expression-v1',
    role: 'face-profile-hair-expression-detail',
    path: '.tmp/virtual-church-art-direction/hero-visual-target-v1/hero-face-hair-expression-v1.png',
    sha256: '9cf0e9881523cd4199c47b4bc2d82b9dcd6c29d0137cc73c6d8f0815c34a9350',
    dimensions: [1536, 1024],
  },
  {
    id: 'hero-costume-material-props-v1',
    role: 'costume-material-footwear-journal-detail',
    path: '.tmp/virtual-church-art-direction/hero-visual-target-v1/hero-costume-material-props-v1.png',
    sha256: '4cdf7bedd26c12c85f241ecd557ccf4ac5eb0e4628b886af9fc502c8fd8774e5',
    dimensions: [1536, 1024],
  },
]
const planPath = resolve(repositoryRoot, 'docs', 'virtual-church-visual-upgrade-plan.zh-CN.md')
const runtimePaths = [
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'src', 'views', 'VirtualChurchView.tsx'),
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'src', 'services', 'virtualChurchService.ts'),
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'vite.config.ts'),
  resolve(repositoryRoot, 'cloudflare', 'alife-app', 'public', 'virtual-church-cache-maintenance.js'),
]

const [referenceBuffers, plan, runtimeSources] = await Promise.all([
  Promise.all(referenceDefinitions.map((item) => readFile(resolve(repositoryRoot, item.path)))),
  readFile(planPath, 'utf8'),
  Promise.all(runtimePaths.map((path) => readFile(path, 'utf8'))),
])

const errors = []
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const references = referenceDefinitions.map((definition, index) => {
  const png = referenceBuffers[index]
  const sha256 = createHash('sha256').update(png).digest('hex')
  const width = png.readUInt32BE(16)
  const height = png.readUInt32BE(20)
  if (!png.subarray(0, 8).equals(pngSignature)) errors.push(`${definition.id} is not a PNG`)
  if (width !== definition.dimensions[0] || height !== definition.dimensions[1]) {
    errors.push(`${definition.id} dimensions changed: ${width}x${height}`)
  }
  if (sha256 !== definition.sha256) errors.push(`${definition.id} SHA-256 changed: ${sha256}`)
  return {
    id: definition.id,
    role: definition.role,
    path: definition.path,
    sha256,
    bytes: png.length,
    dimensions: [width, height],
  }
})

const forbiddenRuntimeFragments = referenceDefinitions.flatMap((item) => [
  item.id,
  basename(item.path),
  item.sha256,
])
for (const fragment of forbiddenRuntimeFragments) {
  if (runtimeSources.some((source) => source.includes(fragment))) {
    errors.push(`concept-only visual reference leaked into runtime source: ${fragment}`)
  }
}

for (const fragment of [
  ...referenceDefinitions.flatMap((item) => [item.id, item.sha256]),
  'user-rejected-not-runtime',
  '当前没有达到该视觉目标的合格 3D Hero 候选',
]) {
  if (!plan.includes(fragment)) errors.push(`master plan lost visual-target contract: ${fragment}`)
}

const primary = references[0]
const report = {
  schemaVersion: 2,
  target: primary.id,
  path: primary.path,
  sha256: primary.sha256,
  bytes: primary.bytes,
  dimensions: primary.dimensions,
  modelingReferences: references.slice(1),
  referenceCount: references.length,
  purpose: 'concept-only-quality-and-modeling-reference-set',
  threeDCandidateAvailable: false,
  runtimeReferenced: false,
  userRejectedCandidate: 'face-readability-candidate-v4',
  qualityBar: {
    firstImpressionMustBeBeautiful: true,
    adultStylizedAppeal: true,
    identityConsistencyAcrossReferencesRequired: true,
    layeredEyesAndFace: true,
    sculptedHairSilhouette: true,
    naturalBodyAndHands: true,
    designedClothingAndMaterials: true,
    blockyProceduralBaselineAccepted: false,
  },
  errors,
  passed: errors.length === 0,
}

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.passed) process.exitCode = 1
