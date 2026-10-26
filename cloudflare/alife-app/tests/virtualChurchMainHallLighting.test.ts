import { readLocalizedSource } from './helpers/readLocalizedSource.cjs'
import assert from 'node:assert/strict'
import test from 'node:test'
import { BoxGeometry, Color, DirectionalLight, Frustum, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, PCFShadowMap, PerspectiveCamera, Scene, Vector3 } from 'three'
import { MAIN_HALL_DIMENSIONS } from '../src/views/virtualChurchMainHallLayout.ts'
import { MAIN_HALL_DAYLIGHT_KEY_POSITION } from '../src/views/virtualChurchMainHallWindows.ts'
import { MAIN_HALL_FILL_RESPONSE, MAIN_HALL_LIGHTING_TRACKS, MAIN_HALL_LIGHTING_HEADS, MAIN_HALL_STAGE_RIG, MAIN_HALL_SHADOW, mainHallShadowMapSize } from '../src/views/virtualChurchMainHallLighting.ts'
import { createVirtualChurchShadowCache } from '../src/views/virtualChurchShadowCache.ts'

test('historical ceiling channels run lengthwise while three independent lighting banks remain above the stage', () => {
  const rig = MAIN_HALL_STAGE_RIG
  assert.ok(Object.isFrozen(rig) && Object.isFrozen(rig.centersX) && Object.isFrozen(rig.channelXs))
  const channels = MAIN_HALL_LIGHTING_TRACKS.slice(0, 2)
  assert.equal(channels.length, 2)
  for (const channel of channels) {
    assert.equal(channel.position[2], 0)
    assert.ok(channel.scale[2] > MAIN_HALL_DIMENSIONS.depth * .95)
    assert.ok(channel.scale[0] < .1 && channel.scale[1] < .05)
  }
  assert.equal(MAIN_HALL_LIGHTING_TRACKS.length, 26)
  const stageFrontZ = MAIN_HALL_DIMENSIONS.stageZ + MAIN_HALL_DIMENSIONS.stageDepth / 2
  for (const part of MAIN_HALL_LIGHTING_TRACKS.slice(2)) {
    assert.ok(part.position[2] + part.scale[2] / 2 < stageFrontZ)
    assert.ok(part.position[1] + part.scale[1] / 2 <= MAIN_HALL_DIMENSIONS.height + 1e-9)
  }
  assert.equal(MAIN_HALL_LIGHTING_HEADS.length, 21)
  for (const head of MAIN_HALL_LIGHTING_HEADS) assert.ok(head.position[2] < stageFrontZ)
  // Geometry/draw bound, not measured FPS: same two instanced materials,
  // 23 extra boxes = 276 triangles for the whole room, not per chair.
  assert.equal((MAIN_HALL_LIGHTING_TRACKS.length - 3) * 12, 276)
  const source = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url))
  for (const [name, placement] of [['main-hall-lighting-tracks','MAIN_HALL_LIGHTING_TRACKS'],['main-hall-track-heads','MAIN_HALL_LIGHTING_HEADS']]) {
    assert.equal((source.match(new RegExp(`name="${name}"`, 'g')) ?? []).length, 1)
    assert.ok(source.includes(`name="${name}" placements={${placement}}`))
  }
  assert.doesNotMatch(source, /const lightingTracks|const trackHeads/)
})

test('bounded pale hemisphere fill stays subordinate to the window key without adding lights', () => {
  const fill = MAIN_HALL_FILL_RESPONSE
  assert.ok(Object.isFrozen(fill))
  assert.ok(fill.ambientIntensity > 0 && fill.ambientIntensity < .27)
  assert.ok(fill.hemisphereIntensity > .72 && fill.hemisphereIntensity <= 1.4)
  const sky = new Color(fill.skyColor), ground = new Color(fill.groundColor)
  assert.ok(sky.b > sky.r && sky.r > .8)
  assert.ok(ground.r > ground.g && ground.g > ground.b && ground.b > .2)
  // Check finite, directional diffuse response; visual approval remains a
  // rendered-photo comparison, not a claim that these values measure the hall.
  const response = (normalY: number) => ground.clone().lerp(sky, normalY * .5 + .5)
    .multiplyScalar(fill.hemisphereIntensity).addScalar(fill.ambientIntensity)
  for (const y of [-1, 0, 1]) assert.ok(response(y).toArray().every(v => Number.isFinite(v) && v > 0 && v < 2.1))
  assert.ok(response(1).b > response(-1).b * 2)
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url))
  assert.equal((view.match(/<ambientLight/g)??[]).length,1)
  assert.equal((view.match(/<hemisphereLight/g)??[]).length,1)
  assert.match(view,/<ambientLight intensity=\{MAIN_HALL_FILL_RESPONSE.ambientIntensity\}/)
  assert.match(view,/<hemisphereLight args=\{\[MAIN_HALL_FILL_RESPONSE.skyColor, MAIN_HALL_FILL_RESPONSE.groundColor, MAIN_HALL_FILL_RESPONSE.hemisphereIntensity\]\}/)
  assert.match(view,/<directionalLight position=\{MAIN_HALL_DAYLIGHT_KEY_POSITION\} intensity=\{1.65\} color="#fff6e8" castShadow/)
})

