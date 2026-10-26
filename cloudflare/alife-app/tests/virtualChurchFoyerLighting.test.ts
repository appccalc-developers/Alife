import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Color, CylinderGeometry, DoubleSide, Texture, Vector3 } from 'three'
import { createVirtualChurchFoyerFloorMaterial, virtualChurchFoyerFloorContactShader } from '../src/views/virtualChurchFoyerContact.ts'
import { createVirtualChurchFoyerHandrailMaterial, createVirtualChurchFoyerInteriorMaterial, createVirtualChurchFoyerWickerMaterial, VIRTUAL_CHURCH_FOYER_SHELTER_RESPONSE as response } from '../src/views/virtualChurchFoyerLighting.ts'
import { VIRTUAL_CHURCH_FOYER_FLOOR } from '../src/views/virtualChurchFoyerFloor.ts'
import { VIRTUAL_CHURCH_FOYER_STAIR as stairLayout } from '../src/views/virtualChurchInteractionContract.ts'

test('covered charcoal and pale walls reduce only their opt-in enclosed direct diffuse response', () => {
  const compile = (covered: boolean) => {
    const material = createVirtualChurchFoyerInteriorMaterial(.86, covered)
    const shader = {
      vertexShader: '#include <begin_vertex>',
      fragmentShader: '#include <aomap_fragment>',
    }
    material.onBeforeCompile(shader as never, null as never)
    return { material, shader }
  }
  const pale = compile(false), dark = compile(true)
  try {
    assert.match(dark.shader.vertexShader, /instanceMatrix \* vec4/)
    assert.match(dark.shader.fragmentShader, /reflectedLight.directDiffuse \*= mix\(1.0, .18, sunShelter\)/)
    assert.match(dark.shader.fragmentShader, /smoothstep\(13.15, 13.5/)
    assert.match(pale.shader.fragmentShader, /reflectedLight.directDiffuse \*= mix\(1.0, mix\(0.680, 0.400, foyerUpperWall\), foyerEnclosure\)/)
    assert.doesNotMatch(pale.shader.fragmentShader, /sunShelter/)
    assert.match(pale.shader.fragmentShader, /reflectedLight.indirectDiffuse/)
    assert.notEqual(pale.material.customProgramCacheKey(), dark.material.customProgramCacheKey())
    assert.equal(dark.material.roughness, .86)
    assert.equal(dark.material.transparent, false)
    assert.equal(dark.material.map, null, 'no new texture request')
  } finally {
    pale.material.dispose(); dark.material.dispose()
  }
})

test('woven pendants retain opaque vertex-colour ribbons while opting into existing indoor shelter', () => {
  const material = createVirtualChurchFoyerWickerMaterial()
  const pale = createVirtualChurchFoyerInteriorMaterial(.88)
  const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <aomap_fragment>' }
  try {
    material.onBeforeCompile(shader as never, null as never)
    assert.equal(material.vertexColors, true)
    assert.equal(material.side, DoubleSide)
    assert.equal(material.roughness, .88)
    assert.equal(material.transparent, false)
    assert.equal(material.emissive.getHex(), 0)
    assert.equal(material.map, null); assert.equal(material.normalMap, null)
    assert.equal(material.customProgramCacheKey(), pale.customProgramCacheKey())
    assert.match(shader.fragmentShader, /reflectedLight.directDiffuse \*= mix\(1.0, mix\(0.680, 0.400, foyerUpperWall\), foyerEnclosure\)/)
    assert.doesNotMatch(shader.fragmentShader, /texture\(|uniform|emissive/)
    let disposed = 0
    material.addEventListener('dispose', () => disposed++)
    material.dispose()
    assert.equal(disposed, 1)
  } finally { pale.dispose() }
})

test('warm shelter only tints existing indirect diffuse and retains the base glazing-end fade', () => {
  for (const covered of [false, true]) {
    const material = createVirtualChurchFoyerInteriorMaterial(.87, covered)
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <aomap_fragment>' }
    try {
      material.onBeforeCompile(shader as never, null as never)
      assert.match(shader.fragmentShader, /reflectedLight.indirectDiffuse \*= mix\(vec3\(1.0\), vec3\(1.025, 1.0, .90\), foyerEnclosure\)/)
      assert.match(shader.fragmentShader, /smoothstep\(\.25, 2.0, vFoyerShelter.y\)/)
      assert.match(shader.fragmentShader, /1.0 - smoothstep\(10.5, 13.28, vFoyerShelter.y\)/)
      assert.doesNotMatch(shader.fragmentShader, /diffuseColor|outgoingLight|emissive|texture\(|uniform/)
      assert.match(material.customProgramCacheKey(), /foyer-sheltered-daylight-v4/)
      assert.equal(material.map, null); assert.equal(material.emissiveIntensity, 1)
      assert.equal(material.emissive.getHex(), 0)
      assert.equal(material.transparent, false)
    } finally { material.dispose() }
  }
})

test('the pale upper end return is sheltered above glazing while charcoal retains its existing end response', () => {
  for (const covered of [false, true]) {
    const material = createVirtualChurchFoyerInteriorMaterial(.87, covered)
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <aomap_fragment>' }
    try {
      material.onBeforeCompile(shader as never, null as never)
      if (covered) assert.doesNotMatch(shader.fragmentShader, /foyerUpperEndWall/)
      else {
        assert.match(shader.fragmentShader, /foyerUpperEndWall = vFoyerVerticalFace/)
        assert.match(shader.fragmentShader, /smoothstep\(2.70, 5.90, vFoyerShelter.x\)/,
          'broad height fade avoids a hard horizontal band above the glazing')
        assert.match(shader.fragmentShader, /smoothstep\(10.5, 13.28, vFoyerShelter.y\)/)
        assert.match(shader.fragmentShader, /1.0 - smoothstep\(13.50, 13.75, vFoyerShelter.y\)/)
        assert.match(shader.fragmentShader, /max\(foyerEnclosure, .70 \* foyerUpperEndWall\)/)
      }
    } finally { material.dispose() }
  }
})

test('wall contact follows entrance-local vertical faces and the authoritative floor height without new assets', () => {
  assert.equal(response.wallBaseY, VIRTUAL_CHURCH_FOYER_FLOOR.boardY)
  assert.ok(response.wallBaseMinimum >= .80 && response.wallBaseMinimum <= .90)
  assert.ok(response.paleUpperDirect >= .35 && response.paleUpperDirect < response.paleLowerDirect)
  assert.ok(response.paleLowerDirect < 1)
  for (const covered of [false, true]) {
    const material = createVirtualChurchFoyerInteriorMaterial(.87, covered)
    const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <aomap_fragment>' }
    try {
      material.onBeforeCompile(shader as never, null as never)
      assert.match(shader.vertexShader, /foyerNormal = normalize\(mat3\(instanceMatrix\) \* foyerNormal\)/)
      assert.match(shader.vertexShader, /abs\(foyerNormal.y\)/)
      assert.doesNotMatch(shader.vertexShader, /normalMatrix|viewMatrix|cameraPosition/)
      assert.match(shader.fragmentShader, /vFoyerVerticalFace \* foyerEnclosure/)
      assert.match(shader.fragmentShader, /smoothstep\(0.095, 0.650, vFoyerShelter.x\)/)
      assert.match(shader.fragmentShader, /mix\(1.0, 0.840, foyerWallFoot\)/)
      assert.match(shader.fragmentShader, /reflectedLight.indirectDiffuse \*= foyerWallContact/)
      assert.match(shader.fragmentShader, /reflectedLight.directDiffuse \*= foyerWallContact/)
      assert.doesNotMatch(shader.fragmentShader, /texture\(|uniform|diffuseColor|outgoingLight|emissive/)
      assert.equal(material.aoMap, null); assert.equal(material.map, null)
    } finally { material.dispose() }
  }
})

test('oak keeps its original colour, texture and contact mask while using bounded nonmetallic reflection', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const floor = source.slice(source.indexOf('const FoyerOakFloor ='), source.indexOf('const FoyerAcousticExtension ='))
  assert.match(floor, /createVirtualChurchFoyerFloorMaterial\(texture, contactMask\)/)
  assert.match(floor, /<primitive object=\{material\} attach="material" \/>/)
  const map = new Texture(), contactMask = new Texture()
  const material = createVirtualChurchFoyerFloorMaterial(map, contactMask)
  try {
    assert.equal(material.map, map); assert.equal(material.aoMap, contactMask)
    assert.equal(material.vertexColors, true); assert.equal(material.roughness, .72)
    assert.equal(material.metalness, 0); assert.equal(material.envMapIntensity, .55)
    assert.ok(material.emissive.equals(new Color('#8f7658')))
    assert.equal(material.emissiveIntensity, .025)
    assert.equal(material.onBeforeCompile, virtualChurchFoyerFloorContactShader)
  } finally { material.dispose(); map.dispose(); contactMask.dispose() }
  assert.doesNotMatch(floor, /pointLight|directionalLight|Reflection|renderTarget|ShaderMaterial/)
  assert.match(source, /createVirtualChurchFoyerInteriorMaterial\(\.87\)/)
  assert.match(source, /createVirtualChurchFoyerInteriorMaterial\(\.86, true\)/)
})

test('offset non-instanced stair cheek receives shelter at its entrance-local Z', () => {
  const material = createVirtualChurchFoyerInteriorMaterial(.88, true, 11.835)
  const shader = { vertexShader: '#include <begin_vertex>', fragmentShader: '#include <aomap_fragment>' }
  try {
    material.onBeforeCompile(shader as never, null as never)
    assert.match(shader.vertexShader, /foyerPoint\.z \+= 11\.835/)
    assert.match(material.customProgramCacheKey(), /covered-11\.835$/)
  } finally { material.dispose() }
})

test('photographed handrail is one round opaque metal draw, not a pale architecture box', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const stair = source.slice(source.indexOf('const FoyerStair ='), source.indexOf('const FoyerStairPlanters ='))
  assert.match(stair, /vc:foyer-stair-metal-handrail/)
  assert.match(stair, /<cylinderGeometry args=\{\[\.02, \.02, foyerStairRailLength, 12\]\}/)
  assert.match(stair, /rotation=\{\[0, 0, foyerStairRailAngle - Math\.PI \/ 2\]\}/,
    'a Y-axis cylinder must rise toward the right wall, not fall toward it')
  assert.match(stair, /useMemo\(createVirtualChurchFoyerHandrailMaterial, \[\]\)/)
  assert.match(stair, /handrailMaterial\.dispose\(\)/)
  assert.doesNotMatch(stair, /pointLight|directionalLight|renderTarget|castShadow/)
  assert.doesNotMatch(source, /color: '#aab3af'/, 'remove the old square pale rail from the architecture instances')
})

test('round handrail preserves both original endpoints with a bounded 48-triangle mesh', () => {
  const { minX, maxX, minZ, rise } = stairLayout
  const length = Math.hypot(maxX - minX, rise)
  const angle = Math.atan2(rise, maxX - minX)
  const center = new Vector3((minX + maxX) / 2, 1.16 + rise / 2, minZ - .06)
  const geometry = new CylinderGeometry(.02, .02, length, 12)
  try {
    assert.equal(geometry.index.count / 3, 48)
    for (const [end, expected] of [
      [-1, new Vector3(minX, 1.16, minZ - .06)],
      [1, new Vector3(maxX, 1.16 + rise, minZ - .06)],
    ] as const) {
      const point = new Vector3(0, end * length / 2, 0)
        .applyAxisAngle(new Vector3(0, 0, 1), angle - Math.PI / 2).add(center)
      assert.ok(point.distanceTo(expected) < 1e-10)
    }
    const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
    assert.match(source, /foyerStairRailLength = Math\.hypot\(foyerStair\.maxX - foyerStair\.minX, foyerStair\.rise\)/)
    assert.match(source, /foyerStairRailPosition: \[number, number, number\] = \[\s*\(foyerStair\.minX \+ foyerStair\.maxX\) \/ 2, 1.16 \+ foyerStair\.rise \/ 2, foyerStair\.minZ - \.06/)
  } finally { geometry.dispose() }
})

test('handrail satin metal uses no new image, transparency, emission or render pass', () => {
  const material = createVirtualChurchFoyerHandrailMaterial()
  try {
    assert.equal(material.color.getHexString(), '9ea8a6')
    assert.equal(material.roughness, .32); assert.equal(material.metalness, .78)
    assert.equal(material.envMapIntensity, .55); assert.equal(material.envMap, null)
    assert.equal(material.map, null); assert.equal(material.normalMap, null)
    assert.equal(material.emissive.getHex(), 0); assert.equal(material.transparent, false)
  } finally { material.dispose() }
})
