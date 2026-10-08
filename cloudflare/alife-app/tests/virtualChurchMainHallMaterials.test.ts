import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { Color, MeshStandardMaterial, Scene, ShaderLib, Texture, WebGLRenderTarget } from 'three'
import { MAIN_HALL_CHAIR_APPEARANCE, MAIN_HALL_CEILING_APPEARANCE, MAIN_HALL_CEILING_BOUNCE, MAIN_HALL_CEILING_CONTACT_GLSL, MAIN_HALL_MATERIAL_RESPONSE, MAIN_HALL_ENVIRONMENT_RESPONSE, attachMainHallEnvironment, mainHallCeilingShader, mainHallChairFabricShader, mainHallChairFabricProgramKey, mainHallCarpetShader, mainHallCarpetProgramKey, mainHallWallContactShader, mainHallWallContactProgramKey, mainHallTimberShader, mainHallTimberProgramKey } from '../src/views/virtualChurchMainHallMaterials.ts'
import { MAIN_HALL_DIMENSIONS } from '../src/views/virtualChurchMainHallLayout.ts'

const compile = (hook: MeshStandardMaterial['onBeforeCompile']) => {
  const shader = { ...ShaderLib.standard, uniforms: { ...ShaderLib.standard.uniforms } }
  // Compile-hook integration, not a WebGL driver compilation claim.
  hook.call(new MeshStandardMaterial(), shader, null!)
  return shader
}

test('pale matte ceiling uses existing standard illumination and retains the diffuser/contact hook', () => {
  const look = MAIN_HALL_CEILING_APPEARANCE
  assert.ok(Object.isFrozen(look))
  const material = new MeshStandardMaterial(look)
  assert.equal(material.toneMapped, true)
  assert.equal(material.metalness, 0)
  assert.equal(material.roughness, 1)
  assert.equal(material.emissiveIntensity, 1)
  assert.equal(material.emissive.getHex(), 0)
  material.dispose()
  const source = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url),'utf8')
  const ceiling = source.split('name="main-hall-ceiling"')[1].split('</mesh>')[0]
  assert.match(ceiling, /<boxGeometry args=\{\[width, \.08, depth\]\}/)
  assert.match(ceiling, /<meshStandardMaterial \{\.\.\.MAIN_HALL_CEILING_APPEARANCE\}/)
  assert.match(ceiling, /onBeforeCompile=\{ceilingDiffuserShader\}/)
  assert.match(ceiling, /main-hall-ceiling-diffusers-v3/)
  assert.doesNotMatch(ceiling, /toneMapped|emissive|receiveShadow|meshBasicMaterial/)
  assert.match(source, /const ceilingDiffuserShader: MeshStandardMaterial\['onBeforeCompile'\]/)
  assert.match(source, /ceilingDiffuserShader: MeshStandardMaterial\['onBeforeCompile'\] = mainHallCeilingShader/)
  const shader = compile(mainHallCeilingShader)
  assert.match(shader.fragmentShader, /ventRing \* \.22 \+ ventCentre \* \.04/)
  assert.ok(shader.fragmentShader.includes(MAIN_HALL_CEILING_CONTACT_GLSL))
})

