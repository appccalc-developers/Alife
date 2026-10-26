import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { Bone, Box3, BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, PerspectiveCamera, SkinnedMesh, Vector3 } from 'three'
import { createSeatedStudyCompanion, STUDY_COMPANION_SEATS } from '../src/views/virtualChurchStudyPose.ts'
import { STUDY_CAMERA_FOV, studyCameraFraming, studyFramingPoints } from '../src/views/virtualChurchStudyCamera.ts'
import { buildStudyFurnitureBatches } from '../src/views/virtualChurchStudyFurniture.ts'
import { startStudyMotionLoop, type StudyMotionHost } from '../src/views/virtualChurchStudyMotion.ts'
import { fetchStudyRoomSource, loadStudyRoomSourcePair, startStudyRoomLoad } from '../src/views/virtualChurchStudyLoading.ts'
import { gatheringTableColumnHeaders, readHomeGatheringSectionHtml } from '../src/views/virtualChurchGatheringsContent.ts'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { decompressCharacterDraco } from '../../../tools/virtual-church/gate-a-character-geometry.mjs'

const viewSource = () => readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))

test('study rendering respects the frozen device preset without adding a continuous render loop', async () => {
  const source = await viewSource()
  assert.match(source, /const \[performancePreset\] = useState\(\(\) => getPerformanceConfig\(\)\)/)
  assert.match(source, /<Canvas frameloop="demand" shadows="percentage" dpr=\{\[1, performancePreset\.maxDevicePixelRatio\]\}/)
  assert.match(source, /shadow-mapSize=\{\[shadowMapSize, shadowMapSize\]\}/)
  assert.match(source, /shadowMapSize=\{Math\.min\(1024, performancePreset\.shadowMapSize\)\}/)
  assert.match(source, /gl\.shadowMap\.autoUpdate = false/)
  assert.doesNotMatch(source, /shadows="soft"|dpr=\{\[1, 1\.25\]\}|shadow-mapSize=\{\[1024, 1024\]\}/)
  assert.match(source, /const motionDiagnostic = new URLSearchParams\(window\.location\.search\)\.has\('profile3d'\)/)
  assert.match(source, /if \(import\.meta\.env\.DEV \|\| motionDiagnostic\) gl\.domElement\.dataset\.studyMotionSeconds/)
  assert.match(source, /stop\(\); delete gl\.domElement\.dataset\.studyMotionSeconds/)
})

test('room failure retires owned loading and removes its Canvas until explicit retry', async () => {
  const source = await viewSource()
  assert.match(source, /\{!failed \? <RoomCanvasBoundary/)
  assert.match(source, /<\/RoomCanvasBoundary> : null\}/)
  assert.match(source, /setCompanions\(\[\]\)[\s\S]*?if \(failed\) return/)
  assert.match(source, /return attempt\.cancel[\s\S]*?\}, \[revision, maleReviewPath, failed\]\)/)
  assert.match(source, /setFailed\(false\); setRevision\(value => value \+ 1\)/)
  assert.match(source, /virtualChurchShouldReportContextLoss\(canvasConnected, pageRef\.current\?\.querySelector\('canvas'\) === gl\.domElement\)/)
  assert.match(source, /contextLossInjections\.current < contextLossLimit/)
  assert.match(source, /window\.clearTimeout\(contextLossTimer\.current\)/)
})

test('both study cameras frame every seat, book and foot across actual canvas aspect ratios', () => {
  for (const [width, height] of [[1280, 582], [844, 252], [390, 654], [320, 550], [1024, 630]]) {
    for (const overview of [false, true]) {
      const framing = studyCameraFraming(width, height, overview)
      const camera = new PerspectiveCamera(STUDY_CAMERA_FOV, width / height, .1, 40)
      camera.position.copy(framing.position); camera.lookAt(framing.target); camera.updateMatrixWorld(true)
      const projected = studyFramingPoints(overview).map(point => point.project(camera))
      for (const point of projected) {
        assert.ok(Math.abs(point.x) <= .92001 && Math.abs(point.y) <= .92001, `${width}x${height} overview=${overview}`)
        assert.ok(point.z > -1 && point.z < 1)
      }
      // At least one dimension uses the available space, not a distant miniature group.
      assert.ok(Math.max(...projected.flatMap(point => [Math.abs(point.x), Math.abs(point.y)])) > .91)
    }
  }
})

test('study camera handles an unmeasured canvas and does not mutate shared seat locations', () => {
  const before = JSON.stringify(STUDY_COMPANION_SEATS)
  for (const [width, height] of [[0, 0], [NaN, 500], [300, Infinity]]) {
    assert.ok(studyCameraFraming(width, height, true).position.toArray().every(Number.isFinite))
  }
  assert.equal(JSON.stringify(STUDY_COMPANION_SEATS), before)
})

