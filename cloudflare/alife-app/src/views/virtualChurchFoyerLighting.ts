import { DoubleSide, MeshStandardMaterial } from 'three'
import { VIRTUAL_CHURCH_FOYER_FLOOR } from './virtualChurchFoyerFloor.ts'

export const VIRTUAL_CHURCH_FOYER_SHELTER_RESPONSE = {
  paleLowerDirect: .68,
  paleUpperDirect: .40,
  wallBaseMinimum: .84,
  wallBaseY: VIRTUAL_CHURCH_FOYER_FLOOR.boardY,
  wallBaseFadeY: .65,
} as const

/** Satin metal on the photographed round rail, using the existing environment.
 * No extra reflection pass, shadow draw, texture or light is introduced.
 */
export function createVirtualChurchFoyerHandrailMaterial() {
  return new MeshStandardMaterial({
    color: '#9ea8a6', roughness: .32, metalness: .78, envMapIntensity: .55,
  })
}

/** Photo-guided wicker is inside the same high foyer as the pale walls.
 * Reuse their bounded shelter rather than letting unoccluded outdoor sun
 * wash the ribbons white. This is artistic shading, not measured GI.
 * Geometry, vertex colours, light count and opaque single draw stay intact. */
export function createVirtualChurchFoyerWickerMaterial() {
  const material = createVirtualChurchFoyerInteriorMaterial(.88)
  material.vertexColors = true
  material.side = DoubleSide
  return material
}

/** An inexpensive, photo-constrained approximation of sheltered daylight.
 * It is not a measured light bake. Only the added foyer architecture opts in;
 * exterior church materials, characters and light sources remain untouched.
 * Both pale and charcoal walls reject unoccluded outdoor sun inside the room,
 * with a stronger response on charcoal. Glazed ends retain their daylight.
 */
export function createVirtualChurchFoyerInteriorMaterial(roughness: number, shelteredSun = false, localOffsetZ = 0) {
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness })
  const response = VIRTUAL_CHURCH_FOYER_SHELTER_RESPONSE
  material.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec2 vFoyerShelter;\nvarying float vFoyerVerticalFace;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec3 foyerPoint = transformed;
      vec3 foyerNormal = normal;
      #ifdef USE_INSTANCING
        foyerPoint = (instanceMatrix * vec4(foyerPoint, 1.0)).xyz;
        foyerNormal = normalize(mat3(instanceMatrix) * foyerNormal);
      #endif
      // Non-instanced stair cheek geometry starts at Z=0 inside an offset mesh.
      foyerPoint.z += ${localOffsetZ.toFixed(3)};
      vFoyerShelter = foyerPoint.yz;
      // Entrance-local orientation, not camera-space normal: a view change
      // cannot move the wall-foot shading onto a ceiling or horizontal ledge.
      vFoyerVerticalFace = 1.0 - smoothstep(.10, .30, abs(foyerNormal.y));`,
    )
    shader.fragmentShader = `varying vec2 vFoyerShelter;\nvarying float vFoyerVerticalFace;\n${shader.fragmentShader}`.replace(
      '#include <aomap_fragment>',
      `#include <aomap_fragment>
      // Preserve daylight at both glazed ends. The upper enclosed wall gets
      // less diffuse sky fill than the lower, lamp-lit part of the foyer.
      float foyerEnclosure = smoothstep(.25, 2.0, vFoyerShelter.y)
        * (1.0 - smoothstep(10.5, 13.28, vFoyerShelter.y));
      ${shelteredSun ? '' : `// The high pale return above the courtyard glazing is still indoors.
      // Its old end fade left this plane completely exposed to sky fill.
      // Preserve the lower daylit opening, all horizontal faces and the entry.
      float foyerUpperEndWall = vFoyerVerticalFace
        * smoothstep(2.70, 5.90, vFoyerShelter.x)
        * smoothstep(10.5, 13.28, vFoyerShelter.y)
        * (1.0 - smoothstep(13.50, 13.75, vFoyerShelter.y));
      foyerEnclosure = max(foyerEnclosure, .70 * foyerUpperEndWall);`}
      float foyerUpperWall = smoothstep(2.0, 5.9, vFoyerShelter.x);
      reflectedLight.indirectDiffuse *= mix(1.0, mix(.88, .60, foyerUpperWall), foyerEnclosure);
      // Photos 07/08 show neutral-warm sheltered walls, not the blue open sky.
      // This bounded colour response is artistic, not measured bounced light;
      // preserve the cooler daylight at the two glazed ends.
      reflectedLight.indirectDiffuse *= mix(vec3(1.0), vec3(1.025, 1.0, .90), foyerEnclosure);
      ${shelteredSun ? `// Bounded artistic shelter, not baked GI: exterior sun cannot wash covered charcoal grey.
      float sunShelter = smoothstep(.25, 2.0, vFoyerShelter.y)
        * (1.0 - smoothstep(13.15, 13.5, vFoyerShelter.y));
      reflectedLight.directDiffuse *= mix(1.0, .18, sunShelter);` : `// Photo-constrained pale shelter: retain readable lower walls while
      // preventing the unoccluded outside sun from flattening upper planes.
      reflectedLight.directDiffuse *= mix(1.0, mix(${response.paleLowerDirect.toFixed(3)}, ${response.paleUpperDirect.toFixed(3)}, foyerUpperWall), foyerEnclosure);`}
      // A light artistic contact cue, not baked AO/GI. Only vertical faces in
      // the enclosed band opt in; the floor, ledges and glazed ends stay intact.
      float foyerWallFoot = vFoyerVerticalFace * foyerEnclosure
        * (1.0 - smoothstep(${response.wallBaseY.toFixed(3)}, ${response.wallBaseFadeY.toFixed(3)}, vFoyerShelter.x));
      float foyerWallContact = mix(1.0, ${response.wallBaseMinimum.toFixed(3)}, foyerWallFoot);
      reflectedLight.indirectDiffuse *= foyerWallContact;
      reflectedLight.directDiffuse *= foyerWallContact;`,
    )
  }
  material.customProgramCacheKey = () => `foyer-sheltered-daylight-v4-${shelteredSun ? 'covered' : 'pale'}-${localOffsetZ.toFixed(3)}`
  return material
}
