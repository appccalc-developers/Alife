import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { BoxGeometry, DirectionalLight, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PCFShadowMap, PerspectiveCamera, Points, PointsMaterial, Scene, SkinnedMesh, Texture, VSMShadowMap, type WebGLRenderer, WebGLRenderTarget } from 'three'
import { createVirtualChurchShadowCache, installVirtualChurchShadowCache } from '../src/views/virtualChurchShadowCache.ts'

function fixture() {
  const scene = new Scene(), camera = new PerspectiveCamera()
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial()
  const parent = new Group(), mesh = new Mesh(geometry, material), light = new DirectionalLight()
  parent.scale.z = -1; parent.add(mesh); scene.add(parent, light)
  mesh.castShadow = true; light.castShadow = true
  const cache = createVirtualChurchShadowCache()
  const check = () => { scene.updateMatrixWorld(true); return cache.needsUpdate(scene, camera, PCFShadowMap) }
  const dispose = () => { geometry.dispose(); material.dispose(); light.dispose() }
  return { scene, camera, parent, mesh, geometry, material, light, check, dispose }
}

test('static shadows survive view changes but refresh for exact caster, light and layer changes', () => {
  const f = fixture()
  assert.equal(f.check(), true)
  assert.equal(f.check(), false)
  f.camera.position.set(20, 10, 30); f.camera.lookAt(0, 0, 0); f.camera.updateMatrixWorld()
  assert.equal(f.check(), false, 'camera motion does not change a directional shadow map')
  const nonCaster = new Mesh(f.geometry, f.material); f.scene.add(nonCaster)
  assert.equal(f.check(), false)
  nonCaster.position.x = 15; assert.equal(f.check(), false, 'non-shadow-casting character motion does not redraw static depth')
  const mutations = [
    () => { f.parent.rotation.y = 0.7 }, // moving door/parent, including source Z mirror
    () => { f.mesh.visible = false },
    () => { f.mesh.visible = true },
    () => { f.parent.visible = false },
    () => { f.parent.visible = true },
    () => { f.mesh.castShadow = false },
    () => { f.mesh.castShadow = true },
    () => { f.geometry.attributes.position.needsUpdate = true },
    () => { f.geometry.index!.needsUpdate = true },
    () => { f.geometry.groups[0].count = 3 },
    () => { f.material.visible = false },
    () => { f.material.visible = true },
    () => { f.material.needsUpdate = true },
    () => { f.light.position.x += 1 },
    () => { f.light.layers.set(1) },
    () => { f.light.layers.set(0) },
    () => { f.light.target.position.z += 1 },
    () => { f.light.shadow.mapSize.set(256, 256) },
    () => { f.light.shadow.needsUpdate = true },
    () => { f.light.shadow.camera.left -= 10; f.light.shadow.camera.updateProjectionMatrix() },
    () => { f.camera.layers.set(1) },
    () => { f.camera.layers.set(0) },
    () => { f.parent.remove(f.mesh) },
    () => { f.parent.add(f.mesh) },
  ]
  for (const mutate of mutations) {
    mutate(); assert.equal(f.check(), true, mutate.toString()); assert.equal(f.check(), false)
  }
  const instance = new InstancedMesh(f.geometry, f.material, 2); instance.castShadow = true
  f.scene.add(instance); assert.equal(f.check(), true); assert.equal(f.check(), false)
  instance.setMatrixAt(0, new Matrix4().makeTranslation(5, 0, 1)); instance.instanceMatrix.needsUpdate = true
  assert.equal(f.check(), true); assert.equal(f.check(), false)
  instance.count = 1; assert.equal(f.check(), true); assert.equal(f.check(), false)
  instance.dispose(); f.dispose()
})

test('deforming, alpha-tested and custom casters conservatively retain per-frame updates', () => {
  for (const kind of ['skin', 'morph', 'alpha', 'displacement', 'custom']) {
    const f = fixture()
    let skin: SkinnedMesh | undefined
    let texture: Texture | undefined
    if (kind === 'skin') { skin = new SkinnedMesh(f.geometry, f.material); skin.castShadow = true; f.scene.add(skin) }
    if (kind === 'morph') f.mesh.morphTargetInfluences = [0]
    if (kind === 'alpha') f.material.alphaTest = 0.5
    if (kind === 'displacement') f.material.displacementMap = texture = new Texture()
    if (kind === 'custom') f.mesh.onBeforeShadow = () => {}
    assert.equal(f.check(), true); assert.equal(f.check(), true, kind)
    texture?.dispose(); f.dispose()
  }
  const f = fixture(), cache = createVirtualChurchShadowCache()
  assert.equal(cache.needsUpdate(f.scene, f.camera, VSMShadowMap), true)
  assert.equal(cache.needsUpdate(f.scene, f.camera, VSMShadowMap), true)
  f.dispose()
})

