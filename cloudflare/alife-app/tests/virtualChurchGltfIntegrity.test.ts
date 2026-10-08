import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'
import { DataTexture, Group, MeshBasicMaterial, Texture } from 'three'
import { GLTFLoader, type GLTF, type GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { assertVirtualChurchGltfTextures, createVirtualChurchGltfIntegrityPlugin, inspectVirtualChurchGltfTextures, VirtualChurchGltfTextureIntegrityError } from '../src/views/virtualChurchGltfIntegrity.ts'

const makeGltf = ({ data = new Uint8Array(16), includeTexture = true } = {}) => {
  const material = new MeshBasicMaterial()
  const texture = new DataTexture(data, data.length > 0 ? 2 : 0, data.length > 0 ? 2 : 0)
  const normal = new DataTexture(new Uint8Array(16), 2, 2)
  const coat = new DataTexture(new Uint8Array(16), 2, 2)
  if (includeTexture) {
    material.map = texture
    Object.assign(material, { normalMap: normal, clearcoatMap: coat })
  }
  const associations = new Map()
  associations.set(material, { materials: 0 })
  // The loader may reuse one Texture object for several texture definitions;
  // its object-keyed association map is therefore not an integrity inventory.
  if (includeTexture) associations.set(texture, { textures: 1 })
  const gltf = {
    scene: new Group(), scenes: [], animations: [], cameras: [], asset: {}, userData: {},
    parser: {
      json: {
        materials: [
          { pbrMetallicRoughness: { baseColorTexture: { index: 1 } }, normalTexture: { index: 2 }, extensions: { KHR_materials_clearcoat: { clearcoatTexture: { index: 3 } } } },
          { emissiveTexture: { index: 4 } }, // unused material must not block runtime.
        ],
        textures: [{ source: 0 }, { source: 1 }, { source: 2 }, { extensions: { EXT_texture_webp: { source: 3 } } }],
        images: [{ uri: 'unused.png' }, { uri: 'base.png' }, { uri: 'normal.png' }, { uri: 'coat.webp' }],
      },
      associations,
    } as unknown as GLTFParser,
  } as GLTF
  return { gltf, material, texture, normal, coat }
}

test('checks every texture used by scene materials, including extension slots, but ignores unused materials', () => {
  const f = makeGltf()
  assert.deepEqual(assertVirtualChurchGltfTextures(f.gltf), {
    requiredTextureIndices: [1, 2, 3], issues: [],
  })
  ;[f.texture, f.normal, f.coat].forEach(texture => texture.dispose()); f.material.dispose()
})

test('reports missing definitions, swallowed loads and zero-sized decoded images with useful URIs', () => {
  const missingLoad = makeGltf({ includeTexture: false })
  let result = inspectVirtualChurchGltfTextures(missingLoad.gltf)
  assert.deepEqual(result.issues, [
    { textureIndex: 1, imageIndex: 1, uri: 'base.png', reason: 'not-loaded' },
    { textureIndex: 2, imageIndex: 2, uri: 'normal.png', reason: 'not-loaded' },
    { textureIndex: 3, imageIndex: 3, uri: 'coat.webp', reason: 'not-loaded' },
  ])
  const empty = makeGltf({ data: new Uint8Array() })
  result = inspectVirtualChurchGltfTextures(empty.gltf)
  assert.equal(result.issues[0].reason, 'empty-image')
  empty.gltf.parser.json.materials[0].normalTexture.index = 99
  assert.equal(inspectVirtualChurchGltfTextures(empty.gltf).issues.at(-1)?.reason, 'missing-definition')
  assert.throws(() => assertVirtualChurchGltfTextures(missingLoad.gltf), (error) =>
    error instanceof VirtualChurchGltfTextureIntegrityError
      && error.gltf === missingLoad.gltf
      && error.message.includes('base.png'))
  ;[missingLoad.texture, missingLoad.normal, missingLoad.coat, empty.texture, empty.normal, empty.coat]
    .forEach(texture => texture.dispose())
  missingLoad.material.dispose(); empty.material.dispose()
})

test('actual church loader asserts integrity before leasing, preparation and ready signalling', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const component = ast.statements.filter(ts.isVariableStatement).flatMap(statement => [...statement.declarationList.declarations])
    .find(declaration => declaration.name.getText(ast) === 'LoadedChurchHeroAsset')
  assert.ok(component)
  const text = component.getText(ast)
  const assertion = text.indexOf('assertVirtualChurchGltfTextures(asset)')
  assert.ok(assertion > text.indexOf('useLoader(GLTFLoader'))
  assert.ok(assertion < text.indexOf('VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain'))
  assert.ok(assertion < text.indexOf('usePreparedReviewAsset'))
  assert.ok(assertion < text.indexOf('useVirtualChurchRenderedAssetSignal'))
})

