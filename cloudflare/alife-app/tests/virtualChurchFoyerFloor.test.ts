import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three'
import { createVirtualChurchFoyerFloorGeometry, createVirtualChurchFoyerOakFloorGeometry, prepareVirtualChurchFoyerFloor, virtualChurchFoyerOakTintAt, VIRTUAL_CHURCH_FOYER_FLOOR as floor, VIRTUAL_CHURCH_FOYER_OAK_DAYLIGHT as daylight } from '../src/views/virtualChurchFoyerFloor.ts'
import { loadDracoDecoder } from '../../../tools/virtual-church/gate-a-church-geometry.mjs'
import { VIRTUAL_CHURCH_FOYER_CIRCULATION as route } from '../src/views/virtualChurchInteractionContract.ts'

test('photo-scale narrow boards continue through both V3 side corridors', () => {
  const geometry = createVirtualChurchFoyerFloorGeometry()
  const p = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), uv1 = geometry.getAttribute('uv1')
  const colors = geometry.getAttribute('color')
  assert.equal(geometry.groups.length, 0)
  assert.ok(p.count / 3 < 1800, 'both extended corridors remain within a bounded floor triangle budget')
  assert.equal(floor.boardWidth, .28)
  assert.ok(floor.gap < .002, 'indoor plank joints remain subtle, not outdoor decking gaps')
  const columnEnds = new Map<number, number[]>()
  let area = 0
  for (let i = 0; i < p.count; i += 3) {
    const twiceArea = (p.getZ(i + 1) - p.getZ(i)) * (p.getX(i + 2) - p.getX(i))
      - (p.getX(i + 1) - p.getX(i)) * (p.getZ(i + 2) - p.getZ(i))
    assert.ok(twiceArea > 0, 'top faces are upward')
    if (i >= 18) area += twiceArea / 2
  }
  for (let i = 0; i < p.count; i++) {
    const branch = p.getZ(i) >= route.branchOpeningStartZ - 1e-5
    assert.ok(p.getX(i) >= (branch ? route.branchLeftX : floor.minX) - 1e-5
      && p.getX(i) <= (branch ? route.branchRightX : floor.maxX) + 1e-5)
    assert.ok(p.getZ(i) >= floor.minZ - 1e-5 && p.getZ(i) <= floor.maxZ + 1e-5)
    assert.ok(p.getY(i) > .093 && p.getY(i) < .096)
    assert.ok(uv.getX(i) >= .3119 && uv.getX(i) <= .3391, 'all planks sample inside one similarly toned cedar board, away from its painted seams')
    assert.ok(uv.getY(i) > .01 && uv.getY(i) < .48, 'sample cedar, never concrete or metal')
    assert.equal(uv.getX(i), uv1.getX(i)); assert.equal(uv.getY(i), uv1.getY(i))
  }
  for (let i = 18; i < p.count; i += 6) {
    const x = p.getX(i), width = p.getX(i + 2) - x
    assert.ok(width > 0 && width <= floor.boardWidth + 1e-5, 'no three-board-wide corridor strip')
    const length = p.getZ(i + 1) - p.getZ(i)
    assert.ok(length > 0 && length <= floor.boardLength + 1e-5, 'every interior board is a bounded plank')
    assert.equal(uv.getX(i), uv.getX(i + 1), 'grain U remains across board width')
    const ends = columnEnds.get(x) ?? []
    ends.push(p.getZ(i + 1)); columnEnds.set(x, ends)
    const tone = colors.getX(i)
    assert.ok(tone >= .9399 && tone <= .9551, 'each board should retain subtle grain without a checkerboard tint')
    assert.equal(colors.getY(i), tone); assert.equal(colors.getZ(i), tone)
  }
  for (let i = 0; i < 18; i++) assert.ok(Math.abs(colors.getX(i) - .88) < 1e-5)
  const [a, b, c] = [...columnEnds.values()]
  assert.notDeepEqual(a, b); assert.notDeepEqual(b, c)
  const boundsArea = (floor.maxX - floor.minX) * (floor.maxZ - floor.minZ)
    + (floor.minX - route.branchLeftX) * (floor.maxZ - route.leftBranchOpeningStartZ)
    + (route.branchRightX - floor.maxX) * (floor.maxZ - route.branchOpeningStartZ)
  assert.ok(area / boundsArea > .98 && area < boundsArea, 'board coverage with only thin seams')
  const again = createVirtualChurchFoyerFloorGeometry()
  for (const name of ['position', 'normal', 'uv', 'uv1', 'color']) {
    assert.deepEqual(geometry.getAttribute(name).array, again.getAttribute(name).array)
  }
  geometry.dispose(); again.dispose()
})

