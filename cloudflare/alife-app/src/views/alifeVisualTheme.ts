/**
 * Original Alife visual theme configuration for the Virtual Church scene.
 * Centralizes color, lighting, and effect parameters while preserving the
 * real church geometry and keeping the styling independent of any reference IP.
 *
 * The v2 scene-level rig remains frozen as the production baseline. V3 uses a
 * separate daylight treatment so visual iteration never changes the accepted
 * church geometry, texture payload, or the current production presentation.
 */

export const ALIFE_V3_PALETTE = {
  skyMist: '#9fc1cf',
  cloudIvory: '#f7edd8',
  sunriseGold: '#f4bc68',
  cedarHoney: '#b9784f',
  fellowshipJade: '#397768',
  gardenSage: '#78936c',
  stoneWarm: '#a79783',
  inkBrown: '#32281f',
  glassTeal: '#527c80',
} as const

export const ALIFE_V3_STYLE_RULES = {
  silhouette: 'rounded-primary-with-tapered-accents',
  edgeLanguage: 'soft-bevels-on-visible-hero-edges',
  materialLanguage: 'hand-painted-pbr-lite',
  contrastOrder: ['character-face', 'entrance', 'wayfinding', 'environment'],
  prohibited: ['photoreal-noise', 'large-layered-transparency', 'effect-led-shape-design'],
} as const

/** Scene-level environment settings: background color, fog, and tone-mapping exposure. */
export const ALIFE_SCENE = {
  background: '#8da8bc',
  fog: { color: '#c58e62', near: 50, far: 130 },
  exposure: 1.15,
} as const

/** Lighting rig: ambient fill, hemisphere sky/ground, key directional light, and warm accent point lights. */
export const ALIFE_LIGHTING = {
  ambient: { intensity: 0.7 },
  hemisphere: { skyColor: '#bfd9e8', groundColor: '#705a45', intensity: 0.95 },
  directional: { color: '#ffd091', intensity: 3.2, position: [38, 24, 30] as [number, number, number] },
  accentLights: { color: '#ffb84d', intensity: 2.5 },
  entrance: { color: '#ffc878', intensity: 2.8, distance: 6 },
} as const

/**
 * V3-only clear-morning treatment. It lifts the white facade, cedar entrance,
 * fair skin and parking hierarchy out of the former orange-grey dusk cast
 * without changing any scene geometry, material map, or world coordinate.
 */
export const ALIFE_V3_SCENE_TREATMENT = {
  scene: {
    background: '#9fc7df',
    // Preserve the near church/character lighting while keeping the mapped
    // industrial middle distance legible. Fully fade before the 190 m far clip.
    fog: { color: '#c8d8d5', near: 80, far: 175 },
    exposure: 1.08,
    backgroundIntensity: { desktop: 0.94, mobile: 0.9 },
    visibleSky: {
      horizonGlow: 'rgba(255, 238, 200, 0.13)',
      cloudCore: 'rgba(255, 255, 250, 0.17)',
      cloudEdge: 'rgba(236, 246, 250, 0)',
    },
  },
  lighting: {
    ambient: { intensity: 0.82 },
    hemisphere: { skyColor: '#d7ecf4', groundColor: '#7b7568', intensity: 1.05 },
    directional: { color: '#fff0d0', intensity: 2.5, position: [34, 32, 18] as [number, number, number] },
  },
  accent: {
    cross: {
      emissive: '#ffe1aa',
      emissiveIntensity: 0.42,
      lightIntensity: 1.15,
      distance: 4.8,
    },
    entrance: {
      color: '#fff0d4',
      intensity: 1.35,
      distance: 5.4,
    },
  },
} as const

/**
 * V3-only supporting prop treatment. These values refine existing vehicle and
 * vegetation assets without changing their geometry, placement, or the frozen
 * church presentation.
 */