test('real r9 Low seated geometry stays inside the framing envelope, without writing an asset', async () => {
  const bytes = await readFile(new URL('../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/characters/character-hero-female-low.glb', import.meta.url))
  const decoded = await decompressCharacterDraco(bytes), length = decoded.readUInt32LE(12)
  const document = JSON.parse(decoded.subarray(20, 20 + length).toString())
  const binary = decoded.subarray(length + 28)
  // Geometry-only check: strip images in memory, never use this parse for colour QA.
  document.materials = document.materials.map((material: { name: string }) => ({ name: material.name }))
  delete document.images; delete document.textures
  const text = Buffer.from(JSON.stringify(document)), json = Buffer.alloc(Math.ceil(text.length / 4) * 4, 32)
  text.copy(json)
  const header = Buffer.alloc(20), binaryHeader = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8)
  header.writeUInt32LE(json.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  binaryHeader.writeUInt32LE(binary.length); binaryHeader.writeUInt32LE(0x004e4942, 4)
  const file = Buffer.concat([header, json, binaryHeader, binary])
  const source = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.length), '')
  const companion = createSeatedStudyCompanion(source.scene, '#ffffff', 4)
  let seatedShoeGeometryDisposals = 0
  try {
    const skeletons = new Set()
    let skinnedParts = 0
    companion.model.traverse(node => {
      if (node instanceof SkinnedMesh) { skinnedParts++; skeletons.add(node.skeleton) }
    })
    assert.equal(skinnedParts, 18, 'check every material part in the actual released Low asset')
    assert.equal(skeletons.size, 1, 'one seated person needs only one identical bone buffer')
    companion.model.updateMatrixWorld(true)
    const shoe = (root: Object3D) => {
      let found: Mesh | undefined
      root.traverse(node => {
        if (node instanceof Mesh && !Array.isArray(node.material)
          && node.material.name.includes('Shoes_01_CLOTH')) found = node
      })
      assert.ok(found, 'the released Low model has a separate shoe mesh')
      return found
    }
    const originalShoe = shoe(source.scene), seatedShoe = shoe(companion.model)
    seatedShoe.geometry.addEventListener('dispose', () => { seatedShoeGeometryDisposals++ })
    const originalShoeIndices = originalShoe.geometry.getIndex()!.count
    const seatedShoeIndex = seatedShoe.geometry.getIndex()!
    assert.notEqual(seatedShoe.geometry, originalShoe.geometry, 'trim only the room-owned shoe geometry')
    assert.ok(seatedShoeIndex.count > 0 && seatedShoeIndex.count < originalShoeIndices)
    assert.equal(originalShoe.geometry.getIndex()!.count, originalShoeIndices)
    assert.equal(seatedShoe.castShadow, true, 'visible shoes and shadow use the same trimmed triangles')
    for (let index = 0; index < seatedShoeIndex.count; index++) {
      const point = seatedShoe.getVertexPosition(seatedShoeIndex.getX(index), new Vector3()).applyMatrix4(seatedShoe.matrixWorld)
      assert.ok(point.y <= .15001, `shoe decoration reaches above the ankle: ${point.y}`)
    }
    let vertices = 0
    const bounds = new Box3()
    companion.model.traverse(node => {
      if (!(node instanceof Mesh)) return
      for (let index = 0; index < node.geometry.getAttribute('position').count; index++) {
        const point = node.getVertexPosition(index, new Vector3()).applyMatrix4(node.matrixWorld)
        bounds.expandByPoint(point)
        vertices++
      }
    })
    assert.ok(bounds.min.x >= -.42 && bounds.max.x <= .42 && bounds.max.y <= 1.6 && bounds.min.z >= -.35 && bounds.max.z <= .85, `seated bounds ${JSON.stringify(bounds)}`)
    assert.ok(bounds.min.y >= .01 && bounds.min.y <= .035, `soles must meet the .01 m rug without sinking or floating: ${bounds.min.y}`)
    assert.ok(vertices > 5000, 'check the actual skinned asset, not a placeholder')
    const point = (name: string) => companion.model.getObjectByName(name)!.getWorldPosition(new Vector3())
    const hands = ['L', 'R'].map(side => point(`J_Bip_${side}_Hand`))
    const feet = ['L', 'R'].map(side => point(`J_Bip_${side}_Foot`))
    let maximumHandDrift = 0, maximumVertexDrift = 0
    const restVertices: Vector3[] = []
    companion.model.traverse(node => {
      if (node instanceof Mesh) for (let index = 0; index < node.geometry.getAttribute('position').count; index++) restVertices.push(node.getVertexPosition(index, new Vector3()).applyMatrix4(node.matrixWorld))
    })
    // Sample every seat's phase/rate for 15 s using the real rig and skinned mesh.
    const { createStudyCompanionMotion } = await import('../src/views/virtualChurchStudyMotion.ts')
    for (let seat = 0; seat < 5; seat++) {
      companion.updateMotion(0)
      const animate = createStudyCompanionMotion(companion.model, seat)
      for (let seconds = 0; seconds <= 15; seconds += .25) {
        animate(seconds); companion.model.updateMatrixWorld(true)
        const movingBounds = new Box3()
        let vertex = 0
        companion.model.traverse(node => {
          if (!(node instanceof Mesh)) return
          for (let index = 0; index < node.geometry.getAttribute('position').count; index++) {
            const current = node.getVertexPosition(index, new Vector3()).applyMatrix4(node.matrixWorld)
            movingBounds.expandByPoint(current)
            maximumVertexDrift = Math.max(maximumVertexDrift, current.distanceTo(restVertices[vertex++]))
          }
        })
        assert.ok(movingBounds.min.y >= .01 && movingBounds.min.y <= .035)
        assert.ok(movingBounds.min.x >= -.42 && movingBounds.max.x <= .42 && movingBounds.max.y <= 1.6 && movingBounds.min.z >= -.35 && movingBounds.max.z <= .85)
        for (const [index, side] of ['L', 'R'].entries()) {
          assert.ok(point(`J_Bip_${side}_Foot`).distanceTo(feet[index]) < 1e-8, 'feet must not bob')
          maximumHandDrift = Math.max(maximumHandDrift, point(`J_Bip_${side}_Hand`).distanceTo(hands[index]))
        }
      }
    }
    assert.ok(maximumVertexDrift > .001 && maximumVertexDrift < .015, `subtle actual skin motion: ${maximumVertexDrift}`)
    assert.ok(maximumHandDrift < .004, `hands stay within 4 mm of the fixed book grip: ${maximumHandDrift}`)
    companion.updateMotion(0)
  } finally {
    companion.dispose()
    source.scene.traverse(node => {
      if (!(node instanceof Mesh)) return
      node.geometry.dispose()
      for (const material of Array.isArray(node.material) ? node.material : [node.material]) material.dispose()
    })
  }
  assert.equal(seatedShoeGeometryDisposals, 1, 'the room frees its shoe geometry without releasing the shared source')
})