test('ceiling bounce is static, underside-only and keeps the standard lighting pipeline', () => {
  const bounce = MAIN_HALL_CEILING_BOUNCE
  assert.ok(Object.isFrozen(bounce) && Object.isFrozen(bounce.irradiance))
  assert.ok(bounce.irradiance.every(value => value >= 1 && value <= 1.3))
  assert.ok(bounce.edgeFactor >= .8 && bounce.edgeFactor < 1)
  assert.ok(bounce.fade >= 4 && bounce.fade <= 6)
  const shader = compile(mainHallCeilingShader)
  assert.match(shader.vertexShader, /vHallCeilingUnder = step\(0\.5, -normal\.y\)/)
  assert.match(shader.fragmentShader, /irradiance \+= vec3\([^\n]+\) \* vHallCeilingUnder \* ceilingBounceShape/)
  assert.match(shader.fragmentShader, /#if defined\(RE_IndirectDiffuse\)/)
  for (const chunk of ['lights_fragment_begin', 'lights_fragment_maps', 'lights_fragment_end', 'tonemapping_fragment']) {
    assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`))
  }
  assert.ok(shader.fragmentShader.indexOf('irradiance +=') > shader.fragmentShader.indexOf('#include <lights_fragment_maps>'))
  assert.ok(shader.fragmentShader.indexOf('irradiance +=') < shader.fragmentShader.indexOf('#include <lights_fragment_end>'))
  assert.equal(Object.keys(shader.uniforms).length, Object.keys(ShaderLib.standard.uniforms).length)
  assert.doesNotMatch(shader.vertexShader + shader.fragmentShader, /undefined|NaN|Infinity|uniform float.*time/)
})

test('chair appearance is bounded wine/dark satin, with explicit finish only on existing frame batches', () => {
  const look = MAIN_HALL_CHAIR_APPEARANCE
  for (const value of [look, look.seatColors, look.backColors, look.frame]) assert.ok(Object.isFrozen(value))
  for (const palette of [look.seatColors, look.backColors]) {
    assert.equal(palette.length, 3)
    const luminances = palette.map(hex => {
      const c = new Color(hex)
      assert.ok(c.r > c.b && c.b > c.g)
      return c.r * .2126 + c.g * .7152 + c.b * .0722
    })
    for (const value of luminances) assert.ok(value > .04 && value < .13)
    assert.ok(Math.max(...luminances) - Math.min(...luminances) < .02)
  }
  assert.ok(look.frame.metalness >= 0 && look.frame.metalness <= .3)
  assert.ok(look.frame.roughness >= .5 && look.frame.roughness <= .7)
  const frame = new Color(look.frame.color)
  assert.ok(Math.max(frame.r, frame.g, frame.b) < .05)
  const source = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url),'utf8')
  const frames = [...source.matchAll(/<Instances name="([^"]+)"[^\n]+\{\.\.\.chairFrameFinish\}/g)].map(match => match[1])
  assert.deepEqual(frames, ['main-hall-chair-legs','main-hall-chair-linked-frames','main-hall-chair-back-frames'])
  assert.match(source, /roughness=\{roughness \?\? \(rounded \? \.93 : metalness > 0 \? \.48 : \.91\)\}/)
  assert.doesNotMatch(source, /#9da5a4/)
  // These numerical art-direction guards are not a rendered beauty test.
})

test('room response hooks retain the actual standard material pipeline', () => {
  const wall = compile(mainHallWallContactShader)
  assert.match(wall.vertexShader, /vHallWallPoint = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xyz/)
  assert.match(wall.vertexShader, /vHallWallFace = vec2\(1\.0 - smoothstep\(0\.1, 0\.3, abs\(normal\.y\)\), step\(0\.5, abs\(normal\.x\)\)\)/)
  assert.match(wall.fragmentShader, /float hallContact = max\(max\(/)
  assert.match(wall.fragmentShader, /diffuseColor\.rgb \*= 1\.0 - hallContact \* vHallWallFace\.x/)
  assert.ok(wall.fragmentShader.includes(`${(MAIN_HALL_DIMENSIONS.width / 2).toFixed(2)} - abs(vHallWallPoint.x)`))
  assert.ok(wall.fragmentShader.includes(`${(MAIN_HALL_DIMENSIONS.depth / 2).toFixed(2)} - abs(vHallWallPoint.z)`))
  assert.equal(Object.keys(wall.uniforms).length, Object.keys(ShaderLib.standard.uniforms).length)
  for (const source of [wall.vertexShader, wall.fragmentShader]) assert.doesNotMatch(source, /undefined|NaN|Infinity/)
  assert.match(wall.fragmentShader, /#include <lights_fragment_begin>/)
  assert.match(wall.fragmentShader, /#include <tonemapping_fragment>/)
  assert.equal(mainHallWallContactProgramKey(), 'main-hall-wall-contact-v1')
})

test('shell contact fades stay shallow and do not stack into black bands', () => {
  const r = MAIN_HALL_MATERIAL_RESPONSE
  assert.ok(Object.isFrozen(r))
  for (const strength of [r.wallFootStrength, r.wallCrownStrength, r.wallCornerStrength, r.ceilingEdgeStrength]) assert.ok(strength > 0 && strength <= .15)
  for (const fade of [r.wallFootFade, r.wallCrownFade, r.wallCornerFade, r.ceilingEdgeFade]) assert.ok(fade >= .6 && fade <= 1.5)
  assert.match(MAIN_HALL_CEILING_CONTACT_GLSL, /min\(11\.60 - abs\(vHallCeilingXZ\.x\), 11\.00 - abs\(vHallCeilingXZ\.y\)\)/)
  assert.match(MAIN_HALL_CEILING_CONTACT_GLSL, /hallCeilingContact \* 0\.15 \* vHallCeilingUnder/)
  assert.doesNotMatch(MAIN_HALL_CEILING_CONTACT_GLSL, /texture|uniform|discard/)
})

test('timber is UV-bound, low contrast and footprint-filtered without textures', () => {
  const wood = compile(mainHallTimberShader)
  assert.match(wood.vertexShader, /vHallTimberUv = uv/)
  assert.match(wood.fragmentShader, /fwidth\(timberBroadPhase\)/)
  assert.match(wood.fragmentShader, /fwidth\(timberFinePhase\)/)
  assert.match(wood.fragmentShader, /0\.045 \* timberBroadWeight/)
  assert.match(wood.fragmentShader, /0\.015 \* timberFineWeight/)
  assert.match(wood.fragmentShader, /diffuseColor\.rgb \*= 1\.0 \+ timberGrain/)
  assert.equal(mainHallTimberProgramKey(), 'main-hall-timber-grain-v1')
  assert.equal(Object.keys(wood.uniforms).length, Object.keys(ShaderLib.standard.uniforms).length)
  assert.doesNotMatch(wood.fragmentShader.slice(wood.fragmentShader.indexOf('float timberWarp'),wood.fragmentShader.indexOf('#include <alphamap_fragment>')), /sampler|texture|discard|gl_FragColor/)
})

test('material response is limited to existing main-hall shell and timber batches', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url),'utf8')
  assert.equal((source.match(/onBeforeCompile=\{mainHallWallContactShader\}/g)??[]).length, 4)
  assert.equal((source.match(/<Instances[^\n]+ timber receiveShadow \/>/g)??[]).length, 2)
  assert.match(source, /name="main-hall-side-slatting"[^\n]+ timber receiveShadow \/>/)
  assert.match(source, /name="main-hall-back-slatting"[^\n]+ timber receiveShadow \/>/)
  assert.match(source, /ceilingDiffuserShader: MeshStandardMaterial\['onBeforeCompile'\] = mainHallCeilingShader/)
  assert.match(source, /<Canvas shadows="percentage" frameloop="demand"/)
  assert.match(source, /lowDetail=\{performancePreset\.isMobile\}/)
  assert.doesNotMatch(source, /TextureLoader|useLoader|<(?:pointLight|spotLight|rectAreaLight)\b/)
})

test('upholstery and carpet filter distant weave, fibres and seams in the standard pipeline', () => {
  const fabric = compile(mainHallChairFabricShader), carpet = compile(mainHallCarpetShader)
  for (const shader of [fabric, carpet]) {
    assert.equal(Object.keys(shader.uniforms).length, Object.keys(ShaderLib.standard.uniforms).length)
    for (const chunk of ['color_fragment','lights_fragment_begin','alphamap_fragment','tonemapping_fragment']) assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`))
    assert.doesNotMatch(shader.vertexShader + shader.fragmentShader, /undefined|NaN|Infinity/)
  }
  assert.match(fabric.fragmentShader, /fwidth\(weavePhase\)/)
  assert.match(fabric.fragmentShader, /weaveWeight.x \* weaveWeight.y/)
  assert.match(fabric.fragmentShader, /\.052 \+ footprint/)
  assert.match(fabric.fragmentShader, /\(\.99 \+ weave \* \.01\) \* mix\(\.95, 1.0, piping\)/)
  assert.match(carpet.fragmentShader, /fwidth\(carpetTile\)/)
  assert.match(carpet.fragmentShader, /vec2\(\.012\) \/ footprint/)
  assert.match(carpet.fragmentShader, /max\(seams.x, seams.y\)/)
  assert.match(carpet.fragmentShader, /fwidth\(finePhase\)/)
  assert.match(carpet.fragmentShader, /fwidth\(broadPhase\)/)
  assert.match(carpet.fragmentShader, /mod\(cell.x \+ cell.y, 2.0\)/)
  assert.equal(mainHallChairFabricProgramKey(), 'main-hall-chair-fabric-v2')
  assert.equal(mainHallCarpetProgramKey(), 'main-hall-carpet-v3')
  assert.equal(new Set([mainHallChairFabricProgramKey(),mainHallCarpetProgramKey(),mainHallTimberProgramKey(),mainHallWallContactProgramKey()]).size, 4)
  // Analytic extrema only, not rendered colour or an image-quality approval.
  assert.ok((.99-.01)*.95 > .93 && .99+.01 <= 1)
  assert.ok(.985-.022-.012-.025 > .92 && .985+.058+.022+.012 < 1.08)
})

