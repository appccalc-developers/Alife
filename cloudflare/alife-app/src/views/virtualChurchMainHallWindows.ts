import { BoxGeometry, Color, Float32BufferAttribute, PlaneGeometry, type BufferGeometry, type MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { MAIN_HALL_DIMENSIONS, MAIN_HALL_SIDE_WINDOW_BAYS } from './virtualChurchMainHallLayout.ts'

// Apertures retain the 2017 photo-estimated anchors. This depth/detail pass is
// not a surveyed wall section, nor evidence of the view beyond those windows.
export const MAIN_HALL_WINDOW_DETAIL = Object.freeze({ wallDepth: .16, frameDepth: .1, sillDepth: .32, vistaDistance: 3.8 })
// Reorient the existing unshadowed key through the stage-side aperture toward
// the central floor. This is art direction, not measured solar illumination.
export const MAIN_HALL_DAYLIGHT_KEY_POSITION: [number, number, number] = [MAIN_HALL_DIMENSIONS.width / 2 + MAIN_HALL_WINDOW_DETAIL.vistaDistance, 3, -10]
Object.freeze(MAIN_HALL_DAYLIGHT_KEY_POSITION)

/** Three room-owned buffers, merged by material rather than by window. The
 * pale sills share the vertex-coloured shell. Only glazing is transparent. */
export function createMainHallWindowGeometry() {
  const temporary: BufferGeometry[] = [], owned: BufferGeometry[] = []
  const { width, height, depth } = MAIN_HALL_DIMENSIONS, detail = MAIN_HALL_WINDOW_DETAIL
  const box = (size: [number, number, number], position: [number, number, number], hex: string) => {
    const geometry = new BoxGeometry(...size).translate(...position)
    const colour = new Color(hex), count = geometry.getAttribute('position').count
    const colours = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) colour.toArray(colours, i * 3)
    geometry.setAttribute('color', new Float32BufferAttribute(colours, 3))
    temporary.push(geometry)
    return geometry
  }
  const pane = (paneWidth: number, paneHeight: number, side: number, x: number, y: number, z: number) => {
    // The single front face looks into the room on both opposing walls.
    const geometry = new PlaneGeometry(paneWidth, paneHeight).rotateY(-side * Math.PI / 2).translate(x, y, z)
    temporary.push(geometry)
    return geometry
  }
  const merge = (parts: BufferGeometry[]) => {
    const geometry = mergeGeometries(parts, false)
    if (!geometry) throw new Error('Main hall window geometry could not be merged')
    owned.push(geometry)
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    return geometry
  }
  try {
    const walls: BufferGeometry[] = [], glass: BufferGeometry[] = [], vistas: BufferGeometry[] = []
    for (const bay of MAIN_HALL_SIDE_WINDOW_BAYS) {
      const { side, centerZ, length, bottomY, topY } = bay
      const x = side * width / 2, centerY = (bottomY + topY) / 2
      const startZ = centerZ - length / 2, endZ = centerZ + length / 2
      walls.push(
        box([detail.wallDepth, bottomY, depth], [x, bottomY / 2, 0], '#e7e3da'),
        box([detail.wallDepth, height - topY, depth], [x, (height + topY) / 2, 0], '#e7e3da'),
        box([detail.wallDepth, topY - bottomY, startZ + depth / 2], [x, centerY, (startZ - depth / 2) / 2], '#e7e3da'),
        box([detail.wallDepth, topY - bottomY, depth / 2 - endZ], [x, centerY, (endZ + depth / 2) / 2], '#e7e3da'),
        box([detail.sillDepth, .065, length + .08], [x - side * .09, bottomY - .025, centerZ], '#d7d4cc'),
      )
      glass.push(pane(length - .055, topY - bottomY - .055, side, x - side * .015, centerY, centerZ))
      // Neutral, unlocated daylight: no copied photograph, trees or fabricated
      // neighbouring church buildings. Recessing it supplies real parallax.
      vistas.push(pane(depth + 10, height + 10, side, x + side * detail.vistaDistance, height / 2, 0))
    }
    return { wall: merge(walls), glazing: merge(glass), vista: merge(vistas) }
  } catch (error) {
    owned.forEach(geometry => geometry.dispose())
    throw error
  } finally { temporary.forEach(geometry => geometry.dispose()) }
}

const linear = (hex: string) => {
  const colour = new Color(hex)
  return `vec3(${colour.r.toFixed(6)}, ${colour.g.toFixed(6)}, ${colour.b.toFixed(6)})`
}

// A calm daylight gradient, deliberately less specific than a landscape.
// It is static, world-continuous, and uses standard basic tone mapping.
export const mainHallDaylightMaterialProps = Object.freeze({
  customProgramCacheKey: () => 'main-hall-illustrative-daylight-v1',
  onBeforeCompile: ((shader) => {
    shader.vertexShader = `varying float vHallDaylightHeight;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHallDaylightHeight = (modelMatrix * vec4(transformed, 1.0)).y;')
    shader.fragmentShader = `varying float vHallDaylightHeight;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(${linear('#eceeeb')}, ${linear('#a7bbc5')}, smoothstep(1.0, 9.0, vHallDaylightHeight));
      `)
  }) as MeshBasicMaterial['onBeforeCompile'],
})