test('single bounded directional shadow camera covers the complete historical review shell at either resolution', () => {
  const light = new DirectionalLight()
  light.position.set(...MAIN_HALL_DAYLIGHT_KEY_POSITION)
  Object.assign(light.shadow.camera, MAIN_HALL_SHADOW.camera)
  light.shadow.camera.updateProjectionMatrix()
  light.updateMatrixWorld(true); light.shadow.updateMatrices(light)
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(light.shadow.camera.projectionMatrix, light.shadow.camera.matrixWorldInverse))
  for (const x of [-MAIN_HALL_DIMENSIONS.width/2, MAIN_HALL_DIMENSIONS.width/2])
    for (const y of [0,MAIN_HALL_DIMENSIONS.height])
      for (const z of [-MAIN_HALL_DIMENSIONS.depth/2,MAIN_HALL_DIMENSIONS.depth/2]) assert.ok(frustum.containsPoint(new Vector3(x,y,z)), `${x},${y},${z}`)
  assert.equal(mainHallShadowMapSize(false), 1024)
  assert.equal(mainHallShadowMapSize(true), 512)
  assert.ok(Object.isFrozen(MAIN_HALL_SHADOW) && Object.isFrozen(MAIN_HALL_SHADOW.camera))
  assert.ok(MAIN_HALL_SHADOW.intensity > .5 && MAIN_HALL_SHADOW.intensity < 1)
  light.dispose()
})

test('static instanced chair/door shadow state reuses camera motion and refreshes real geometry/door changes', () => {
  const scene = new Scene(), camera = new PerspectiveCamera(), light = new DirectionalLight()
  const geometry = new BoxGeometry(), material = new MeshStandardMaterial()
  const chairs = new InstancedMesh(geometry,material,360), door = new Group(), leaf = new Mesh(geometry,material)
  const transform = new Matrix4()
  for (let i=0;i<360;i++) chairs.setMatrixAt(i,transform.makeTranslation((i%30)*.56-8.4, .5, Math.floor(i/30)*.94-5.6))
  chairs.instanceMatrix.needsUpdate = true
  chairs.castShadow = true; leaf.castShadow = true; light.castShadow = true
  door.add(leaf); scene.add(chairs,door,light)
  const cache = createVirtualChurchShadowCache()
  const check = () => { scene.updateMatrixWorld(true); return cache.needsUpdate(scene,camera,PCFShadowMap) }
  assert.equal(check(),true); assert.equal(check(),false)
  camera.position.set(0,2,-8); camera.lookAt(0,1,8); assert.equal(check(),false)
  door.rotation.y = .5; assert.equal(check(),true); assert.equal(check(),false)
  chairs.setMatrixAt(0,transform.makeTranslation(1,1,1)); chairs.instanceMatrix.needsUpdate = true
  assert.equal(check(),true); assert.equal(check(),false)
  scene.remove(door); assert.equal(check(),true); assert.equal(check(),false)
  chairs.dispose(); geometry.dispose(); material.dispose(); light.dispose()
})

test('actual auditorium integration confines cached shadows to one light, four chair caster batches and room architecture', () => {
  const view = readLocalizedSource(new URL('../src/views/VirtualChurchMainHallView.tsx',import.meta.url))
  assert.equal((view.match(/<directionalLight/g)??[]).length,1)
  assert.equal((view.match(/<HallStaticShadows \/>/g)??[]).length,1)
  assert.match(view,/useLayoutEffect\(\(\) => installVirtualChurchShadowCache\(scene, gl\), \[scene, gl\]\)/)
  assert.match(view,/<Canvas shadows="percentage" frameloop="demand"/)
  const chairCasters=[...view.matchAll(/<Instances name="(main-hall-chair-[^"]+)"[^\n]*castShadow/g)].map(m=>m[1])
  assert.deepEqual(chairCasters,['main-hall-chair-legs','main-hall-chair-back-frames','main-hall-chair-seats','main-hall-chair-backs'])
  assert.match(view,/main-hall-openings-wall" castShadow receiveShadow/)
  assert.match(view,/MAIN_HALL_FOYER_EXIT_WIDTH \/ 4 - .025\), 1.2, 0\]} castShadow receiveShadow/)
  assert.doesNotMatch(view,/<(?:pointLight|spotLight|rectAreaLight)|<ContactShadows|<EffectComposer/)
  const cacheHook=view.slice(view.indexOf('function HallStaticShadows()'),view.indexOf('// Structex'))
  assert.doesNotMatch(cacheHook,/useFrame|setInterval|setTimeout|requestAnimationFrame/)
  assert.match(view,/rendererLastFrame/)
  assert.match(view,/data-main-hall-render/)
  assert.match(view,/if \(scene.onAfterRender === hook\) scene.onAfterRender = previous/)
  assert.match(view,/removeAttribute\('data-main-hall-render'\)/)
  assert.match(view,/not a record of the 2026 interior/)
})