test('V3 avatar rejects incomplete textures before it becomes visible', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  const ast = ts.createSourceFile('view.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const declarations = ast.statements.filter(ts.isVariableStatement)
    .flatMap(statement => [...statement.declarationList.declarations])
  const avatar = declarations.find(declaration => declaration.name.getText(ast) === 'GateASkinnedFemaleHero')
  const boundary = ast.statements.filter(ts.isClassDeclaration)
    .find(statement => statement.name?.text === 'GateAHeroAssetBoundary')
  assert.ok(avatar)
  assert.ok(boundary)
  const avatarText = avatar.getText(ast)
  const assertion = avatarText.indexOf('assertVirtualChurchGltfTextures(gltf)')
  assert.ok(assertion > avatarText.indexOf('useLoader(GLTFLoader'))
  assert.ok(assertion < avatarText.indexOf('VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES.retain'))
  assert.ok(assertion < avatarText.indexOf('const avatarReady'))
  assert.match(boundary.getText(ast), /error instanceof VirtualChurchGltfTextureIntegrityError/)
  assert.match(boundary.getText(ast), /releaseLoadedGltfResource\(this\.props\.assetPath, error\.gltf\)/)
})

// Use the installed GLTFLoader parser, not a mock of its success/error order.
const parserFixture = JSON.stringify({
  asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }],
  nodes: [{ mesh: 0 }], meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  buffers: [{ byteLength: 36, uri: `data:application/octet-stream;base64,${Buffer.alloc(36).toString('base64')}` }],
  bufferViews: [{ buffer: 0, byteLength: 36 }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [0, 0, 0] }],
  materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }],
  textures: [{ source: 0 }], images: [{ uri: 'atlas.png' }],
})

test('real parser rejects swallowed texture failures before successful completion; a fresh parse recovers', async () => {
  let completeTexture = false
  const loader = new GLTFLoader()
  loader.register(() => ({
    name: 'test_texture_dependency',
    // Inject only dependency bytes; Node has no browser ProgressEvent API.
    loadBufferView: () => Promise.resolve(new ArrayBuffer(36)),
    loadTexture: () => Promise.resolve(completeTexture ? new DataTexture(new Uint8Array(16), 2, 2) : null),
  }))
  // Without the hook, Three resolves a model with this nullable dependency.
  const incomplete = await loader.parseAsync(parserFixture, '/v3/buildings/')
  assert.ok(inspectVirtualChurchGltfTextures(incomplete).issues.length > 0)
  loader.register(parser => createVirtualChurchGltfIntegrityPlugin(parser, '/v3/buildings/church.glb', 'https://local.test/'))
  await assert.rejects(loader.parseAsync(parserFixture, '/v3/buildings/'), VirtualChurchGltfTextureIntegrityError)
  completeTexture = true
  const recovered = await loader.parseAsync(parserFixture, '/v3/buildings/')
  assert.equal(assertVirtualChurchGltfTextures(recovered).issues.length, 0)
  recovered.scene.traverse(node => {
    if ('isMesh' in node && node.isMesh) {
      const mesh = node as import('three').Mesh
      mesh.geometry.dispose()
      const material = mesh.material as MeshBasicMaterial
      material.map?.dispose()
      material.dispose()
    }
  })
})

test('integrity plugin limits the shared loader to the selected directory and origin', async () => {
  const incomplete = makeGltf({ includeTexture: false }).gltf
  for (const path of ['/vehicles/', '/v3/characters/', 'https://other.test/v3/buildings/']) {
    const parser = { options: { path } } as GLTFParser
    await assert.doesNotReject(() => createVirtualChurchGltfIntegrityPlugin(parser, '/v3/buildings/church.glb', 'https://local.test/').afterRoot(incomplete))
  }
  const parser = { options: { path: 'https://local.test/v3/buildings/' } } as GLTFParser
  await assert.rejects(() => createVirtualChurchGltfIntegrityPlugin(parser, '/v3/buildings/church.glb', 'https://local.test/').afterRoot(incomplete), VirtualChurchGltfTextureIntegrityError)
})

test('V3 registers a stable parser guard and explicit Canvas retry clears only unused church cache', () => {
  const source = readFileSync(new URL('../src/views/VirtualChurchView.tsx', import.meta.url), 'utf8')
  assert.match(source, /if \(visualVersion === 'v3'\) loader\.register\(installVirtualChurchGltfIntegrity\)/)
  const retry = source.slice(source.indexOf('const retryWebGl ='), source.indexOf('const retryCharacter ='))
  assert.ok(retry.indexOf('clearFailedGltfAsset(CHURCH_HERO_ASSET_PATH)') < retry.indexOf('setCanvasSessionKey'))
  assert.match(retry, /if \(config3D\.visualVersion === 'v3'\) clearFailedGltfAsset/)
  const clear = source.slice(source.indexOf('const clearFailedGltfAsset ='), source.indexOf('const releaseLoadedGltfResource ='))
  assert.match(clear, /if \(!VIRTUAL_CHURCH_GLTF_RESOURCE_LEASES\.has\(assetPath\)\)/)
})
