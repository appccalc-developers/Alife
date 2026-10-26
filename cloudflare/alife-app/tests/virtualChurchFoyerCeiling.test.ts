import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Ray, Texture, Vector3 } from 'three'
import { FOYER_ACOUSTIC_STRIP as strip, FOYER_ACOUSTIC_SURFACE as surface, createVirtualChurchFoyerExtensionCeilingMaterial, isFoyerAcousticSurface, prepareVirtualChurchFoyerCeiling } from '../src/views/virtualChurchFoyerCeiling.ts'
import { loadDracoDecoder } from '../../../tools/virtual-church/gate-a-church-geometry.mjs'

test('ceiling mask excludes walls, roof, floor and faces outside the photo-backed panel field', () => {
  const x = (surface.minX + surface.maxX) / 2, z = (surface.minZ + surface.maxZ) / 2
  assert.equal(isFoyerAcousticSurface(x, 5.9, z, -1), true)
  for (const [px, y, pz, ny] of [[x, .095, z, 1], [x, 5.9, z, 0], [x, 5.9, z, 1], [x, 6.05, z, -1], [surface.minX - 1, 5.9, z, -1], [x, 5.9, surface.maxZ + 1, -1]]) {
    assert.equal(isFoyerAcousticSurface(px, y, pz, ny), false)
  }
})

test('ceiling surface owns only a material copy and preserves existing shader hooks and geometry', () => {
  const geometry = new BoxGeometry(.5, .02, .5)
  geometry.translate((surface.minX + surface.maxX) / 2, 5.91, 1)
  const texture = new Texture(), material = new MeshStandardMaterial({ map: texture })
  material.name = 'M_OffWhite'; material.customProgramCacheKey = () => 'original'
  material.onBeforeCompile = shader => { shader.fragmentShader += '\n// original hook' }
  const mesh = new Mesh(geometry, material), model = new Group(); model.add(mesh)
  let borrowedDisposals = 0, ownedDisposals = 0
  for (const item of [geometry, material, texture]) item.addEventListener('dispose', () => borrowedDisposals++)
  const prepared = prepareVirtualChurchFoyerCeiling(model)
  assert.equal(prepared.count, 1); assert.equal(mesh.geometry, geometry); assert.notEqual(mesh.material, material)
  assert.equal(mesh.material.map, texture); assert.equal(model.children.length, 1)
  const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' }
  mesh.material.onBeforeCompile(shader as never, {} as never)
  assert.match(shader.fragmentShader, /original hook/)
  assert.match(shader.fragmentShader, /fwidth/)
  assert.match(shader.fragmentShader, /smoothstep\(.012, .035, footprint\)/)
  assert.doesNotMatch(shader.fragmentShader, /diffuseColor\.rgb = mix|vec3\(hole, field, detail\)/)
  assert.equal(mesh.material.customProgramCacheKey(), 'original:foyer-acoustic-v1')
  mesh.material.addEventListener('dispose', () => ownedDisposals++)
  prepared.dispose(); prepared.dispose()
  assert.equal(ownedDisposals, 1); assert.equal(borrowedDisposals, 0)
  geometry.dispose(); material.dispose(); texture.dispose()
})

test('tall foyer extension confines perforations to the photographed central strip without a box grid', async () => {
  const material = createVirtualChurchFoyerExtensionCeilingMaterial(13.2, 4.06)
  assert.equal(material.map, null, 'the extension reuses no downloaded or generated texture')
  assert.match(material.customProgramCacheKey(), /foyer-acoustic-extension-v2/)
  const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <color_fragment>' }
  material.onBeforeCompile(shader as never, {} as never)
  assert.match(shader.vertexShader, /vFoyerPanelUV = uv \* vec2\(13\.2, 4\.06\)/)
  assert.match(shader.fragmentShader, /fwidth\(vFoyerPanelUV\.x\)/)
  assert.match(shader.fragmentShader, /smoothstep\(\.012, \.035, footprint\)/)
  assert.equal(strip.start, .11); assert.equal(strip.end, .69)
  const bounds = shader.fragmentShader.match(/float acousticStrip = step\(([\d.]+), vFoyerPanelUV\.x\) \* step\(vFoyerPanelUV\.x, ([\d.]+)\)/)
  assert.ok(bounds)
  assert.ok(Math.abs(Number(bounds[1]) - 13.2 * strip.start) < 1e-6)
  assert.ok(Math.abs(Number(bounds[2]) - 13.2 * strip.end) < 1e-6)
  assert.match(shader.fragmentShader, /diffuseColor\.rgb \*= 1\.0 - acousticStrip \*/)
  material.dispose()
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /<FoyerAcousticExtension \/>/)
  assert.match(source, /<planeGeometry args=\{\[ceiling\.scale\[0\], ceiling\.scale\[2\]\]\} \/>/)
  assert.doesNotMatch(source, /foyerRoutePanels/)
})

