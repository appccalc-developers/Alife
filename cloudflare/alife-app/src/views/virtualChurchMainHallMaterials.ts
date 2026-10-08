import type { MeshStandardMaterial, Scene, WebGLRenderTarget } from 'three'
import { MAIN_HALL_DIMENSIONS } from './virtualChurchMainHallLayout.ts'

// Pale matte paint, not a measured finish. Let the existing hall illumination
// and tone mapping govern the ceiling instead of a fixed unlit display colour.
export const MAIN_HALL_CEILING_APPEARANCE = Object.freeze({ color: '#eeefeb', roughness: 1, metalness: 0 })
// Original broad ceiling-bounce approximation, not a measured irradiance or
// simulated GI. The room's warm floor hemisphere alone tinted the whole roof
// yellow. Keep a cool-white underside with a soft falloff near timber edges;
// this adds no light object, shadow map, texture or animation.
export const MAIN_HALL_CEILING_BOUNCE = Object.freeze({ irradiance: Object.freeze([1, 1.14, 1.3]), edgeFactor: .82, fade: 5 })

// Photo-informed separation of pale timber faces from dark acoustic backing.
// These are art-directed albedos, not measured finishes or a new wall layout.
export const MAIN_HALL_TIMBER_APPEARANCE = Object.freeze({
  backing: '#352d26', side: '#ad865b', rear: '#b48b60', roughness: .84,
})

// Photo-informed wine upholstery and dark satin steel, not sampled albedo or
// proof of the 2017 manufacturer's finish. The brighter room fill made the
// previous dusty-pink palette and silver outline dominate the whole seating.
// Keep geometry, standard lighting, weave and draw batches unchanged.
export const MAIN_HALL_CHAIR_APPEARANCE = Object.freeze({
  seatColors: Object.freeze(['#8e4855', '#904a57', '#924c59']),
  backColors: Object.freeze(['#783946', '#7a3b48', '#7c3d4a']),
  frame: Object.freeze({ color: '#343637', metalness: .22, roughness: .57 }),
})

// Art-directed contact response on the existing room shell, not measured AO,
// baked illumination or a replacement for real geometry/light transport.
export const MAIN_HALL_MATERIAL_RESPONSE = Object.freeze({
  wallFootStrength: .1,
  wallFootFade: .65,
  wallCrownStrength: .08,
  wallCrownFade: .85,
  wallCornerStrength: .08,
  wallCornerFade: 1.1,
  ceilingEdgeStrength: .15,
  ceilingEdgeFade: 1.4,
})
const dimensions = MAIN_HALL_DIMENSIONS
const response = MAIN_HALL_MATERIAL_RESPONSE

// A small original studio response, not an HDR photograph or measured hall GI.
// Rough satin hardware needs broad reflections, not a sharp 256px cubemap.
export const MAIN_HALL_ENVIRONMENT_RESPONSE = Object.freeze({ size: 64, intensity: .16 })

/** The room owns the prefiltered target. Restore previous scene state without
 * clobbering a newer owner, and dispose exactly once on exit/StrictMode replay. */
export function attachMainHallEnvironment(scene: Scene, target: WebGLRenderTarget) {
  const previous = scene.environment, previousIntensity = scene.environmentIntensity
  scene.environment = target.texture
  scene.environmentIntensity = MAIN_HALL_ENVIRONMENT_RESPONSE.intensity
  let retired = false
  return () => {
    if (retired) return
    retired = true
    if (scene.environment === target.texture) {
      scene.environment = previous
      scene.environmentIntensity = previousIntensity
    }
    target.dispose()
  }
}

export const mainHallChairFabricShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vChairUv;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvChairUv = uv;')
  shader.fragmentShader = `varying vec2 vChairUv;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 weavePhase = vChairUv * 380.0;
      vec2 weaveWeight = 1.0 - smoothstep(vec2(.65), vec2(1.5), fwidth(weavePhase));
      float weave = sin(weavePhase.x) * sin(weavePhase.y) * weaveWeight.x * weaveWeight.y;
      vec2 edge = min(vChairUv, 1.0 - vChairUv);
      float footprint = max(fwidth(vChairUv.x), fwidth(vChairUv.y));
      float piping = smoothstep(.012, .052 + footprint, min(edge.x, edge.y));
      diffuseColor.rgb *= (.99 + weave * .01) * mix(.95, 1.0, piping);
    `)
}
export const mainHallChairFabricProgramKey = () => 'main-hall-chair-fabric-v2'

export const mainHallCarpetShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vHallUv;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHallUv = uv;')
  shader.fragmentShader = `varying vec2 vHallUv;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 carpetTile = vHallUv * vec2(30.0, 28.4);
      vec2 cell = floor(carpetTile);
      vec2 local = fract(carpetTile);
      vec2 footprint = max(fwidth(carpetTile), vec2(.00001));
      vec2 edge = min(local, 1.0 - local);
      vec2 seams = (1.0 - smoothstep(vec2(0.0), vec2(.012) + footprint, edge)) * min(vec2(1.0), vec2(.012) / footprint);
      float seam = max(seams.x, seams.y);
      // Preserve the photo-informed alternating fibre direction; estimate only.
      float tileTurn = mod(cell.x + cell.y, 2.0);
      float fibreAxis = mix(local.x + local.y * .16, local.y + local.x * .16, tileTurn);
      float finePhase = fibreAxis * 54.0 + sin(fibreAxis * 11.0) * .7;
      float broadPhase = fibreAxis * 13.0;
      float fineFibre = sin(finePhase) * (1.0 - smoothstep(.65, 1.5, fwidth(finePhase)));
      float broadFibre = sin(broadPhase) * (1.0 - smoothstep(.65, 1.5, fwidth(broadPhase)));
      float shade = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
      diffuseColor.rgb *= .985 + shade * .058 + fineFibre * .022 + broadFibre * .012 - seam * .025;
    `)
}
export const mainHallCarpetProgramKey = () => 'main-hall-carpet-v3'

