import { DoubleSide, Mesh, MeshStandardMaterial, type Object3D } from 'three'
import { VIRTUAL_CHURCH_FOYER_FLOOR as floor } from './virtualChurchFoyerFloor.ts'

// Undersides of the photo-backed shallow foyer's authored acoustic panels.
// Surface spacing is a visual estimate from InteriorReferences/10, not a survey.
const width = floor.maxX - floor.minX
// Photo 10 confines the perforations to the strip between the two dark ceiling slots.
// The authored front panels already use these bounds; keep the continuation aligned.
export const FOYER_ACOUSTIC_STRIP = { start: .11, end: .69 } as const
export const FOYER_ACOUSTIC_SURFACE = {
  minX: floor.minX + width * FOYER_ACOUSTIC_STRIP.start,
  maxX: floor.minX + width * FOYER_ACOUSTIC_STRIP.end,
  minZ: floor.minZ + .31, maxZ: floor.maxZ - .31,
  minY: 5.89, maxY: 5.92, panel: .64, pitch: .035, radius: .006,
} as const

export function isFoyerAcousticSurface(x: number, y: number, z: number, normalY: number) {
  const a = FOYER_ACOUSTIC_SURFACE
  return x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ && y >= a.minY && y <= a.maxY && normalY <= -.99
}

/** A single downward surface continues the photographed perforation language
 * over the tall part of the provisional foyer. The side corridors retain their
 * lower, plain ceiling; no panel boxes float above them. */
export function createVirtualChurchFoyerExtensionCeilingMaterial(width: number, depth: number) {
  const a = FOYER_ACOUSTIC_SURFACE
  const stripStart = width * FOYER_ACOUSTIC_STRIP.start
  const stripEnd = width * FOYER_ACOUSTIC_STRIP.end
  const material = new MeshStandardMaterial({ color: '#dfded7', roughness: .94, side: DoubleSide })
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vFoyerPanelUV;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFoyerPanelUV = uv * vec2(${width}, ${depth});`)
    shader.fragmentShader = `varying vec2 vFoyerPanelUV;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 panelUV = mod(vFoyerPanelUV, ${a.panel});
      vec2 panelEdge = min(panelUV, ${a.panel} - panelUV);
      float field = step(.025, min(panelEdge.x, panelEdge.y));
      vec2 holeUV = mod(vFoyerPanelUV + ${a.pitch / 2}, ${a.pitch}) - ${a.pitch / 2};
      float footprint = max(fwidth(vFoyerPanelUV.x), fwidth(vFoyerPanelUV.y));
      float aa = max(.0005, footprint * .65);
      float hole = 1.0 - smoothstep(${a.radius} - aa, ${a.radius} + aa, length(holeUV));
      float detail = 1.0 - smoothstep(.012, .035, footprint);
      float acousticStrip = step(${stripStart}, vFoyerPanelUV.x) * step(vFoyerPanelUV.x, ${stripEnd});
      diffuseColor.rgb *= 1.0 - acousticStrip * (.72 * hole * field * detail + .05 * (1.0 - field));
    `)
  }
  material.customProgramCacheKey = () => `foyer-acoustic-extension-v2:${width}:${depth}`
  return material
}

/** Decorate only an existing downward panel face, without new geometry, textures
 * or draw calls. A local vertex mask excludes roof, walls, floor and fixtures. */
export function prepareVirtualChurchFoyerCeiling(model: Object3D) {
  const owned: MeshStandardMaterial[] = []
  model.traverse(node => {
    if (!(node instanceof Mesh) || !(node.material instanceof MeshStandardMaterial)
      || !['M_OffWhite', 'M_CedarLight'].includes(node.material.name)) return
    if (node.position.lengthSq() !== 0 || node.quaternion.x !== 0 || node.quaternion.y !== 0 || node.quaternion.z !== 0 || node.quaternion.w !== 1
      || node.scale.x !== 1 || node.scale.y !== 1 || node.scale.z !== 1) return
    const position = node.geometry.getAttribute('position'), normal = node.geometry.getAttribute('normal')
    if (!position || !normal || position.count !== normal.count) return
    let count = 0
    for (let i = 0; i < position.count; i++) {
      if (isFoyerAcousticSurface(position.getX(i), position.getY(i), position.getZ(i), normal.getY(i))) count++
    }
    if (!count) return
    // No geometry mutation: compute this same planar mask in the vertex shader.
    const source = node.material, material = source.clone()
    const previousCompile = source.onBeforeCompile.bind(source)
    const previousKey = source.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      previousCompile(shader, renderer)
      const a = FOYER_ACOUSTIC_SURFACE
      shader.vertexShader = `varying vec3 vFoyerAcoustic;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
        vFoyerAcoustic = vec3(position.xz, step(${a.minY}, position.y) * step(position.y, ${a.maxY}) * step(normal.y, -.99)
          * step(${a.minX}, position.x) * step(position.x, ${a.maxX}) * step(${a.minZ}, position.z) * step(position.z, ${a.maxZ}));`)
      shader.fragmentShader = `varying vec3 vFoyerAcoustic;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 panelUV = mod(vFoyerAcoustic.xy, ${FOYER_ACOUSTIC_SURFACE.panel});
        vec2 panelEdge = min(panelUV, ${FOYER_ACOUSTIC_SURFACE.panel} - panelUV);
        float field = step(.05, min(panelEdge.x, panelEdge.y));
        vec2 holeUV = mod(vFoyerAcoustic.xy + ${FOYER_ACOUSTIC_SURFACE.pitch / 2}, ${FOYER_ACOUSTIC_SURFACE.pitch}) - ${FOYER_ACOUSTIC_SURFACE.pitch / 2};
        float footprint = max(fwidth(vFoyerAcoustic.x), fwidth(vFoyerAcoustic.y));
        float aa = max(.0005, footprint * .65);
        float hole = 1.0 - smoothstep(${FOYER_ACOUSTIC_SURFACE.radius} - aa, ${FOYER_ACOUSTIC_SURFACE.radius} + aa, length(holeUV));
        // Subpixel holes fade instead of sparkling as the player moves.
        float detail = 1.0 - smoothstep(.012, .035, footprint);
        diffuseColor.rgb *= 1.0 - .72 * hole * field * detail * step(.99, vFoyerAcoustic.z);
      `)
    }
    material.customProgramCacheKey = () => `${previousKey}:foyer-acoustic-v1`
    node.material = material
    owned.push(material)
  })
  let disposed = false
  return { count: owned.length, dispose() { if (disposed) return; disposed = true; owned.forEach(material => material.dispose()) } }
}