test('V3 oak layer preserves floor geometry and grades toward the photographed courtyard daylight at bounded cost', async () => {
  const fallback = createVirtualChurchFoyerFloorGeometry()
  const oak = createVirtualChurchFoyerOakFloorGeometry()
  const p = oak.getAttribute('position'), fallbackP = fallback.getAttribute('position')
  const uv = oak.getAttribute('uv'), uv1 = oak.getAttribute('uv1'), color = oak.getAttribute('color')
  assert.equal(p.count, fallbackP.count)
  assert.ok(p.count / 3 < 1800)
  let foyerBoards = 0, corridorBoards = 0
  for (let i = 0; i < p.count; i++) {
    assert.ok(Math.abs(p.getY(i) - fallbackP.getY(i) - .003) < 1e-6)
    assert.equal(p.getX(i), fallbackP.getX(i)); assert.equal(p.getZ(i), fallbackP.getZ(i))
    assert.ok(uv.getX(i) >= 0 && uv.getX(i) <= 1 && uv.getY(i) >= 0 && uv.getY(i) <= 1)
    assert.equal(uv.getX(i), uv1.getX(i)); assert.equal(uv.getY(i), uv1.getY(i))
  }
  assert.deepEqual(virtualChurchFoyerOakTintAt(daylight.startZ - 1, false), [...daylight.near])
  assert.deepEqual(virtualChurchFoyerOakTintAt(daylight.endZ + 1, false), [...daylight.far])
  assert.deepEqual(virtualChurchFoyerOakTintAt(daylight.endZ, true), [...daylight.sideCorridor])
  assert.ok(daylight.sideCorridor[0] >= 1.4 && daylight.sideCorridor[1] >= 1.2,
    'photo 01 left corridor should read as distinctly daylit pale oak, not the entrance-floor brown')
  assert.ok(daylight.near[0] >= .38 && daylight.near[0] <= .48
    && daylight.far[0] <= .9 && daylight.far[0] - daylight.near[0] >= .35,
  'the photo-guided entrance is subdued brown-grey and brightens toward the courtyard')
  for (let i = 18; i < p.count; i += 6) {
    const side = p.getX(i) < floor.minX || p.getX(i) >= floor.maxX
    for (let vertex = 0; vertex < 6; vertex++) {
      const expected = virtualChurchFoyerOakTintAt(p.getZ(i + vertex), side)
      for (let channel = 0; channel < 3; channel++) {
        const actual = [color.getX(i + vertex), color.getY(i + vertex), color.getZ(i + vertex)][channel]
        assert.ok(Math.abs(actual - expected[channel]) < 1e-6, 'each plank follows the same continuous courtyard exposure')
      }
    }
    assert.ok(color.getX(i) > color.getY(i) && color.getY(i) > color.getZ(i), 'oak tint stays warm')
    if (side) {
      corridorBoards++
      assert.ok(color.getX(i) > daylight.far[0] && color.getY(i) > daylight.far[1],
        'daylit side corridor stays visibly lighter than the main foyer with the new oak grain')
    }
    else {
      foyerBoards++
      assert.ok(color.getX(i) >= daylight.near[0] - 1e-5 && color.getX(i) <= daylight.far[0] + 1e-5)
      assert.ok(color.getX(i) - color.getY(i) < .14 && color.getX(i) - color.getZ(i) < .23,
        'main foyer remains muted neutral oak, not the former orange cedar tint')
    }
  }
  assert.ok(foyerBoards > 100 && corridorBoards > 30)
  const asset = await readFile(new URL('../public/virtual-church-assets/v3/foyer-oak-basecolor-v2.webp', import.meta.url))
  assert.equal(asset.toString('ascii', 0, 4), 'RIFF')
  assert.equal(asset.toString('ascii', 8, 12), 'WEBP')
  assert.ok(asset.length < 20_000, 'optional V3-only image stays a small mobile payload')
  fallback.dispose(); oak.dispose()
})