test('untracked caster kinds never silently reuse a static depth map', () => {
  const f = fixture()
  const material = new PointsMaterial()
  const points = new Points(f.geometry, material); points.castShadow = true
  f.scene.add(points)
  assert.equal(f.check(), true); assert.equal(f.check(), true)
  f.scene.remove(points)
  // The previous dynamic draw contained these points, so their removal must
  // also invalidate before static reuse can resume.
  assert.equal(f.check(), true, 'removing a conservative-only caster invalidates its old shadow')
  assert.equal(f.check(), false)
  f.mesh.onBeforeShadow = () => {}
  assert.equal(f.check(), true); assert.equal(f.check(), true)
  f.mesh.onBeforeShadow = Object3D.prototype.onBeforeShadow
  assert.equal(f.check(), true, 'retiring a dynamic callback must clear its final depth state')
  assert.equal(f.check(), false)
  material.dispose(); f.dispose()
})

test('renderer integration preserves callbacks, explicit invalidation, prewarm and StrictMode cleanup', () => {
  const f = fixture()
  const renderer = { localClippingEnabled: false, clippingPlanes: [], shadowMap: { autoUpdate: true, needsUpdate: false, enabled: true, type: PCFShadowMap } } as unknown as WebGLRenderer
  let hooks = 0
  const previous = () => { hooks++ }
  f.scene.onBeforeRender = previous
  const target = new WebGLRenderTarget(1, 1)
  for (let replay = 0; replay < 2; replay++) {
    const dispose = installVirtualChurchShadowCache(f.scene, renderer)
    const draw = (offscreen = false) => {
      f.scene.updateMatrixWorld(true)
      f.scene.onBeforeRender(renderer, f.scene, f.camera, offscreen ? target : null)
      const update = renderer.shadowMap.needsUpdate
      renderer.shadowMap.needsUpdate = false // WebGLShadowMap consumes the dirty flag.
      return update
    }
    assert.equal(renderer.shadowMap.autoUpdate, false)
    assert.equal(draw(), true); assert.equal(draw(), false)
    renderer.shadowMap.needsUpdate = true
    assert.equal(draw(), true); assert.equal(draw(), false)
    assert.equal(draw(true), true); assert.equal(draw(), true); assert.equal(draw(), false)
    renderer.shadowMap.enabled = false; assert.equal(draw(), true)
    renderer.shadowMap.enabled = true; assert.equal(draw(), true)
    dispose()
    assert.equal(renderer.shadowMap.autoUpdate, true)
    assert.equal(renderer.shadowMap.needsUpdate, true)
    assert.equal(f.scene.onBeforeRender, previous)
  }
  assert.equal(hooks, 18)
  target.dispose(); f.dispose()
})

test('actual scene integration enables the cache only for V3 mobile without postprocessing', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const component = ast.statements.filter(ts.isVariableStatement).flatMap(s => [...s.declarationList.declarations])
    .find(d => d.name.getText(ast) === 'SiteScene')
  assert.ok(component)
  let effect: ts.Node | undefined
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useLayoutEffect'
      && node.arguments[0].getText(ast).includes('installVirtualChurchShadowCache')) effect = node.arguments[0]
    ts.forEachChild(node, visit)
  }
  visit(component); assert.ok(effect)
  for (const visualVersion of ['v2', 'v3']) for (const isMobile of [false, true]) for (const postProcessing of [false, true]) for (const profile3DEnabled of [false, true]) {
    let installs = 0
    let marks = 0
    const cleanup = () => {}
    const run = new Function('visualVersion', 'perfConfig', 'scene', 'gl', 'installVirtualChurchShadowCache', 'profile3DEnabled', 'performance', `return (${effect.getText(ast)})()`)
    const result = run(visualVersion, { isMobile, postProcessing }, {}, {}, () => { installs++; return cleanup }, profile3DEnabled, { mark: (name: string) => { assert.equal(name,'vc:site:layout-effect'); marks++ } })
    assert.equal(marks,profile3DEnabled ? 1 : 0)
    const enabled = visualVersion === 'v3' && isMobile && !postProcessing
    assert.equal(installs, enabled ? 1 : 0)
    assert.equal(result, enabled ? cleanup : undefined)
  }
})