export const ALIFE_V3_ENVIRONMENT_TREATMENT = {
  vehicles: {
    bodyColor: {
      suv: '#3f6657',
      sedan: '#8f4c40',
      van: '#4e6685',
    },
    glassColor: '#506973',
    trimColor: '#2b3136',
    metalColor: '#aeb7bc',
    // These semantic bins come from the triangle UVs in the three source GLBs,
    // not from sampling the top-down atlas image in isolation.
    atlasBins: {
      paint: {
        suv: [[3, 2], [3, 1]],
        sedan: [[3, 2], [6, 1]],
        van: [[3, 2], [7, 1]],
      },
      glass: [0, 3],
      trim: [2, 2],
      metal: [6, 2],
      lights: [[1, 3], [2, 3]],
    },
    body: {
      metalness: 0.14,
      roughness: 0.3,
      clearcoat: 0.58,
      clearcoatRoughness: 0.18,
      envMapIntensity: 1.05,
    },
    wheel: {
      metalness: 0.08,
      roughness: 0.78,
      clearcoat: 0.08,
      clearcoatRoughness: 0.68,
      envMapIntensity: 0.42,
    },
  },
  trees: {
    leaf: {
      broadleaf: '#52785a',
      oak: '#5f7655',
      pine: '#355f4f',
    },
    trunk: '#6d513b',
    accent: '#81936a',
    leafRoughness: 0.88,
    trunkRoughness: 0.96,
    envMapIntensity: 0.48,
  },
  bushes: {
    // The Quaternius bush texture is intentionally high-chroma. Remap its
    // light/dark leaf values into the same muted range as the Kenney trees so
    // the entrance planting reads as one landscape rather than mixed packs.
    darkLeaf: '#3f654a',
    lightLeaf: '#6f8461',
    roughness: 0.9,
    envMapIntensity: 0.4,
  },
  groundDetails: {
    grass: '#667c57',
    rock: '#786f63',
    flowerPurple: '#8d7aad',
    flowerYellow: '#d0aa55',
    flowerWhite: '#ded8c8',
    foliageRoughness: 0.92,
    flowerRoughness: 0.82,
    envMapIntensity: 0.34,
  },
  plantSilhouettes: {
    flax: '#466a50',
    tussock: '#718361',
    reserveTussock: '#667b5d',
    dryAccent: '#9b956b',
    roughness: 0.96,
    envMapIntensity: 0.38,
  },
  hedges: {
    base: '#48604a',
    variation: ['#4b654d', '#435d47', '#526b52'],
    cornerRadius: 0.16,
    roughness: 0.96,
    envMapIntensity: 0.34,
  },
  lightingDetails: {
    streetFixture: '#2d3433',
    streetFixtureRoughness: 0.62,
    streetFixtureMetalness: 0.52,
    streetLamp: '#e4e1d8',
    streetLampEmissive: '#fff3d2',
    streetLampEmissiveIntensity: 0.38,
    uplightFixture: '#343a39',
    uplightColor: '#ffe2ad',
    uplightIntensity: 0.78,
    uplightDistance: 4.8,
  },
  siteMetalwork: {
    fence: '#252c2a',
    fenceRoughness: 0.78,
    fenceMetalness: 0.36,
    gateLatch: '#b6b29c',
    gateLatchRoughness: 0.58,
    gateLatchMetalness: 0.34,
  },
  industrialContext: {
    auxiliaryWall: '#aeb3b0',
    auxiliaryRoof: '#747c79',
    auxiliaryAccent: '#626c69',
    silverWall: '#b9bfbd',
    silverAccent: '#747d7a',
    silverJoint: '#9fa8a5',
    paleWall: '#c5c1b6',
    paleAccent: '#707876',
    paleJoint: '#aaa9a1',
    greyWall: '#8b9491',
    greyAccent: '#606967',
    greyJoint: '#757f7c',
    darkOffice: '#3f4545',
    entryOrange: '#c56a2b',
    roofTrim: '#6f7673',
    roofLight: '#d0d2cb',
    roofBandLight: '#dedfd8',
    roofBandGrey: '#89928f',
    glass: '#3e5a5e',
    rollerDoor: '#969d9a',
    rollerSlat: '#6d7673',
    loadingPad: '#959995',
    serviceApron: '#626866',
    mulch: '#6c5140',
  },
  culvertDetails: {
    crossingAsphalt: '#505654',
    crossingConcrete: '#c2c4be',
    precastConcrete: '#a9ada7',
    concreteEdge: '#90968f',
    pipeInterior: '#1b2824',
    roughness: 0.96,
  },
  groundSurfaces: {
    terrain: '#74886c',
    reserveGrass: '#667a5f',
    grassTextureSize: 128,
    grassRepeat: 0.1,
    grassRoughness: 0.98,
    grassEnvMapIntensity: 0.36,
    asphaltTextureSize: 128,
    asphaltRepeat: 0.075,
    concreteTextureSize: 96,
    concreteRepeat: 0.12,
    footpath: '#c6c8c2',
    trafficIsland: '#aaa99f',
    spineWalkway: '#c4c5bf',
    entranceApron: '#b9bcb7',
    water: '#315a5d',
    waterNormalTextureSize: 64,
    waterNormalRepeat: 0.32,
    waterNormalStrength: 0.16,
    waterRoughness: 0.2,
    waterEnvMapIntensity: 0.82,
    waterDriftPerSecond: [0.004, 0.0025],
    swaleBank: '#66745c',
    swaleTransition: '#817768',
    swaleBed: '#2f3b36',
    swaleWater: '#3d6b69',
    swaleWaterRoughness: 0.24,
    swaleWaterEnvMapIntensity: 0.68,
  },
  parkingDetails: {
    line: '#e7e2d2',
    accessibleLine: '#d8ad4f',
    lineRoughness: 0.9,
    wheelStop: '#b3b5ae',
    wheelStopRoughness: 0.94,
  },
} as const