test('room-owned environment restores prior scene values and disposes once, without sharing targets', () => {
  const scene = new Scene(), other = new Scene(), previous = new Texture()
  const first = new WebGLRenderTarget(336,256), second = new WebGLRenderTarget(336,256)
  scene.environment = previous; scene.environmentIntensity = .7
  let firstDisposals = 0, secondDisposals = 0
  first.addEventListener('dispose', () => { firstDisposals++ })
  second.addEventListener('dispose', () => { secondDisposals++ })
  const release = attachMainHallEnvironment(scene, first), releaseOther = attachMainHallEnvironment(other, second)
  assert.equal(scene.environment, first.texture)
  assert.equal(scene.environmentIntensity, .16)
  release(); release()
  assert.equal(firstDisposals, 1)
  assert.equal(scene.environment, previous)
  assert.equal(scene.environmentIntensity, .7)
  assert.equal(other.environment, second.texture)
  assert.equal(secondDisposals, 0)
  releaseOther()
  assert.equal(secondDisposals, 1)
  assert.equal(other.environment, null)
  previous.dispose()
})

test('environment replay releases old targets and an old cleanup cannot overwrite a new scene owner', () => {
  const scene = new Scene(), first = new WebGLRenderTarget(), second = new WebGLRenderTarget()
  const initial = attachMainHallEnvironment(scene, first)
  initial() // StrictMode effect cleanup before the second setup.
  const final = attachMainHallEnvironment(scene, second)
  assert.equal(scene.environment, second.texture)
  initial()
  assert.equal(scene.environment, second.texture)
  const replacement = new Texture()
  scene.environment = replacement; scene.environmentIntensity = .8
  final()
  assert.equal(scene.environment, replacement)
  assert.equal(scene.environmentIntensity, .8)
  replacement.dispose()
})

