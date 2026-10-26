import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { MeshStandardMaterial, ShaderLib } from 'three'
import { STUDY_DAYLIGHT, STUDY_MATERIAL_RESPONSE, studyFloorMaterialProps, studyWallMaterialProps, studyTableMaterialProps, studyVerticalTimberMaterialProps, studyRugMaterialProps, studyCushionMaterialProps } from '../src/views/virtualChurchStudyMaterials.ts'

const variants = [studyFloorMaterialProps, studyWallMaterialProps, studyTableMaterialProps, studyVerticalTimberMaterialProps, studyRugMaterialProps, studyCushionMaterialProps]
function compile(hook: MeshStandardMaterial['onBeforeCompile']) {
  const shader = { ...ShaderLib.standard, uniforms: { ...ShaderLib.standard.uniforms } }
  hook.call(new MeshStandardMaterial(), shader, null!)
  return shader // Hook wiring, not a WebGL driver compilation claim.
}

test('room surface hooks preserve lighting, shadows, alpha and tone mapping with no new uniforms/textures', () => {
  for (const variant of variants) {
    const shader = compile(variant.onBeforeCompile)
    assert.equal(Object.keys(shader.uniforms).length, Object.keys(ShaderLib.standard.uniforms).length)
    for (const chunk of ['lights_fragment_begin', 'shadowmap_pars_fragment', 'alphamap_fragment', 'tonemapping_fragment']) assert.ok(shader.fragmentShader.includes(`#include <${chunk}>`))
    assert.ok(shader.vertexShader.includes('#include <project_vertex>'))
    assert.ok(shader.fragmentShader.includes('#include <color_fragment>'))
    assert.doesNotMatch(shader.vertexShader + shader.fragmentShader, /undefined|NaN|Infinity/)
    assert.ok(Object.isFrozen(variant))
  }
  assert.equal(new Set(variants.map(variant => variant.customProgramCacheKey())).size, 6, 'distinct surface responses cannot share the wrong program')
})

test('oak flooring uses world scale, restrained board variation and footprint-filtered grain/seams', () => {
  const shader = compile(studyFloorMaterialProps.onBeforeCompile), r = STUDY_MATERIAL_RESPONSE
  assert.match(shader.vertexShader, /vStudyFloorXZ = \(modelMatrix \* vec4\(transformed, 1\.0\)\)\.xz/)
  assert.ok(shader.fragmentShader.includes(`vec2(${r.boardWidth}, ${r.boardLength})`))
  assert.match(shader.fragmentShader, /fwidth\(timber\)/)
  assert.match(shader.fragmentShader, /gap \/ footprint/)
  assert.match(shader.fragmentShader, /max\(seam.x, seam.y\)/)
  assert.match(shader.fragmentShader, /fwidth\(broadPhase\)/)
  assert.match(shader.fragmentShader, /fwidth\(finePhase\)/)
  assert.ok(r.boardWidth >= .18 && r.boardWidth <= .24)
  assert.ok(r.boardVariation <= .05 && r.seamStrength <= .12)
  assert.ok(r.floorBroadGrain + r.floorFineGrain <= .04)
  // Even the strongest possible close-view seam/variation/grain stays bounded.
  const min = (1 - .5 * r.boardVariation - r.floorBroadGrain - r.floorFineGrain) * (1 - r.seamStrength)
  const max = 1 + .5 * r.boardVariation + r.floorBroadGrain + r.floorFineGrain
  assert.ok(min > .82 && max < 1.06)
})

test('wall response uses the existing two inward faces, limits darkening and never stacks contact terms', () => {
  const shader = compile(studyWallMaterialProps.onBeforeCompile), r = STUDY_MATERIAL_RESPONSE
  assert.ok(Object.isFrozen(r))
  assert.ok(Math.abs(r.insideLeft - (-4.1 + .15 / 2)) < 1e-12)
  assert.ok(Math.abs(r.insideBack - (-3.6 + .15 / 2)) < 1e-12)
  assert.match(shader.vertexShader, /abs\(normal.y\)/)
  assert.match(shader.fragmentShader, /max\(foot \* 0.1, corner \* 0.1\)/)
  assert.ok(r.wallFootFade > .5 && r.wallCornerFade > .8)
  assert.ok(r.wallFootStrength <= .1 && r.wallCornerStrength <= .1)
})

