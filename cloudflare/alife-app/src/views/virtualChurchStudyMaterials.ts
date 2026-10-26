import type { MeshStandardMaterial } from 'three'

type Hook = MeshStandardMaterial['onBeforeCompile']

// Original calm daylight for the explicitly labelled concept room. Preserve
// one cached directional shadow map; this is not measured church photometry.
export const STUDY_DAYLIGHT = Object.freeze({
  ambientIntensity: .12, hemisphereIntensity: 1.15,
  skyColor: '#f4f6f8', groundColor: '#b2a28d',
  keyIntensity: 1.25, keyColor: '#f4f7fa',
  shadowIntensity: .7, shadowRadius: 2.2,
  wallColor: '#e0ddd3', rugColor: '#c3beb1', rugEdgeColor: '#9a9487',
})

// Original, room-only material response. These are artistic surface cues,
// not scanned timber, measured AO/GI or a record of the church's actual fit-out.
export const STUDY_MATERIAL_RESPONSE = Object.freeze({
  boardWidth: .2, boardLength: 1.8,
  boardVariation: .05, seamStrength: .12,
  floorBroadGrain: .025, floorFineGrain: .008,
  wallFootStrength: .1, wallFootFade: .55,
  wallCornerStrength: .1, wallCornerFade: .85,
  insideLeft: -4.025, insideBack: -3.525,
})
const response = STUDY_MATERIAL_RESPONSE

export const studyFloorShader: Hook = shader => {
  shader.vertexShader = `varying vec2 vStudyFloorXZ;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudyFloorXZ = (modelMatrix * vec4(transformed, 1.0)).xz;')
  shader.fragmentShader = `varying vec2 vStudyFloorXZ;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      vec2 timber = vStudyFloorXZ / vec2(${response.boardWidth}, ${response.boardLength});
      float row = floor(timber.x);
      timber.y += mod(row, 3.0) * .37;
      vec2 cell = floor(timber);
      vec2 local = fract(timber);
      float variation = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
      vec2 footprint = max(fwidth(timber), vec2(.00001));
      vec2 edge = min(local, 1.0 - local);
      vec2 gap = vec2(.0075, .00084); // about 1.5 mm, not wide black grout
      vec2 seam = (1.0 - smoothstep(vec2(0.0), gap + footprint, edge)) * min(vec2(1.0), gap / footprint);
      float warp = sin(local.y * 5.6 + variation * 9.0) * 1.2;
      float broadPhase = local.x * 70.0 + warp;
      float finePhase = local.x * 220.0 + warp * 3.0;
      float broadWeight = 1.0 - smoothstep(.65, 1.5, fwidth(broadPhase));
      float fineWeight = 1.0 - smoothstep(.65, 1.5, fwidth(finePhase));
      float grain = sin(broadPhase) * ${response.floorBroadGrain} * broadWeight + sin(finePhase) * ${response.floorFineGrain} * fineWeight;
      diffuseColor.rgb *= (1.0 + (variation - .5) * ${response.boardVariation} + grain) * (1.0 - max(seam.x, seam.y) * ${response.seamStrength});
    `)
}

export const studyWallShader: Hook = shader => {
  shader.vertexShader = `varying vec3 vStudyWallPoint;\nvarying vec2 vStudyWallFace;\n${shader.vertexShader}`
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      vStudyWallPoint = (modelMatrix * vec4(transformed, 1.0)).xyz;
      vStudyWallFace = vec2(1.0 - smoothstep(.1, .3, abs(normal.y)), step(.5, abs(normal.x)));
    `)
  shader.fragmentShader = `varying vec3 vStudyWallPoint;\nvarying vec2 vStudyWallFace;\n${shader.fragmentShader}`
    .replace('#include <color_fragment>', `#include <color_fragment>
      float foot = 1.0 - smoothstep(0.0, ${response.wallFootFade}, vStudyWallPoint.y);
      float cornerDistance = mix(vStudyWallPoint.x - (${response.insideLeft}), vStudyWallPoint.z - (${response.insideBack}), vStudyWallFace.y);
      float corner = 1.0 - smoothstep(0.0, ${response.wallCornerFade}, cornerDistance);
      // Do not stack two dark bands at the junction.
      float contact = max(foot * ${response.wallFootStrength}, corner * ${response.wallCornerStrength});
      diffuseColor.rgb *= 1.0 - contact * vStudyWallFace.x;
    `)
}

function timberShader(vertical: boolean): Hook {
  return shader => {
    shader.vertexShader = `varying vec3 vStudyTimberPoint;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStudyTimberPoint = transformed;')
    shader.fragmentShader = `varying vec3 vStudyTimberPoint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 timber = vStudyTimberPoint.${vertical ? 'xy' : 'xz'};
        float warp = sin(timber.y * ${vertical ? '4.0' : '7.0'}) * 1.2 + sin(timber.y * 18.0) * .25;
        float broadPhase = timber.x * ${vertical ? '45.0' : '80.0'} + warp;
        float finePhase = timber.x * ${vertical ? '170.0' : '260.0'} + warp * 2.0;
        float broadWeight = 1.0 - smoothstep(.65, 1.5, fwidth(broadPhase));
        float fineWeight = 1.0 - smoothstep(.65, 1.5, fwidth(finePhase));
        diffuseColor.rgb *= 1.0 + sin(broadPhase) * .035 * broadWeight + sin(finePhase) * .012 * fineWeight;
      `)
  }
}

export const studyFloorMaterialProps = Object.freeze({ onBeforeCompile: studyFloorShader, customProgramCacheKey: () => 'study-floor-oak-v2' })
export const studyWallMaterialProps = Object.freeze({ onBeforeCompile: studyWallShader, customProgramCacheKey: () => 'study-wall-contact-v1' })
export const studyTableMaterialProps = Object.freeze({ onBeforeCompile: timberShader(false), customProgramCacheKey: () => 'study-table-timber-v1' })
export const studyVerticalTimberMaterialProps = Object.freeze({ onBeforeCompile: timberShader(true), customProgramCacheKey: () => 'study-vertical-timber-v1' })

// World-independent fabric grain shared by instanced cushions; filter below
// pixel size rather than producing crawling weave in the Low/portrait view.
// Colour response only: no displacement, extra textures or render passes.
function fabricShader(cushion: boolean): Hook {
  return shader => {
    shader.vertexShader = `varying vec2 vStudyFabricPoint;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Rug CircleGeometry is authored in XY before the mesh rotates to XZ.
        vStudyFabricPoint = ${cushion ? 'mix(transformed.xy, transformed.xz, step(.5, abs(normal.y)))' : 'transformed.xy'};
      `)
    shader.fragmentShader = `varying vec2 vStudyFabricPoint;\n${shader.fragmentShader}`
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 fabricPhase = vStudyFabricPoint * ${cushion ? '820.0' : '650.0'};
        vec2 fabricWeight = 1.0 - smoothstep(vec2(.65), vec2(1.5), fwidth(fabricPhase));
        float fabricWeave = dot(sin(fabricPhase) * fabricWeight, vec2(.012));
        diffuseColor.rgb *= 1.0 + fabricWeave;
      `)
  }
}
export const studyRugMaterialProps = Object.freeze({ onBeforeCompile: fabricShader(false), customProgramCacheKey: () => 'study-rug-fabric-v1' })
export const studyCushionMaterialProps = Object.freeze({ onBeforeCompile: fabricShader(true), customProgramCacheKey: () => 'study-cushion-fabric-v1' })