test('floor owns only its mesh material and geometry, never cached atlas resources', () => {
  for (const channel of [0, 1]) {
    const texture = new Texture(); texture.channel = channel; texture.flipY = false
    const material = new MeshStandardMaterial({ map: texture, normalMap: texture, roughnessMap: texture, metalnessMap: texture })
    material.name = 'M_CedarLight'; material.userData.vc04AtlasQuadrant = [0, .5, .5, 1]
    const cachedGeometry = new BoxGeometry()
    cachedGeometry.clearGroups()
    const model = new Group(); model.add(new Mesh(cachedGeometry, material))
    model.children[0].castShadow = true
    let textureDisposals = 0, cachedDisposals = 0, ownedDisposals = 0
    texture.addEventListener('dispose', () => textureDisposals++)
    material.addEventListener('dispose', () => cachedDisposals++)
    cachedGeometry.addEventListener('dispose', () => cachedDisposals++)
    const prepared = prepareVirtualChurchFoyerFloor(model)!
    assert.ok(prepared)
    assert.equal(model.children.length, 1, 'same authored batch, no additional draw object')
    assert.notEqual(prepared.mesh.material, material)
    assert.equal(prepared.mesh.material.map, texture)
    assert.equal(prepared.mesh.material.normalMap, texture)
    assert.equal(prepared.mesh.material.map!.channel, channel)
    assert.equal(material.vertexColors, false)
    assert.equal(prepared.mesh.material.vertexColors, true)
    assert.equal(prepared.mesh.castShadow, true, 'preserve authored batch shadow settings')
    const sourceCount = cachedGeometry.getAttribute('position').count
    for (const name of ['position', 'normal', 'uv']) {
      assert.deepEqual(Array.from(prepared.mesh.geometry.getAttribute(name).array).slice(0, cachedGeometry.getAttribute(name).array.length),
        Array.from(cachedGeometry.getAttribute(name).array), `cached ${name} preserved exactly`)
    }
    assert.deepEqual(Array.from(prepared.mesh.geometry.index!.array).slice(0, cachedGeometry.index!.count), Array.from(cachedGeometry.index!.array))
    assert.equal(prepared.mesh.geometry.groups.length, 0)
    assert.deepEqual(Array.from(prepared.mesh.geometry.getAttribute('color').array).slice(0, sourceCount * 3), Array(sourceCount * 3).fill(1))
    assert.equal(cachedGeometry.getAttribute('color'), undefined)
    prepared.mesh.material.addEventListener('dispose', () => ownedDisposals++)
    prepared.mesh.geometry.addEventListener('dispose', () => ownedDisposals++)
    prepared.dispose()
    assert.equal(ownedDisposals, 2); assert.equal(textureDisposals, 0); assert.equal(cachedDisposals, 0)
    material.dispose(); cachedGeometry.dispose(); texture.dispose()
  }
})

test('unknown atlas and absent cedar material keep the authored fallback', () => {
  const model = new Group()
  assert.equal(prepareVirtualChurchFoyerFloor(model), null)
  const source = new MeshStandardMaterial({ map: new Texture() }); source.name = 'M_CedarLight'
  const geometry = new BoxGeometry(); model.add(new Mesh(geometry, source))
  assert.equal(prepareVirtualChurchFoyerFloor(model), null)
  source.userData.vc04AtlasQuadrant = [0, .5, .5, 1]; source.map!.channel = 2
  assert.equal(prepareVirtualChurchFoyerFloor(model), null)
  source.dispose(); source.map!.dispose(); geometry.dispose()
})