/** Bloom post-processing parameters (UnrealBloomPass / EffectComposer). */
export const ALIFE_BLOOM = {
  luminanceThreshold: 1.05,
  luminanceSmoothing: 0.35,
  intensity: 0.45,
  radius: 0.28,
} as const

/** N8AO (N8 Ambient Occlusion) post-processing parameters for realistic corner & contact shadows. */
export const ALIFE_N8AO = {
  aoRadius: 1,
  intensity: 0.9,
  distanceFalloff: 1.2,
  screenSpaceRadius: false,
} as const

/** PBR Environment map and material reflectance parameters. */
export const ALIFE_PBR = {
  envMapIntensity: 1.25,
  asphaltRoughness: 0.65,
  asphaltMetalness: 0.15,
  grassRoughness: 0.85,
  buildingRoughness: 0.35,
  buildingMetalness: 0.25,
  glassRoughness: 0.05,
  glassMetalness: 0.9,
} as const

/** Floating particle system: colors, counts, glow, and size range. */
export const ALIFE_PARTICLES = {
  colors: { magicPink: '#ff6b9d', mysticBlue: '#6ba3ff' },
  count: 12,
  // Keep the photographed entrance visually stable; the former spiral of
  // emissive particles looked like geometry flicker around the door.
  entranceCount: 0,
  emissiveIntensity: 0.35,
  opacity: 0.38,
  sizeRange: [0.08, 0.25] as [number, number],
} as const

/** Emissive material overrides for specific scene objects (street lights, vehicles, cross, entrance). */
export const ALIFE_EMISSIVE = {
  streetLight: { emissiveIntensity: 0.85 },
  vehicleLight: { emissiveIntensity: 0.65 },
  cross: { emissive: '#ffa500', emissiveIntensity: 0.3 },
  entranceMarker: { emissive: '#ffa500', emissiveIntensity: 0.8 },
  entranceRing: { color: '#ffd070', emissiveIntensity: 0.7 },
} as const

/** UI overlay styling: button, panel, and accent colors for the Alife HUD. */
export const ALIFE_UI = {
  buttonBg: 'bg-[#1a1208]/85',
  buttonText: 'text-[#f4d89b]',
  buttonBorder: 'border-[#c8952a]/60',
  buttonHover: 'hover:shadow-[0_0_12px_rgba(200,149,42,0.4)]',
  panelGradient: 'bg-gradient-to-b from-[#2a1f0a]/95 to-[#1a1208]/95',
  accentColor: '#c8952a',
  goldText: '#f4d89b',
} as const
