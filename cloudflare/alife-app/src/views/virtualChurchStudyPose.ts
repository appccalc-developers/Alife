import { Box3, Color, Mesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Quaternion, Vector3, type Material } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { gateAIsSkinMaterial, gateAIsOutfitMaterial, GATE_A_SKIN_UNLIT_COLOR } from './virtualChurchCharacterWardrobe.ts'
import { disposeVirtualChurchCharacterSkeletons, shareVirtualChurchOwnedCloneSkeletons } from './virtualChurchResourceLeaseContract.ts'
import { createStudyCompanionMotion } from './virtualChurchStudyMotion.ts'

// Five companions, with the sixth/front position reserved for the visitor.
export const STUDY_COMPANION_SEATS = [
  { angle: -100, tint: '#718f82', hairTint: '#4d372d' },
  { angle: -50, tint: '#b87576', hairTint: '#a47449' },
  { angle: 0, tint: '#6f8da8', hairTint: '#d0b887' },
  { angle: 50, tint: '#ae9665', hairTint: '#2f2927' },
  { angle: 100, tint: '#8c79a1', hairTint: '#b6a89a' },
].map(({ angle, tint, hairTint }) => ({
  position: [Math.sin(angle * Math.PI / 180) * 2.15, 0, -Math.cos(angle * Math.PI / 180) * 2.15] as [number, number, number],
  yaw: -angle * Math.PI / 180, tint, hairTint,
}))