test('runtime attaches only to V3 prepared clones and disposes its overlay', async () => {
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /const result = asset\.scene\.clone\(true\)/)
  assert.match(source, /visualVersion === 'v3' \? prepareVirtualChurchFoyerFloor\(result\) : null/)
  assert.doesNotMatch(source, /result\.add\(foyerFloor\.mesh\)/)
  assert.match(source, /useEffect\(\(\) => \(\) => foyerFloor\?\.dispose\(\), \[foyerFloor\]\)/)
  const oak = source.slice(source.indexOf('const FoyerOakFloor ='), source.indexOf('const FoyerAcousticExtension ='))
  assert.match(oak, /texture \? createVirtualChurchFoyerFloorMaterial\(texture, contactMask\) : null/)
  assert.match(oak, /name="vc:foyer-oak-floor"[\s\S]*?<primitive object=\{material\} attach="material"/)
  assert.match(oak, /useEffect\(\(\) => \(\) => material\?\.dispose\(\), \[material\]\)/)
})

test('overlay covers the actual authored floor in all three immutable church LODs', async () => {
  const { module: draco } = await loadDracoDecoder()
  for (const suffix of ['', '-medium', '-low']) {
    const raw = await readFile(new URL(`../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero${suffix}.glb`, import.meta.url))
    const length = raw.readUInt32LE(12), json = JSON.parse(raw.toString('utf8', 20, 20 + length)), binary = raw.subarray(28 + length)
    const material = json.materials.find((m: { name: string }) => m.name === 'M_CedarLight')
    assert.deepEqual(material.extras.vc04AtlasQuadrant, [0, .5, .5, 1])
    const channel = material.pbrMetallicRoughness.baseColorTexture.texCoord ?? 0
    assert.equal(channel, suffix === '-low' ? 0 : 1)
    let floorVertices = 0
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      if (json.materials[primitive.material] !== material) continue
      const ext = primitive.extensions.KHR_draco_mesh_compression, view = json.bufferViews[ext.bufferView]
      const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
      const positions = new draco.DracoFloat32Array(), normals = new draco.DracoFloat32Array(), uv = new draco.DracoFloat32Array()
      try {
        buffer.Init(new Int8Array(bytes), bytes.length)
        assert.ok(decoder.DecodeBufferToMesh(buffer, decoded).ok())
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, ext.attributes.POSITION), positions)
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, ext.attributes.NORMAL), normals)
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, ext.attributes[`TEXCOORD_${channel}`]), uv)
        for (let i = 0; i < decoded.num_points(); i++) {
          const x = positions.GetValue(i * 3), y = positions.GetValue(i * 3 + 1), z = positions.GetValue(i * 3 + 2)
          if (Math.abs(y - .09) > .002 || normals.GetValue(i * 3 + 1) < .9) continue
          floorVertices++
          // Medium's floor vertices extend 2 cm under the .18 m perimeter wall;
          // retain that authored geometry rather than expanding the room.
          assert.ok(x >= floor.minX - .09 && x <= floor.maxX + .09 && z >= floor.minZ - .002 && z <= floor.maxZ + .09, `${suffix}: ${x}, ${y}, ${z}`)
          assert.ok(y < floor.baseY, 'new surface sits above old coarse joints')
          assert.ok(uv.GetValue(i * 2) < .5 && uv.GetValue(i * 2 + 1) < .5, 'authored floor and overlay use the same cedar quadrant')
        }
      } finally {
        for (const value of [positions, normals, uv, decoded, buffer, decoder]) draco.destroy(value)
      }
    }
    assert.ok(floorVertices > 50, `${suffix}: inspected real floor boards`)
  }
})
