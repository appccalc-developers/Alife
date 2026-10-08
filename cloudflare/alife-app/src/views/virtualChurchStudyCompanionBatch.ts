import { Color, Group, InstancedMesh, Material, Matrix4, Mesh, MeshBasicMaterial, MeshDepthMaterial, MeshStandardMaterial, Object3D, RGBADepthPacking, ShaderChunk, Skeleton, SkinnedMesh, type BufferGeometry } from 'three'
import { STUDY_COMPANION_SEATS } from './virtualChurchStudyPose.ts'

// Room-only: a combined palette contains five independent rigs. Instance i
// addresses only its own consecutive bone range, in main and shadow passes.
class StudySkinnedInstances extends InstancedMesh {
  readonly isSkinnedMesh = true
  readonly bindMatrix: Matrix4
  readonly bindMatrixInverse: Matrix4
  readonly skeleton: Skeleton
  constructor(geometry: BufferGeometry, material: Material, count: number, part: SkinnedMesh, palette: Skeleton) {
    super(geometry, material, count)
    this.bindMatrix = part.bindMatrix.clone()
    this.bindMatrixInverse = part.matrixWorld.clone().invert()
    this.skeleton = palette
    // All five people are always framed together. Do not cull using the
    // standing source geometry's bounds or compute a misleading seated bound.
    this.frustumCulled = false
    this.castShadow = part.castShadow
    this.receiveShadow = part.receiveShadow
    this.name = `study-instances-${part.name}`
    // No character picking is exposed in this concept room.
    this.raycast = () => {}
  }
}

function sameArray(a: ArrayLike<number>, b: ArrayLike<number>) {
  return a.length === b.length && Array.from(a).every((value, index) => value === b[index])
}

function sameGeometry(a: BufferGeometry, b: BufferGeometry) {
  if (a === b) return true
  if (a.groups.length || b.groups.length || a.drawRange.start !== b.drawRange.start || a.drawRange.count !== b.drawRange.count) return false
  const keys = Object.keys(a.attributes)
  if (keys.length !== Object.keys(b.attributes).length) return false
  if (!!a.index !== !!b.index || (a.index && b.index && !sameArray(a.index.array, b.index.array))) return false
  return keys.every(key => {
    const left = a.getAttribute(key), right = b.getAttribute(key)
    return right && 'array' in left && 'array' in right && left.itemSize === right.itemSize
      && left.normalized === right.normalized && left.array.constructor === right.array.constructor
      && sameArray(left.array, right.array)
  })
}

function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (a instanceof Color && b instanceof Color) return a.equals(b)
  if (typeof a === 'function' && typeof b === 'function') return a.toString() === b.toString()
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    // Textures must be borrowed by identity, never substitute an equal-looking
    // image or bypass different sampler/UV-transform state.
    if ('isTexture' in a || 'isTexture' in b) return false
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return false
}

function compatibleMaterial(a: Material, b: Material) {
  if (!(a instanceof MeshBasicMaterial || a instanceof MeshStandardMaterial)
    || a.type !== b.type || a.customProgramCacheKey() !== b.customProgramCacheKey()) return false
  if (a.onBeforeCompile !== Material.prototype.onBeforeCompile
    && !(a.customProgramCacheKey() === 'study-companion-fabric-v1' && a.userData.studyFabricTint && b.userData.studyFabricTint)) return false
  if (!!a.userData.studyFabricTint !== !!b.userData.studyFabricTint) return false
  const ignored = new Set(['uuid', 'id', 'color', 'userData', 'version'])
  return Object.keys(a).every(key => ignored.has(key)
    || sameValue((a as unknown as Record<string, unknown>)[key], (b as unknown as Record<string, unknown>)[key]))
    && Object.keys(b).every(key => ignored.has(key) || key in a)
    && sameValue({ ...a.userData, studyFabricTint: undefined }, { ...b.userData, studyFabricTint: undefined })
}

export function studyInstanceSkinningChunk(bonesPerPerson: number) {
  if (!Number.isInteger(bonesPerPerson) || bonesPerPerson <= 0) throw new Error('Invalid study bone stride')
  const original = 'int j = int( i ) * 4;'
  if (!ShaderChunk.skinning_pars_vertex.includes(original)) throw new Error('Study skinning shader contract changed')
  return ShaderChunk.skinning_pars_vertex.replace(original, `int j = ( int( i ) + gl_InstanceID * ${bonesPerPerson} ) * 4;`)
}

/** Build only for the compatible, already posed room clones. Returns null for
 * mixed assets, morphs, non-matching binds/materials or geometry, leaving the
 * original rendering available. Does not edit a model, rig, map or source. */