test('motion loop caps requests, stops in background, resumes without wall-time jumps and cleans up', () => {
  let now = 0, hidden = false, serial = 0, listener: (() => void) | undefined
  const timers = new Map<number, () => void>(), deltas: number[] = []
  const host: StudyMotionHost = {
    now: () => now, hidden: () => hidden,
    schedule: (callback, delay) => { assert.equal(delay, 1000 / 24); timers.set(++serial, callback); return serial },
    cancel: id => { timers.delete(id) },
    listen: callback => { listener = callback; return () => { listener = undefined } },
  }
  const fire = (milliseconds: number) => {
    now += milliseconds
    const [id, callback] = [...timers.entries()][0]; timers.delete(id); callback()
  }
  const stop = startStudyMotionLoop(host, delta => deltas.push(delta))
  fire(1000 / 24); assert.equal(deltas.length, 1); assert.equal(timers.size, 1)
  hidden = true; listener!(); assert.equal(timers.size, 0)
  now += 120000; hidden = false; listener!(); fire(1000 / 24)
  assert.ok(Math.abs(deltas[1] - 1 / 24) < 1e-10)
  fire(10000); assert.equal(deltas[2], .1, 'late callback cannot skip ahead')
  const queued = [...timers.values()][0]
  stop(); stop(); queued()
  assert.equal(timers.size, 0); assert.equal(listener, undefined); assert.equal(deltas.length, 3)
  hidden = true
  const stopHidden = startStudyMotionLoop(host, () => assert.fail('hidden start must not run'))
  assert.equal(timers.size, 0); stopHidden()
})

test('breathing is deterministic, non-accumulating and only mutates the room copy', () => {
  const { source, mesh, material } = makeRig()
  source.updateMatrixWorld(true)
  const before = JSON.stringify(source.toJSON())
  const companions = STUDY_COMPANION_SEATS.map((seat, index) => createSeatedStudyCompanion(source, seat.tint, index))
  const head = (index: number) => companions[index].model.getObjectByName('J_Bip_C_Head')!
  const rest = head(0).quaternion.clone()
  companions.forEach(item => item.updateMotion(3))
  const atThree = head(0).quaternion.clone()
  assert.ok(atThree.angleTo(head(1).quaternion) > .001, 'different phases, not synchronized nodding')
  companions[0].updateMotion(10000); companions[0].updateMotion(3)
  assert.ok(atThree.angleTo(head(0).quaternion) < 1e-7)
  for (const invalid of [0, -1, NaN, Infinity]) {
    companions[0].updateMotion(invalid)
    assert.ok(rest.angleTo(head(0).quaternion) < 1e-7)
  }
  assert.equal(JSON.stringify(source.toJSON()), before)
  companions.forEach(item => item.dispose()); mesh.geometry.dispose(); material.dispose()
})

// Small owned rig fixture; no binary exports or changes to approved assets.
function makeRig() {
  const source = new Object3D()
  const material = new MeshStandardMaterial({ color: '#aaccaa' })
  material.name = 'M_VC3_HeroFemale_Outfit'
  const mesh = new Mesh(new BoxGeometry(.5, 1.72, .3), material)
  mesh.position.y = .86
  source.add(mesh)
  const joint = (parent: Object3D, name: string, position: [number, number, number]) => {
    const bone = new Bone(); bone.name = name; bone.position.set(...position); parent.add(bone); return bone
  }
  const hips = joint(source, 'J_Bip_C_Hips', [0, .99, 0])
  const chest = joint(hips, 'chest', [0, .3, 0])
  joint(chest, 'J_Bip_C_Head', [0, .3, 0])
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    const leg = joint(hips, `J_Bip_${side}_UpperLeg`, [sign * .09, 0, 0])
    const knee = joint(leg, `J_Bip_${side}_LowerLeg`, [0, -.38, 0])
    joint(knee, `J_Bip_${side}_Foot`, [0, -.445, 0])
    const arm = joint(chest, `J_Bip_${side}_UpperArm`, [sign * .16, .1, 0])
    const elbow = joint(arm, `J_Bip_${side}_LowerArm`, [sign * .23, 0, 0])
    joint(elbow, `J_Bip_${side}_Hand`, [sign * .23, 0, 0])
  }
  return { source, mesh, material }
}