export const mainHallWallContactShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec3 vHallWallPoint;\nvarying vec2 vHallWallFace;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vHallWallPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vHallWallFace = vec2(1.0 - smoothstep(0.1, 0.3, abs(normal.y)), step(0.5, abs(normal.x)));
    `)
  shader.fragmentShader = `varying vec3 vHallWallPoint;\nvarying vec2 vHallWallFace;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      float hallFoot = 1.0 - smoothstep(0.0, ${response.wallFootFade}, vHallWallPoint.y);
      float hallCrown = 1.0 - smoothstep(0.0, ${response.wallCrownFade}, ${dimensions.height} - vHallWallPoint.y);
      float hallCornerDistance = mix(${(dimensions.width / 2).toFixed(2)} - abs(vHallWallPoint.x), ${(dimensions.depth / 2).toFixed(2)} - abs(vHallWallPoint.z), vHallWallFace.y);
      float hallCorner = 1.0 - smoothstep(0.0, ${response.wallCornerFade}, hallCornerDistance);
      // Use the strongest local term instead of stacking black corner bands.
      float hallContact = max(max(hallFoot * ${response.wallFootStrength}, hallCrown * ${response.wallCrownStrength}), hallCorner * ${response.wallCornerStrength});
      diffuseColor.rgb *= 1.0 - hallContact * vHallWallFace.x;
    `)
}
export const mainHallWallContactProgramKey = () => 'main-hall-wall-contact-v1'

// Grain is confined to the two existing timber-slat batches. High-frequency
// detail fades with its screen footprint rather than shimmering at a distance.
export const mainHallTimberShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vHallTimberUv;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHallTimberUv = uv;')
  shader.fragmentShader = `varying vec2 vHallTimberUv;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      float timberWarp = sin(vHallTimberUv.y * 8.0) * 1.6 + sin(vHallTimberUv.y * 23.0) * 0.3;
      float timberBroadPhase = vHallTimberUv.x * 42.0 + timberWarp;
      float timberFinePhase = vHallTimberUv.x * 145.0 + timberWarp * 2.0;
      float timberBroadWeight = 1.0 - smoothstep(0.65, 1.5, fwidth(timberBroadPhase));
      float timberFineWeight = 1.0 - smoothstep(0.65, 1.5, fwidth(timberFinePhase));
      float timberGrain = sin(timberBroadPhase) * 0.045 * timberBroadWeight + sin(timberFinePhase) * 0.015 * timberFineWeight;
      diffuseColor.rgb *= 1.0 + timberGrain;
    `)
}
export const mainHallTimberProgramKey = () => 'main-hall-timber-grain-v1'

export const MAIN_HALL_CEILING_CONTACT_GLSL = `
  float hallCeilingEdge = min(${(dimensions.width / 2).toFixed(2)} - abs(vHallCeilingXZ.x), ${(dimensions.depth / 2).toFixed(2)} - abs(vHallCeilingXZ.y));
  float hallCeilingContact = 1.0 - smoothstep(0.0, ${response.ceilingEdgeFade}, hallCeilingEdge);
  diffuseColor.rgb *= 1.0 - hallCeilingContact * ${response.ceilingEdgeStrength} * vHallCeilingUnder;
`

// The diffuser pattern remains confined to the existing ceiling underside.
export const mainHallCeilingShader: MeshStandardMaterial['onBeforeCompile'] = shader => {
  shader.vertexShader = `varying vec2 vHallCeilingXZ;\nvarying float vHallCeilingUnder;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHallCeilingXZ = position.xz;\nvHallCeilingUnder = step(0.5, -normal.y);')
  shader.fragmentShader = `varying vec2 vHallCeilingXZ;\nvarying float vHallCeilingUnder;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 ventCell = mod(vHallCeilingXZ + vec2(11.2, 10.0), vec2(5.6, 5.0)) - vec2(2.8, 2.5);
      float ventRadius = length(ventCell);
      float ventRing = smoothstep(.115, .14, ventRadius) * (1.0 - smoothstep(.18, .205, ventRadius));
      float ventCentre = 1.0 - smoothstep(.085, .11, ventRadius);
      diffuseColor.rgb *= 1.0 - vHallCeilingUnder * (ventRing * .22 + ventCentre * .04);
      ${MAIN_HALL_CEILING_CONTACT_GLSL}
    `)
    .replace('#include <lights_fragment_maps>', `#include <lights_fragment_maps>
      #if defined(RE_IndirectDiffuse)
        float ceilingBounceEdge = min(${(dimensions.width / 2).toFixed(2)} - abs(vHallCeilingXZ.x), ${(dimensions.depth / 2).toFixed(2)} - abs(vHallCeilingXZ.y));
        float ceilingBounceShape = mix(${MAIN_HALL_CEILING_BOUNCE.edgeFactor}, 1.0, smoothstep(0.0, ${MAIN_HALL_CEILING_BOUNCE.fade.toFixed(1)}, ceilingBounceEdge));
        irradiance += vec3(${MAIN_HALL_CEILING_BOUNCE.irradiance.map(value => value.toFixed(2)).join(', ')}) * vHallCeilingUnder * ceilingBounceShape;
      #endif
    `)
}