export function createStudyCompanionBatch(models: Object3D[]) {
  if (models.length !== STUDY_COMPANION_SEATS.length) return null
  const parts = models.map(model => {
    model.updateMatrixWorld(true)
    const result: SkinnedMesh[] = []
    let unsupported = false
    model.traverse(node => {
      if (!(node instanceof Mesh)) return
      if (!(node instanceof SkinnedMesh) || Array.isArray(node.material)
        || Object.keys(node.geometry.morphAttributes).length || node.geometry.groups.length || node.children.length) unsupported = true
      else {
        for (let ancestor: Object3D | null = node; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) unsupported = true
        result.push(node)
      }
    })
    return unsupported ? [] : result
  })
  const first = parts[0]
  if (!first.length || parts.some(person => person.length !== first.length)) return null
  const rigs = parts.map(person => person[0].skeleton)
  const stride = rigs[0].bones.length
  for (let person = 0; person < models.length; person++) {
    if (rigs[person].bones.length !== stride || rigs[person].boneInverses.length !== stride) return null
    for (let part = 0; part < first.length; part++) {
      const a = first[part], b = parts[person][part]
      if (b.skeleton !== rigs[person] || a.name !== b.name || !a.bindMatrix.equals(b.bindMatrix)
        || !a.matrixWorld.equals(b.matrixWorld) || a.castShadow !== b.castShadow || a.receiveShadow !== b.receiveShadow
        || !sameGeometry(a.geometry, b.geometry) || !compatibleMaterial(a.material as Material, b.material as Material)
        || !rigs[0].boneInverses.every((matrix, index) => matrix.equals(rigs[person].boneInverses[index]))) return null
      const material = b.material as MeshStandardMaterial
      const fabric = material.userData.studyFabricTint as number[] | undefined
      if (fabric && (!sameArray(material.color.toArray(), fabric) || fabric.length !== 3)) return null
    }
  }
  const skinning = studyInstanceSkinningChunk(stride)
  const palette = new Skeleton(rigs.flatMap(rig => rig.bones), rigs.flatMap(rig => rig.boneInverses))
  const group = new Group()
  group.name = 'study-companions-batched'
  const instances: StudySkinnedInstances[] = []
  const ownedMaterials: Material[] = []
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    instances.forEach(mesh => mesh.dispose())
    ownedMaterials.forEach(material => material.dispose())
    palette.dispose()
    // Geometry, all maps and clone rigs belong to the loading attempt.
  }
  try {
    first.forEach((part, partIndex) => {
      const source = part.material as MeshBasicMaterial | MeshStandardMaterial
      const material = source.clone()
      ownedMaterials.push(material)
      material.color.setRGB(1, 1, 1)
      const fabric = !!source.userData.studyFabricTint
      material.onBeforeCompile = (shader, renderer) => {
        source.onBeforeCompile(shader, renderer)
        shader.vertexShader = shader.vertexShader.replace('#include <skinning_pars_vertex>', skinning)
        if (fabric) {
          shader.vertexShader = `varying vec3 vStudyFabricTint;\n${shader.vertexShader}`
            .replace('#include <color_vertex>', '#include <color_vertex>\nvStudyFabricTint = instanceColor;')
          shader.fragmentShader = shader.fragmentShader.replace('uniform vec3 studyFabricTint;', 'varying vec3 vStudyFabricTint;')
            .replaceAll('studyFabricTint *', 'vStudyFabricTint *')
        }
      }
      material.customProgramCacheKey = () => `study-instances-v1-${stride}-${source.customProgramCacheKey()}`
      const mesh = new StudySkinnedInstances(part.geometry, material, models.length, part, palette)
      instances.push(mesh)
      // Separate owned depth shader; normal and alpha-cutout shadow silhouettes
      // use exactly the same per-instance bone offset as the colour pass.
      const depth = new MeshDepthMaterial({ depthPacking: RGBADepthPacking })
      ownedMaterials.push(depth)
      depth.onBeforeCompile = shader => { shader.vertexShader = shader.vertexShader.replace('#include <skinning_pars_vertex>', skinning) }
      depth.customProgramCacheKey = () => `study-instance-depth-v1-${stride}`
      mesh.customDepthMaterial = depth
      models.forEach((_, index) => {
        const seat = STUDY_COMPANION_SEATS[index], transform = new Object3D()
        transform.position.set(...seat.position); transform.rotation.y = seat.yaw; transform.updateMatrix()
        mesh.setMatrixAt(index, new Matrix4().multiplyMatrices(transform.matrix, parts[index][partIndex].matrixWorld))
        mesh.setColorAt(index, (parts[index][partIndex].material as MeshStandardMaterial).color)
      })
      mesh.instanceMatrix.needsUpdate = true
      mesh.instanceColor!.needsUpdate = true
      group.add(mesh)
    })
    return { group, palette, instances, update: () => models.forEach(model => model.updateMatrixWorld(true)), dispose }
  } catch (error) { dispose(); throw error }
}