test('five distinct companions face the centre and leave a sixth visitor position', () => {
  assert.equal(STUDY_COMPANION_SEATS.length, 5)
  assert.equal(new Set(STUDY_COMPANION_SEATS.map(seat => seat.tint)).size, 5)
  assert.equal(new Set(STUDY_COMPANION_SEATS.map(seat => seat.hairTint)).size, 5)
  for (const [index, seat] of STUDY_COMPANION_SEATS.entries()) {
    const position = new Vector3(...seat.position)
    assert.ok(Math.abs(position.length() - 2.15) < 1e-8)
    const forward = new Vector3(0, 0, 1).applyAxisAngle(new Vector3(0, 1, 0), seat.yaw)
    assert.ok(forward.dot(position.clone().negate().normalize()) > .999)
    assert.ok(position.distanceTo(new Vector3(0, 0, 2)) > 1.5)
    for (const other of STUDY_COMPANION_SEATS.slice(index + 1)) assert.ok(position.distanceTo(new Vector3(...other.position)) > 1.5)
  }
})

test('retiring the owner during a motion update cannot enqueue another timeout', () => {
  let now = 0, queued: (() => void) | undefined, stop = () => {}
  stop = startStudyMotionLoop({
    now: () => now, hidden: () => false,
    schedule: callback => { queued = callback; return 1 },
    cancel: () => { queued = undefined }, listen: () => () => {},
  }, () => stop())
  now = 50
  const callback = queued!; queued = undefined; callback()
  assert.equal(queued, undefined)
})

test('becoming hidden during an update stops scheduling until visibility resumes', () => {
  let now = 0, hidden = false, queued: (() => void) | undefined, listener: (() => void) | undefined
  const deltas: number[] = []
  const stop = startStudyMotionLoop({
    now: () => now, hidden: () => hidden,
    schedule: callback => { assert.equal(queued, undefined); queued = callback; return 1 },
    cancel: () => { queued = undefined }, listen: callback => { listener = callback; return () => { listener = undefined } },
  }, delta => { deltas.push(delta); hidden = true })
  now = 50
  const callback = queued!; queued = undefined; callback()
  assert.equal(queued, undefined)
  now += 120000; hidden = false; listener!()
  now += 50
  const resumed = queued!; queued = undefined; resumed()
  stop()
  assert.deepEqual(deltas, [.05, .05])
  assert.equal(queued, undefined)
  assert.equal(listener, undefined)
})