test('unknown or transformed meshes are not decorated; runtime uses only V3 clones', async () => {
  const geometry = new BoxGeometry(.5, .02, .5), material = new MeshStandardMaterial()
  geometry.translate((surface.minX + surface.maxX) / 2, 5.91, 1)
  const model = new Group(), mesh = new Mesh(geometry, material); model.add(mesh)
  assert.equal(prepareVirtualChurchFoyerCeiling(model).count, 0)
  material.name = 'M_OffWhite'; mesh.position.x = 1
  assert.equal(prepareVirtualChurchFoyerCeiling(model).count, 0)
  const source = await readFile(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /visualVersion === 'v3' \? prepareVirtualChurchFoyerCeiling\(result\) : null/)
  assert.match(source, /useEffect\(\(\) => \(\) => foyerCeiling\?\.dispose\(\), \[foyerCeiling\]\)/)
  geometry.dispose(); material.dispose()
})

test('every real church LOD has downward acoustic faces inside the narrowly bounded mask', async () => {
  const { module: draco } = await loadDracoDecoder()
  for (const suffix of ['', '-medium', '-low']) {
    const raw = await readFile(new URL(`../public/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero${suffix}.glb`, import.meta.url))
    const length = raw.readUInt32LE(12), json = JSON.parse(raw.toString('utf8', 20, 20 + length)), binary = raw.subarray(28 + length)
    let selected = 0, ignored = 0, maskedFaces = 0
    const ray = new Ray(new Vector3((surface.minX + surface.maxX) / 2 + .16, 1.8, 3.11), new Vector3(0, 1, 0))
    const hits: Array<{ y: number; material: string; masked: boolean }> = []
    for (const mesh of json.meshes) for (const primitive of mesh.primitives) {
      const name = json.materials[primitive.material].name
      const eligible = ['M_OffWhite', 'M_CedarLight'].includes(name)
      const ext = primitive.extensions.KHR_draco_mesh_compression, view = json.bufferViews[ext.bufferView]
      const bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
      const decoder = new draco.Decoder(), buffer = new draco.DecoderBuffer(), decoded = new draco.Mesh()
      const p = new draco.DracoFloat32Array(), n = new draco.DracoFloat32Array(), face = new draco.DracoInt32Array()
      try {
        buffer.Init(new Int8Array(bytes), bytes.length)
        assert.ok(decoder.DecodeBufferToMesh(buffer, decoded).ok())
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, ext.attributes.POSITION), p)
        decoder.GetAttributeFloatForAllPoints(decoded, decoder.GetAttributeByUniqueId(decoded, ext.attributes.NORMAL), n)
        for (let i = 0; i < decoded.num_points(); i++) {
          if (eligible && isFoyerAcousticSurface(p.GetValue(i * 3), p.GetValue(i * 3 + 1), p.GetValue(i * 3 + 2), n.GetValue(i * 3 + 1))) selected++
          else ignored++
        }
        for (let i = 0; i < decoded.num_faces(); i++) {
          decoder.GetFaceFromMesh(decoded, i, face)
          const masked = eligible && [0, 1, 2].every(corner => {
            const v = face.GetValue(corner)
            return isFoyerAcousticSurface(p.GetValue(v * 3), p.GetValue(v * 3 + 1), p.GetValue(v * 3 + 2), n.GetValue(v * 3 + 1))
          })
          if (masked) maskedFaces++
          const points = [0, 1, 2].map(corner => { const v = face.GetValue(corner); return new Vector3(p.GetValue(v * 3), p.GetValue(v * 3 + 1), p.GetValue(v * 3 + 2)) })
          const hit = ray.intersectTriangle(points[0], points[1], points[2], false, new Vector3())
          if (hit) hits.push({ y: hit.y, material: name, masked })
        }
      } finally { for (const value of [p, n, face, decoded, buffer, decoder]) draco.destroy(value) }
    }
    assert.ok(selected >= 24, `${suffix}: must find the real panels, not a no-op`)
    assert.ok(ignored > selected, `${suffix}: the remainder of the building is excluded`)
    assert.ok(maskedFaces >= 12, `${suffix}: only ${maskedFaces} complete panel faces are covered`)
    hits.sort((a, b) => a.y - b.y)
    assert.ok(hits[0]?.masked, `${suffix}: nearest visible ceiling ${JSON.stringify(hits.slice(0, 4))}`)
  }
})