test('environment is generated once per mount at bounded resolution, not fetched or refreshed per frame', () => {
  assert.ok(Object.isFrozen(MAIN_HALL_ENVIRONMENT_RESPONSE))
  assert.equal(MAIN_HALL_ENVIRONMENT_RESPONSE.size, 64)
  const view = readFileSync(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url),'utf8')
  const environment = view.slice(view.indexOf('function HallEnvironment()'),view.indexOf('// Structex'))
  assert.match(environment, /generator.fromScene\(room, \.04, \.1, 100, \{ size: MAIN_HALL_ENVIRONMENT_RESPONSE.size \}\)/)
  assert.match(environment, /const release = attachMainHallEnvironment\(scene, target\)/)
  assert.match(environment, /useLayoutEffect\(\(\) =>/,
    'the final environment must exist before the first demand-frame submission')
  assert.match(environment, /return release/)
  assert.match(environment, /target\?\.dispose\(\)/)
  assert.match(environment, /finally \{ generator.dispose\(\); room.dispose\(\) \}/)
  assert.doesNotMatch(environment, /fetch\(|Loader|useFrame|setTimeout|requestAnimationFrame/)
  assert.equal((view.match(/<HallEnvironment \/>/g)??[]).length,1)
  assert.match(view, /roughness=\{roughness \?\? \(rounded \? \.93 : metalness > 0 \? \.48 : \.91\)\}/)
  assert.match(view, /2017 photo reference/)
  assert.match(view, /not represent the 2026|2026 site|2026 conditions|2026 年现状/)
})