test('study companions vary hair and clothes without tinting approved fair skin or the shared source', () => {
  const { source, mesh, material } = makeRig()
  material.name = 'N00_000_00_Body_00_CLOTH_01 (Instance)'
  mesh.name = 'outfit-mesh'
  const hairMaterial = new MeshStandardMaterial({ color: '#ffffff' })
  hairMaterial.name = 'N00_000_Hair_00_HAIR_01 (Instance)'
  const hair = new Mesh(new BoxGeometry(.18, .18, .18), hairMaterial)
  hair.name = 'hair-mesh'; hair.position.y = 1.6; source.add(hair)
  const skinMaterial = new MeshStandardMaterial({ color: '#d6a991' })
  skinMaterial.name = 'N00_000_00_Face_00_SKIN (Instance)'
  const skin = new Mesh(new BoxGeometry(.16, .16, .16), skinMaterial)
  skin.name = 'skin-mesh'; skin.position.y = 1.45; source.add(skin)
  const shoeMaterial = new MeshStandardMaterial({ color: '#d8b681' })
  shoeMaterial.name = 'N00_008_01_Shoes_01_CLOTH (Instance)'
  const shoes = new Mesh(new BoxGeometry(.16, .08, .24), shoeMaterial)
  shoes.name = 'shoe-mesh'; shoes.position.y = .04; source.add(shoes)
  const trimMaterial = new MeshStandardMaterial({ color: '#e3c792' })
  trimMaterial.name = 'N00_002_03_Tops_01_CLOTH_02 (Instance)'
  const trim = new Mesh(new BoxGeometry(.16, .04, .16), trimMaterial)
  trim.name = 'trim-mesh'; trim.position.y = 1.2; source.add(trim)
  source.updateMatrixWorld(true)
  const companions = STUDY_COMPANION_SEATS.map((seat, index) => createSeatedStudyCompanion(source, seat.tint, index))
  try {
    const colour = (index: number, name: string) => ((companions[index].model.getObjectByName(name) as Mesh).material as MeshStandardMaterial).color.getHexString()
    assert.equal(new Set(companions.map((_, index) => colour(index, 'outfit-mesh'))).size, 5)
    assert.equal(new Set(companions.map((_, index) => colour(index, 'hair-mesh'))).size, 5)
    assert.ok(companions.every((_, index) => colour(index, 'shoe-mesh') === 'd8b681'), 'approved shoe colour stays independent of the garment tint')
    assert.ok(companions.every((_, index) => colour(index, 'trim-mesh') === 'e3c792'), 'approved trim colour stays independent of the garment tint')
    const fabric = (companions[0].model.getObjectByName('outfit-mesh') as Mesh).material as MeshStandardMaterial
    const shader = { uniforms: {} as Record<string, { value: unknown }>, fragmentShader: '#include <color_fragment>' }
    ;(fabric.onBeforeCompile as (shader: typeof shader) => void)(shader)
    assert.equal(fabric.customProgramCacheKey(), 'study-companion-fabric-v1')
    assert.equal((shader.uniforms.studyFabricTint.value as { getHexString: () => string }).getHexString(), '718f82')
    assert.match(shader.fragmentShader, /diffuseColor\.rgb = mix\(diffuseColor\.rgb, studyFabricTint/)
    for (const companion of companions) {
      const skinCopy = (companion.model.getObjectByName('skin-mesh') as Mesh).material
      assert.ok(skinCopy instanceof MeshBasicMaterial)
      assert.equal(skinCopy.color.getHexString(), 'ffffff')
      assert.equal(skinCopy.toneMapped, false)
    }
    assert.equal(material.color.getHexString(), 'aaccaa')
    assert.equal(hairMaterial.color.getHexString(), 'ffffff')
    assert.equal(skinMaterial.color.getHexString(), 'd6a991')
  } finally {
    companions.forEach(companion => companion.dispose())
    for (const item of [mesh, hair, skin, shoes, trim]) item.geometry.dispose()
    for (const item of [material, hairMaterial, skinMaterial, shoeMaterial, trimMaterial]) item.dispose()
  }
})

test('reading pose bends knees, holds the book between hands and does not edit the source', () => {
  const { source, mesh, material } = makeRig()
  source.updateMatrixWorld(true)
  const before = JSON.stringify(source.toJSON())
  const companions = STUDY_COMPANION_SEATS.map(seat => createSeatedStudyCompanion(source, seat.tint))
  assert.equal(JSON.stringify(source.toJSON()), before)
  const getPoint = (model: Object3D, name: string) => model.getObjectByName(name)!.getWorldPosition(new Vector3())
  for (const companion of companions) {
    assert.notEqual(companion.model, source)
    assert.ok(Math.abs(getPoint(companion.model, 'J_Bip_C_Hips').y - .67) < 1e-5)
    for (const side of ['L', 'R']) {
      const thigh = getPoint(companion.model, `J_Bip_${side}_UpperLeg`)
      const knee = getPoint(companion.model, `J_Bip_${side}_LowerLeg`)
      const foot = getPoint(companion.model, `J_Bip_${side}_Foot`)
      assert.ok(knee.z - thigh.z > .3)
      assert.ok(knee.y - foot.y > .4)
    }
    const hands = getPoint(companion.model, 'J_Bip_L_Hand').add(getPoint(companion.model, 'J_Bip_R_Hand')).multiplyScalar(.5)
    assert.ok(new Vector3(...companion.book).distanceTo(hands) < .09)
    const cloneMesh = companion.model.children.find(node => node instanceof Mesh) as Mesh
    assert.equal(cloneMesh.geometry, mesh.geometry)
    assert.notEqual(cloneMesh.material, material)
    assert.equal(cloneMesh.castShadow, true)
    assert.equal(mesh.castShadow, false)
  }
  companions.forEach(item => item.dispose())
  mesh.geometry.dispose(); material.dispose()
})

test('disposing a companion frees its own materials exactly once, never borrowed geometry/materials', () => {
  const { source, mesh, material } = makeRig()
  let originalDisposals = 0, cloneDisposals = 0
  mesh.geometry.addEventListener('dispose', () => originalDisposals++)
  material.addEventListener('dispose', () => originalDisposals++)
  const companion = createSeatedStudyCompanion(source, '#ffffff')
  companion.model.traverse(node => {
    if (node instanceof Mesh) (node.material as MeshStandardMaterial).addEventListener('dispose', () => cloneDisposals++)
  })
  companion.dispose(); companion.dispose()
  assert.equal(cloneDisposals, 1); assert.equal(originalDisposals, 0)
  mesh.geometry.dispose(); material.dispose()
})

test('incompatible or empty assets fail before allocating a seated clone', () => {
  assert.throws(() => createSeatedStudyCompanion(new Object3D(), '#ffffff'), /missing/)
  const { source, mesh, material } = makeRig()
  source.remove(mesh)
  assert.throws(() => createSeatedStudyCompanion(source, '#ffffff'), /bounds/)
  mesh.geometry.dispose(); material.dispose()
})

test('room uses all five seats, demand rendering and an explicit non-live concept label', async () => {
  const source = await viewSource()
  const motionRender = source.slice(source.indexOf('const render = () => {'), source.indexOf('if (reducedMotion) {'))
  assert.doesNotMatch(motionRender, /shadowMap\.needsUpdate/,
    'breathing must not force a full five-character shadow pass on every demand frame')
  assert.match(source, /if \(reducedMotion\) \{[\s\S]*?gl\.shadowMap\.needsUpdate = true[\s\S]*?render\(\)/,
    'resetting a reduced-motion pose should refresh the static shadow once')
  assert.match(source, /STUDY_COMPANION_SEATS as seats/)
  assert.match(source, /count: seats.length/)
  assert.match(source, /clone: \(sources, index\) => createSeatedStudyCompanion\(/)
  assert.match(source, /sources\[index === 1 \|\| index === 3 \? 1 : 0\]/)
  assert.match(source, /seats.map\(\(seat, index\)/)
  assert.match(source, /buildStudyFurnitureBatches\(companions.map\(companion => companion.book\), overview\)/)
  assert.match(source, /furniture.map\(batch => <FurnitureBatch/)
  assert.match(source, /frameloop="demand"/)
  assert.match(source, /useVirtualChurchReducedMotion\(\)/)
  assert.match(source, /if \(!enabled \|\| reducedMotion \|\| !companions.length\) return/)
  assert.match(source, /const stop = startStudyMotionLoop/)
  assert.match(source, /return \(\) => \{ stop\(\)/)
  assert.match(source, /暂停同伴动作/)
  assert.match(source, /Pause companions/)
  assert.match(source, /非实时成员 · 场景为概念设计/)
  assert.match(source, /男女混合本地评审/)
  assert.match(source, /Local mixed-character review/)
  assert.match(source, /import\.meta\.env\.DEV[\s\S]*vcStudyReview/)
  assert.match(source, /loadStudyRoomSourcePair<GLTF>/)
  assert.match(source, /loadModel\(config\.characters\.gateAFemaleLow, signal\)/)
  assert.match(source, /disposeSource: sources => sources\.forEach\(source => disposeSource\(source\.scene\)\)/)
  assert.match(source, /return attempt.cancel/)
  assert.match(source, /navigate\('\/virtual-church\?vcArrival=study-room'\)/)
  assert.match(source, /返回门厅/)
  assert.match(source, /navigate\('\/study\?from=virtual-church-study-room'\)/)
})

test('optional second model preserves both sources until the room releases them', async () => {
  const controller = new AbortController()
  const disposed: string[] = []
  const pair = await loadStudyRoomSourcePair(
    controller.signal,
    async signal => { assert.equal(signal, controller.signal); return 'female' },
    async signal => { assert.equal(signal, controller.signal); return 'male' },
    source => disposed.push(source),
  )
  assert.deepEqual(pair, ['female', 'male'])
  assert.deepEqual(disposed, [])
})

test('optional second model failure releases the first decoded source', async () => {
  const disposed: string[] = []
  await assert.rejects(loadStudyRoomSourcePair(
    new AbortController().signal,
    async () => 'female',
    async () => { throw new Error('male model failed') },
    source => disposed.push(source),
  ), /male model failed/)
  assert.deepEqual(disposed, ['female'])
})

test('five mixed companions release both source models once on exit', async () => {
  const disposedSources: string[] = [], disposedCompanions: number[] = []
  let published = 0
  const attempt = startStudyRoomLoad({
    load: signal => loadStudyRoomSourcePair(
      signal,
      async () => 'female',
      async () => 'male',
      source => disposedSources.push(source),
    ),
    count: 5,
    clone: (sources, index) => {
      assert.equal(sources[index === 1 || index === 3 ? 1 : 0], index === 1 || index === 3 ? 'male' : 'female')
      return { dispose: () => disposedCompanions.push(index) }
    },
    disposeSource: sources => sources.forEach(source => disposedSources.push(source)),
    disposeDecoder: () => {},
    ready: () => { published++ },
    failed: () => assert.fail('both models loaded'),
  })
  await attempt.settled
  assert.equal(published, 1)
  attempt.cancel(); attempt.cancel()
  assert.deepEqual(disposedCompanions, [0, 1, 2, 3, 4])
  assert.deepEqual(disposedSources, ['female', 'male'])
})

function studyLoadHarness(failClone = -1) {
  const source = { id: Symbol('owned source') }
  let resolve!: (value: typeof source) => void, reject!: (reason: Error) => void
  const pending = new Promise<typeof source>((ok, fail) => { resolve = ok; reject = fail })
  let signal!: AbortSignal, expire!: () => void
  const disposed: number[] = [], counts = { source: 0, decoder: 0, ready: 0, failed: 0 }
  const attempt = startStudyRoomLoad({
    load: value => { signal = value; return pending }, count: 5,
    clone: (value, index) => {
      assert.equal(value, source)
      if (index === failClone) throw new Error('clone failure')
      return { dispose: () => { disposed.push(index) } }
    },
    disposeSource: value => { assert.equal(value, source); counts.source++ },
    disposeDecoder: () => { counts.decoder++ },
    ready: companions => { assert.equal(companions.length, 5); counts.ready++ },
    failed: () => { counts.failed++ }, deadline: callback => { expire = callback; return () => {} },
  })
  return { attempt, source, resolve, reject, signal, expire, counts, disposed }
}

test('successful five-person load retains resources until exit and ignores stale deadlines', async () => {
  const h = studyLoadHarness()
  h.resolve(h.source); await h.attempt.settled
  h.expire()
  assert.deepEqual(h.counts, { source: 0, decoder: 1, ready: 1, failed: 0 })
  assert.deepEqual(h.disposed, [])
  h.attempt.cancel(); h.attempt.cancel()
  assert.equal(h.signal.aborted, true)
  assert.deepEqual(h.disposed, [0, 1, 2, 3, 4]); assert.equal(h.counts.source, 1)
})

test('partial companion creation failure immediately frees owned clones and source', async () => {
  const h = studyLoadHarness(2)
  h.resolve(h.source); await h.attempt.settled
  assert.deepEqual(h.disposed, [0, 1])
  assert.deepEqual(h.counts, { source: 1, decoder: 1, ready: 0, failed: 1 })
  h.expire(); h.attempt.cancel()
  assert.equal(h.counts.source, 1); assert.equal(h.counts.failed, 1)
})

test('exiting during decode discards late results without publishing or interrupting the decoder', async () => {
  const h = studyLoadHarness()
  h.attempt.cancel(); h.expire()
  assert.equal(h.signal.aborted, true); assert.equal(h.counts.decoder, 0)
  h.resolve(h.source); await h.attempt.settled
  assert.deepEqual(h.counts, { source: 1, decoder: 1, ready: 0, failed: 0 })
  assert.deepEqual(h.disposed, [])
})

test('deadline fails once, aborts download and rejects late success; retry has separate ownership', async () => {
  const old = studyLoadHarness()
  old.expire(); old.expire()
  assert.equal(old.signal.aborted, true)
  assert.deepEqual(old.counts, { source: 0, decoder: 0, ready: 0, failed: 1 })
  const next = studyLoadHarness()
  old.attempt.cancel()
  assert.equal(next.signal.aborted, false)
  next.resolve(next.source); await next.attempt.settled
  old.resolve(old.source); await old.attempt.settled
  assert.deepEqual(old.counts, { source: 1, decoder: 1, ready: 0, failed: 1 })
  assert.deepEqual(next.counts, { source: 0, decoder: 1, ready: 1, failed: 0 })
  next.attempt.cancel()
})

test('request rejection reports failure but an aborted unmounted request does not', async () => {
  for (const cancelled of [false, true]) {
    const h = studyLoadHarness()
    if (cancelled) h.attempt.cancel()
    h.reject(new Error('download failed')); await h.attempt.settled
    assert.deepEqual(h.counts, { source: 0, decoder: 1, ready: 0, failed: cancelled ? 0 : 1 })
    h.attempt.cancel()
  }
})

test('owned HTTP stream aborts while a simultaneous same-URL retry remains usable', { timeout: 5000 }, async () => {
  let received!: () => void, closed!: () => void, requests = 0, parses = 0
  const firstReceived = new Promise<void>(resolve => { received = resolve })
  const firstClosed = new Promise<void>(resolve => { closed = resolve })
  const server = createServer((_request, response) => {
    requests++
    if (requests === 1) {
      response.writeHead(200, { 'Content-Length': '10' }); response.write('a')
      response.on('close', closed); received()
    } else response.end('complete')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}/assets/person.glb`
  const first = new AbortController(), second = new AbortController()
  try {
    const parse = async (bytes: ArrayBuffer, base: string) => { parses++; assert.equal(base, url.slice(0, url.lastIndexOf('/') + 1)); return new TextDecoder().decode(bytes) }
    const pending = fetchStudyRoomSource(url, first.signal, parse)
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    await firstReceived
    const retry = fetchStudyRoomSource(url, second.signal, parse)
    first.abort(); await rejected; await firstClosed
    assert.equal(await retry, 'complete')
    assert.equal(requests, 2); assert.equal(parses, 1); assert.equal(second.signal.aborted, false)
  } finally {
    first.abort(); second.abort(); server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('HTTP 404 and truncated content fail before parsing, then the same URL recovers', { timeout: 5000 }, async () => {
  let requests = 0, parses = 0
  const server = createServer((_request, response) => {
    if (++requests === 1) { response.writeHead(404); response.end('missing') }
    else if (requests === 2) { response.writeHead(200, { 'Content-Length': '100', Connection: 'close' }); response.end('short') }
    else response.end('valid')
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const url = `http://127.0.0.1:${address.port}/person.glb`
  const load = () => fetchStudyRoomSource(url, AbortSignal.timeout(1000), async bytes => { parses++; return bytes.byteLength })
  try {
    await assert.rejects(load(), /404/)
    await assert.rejects(load(), { name: 'TypeError' })
    assert.equal(await load(), 5); assert.equal(parses, 1)
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
  }
})

test('shared furniture keeps chair anchors, leg envelopes and every Bible transform/material', () => {
  type Point = [number, number, number]
  const books: Point[] = STUDY_COMPANION_SEATS.map((_, index) => [.01 * index, .91, .36])
  for (const overview of [false, true]) for (const loaded of [false, true]) {
    // Independent reference: the previous JSX hierarchy, with dimensions on each leaf.
    const root = new Object3D(), leaves: Array<{ node: Object3D; batch: number }> = []
    const group = (parent: Object3D, position: Point, rotation: Point = [0, 0, 0]) => {
      const node = new Object3D(); node.position.set(...position); node.rotation.set(...rotation); parent.add(node); return node
    }
    const leaf = (parent: Object3D, batch: number, position: Point, size: Point, rotation: Point = [0, 0, 0]) => {
      const node = group(parent, position, rotation); node.scale.set(...size); leaves.push({ node, batch })
    }
    const chair = (parent: Object3D) => {
      leaf(parent, 0, [0, 0, 0], [1, 1, 1])
      for (const x of [-.23, .23]) for (const z of [-.2, .2]) leaf(parent, 1, [x, .24, z], [.045, .48, .045])
    }
    const book = (parent: Object3D, position: Point) => {
      const bible = group(parent, position, [.22, 0, 0])
      for (const side of [-1, 1]) {
        const half = group(bible, [side * .095, 0, 0], [0, 0, side * .09])
        leaf(half, 2, [0, 0, 0], [.19, .018, .26])
        leaf(half, 3, [0, .016, 0], [.178, .015, .244])
        for (let row = 0; row < 7; row++) leaf(half, 4, [0, .025, -.082 + row * .025], [.135, .001, .0015])
      }
    }
    for (const [index, seat] of STUDY_COMPANION_SEATS.entries()) {
      const parent = group(root, seat.position, [0, seat.yaw, 0]); chair(parent)
      if (loaded) book(parent, books[index])
    }
    if (overview) chair(group(root, [0, 0, 2], [0, Math.PI, 0]))
    book(root, [.2, .754, .32]); root.updateMatrixWorld(true)
    const batches = buildStudyFurnitureBatches(loaded ? books : [], overview)
    assert.equal(batches.length, 5, 'five visible furniture batches, regardless of camera or occupants')
    assert.deepEqual(batches.map(({ color, roughness, shadows }) => [color, roughness, shadows]), [
      ['#456658', .95, true], ['#6d503a', .9, true], ['#29473b', .95, false], ['#fff3d5', 1, false], ['#ab9d81', .9, false],
    ])
    for (const [batchIndex, batch] of batches.entries()) {
      const expected = leaves.filter(leaf => leaf.batch === batchIndex)
      assert.equal(batch.matrices.length, expected.length)
      batch.matrices.forEach((matrix, index) => matrix.elements.forEach((value, component) => {
        assert.ok(Math.abs(value - expected[index].node.matrixWorld.elements[component]) < 1e-12)
      }))
    }
    assert.deepEqual(batches.map(batch => batch.matrices.length), [overview ? 6 : 5, overview ? 24 : 20, loaded ? 12 : 2, loaded ? 12 : 2, loaded ? 84 : 14])
  }
})

test('furniture batches have independent matrix ownership across reload and overview changes', () => {
  const initial = buildStudyFurnitureBatches([], false)
  const snapshot = JSON.stringify(initial)
  const next = buildStudyFurnitureBatches([], true)
  next[0].matrices[0].elements[12] = 999
  assert.equal(JSON.stringify(initial), snapshot)
})

test('guest room enters the guarded Scripture reader and keeps protected fallback exits', async () => {
  const routes = await readFile(new URL('../src/app/routing/AppRoutes.tsx', import.meta.url), 'utf8')
  const view = await readLocalizedSource(new URL('../src/views/VirtualChurchView.tsx', import.meta.url))
  assert.match(routes, /path="\/virtual-church\/study-room" element=\{<VirtualChurchPreviewRoute><VirtualChurchRouteBoundary><VirtualChurchStudyRoomView/)
  assert.match(view, /navigate\(path === '\/study' \? '\/virtual-church\/study-room' : path\)/)
  assert.match(view, /if \(path === '\/events'\).*setShowGatherings\(true\)/)
  assert.match(view, /\|\| showGatherings/)
  assert.match(view, /onClick=\{\(\) => navigate\('\/study'\)\}/)
})

test('gathering modal reads public homepage data and renders text with accessible focus management', async () => {
  const source = await readLocalizedSource(new URL('../src/views/VirtualChurchGatheringsDialog.tsx', import.meta.url))
  assert.match(source, /getFirstPageMenuPage\(pages.data/)
  assert.match(source, /detail.data\?\.id === home\?\.id && detail.data\?\.visibility === 'public'/)
  assert.match(source, /cell.textContent/)
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|10:00|11:30/)
  assert.match(source, /useVirtualChurchDialogFocus\(onClose\)/)
  assert.match(source, /role="dialog" aria-modal="true"/)
  assert.match(source, /<thead className="sr-only">/)
  assert.match(source, /scope="col"/)
})

test('gathering timetable labels only the known three-column schedule', () => {
  const timetable = [
    ['主日崇拜', '大堂', '10:00-11:30'],
    ['青年堂', '副堂', '10:00-11:30'],
  ]
  assert.deepEqual(gatheringTableColumnHeaders(timetable, 'zh'), ['聚会', '地点', '时间'])
  assert.deepEqual(gatheringTableColumnHeaders(timetable, 'en'), ['Gathering', 'Location', 'Time'])
  assert.equal(gatheringTableColumnHeaders([['活动', '地点', '报名']], 'zh'), null)
  assert.equal(gatheringTableColumnHeaders([['活动', '10:00']], 'zh'), null)
  assert.equal(gatheringTableColumnHeaders([], 'zh'), null)
})

test('gathering modal selects the same displayed body field as the homepage', () => {
  const table = '<table><tr><td>Sunday Service</td><td>10:00</td></tr></table>'
  assert.equal(readHomeGatheringSectionHtml({ centerText: { en: table, zh: '主日崇拜 10:00' }, body: 'stale' }, 'en'), table)
  assert.equal(readHomeGatheringSectionHtml({ centerText: 'Visible introduction', body: table }, 'en'), 'Visible introduction')
  assert.equal(readHomeGatheringSectionHtml({ text: { en: table } }, 'en'), table)
  assert.equal(readHomeGatheringSectionHtml(JSON.stringify({ text: { zh: '主日崇拜 10:00' } }), 'en'), '主日崇拜 10:00')
  assert.equal(readHomeGatheringSectionHtml({ centerText: '', body: table }, 'en'), '')
  assert.equal(readHomeGatheringSectionHtml('{invalid', 'zh'), '')
})