test('tabletop and legs use local wood axes with derivative fade, no new scene geometry or character edits', () => {
  assert.match(compile(studyTableMaterialProps.onBeforeCompile).fragmentShader, /vStudyTimberPoint.xz/)
  assert.match(compile(studyVerticalTimberMaterialProps.onBeforeCompile).fragmentShader, /vStudyTimberPoint.xy/)
  for (const props of [studyTableMaterialProps, studyVerticalTimberMaterialProps]) {
    const shader = compile(props.onBeforeCompile)
    assert.match(shader.vertexShader, /vStudyTimberPoint = transformed/)
    assert.match(shader.fragmentShader, /fwidth\(broadPhase\)/)
    assert.match(shader.fragmentShader, /fwidth\(finePhase\)/)
  }
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
  assert.equal((view.match(/\.\.\.studyWallMaterialProps/g) ?? []).length, 2)
  assert.equal((view.match(/\.\.\.studyFloorMaterialProps/g) ?? []).length, 1)
  assert.match(view, /batch.id === 'chair-legs' \? studyVerticalTimberMaterialProps : batch.id === 'chair-upholstery' \? studyCushionMaterialProps : \{\}/)
  assert.match(view, /color="#8b613d" roughness=\{.66\} \{\.\.\.studyTableMaterialProps\}/)
  assert.match(view, /frameloop="demand"/)
  assert.match(view, /Concept room/)
  assert.match(view, /shadow-mapSize=\{\[shadowMapSize, shadowMapSize\]\}/)
  const source = readFileSync(new URL('../src/views/virtualChurchStudyMaterials.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source.replace(/\/\/[^\r\n]*/g, ''), /Texture|Loader|fetch\(|useFrame|requestAnimationFrame|setTimeout|uniform|Geometry/)
})

test('fabric weave fades below pixel size and cannot displace furniture or add texture loads', () => {
  assert.match(compile(studyRugMaterialProps.onBeforeCompile).vertexShader, /vStudyFabricPoint = transformed.xy/)
  for (const props of [studyRugMaterialProps, studyCushionMaterialProps]) {
    const shader = compile(props.onBeforeCompile)
    assert.match(shader.fragmentShader, /fwidth\(fabricPhase\)/)
    assert.match(shader.fragmentShader, /diffuseColor.rgb \*= 1.0 \+ fabricWeave/)
    assert.match(shader.fragmentShader, /vec2\(.012\)/)
    assert.doesNotMatch(shader.vertexShader, /transformed\s*[+*]?=/)
    assert.deepEqual(shader.fragmentShader.match(/uniform [^;]+;/g), ShaderLib.standard.fragmentShader.match(/uniform [^;]+;/g))
    assert.equal((shader.fragmentShader.match(/texture2D\(/g) ?? []).length, (ShaderLib.standard.fragmentShader.match(/texture2D\(/g) ?? []).length)
  }
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
  assert.equal((view.match(/\.\.\.studyRugMaterialProps/g) ?? []).length, 2)
})

test('calm daylight retains one cached device-sized shadow and concept-room scope', () => {
  assert.ok(Object.isFrozen(STUDY_DAYLIGHT))
  assert.ok(STUDY_DAYLIGHT.shadowIntensity > .5 && STUDY_DAYLIGHT.shadowIntensity < 1)
  assert.ok(STUDY_DAYLIGHT.shadowRadius > 1 && STUDY_DAYLIGHT.shadowRadius < 3)
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchStudyRoomView.tsx', import.meta.url))
  assert.equal((view.match(/<directionalLight /g) ?? []).length, 1)
  assert.match(view, /shadow-intensity=\{STUDY_DAYLIGHT.shadowIntensity\}/)
  assert.match(view, /shadow-radius=\{STUDY_DAYLIGHT.shadowRadius\}/)
  assert.match(view, /gl.shadowMap.autoUpdate = false/)
  assert.match(view, /shadowMapSize=\{Math.min\(1024, performancePreset.shadowMapSize\)\}/)
  assert.match(view, /Concept room/)
})