/** A room-only reading pose. Never modifies the approved source rig or clips. */
export function createSeatedStudyCompanion(source: Object3D, tint: string, index = 0) {
  // Reject incompatible assets before allocating cloned skeletons/materials.
  const required = ['J_Bip_C_Hips', 'J_Bip_C_Head', ...['L', 'R'].flatMap(side =>
    ['UpperLeg', 'LowerLeg', 'Foot', 'UpperArm', 'LowerArm', 'Hand'].map(part => `J_Bip_${side}_${part}`))]
  for (const name of required) if (!source.getObjectByName(name)) throw new Error(`Study companion is missing ${name}`)
  const box = new Box3().setFromObject(source)
  const height = box.max.y - box.min.y
  if (!Number.isFinite(height) || height <= 0) throw new Error('Study companion has no usable bounds')
  const model = clone(source)
  shareVirtualChurchOwnedCloneSkeletons(model)
  const materials = new Set<Material>()
  const ownedGeometries = new Set<Mesh['geometry']>()
  const outfitColor = new Color(tint)
  const hairColor = new Color(STUDY_COMPANION_SEATS[index]?.hairTint ?? '#ffffff')
  model.traverse(node => {
    if (!(node instanceof Mesh)) return
    node.castShadow = true
    node.receiveShadow = true
    const convert = (sourceMaterial: Material) => {
      let material: Material
      if (sourceMaterial instanceof MeshStandardMaterial && gateAIsSkinMaterial(sourceMaterial.name)) {
        material = new MeshBasicMaterial({ color: GATE_A_SKIN_UNLIT_COLOR, map: sourceMaterial.map, alphaTest: sourceMaterial.alphaTest, transparent: sourceMaterial.transparent, opacity: sourceMaterial.opacity, side: sourceMaterial.side, toneMapped: false })
      } else {
        material = sourceMaterial instanceof MeshStandardMaterial ? new MeshStandardMaterial().copy(sourceMaterial) : sourceMaterial.clone()
        // Vary the two broad garments only. Dyeing every CLOTH slot also
        // muddies the approved gold trim and shoes when five seated figures
        // are viewed together.
        if (material instanceof MeshStandardMaterial
          && gateAIsOutfitMaterial(sourceMaterial.name)
          && /_CLOTH_01(?:\s|\()/.test(sourceMaterial.name)) {
          material.color.multiply(outfitColor)
          // The authored fabric maps are strongly green/pink. Multiplication
          // alone leaves five seated copies reading as the same outfit. On the
          // two broad fabric slots, keep map luminance and folds while giving
          // each virtual companion a distinct, quiet colour. The approved
          // playable character and the shared GLB remain untouched.
          material.onBeforeCompile = shader => {
            shader.uniforms.studyFabricTint = { value: outfitColor }
            shader.fragmentShader = `uniform vec3 studyFabricTint;\n${shader.fragmentShader}`
              .replace('#include <color_fragment>', `#include <color_fragment>
                float studyFabricLuma = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));
                diffuseColor.rgb = mix(diffuseColor.rgb, studyFabricTint * (.55 + studyFabricLuma), .88);
              `)
          }
          material.customProgramCacheKey = () => 'study-companion-fabric-v1'
          material.userData.studyFabricTint = outfitColor.toArray()
        }
        if (material instanceof MeshStandardMaterial && /_HAIR(?:_| \()/.test(sourceMaterial.name)) material.color.multiply(hairColor)
      }
      materials.add(material)
      return material
    }
    node.material = Array.isArray(node.material) ? node.material.map(convert) : convert(node.material)
  })
  model.scale.multiplyScalar(1.72 / height)
  model.position.y -= box.min.y * (1.72 / height)
  model.updateMatrixWorld(true)
  const bone = (name: string) => {
    const result = model.getObjectByName(name)
    if (!result) throw new Error(`Study companion is missing ${name}`)
    return result
  }
  const aim = (joint: Object3D, child: Object3D, direction: Vector3) => {
    model.updateMatrixWorld(true)
    const current = child.getWorldPosition(new Vector3()).sub(joint.getWorldPosition(new Vector3())).normalize()
    const world = joint.getWorldQuaternion(new Quaternion())
    world.premultiply(new Quaternion().setFromUnitVectors(current, direction.normalize()))
    joint.quaternion.copy(joint.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world))
    model.updateMatrixWorld(true)
  }
  const hips = bone('J_Bip_C_Hips')
  const hipPosition = hips.getWorldPosition(new Vector3())
  hipPosition.y = .67
  hips.position.copy(hips.parent!.worldToLocal(hipPosition))
  model.updateMatrixWorld(true)
  for (const [side, sign] of [['L', 1], ['R', -1]] as const) {
    const thigh = bone(`J_Bip_${side}_UpperLeg`), knee = bone(`J_Bip_${side}_LowerLeg`), foot = bone(`J_Bip_${side}_Foot`)
    const footRotation = foot.getWorldQuaternion(new Quaternion())
    // Nearly level thighs keep the approved Low model's shoes above the rug;
    // the steeper standing-derived angle pushed the soles 6 cm into the floor.
    aim(thigh, knee, new Vector3(sign * .06, -.043, .36))
    aim(knee, foot, new Vector3(0, -1, -.04))
    foot.quaternion.copy(foot.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(footRotation))
    const upper = bone(`J_Bip_${side}_UpperArm`), elbow = bone(`J_Bip_${side}_LowerArm`), hand = bone(`J_Bip_${side}_Hand`)
    aim(upper, elbow, new Vector3(sign * .025, -.24, .10))
    aim(elbow, hand, new Vector3(-sign * .10, -.015, .21))
  }
  // Let the long skirt drape over the seated thighs rather than through the floor.
  model.traverse(node => {
    if (/Skirt(?:Front|Side)0_/.test(node.name)) {
      const child = node.children.find(item => /Skirt/.test(item.name) && !/collider/.test(item.name))
      if (child) aim(node, child, new Vector3(0, -.35, .8))
    }
  })
  bone('J_Bip_C_Head').rotateX(.16)
  model.updateMatrixWorld(true)
  // The approved standing outfit puts filigree from the shoe material up the
  // calves. Once seated, those narrow cut-outs read as black scratches on bare
  // legs. Trim only the room copy's shoe triangles above the ankle; keep the
  // shoes, their texture and their shadow geometry in sync. The player GLB and
  // all other character materials stay untouched.
  model.traverse(node => {
    if (!(node instanceof Mesh) || Array.isArray(node.material)
      || !node.material.name.includes('Shoes_01_CLOTH')) return
    const sourceIndex = node.geometry.getIndex()
    const count = sourceIndex?.count ?? node.geometry.getAttribute('position').count
    const kept: number[] = []
    const point = new Vector3()
    for (let start = 0; start + 2 < count; start += 3) {
      const vertices = [0, 1, 2].map(offset => sourceIndex?.getX(start + offset) ?? start + offset)
      if (vertices.every(index => node.getVertexPosition(index, point).applyMatrix4(node.matrixWorld).y <= .15)) {
        kept.push(...vertices)
      }
    }
    if (kept.length === 0 || kept.length === count) return
    const geometry = node.geometry.clone()
    geometry.setIndex(kept)
    node.geometry = geometry
    ownedGeometries.add(geometry)
  })
  const book = bone('J_Bip_L_Hand').getWorldPosition(new Vector3())
    .add(bone('J_Bip_R_Hand').getWorldPosition(new Vector3())).multiplyScalar(.5)
  book.y -= .025
  book.z += .08
  let disposed = false
  return {
    model,
    updateMotion: createStudyCompanionMotion(model, index),
    book: book.toArray() as [number, number, number],
    dispose: () => {
      if (disposed) return
      disposed = true
      materials.forEach(material => material.dispose())
      ownedGeometries.forEach(geometry => geometry.dispose())
      disposeVirtualChurchCharacterSkeletons(model)
    },
  }
}
