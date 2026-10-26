import { BoxGeometry, Color, PlaneGeometry, type BufferGeometry, type MeshBasicMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Original concept-room openings, not surveyed church windows or surroundings.
export const STUDY_WINDOWS = Object.freeze({
  centers: Object.freeze([-2.65, 0, 2.65]),
  width: 1.65, height: 2.3, centerY: 2.08,
  wallZ: -3.6, wallDepth: .15, wallWidth: 30, wallHeight: 12,
  frameWidth: .055, frameDepth: .1,
  vistaZ: -5.5,
})

/** Five shared, room-owned buffers. Openings are genuinely absent from the wall;
 * the opaque original garden sits beyond it, not painted on the room wall.
 * No per-window materials, transparent back faces, textures or shadow map. */
export function createStudyWindowGeometry() {
  const temporary: BufferGeometry[] = [], owned: BufferGeometry[] = []
  const w = STUDY_WINDOWS, bottom = w.centerY - w.height / 2, top = w.centerY + w.height / 2
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number) => {
    const geometry = new BoxGeometry(width, height, depth).translate(x, y, z)
    temporary.push(geometry)
    return geometry
  }
  const plane = (width: number, height: number, x: number, y: number, z: number) => {
    const geometry = new PlaneGeometry(width, height).translate(x, y, z)
    temporary.push(geometry)
    return geometry
  }
  const merge = (parts: BufferGeometry[]) => {
    const geometry = mergeGeometries(parts, false)
    if (!geometry) throw new Error('Study window geometry could not be merged')
    owned.push(geometry)
    geometry.computeBoundingBox(); geometry.computeBoundingSphere()
    return geometry
  }
  try {
    const wallParts = [
      box(w.wallWidth, bottom, w.wallDepth, 0, bottom / 2, w.wallZ),
      box(w.wallWidth, w.wallHeight - top, w.wallDepth, 0, (top + w.wallHeight) / 2, w.wallZ),
    ]
    let left = -w.wallWidth / 2
    for (const x of w.centers) {
      const right = x - w.width / 2
      wallParts.push(box(right - left, w.height, w.wallDepth, (left + right) / 2, w.centerY, w.wallZ))
      left = x + w.width / 2
    }
    wallParts.push(box(w.wallWidth / 2 - left, w.height, w.wallDepth, (left + w.wallWidth / 2) / 2, w.centerY, w.wallZ))
    const frameParts: BufferGeometry[] = [], sillParts: BufferGeometry[] = [], glassParts: BufferGeometry[] = []
    const front = w.wallZ + w.wallDepth / 2
    for (const x of w.centers) {
      for (const sign of [-1, 1]) {
        frameParts.push(box(w.frameWidth, w.height, w.frameDepth, x + sign * (w.width - w.frameWidth) / 2, w.centerY, front))
        frameParts.push(box(w.width - 2 * w.frameWidth, w.frameWidth, w.frameDepth, x, w.centerY + sign * (w.height - w.frameWidth) / 2, front))
      }
      frameParts.push(box(.025, w.height - 2 * w.frameWidth, .065, x, w.centerY, front + .015))
      frameParts.push(box(w.width - 2 * w.frameWidth, .025, .065, x, w.centerY - .4, front + .015))
      sillParts.push(box(1.8, .07, .28, x, bottom - .025, front + .04))
      glassParts.push(plane(w.width - 2 * w.frameWidth, w.height - 2 * w.frameWidth, x, w.centerY, front - .045))
    }
    return {
      wall: merge(wallParts), frames: merge(frameParts), sills: merge(sillParts),
      glazing: merge(glassParts), vista: merge([plane(40, 20, 0, 6, w.vistaZ)]),
    }
  } catch (error) {
    owned.forEach(geometry => geometry.dispose())
    throw error
  } finally { temporary.forEach(geometry => geometry.dispose()) }
}

const linear = (hex: string) => {
  const color = new Color(hex)
  return `vec3(${color.r.toFixed(6)}, ${color.g.toFixed(6)}, ${color.b.toFixed(6)})`
}

// Static, original garden impression. World coordinates give one continuous
// view through all three apertures; it does not claim local site accuracy.
export const studyGardenMaterialProps = Object.freeze({
  customProgramCacheKey: () => 'study-concept-garden-v1',
  onBeforeCompile: ((shader) => {
    shader.vertexShader = `varying vec3 vStudyGardenPoint;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudyGardenPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    shader.fragmentShader = `varying vec3 vStudyGardenPoint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 p = vStudyGardenPoint.xy;
        vec3 sky = mix(${linear('#e9efec')}, ${linear('#9bb9c7')}, smoothstep(1.0, 10.0, p.y));
        float distant = 1.18 + .17 * sin(p.x * .65) + .09 * sin(p.x * 1.7);
        float hedge = .72 + .12 * sin(p.x * 2.7) + .055 * sin(p.x * 6.1);
        vec3 garden = mix(sky, ${linear('#9baaa0')}, 1.0 - smoothstep(distant - .06, distant + .06, p.y));
        garden = mix(garden, ${linear('#5d7964')}, 1.0 - smoothstep(hedge - .04, hedge + .04, p.y));
        garden = mix(${linear('#a2a99a')}, garden, smoothstep(-.4, .35, p.y));
        diffuseColor.rgb = garden;
      `)
  }) as MeshBasicMaterial['onBeforeCompile'],
})
