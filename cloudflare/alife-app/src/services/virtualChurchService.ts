/**
 * Virtual Church 3D asset configuration service.
 *
 * Resolves 3D model URLs based on the current environment:
 *   - Production  → Cloudflare R2 CDN (via VITE_3D_ASSETS_CDN)
 *   - Development → local `/virtual-church-assets/…` paths
 *
 * Also exposes performance presets, VR detection, and terrain LOD config.
 *
 * To test CDN assets locally, set VITE_3D_ASSETS_CDN in your .env.local:
 *   VITE_3D_ASSETS_CDN=https://pub-xxxxx.r2.dev
 */

import { virtualChurchUsesMobileBudget } from '../views/virtualChurchPerformanceContract'

// ── Asset URLs ──────────────────────────────────────────────────────────────

const LOCAL_BASE = '/virtual-church-assets'
const V2_ASSET_PREFIX = ''
const V3_ASSET_RELEASE = 'gate-a-baseline-r9'
const V3_ASSET_PREFIX = `/v3/releases/${V3_ASSET_RELEASE}`

const cdnBase = (import.meta.env.VITE_3D_ASSETS_CDN ?? '').trim().replace(/\/$/, '')

const isCdnConfigured = cdnBase.length > 0

export type VirtualChurchVisualVersion = 'v2' | 'v3'
export type VirtualChurchCharacterReview =
  | 'female-v12'
  | 'male-v12'
  | 'female-v13'
  | 'male-v13'
  | 'female-v14'
  | 'male-v14'
export type VirtualChurchCharacterReviewQuality = 'high' | 'medium' | 'low'
export type VirtualChurchHeroId = 'female' | 'male'
// A released motion profile is independent of the DEV-only review endpoints.
export type VirtualChurchCharacterMotionProfile = VirtualChurchCharacterReview | VirtualChurchHeroId

export const VIRTUAL_CHURCH_CHARACTER_REVIEW_ASSETS: Partial<Record<
  VirtualChurchCharacterReview,
  Partial<Record<VirtualChurchCharacterReviewQuality, string>>
>> = import.meta.env.DEV ? {
  'female-v12': {
    high: '/__alife-review/virtual-church/character-hero-female-v12-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-female-v12-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-female-v12-low.glb',
  },
  'male-v12': {
    high: '/__alife-review/virtual-church/character-hero-male-v12-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-male-v12-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-male-v12-low.glb',
  },
  'female-v13': {
    high: '/__alife-review/virtual-church/character-hero-female-v13-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-female-v13-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-female-v13-low.glb',
  },
  'male-v13': {
    high: '/__alife-review/virtual-church/character-hero-male-v13-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-male-v13-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-male-v13-low.glb',
  },
  'female-v14': {
    high: '/__alife-review/virtual-church/character-hero-female-v14-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-female-v14-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-female-v14-low.glb',
  },
  'male-v14': {
    high: '/__alife-review/virtual-church/character-hero-male-v14-high.glb',
    medium: '/__alife-review/virtual-church/character-hero-male-v14-medium.glb',
    low: '/__alife-review/virtual-church/character-hero-male-v14-low.glb',
  },
} : {}

export const VIRTUAL_CHURCH_CHARACTER_REVIEW_PICKERS: Partial<Record<
  VirtualChurchCharacterReview,
  string
>> = import.meta.env.DEV ? {
  'male-v12': '/__alife-review/virtual-church/character-hero-male-v12-picker.webp',
  'male-v13': '/__alife-review/virtual-church/character-hero-male-v12-picker.webp',
  'male-v14': '/__alife-review/virtual-church/character-hero-male-v14-picker.webp',
} : {}

const configuredVisualVersion: VirtualChurchVisualVersion =
  import.meta.env.VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT === 'v3'
    ? 'v3'
    : import.meta.env.VITE_VIRTUAL_CHURCH_VISUAL_DEFAULT === 'v2'
      ? 'v2'
      : import.meta.env.DEV
        ? 'v3'
        : 'v2'

/**
 * Return the released visual version.
 *
 * A local `?vcVisual=v2|v3` override is deliberately restricted to Vite
 * development builds so a production visitor cannot bypass release state.
 */
export const getVisualVersion = (): VirtualChurchVisualVersion => {
  if (!import.meta.env.DEV) return configuredVisualVersion

  const localOverride = new URLSearchParams(window.location.search).get('vcVisual')
  return localOverride === 'v2' || localOverride === 'v3'
    ? localOverride
    : configuredVisualVersion
}

/**
 * Select an unpublished character only for an explicit local V3 review.
 *
 * The asset is served by Vite's development middleware and is absent from the
 * production public directory, build output, PWA cache and release mapping.
 */
export const getVirtualChurchCharacterReview = (
  visualVersion = getVisualVersion(),
): VirtualChurchCharacterReview | null => {
  if (!import.meta.env.DEV || visualVersion !== 'v3') return null
  const review = new URLSearchParams(window.location.search).get('vcCharacterReview')
  return review === 'female-v12'
    || review === 'male-v12'
    || review === 'female-v13'
    || review === 'male-v13'
    || review === 'female-v14'
    || review === 'male-v14'
    ? review
    : null
}

export const getVirtualChurchCharacterReviewQuality = (
  fallback: VirtualChurchCharacterReviewQuality,
): VirtualChurchCharacterReviewQuality => {
  if (!import.meta.env.DEV) return fallback
  const quality = new URLSearchParams(window.location.search)
    .get('vcCharacterReviewQuality')
  return quality === 'high' || quality === 'medium' || quality === 'low'
    ? quality
    : fallback
}

export const getVirtualChurchSharedMotionReview = (review: VirtualChurchCharacterMotionProfile | null): string | null =>
  import.meta.env.DEV && review === 'male-v14'
    && new URLSearchParams(window.location.search).get('vcSharedMotion') === '1'
    ? '/__alife-review/virtual-church/character-hero-male-v14-motion.glb'
    : null

const getAssetPrefix = (visualVersion: VirtualChurchVisualVersion) =>
  visualVersion === 'v3' ? V3_ASSET_PREFIX : V2_ASSET_PREFIX

/** Build a full asset URL – CDN in production (when configured), local otherwise. */
const assetUrl = (
  relativePath: string,
  visualVersion: VirtualChurchVisualVersion,
) => {
  const versionedPath = `${getAssetPrefix(visualVersion)}${relativePath}`
  return isCdnConfigured ? `${cdnBase}${versionedPath}` : `${LOCAL_BASE}${versionedPath}`
}

/**
 * Gate A replaces assets one by one. Until a v3 path is explicitly supplied,
 * the preview keeps using the released v2 asset instead of producing a 404 or
 * duplicating both versions in the scene.
 */
const selectedAssetUrl = (
  relativePath: string,
  visualVersion: VirtualChurchVisualVersion,
  v3RelativePath?: string,
) => visualVersion === 'v3' && v3RelativePath
  ? assetUrl(v3RelativePath, 'v3')
  : assetUrl(relativePath, 'v2')

export type NatureAssetKey = 'broadleaf' | 'oak' | 'pine' | 'purpleFlower' | 'yellowFlower' | 'grass' | 'rockA' | 'rockC' | 'flatRock'
export type VehicleAssetKey = 'sedan' | 'suv' | 'van'
export type CharacterAssetKey =
  | 'cleric'
  | 'ranger'
  | 'wizard'
  | 'pastor'
  | 'sister'
  | 'believerMan'
  | 'believerWoman'
  | 'gateAFemaleHigh'
  | 'gateAFemaleMedium'
  | 'gateAFemaleLow'
  | 'gateAFemalePicker'
  | 'gateAMaleHigh'
  | 'gateAMaleMedium'
  | 'gateAMaleLow'
  | 'gateAMalePicker'
export type BuildingAssetKey = 'churchHeroHigh' | 'churchHeroMedium' | 'churchHeroLow' | 'churchProps'

export type Config3D = {
  /** Selected visual release; v3 is query-selectable only in local development. */
  visualVersion: VirtualChurchVisualVersion
  /** Base URL used for all 3D assets (CDN or local). */
  baseUrl: string
  /** Whether the CDN is actively configured (production or local override). */
  isCdn: boolean
  /** Shared decoder path for Draco-compressed church geometry. */
  dracoDecoderPath: string
  nature: Record<NatureAssetKey, string>
  vehicles: Record<VehicleAssetKey, string>
  characters: Record<CharacterAssetKey, string>
  buildings: Record<BuildingAssetKey, string>
}

export const get3DConfig = (
  visualVersion = getVisualVersion(),
): Config3D => ({
  visualVersion,
  baseUrl: isCdnConfigured
    ? `${cdnBase}${getAssetPrefix(visualVersion)}`
    : `${LOCAL_BASE}${getAssetPrefix(visualVersion)}`,
  isCdn: isCdnConfigured,
  // Decoder binaries are shared infrastructure, not visual-version assets.
  dracoDecoderPath: assetUrl('/draco/', 'v2'),

  nature: {
    broadleaf: selectedAssetUrl('/nature/tree-broadleaf.glb', visualVersion),
    oak: selectedAssetUrl('/nature/tree-oak.glb', visualVersion),
    pine: selectedAssetUrl('/nature/tree-pine.glb', visualVersion),
    purpleFlower: selectedAssetUrl('/nature/flower-purple.glb', visualVersion),
    yellowFlower: selectedAssetUrl('/nature/flower-yellow.glb', visualVersion),
    grass: selectedAssetUrl('/nature/grass-clump.glb', visualVersion),
    rockA: selectedAssetUrl('/nature/rock-large-a.glb', visualVersion),
    rockC: selectedAssetUrl('/nature/rock-large-c.glb', visualVersion),
    flatRock: selectedAssetUrl('/nature/rock-flat.glb', visualVersion),
  },

  vehicles: {
    sedan: selectedAssetUrl('/vehicles/sedan.glb', visualVersion),
    suv: selectedAssetUrl('/vehicles/suv.glb', visualVersion),
    van: selectedAssetUrl('/vehicles/van.glb', visualVersion),
  },

  characters: {
    cleric: selectedAssetUrl('/characters/cleric.gltf', visualVersion),
    ranger: selectedAssetUrl('/characters/ranger.gltf', visualVersion),
    wizard: selectedAssetUrl('/characters/wizard.gltf', visualVersion),
    pastor: selectedAssetUrl('/characters/pastor.gltf', visualVersion),
    sister: selectedAssetUrl('/characters/sister.gltf', visualVersion),
    believerMan: selectedAssetUrl('/characters/believer-man.gltf', visualVersion),
    believerWoman: selectedAssetUrl('/characters/believer-woman.gltf', visualVersion),
    gateAFemaleHigh: selectedAssetUrl(
      '/characters/believer-woman.gltf',
      visualVersion,
      '/characters/character-hero-female-high.glb',
    ),
    gateAFemaleMedium: selectedAssetUrl(
      '/characters/believer-woman.gltf',
      visualVersion,
      '/characters/character-hero-female-medium.glb',
    ),
    gateAFemaleLow: selectedAssetUrl(
      '/characters/believer-woman.gltf',
      visualVersion,
      '/characters/character-hero-female-low.glb',
    ),
    // The picker portrait belongs to the v3 Hero release and is requested
    // only when its drawer opens. Keep its URL release-scoped even while the
    // production scene remains on v2 during Gate A review.
    gateAFemalePicker: assetUrl(
      '/characters/character-hero-female-picker.webp',
      'v3',
    ),
    // Separate immutable release: do not rewrite the accepted r9 female or
    // church bundle. No model or portrait is requested by this URL mapping.
    gateAMaleHigh: `${isCdnConfigured ? cdnBase : LOCAL_BASE}/v3/releases/male-hero-v14-r1/characters/character-hero-male-high.glb`,
    gateAMaleMedium: `${isCdnConfigured ? cdnBase : LOCAL_BASE}/v3/releases/male-hero-v14-r1/characters/character-hero-male-medium.glb`,
    gateAMaleLow: `${isCdnConfigured ? cdnBase : LOCAL_BASE}/v3/releases/male-hero-v14-r1/characters/character-hero-male-low.glb`,
    gateAMalePicker: `${isCdnConfigured ? cdnBase : LOCAL_BASE}/v3/releases/male-hero-v14-r1/characters/character-hero-male-picker.webp`,
  },

  buildings: {
    // V3 uses byte-identical GLBs with 1024px textures whose decoded RGBA
    // pixels are identical to v2. Only lossless PNG encoding differs.
    churchHeroHigh: selectedAssetUrl(
      '/buildings/church-hero.glb',
      visualVersion,
      '/buildings/church-hero.glb',
    ),
    churchHeroMedium: selectedAssetUrl(
      '/buildings/church-hero-medium.glb',
      visualVersion,
      '/buildings/church-hero-medium.glb',
    ),
    churchHeroLow: selectedAssetUrl(
      '/buildings/church-hero-low.glb',
      visualVersion,
      '/buildings/church-hero-low.glb',
    ),
    churchProps: assetUrl('/buildings/church-props.glb', 'v2'),
  },
})

// ── Performance ─────────────────────────────────────────────────────────────

export type ShadowQuality = 'low' | 'medium' | 'high' | 'ultra'

export type AntiAliasingMode = 'none' | 'fxaa' | 'smaa' | 'taa'

export type LODDistances = {
  /** Beyond this distance (metres) trees switch to low-poly billboards. */
  tree: number
  /** Beyond this distance decorative detail (flowers, grass) is culled. */
  detail: number
  /** Building geometry is always loaded; this controls extra detail swaps. */
  building: number
}

export type PerformanceConfig = {
  /** Maximum texture resolution uploaded to GPU (px per axis). */
  maxTextureResolution: number
  shadowQuality: ShadowQuality
  /** Shadow map width/height in pixels. */
  shadowMapSize: number
  antiAliasing: AntiAliasingMode
  lodDistances: LODDistances
  /** Maximum device pixel ratio the renderer will use. */
  maxDevicePixelRatio: number
  /** Whether post-processing (bloom, AO, vignette) should be enabled. */
  postProcessing: boolean
  /** Whether glass transmission materials are enabled. */
  glassTransmission: boolean
  /** Whether this config targets a mobile-class device. */
  isMobile: boolean
  /** Whether immersive VR (WebXR) is available. */
  vrSupport: boolean
}

const SHADOW_MAP_SIZES: Record<ShadowQuality, number> = {
  low: 512,
  medium: 1024,
  high: 2048,
  ultra: 4096,
}

const DESKTOP_PRESET: PerformanceConfig = {
  maxTextureResolution: 2048,
  shadowQuality: 'high',
  shadowMapSize: SHADOW_MAP_SIZES.high,
  antiAliasing: 'smaa',
  lodDistances: { tree: 50, detail: 30, building: 120 },
  maxDevicePixelRatio: 1.1,
  postProcessing: true,
  glassTransmission: true,
  isMobile: false,
  vrSupport: false,
}

const MOBILE_PRESET: PerformanceConfig = {
  maxTextureResolution: 1024,
  shadowQuality: 'low',
  shadowMapSize: SHADOW_MAP_SIZES.low,
  antiAliasing: 'fxaa',
  lodDistances: { tree: 25, detail: 15, building: 60 },
  maxDevicePixelRatio: 1,
  postProcessing: false,
  glassTransmission: false,
  isMobile: true,
  vrSupport: false,
}

const VR_PRESET: PerformanceConfig = {
  maxTextureResolution: 1024,
  shadowQuality: 'medium',
  shadowMapSize: SHADOW_MAP_SIZES.medium,
  antiAliasing: 'fxaa',
  lodDistances: { tree: 35, detail: 20, building: 80 },
  maxDevicePixelRatio: 1,
  postProcessing: false,
  glassTransmission: false,
  isMobile: false,
  vrSupport: true,
}

/** Orientation-independent mobile budget; do not upgrade landscape phones. */
const isMobileDevice = () =>
  virtualChurchUsesMobileBudget(navigator.userAgent, window.innerWidth, window.innerHeight)

/**
 * Detect WebXR immersive-vr support via the browser's `navigator.xr` API.
 * Returns a promise that resolves to `true` when an immersive-vr session
 * mode is reported as supported. Resolves to `false` on any failure or
 * when the API is absent.
 */
export const detectVRSupport = async (): Promise<boolean> => {
  try {
    const xr = (navigator as Navigator & { xr?: { isSessionSupported(mode: string): Promise<boolean> } }).xr
    if (!xr) return false
    return await xr.isSessionSupported('immersive-vr')
  } catch {
    return false
  }
}

/**
 * Return the performance configuration appropriate for the current device.
 *
 * - Mobile devices receive a reduced preset automatically.
 * - When `overrideVR` is `true` (e.g. after an async VR check), the VR
 *   preset is returned instead.
 * - On desktop the full-quality preset is used.
 */
export const getPerformanceConfig = (overrideVR = false): PerformanceConfig => {
  if (overrideVR) return { ...VR_PRESET }
  const profileMode = new URLSearchParams(window.location.search).get('profile3d')
  if (profileMode === 'mobile') return { ...MOBILE_PRESET }
  if (profileMode === 'desktop') return { ...DESKTOP_PRESET }
  if (isMobileDevice()) return { ...MOBILE_PRESET }
  return { ...DESKTOP_PRESET }
}

// ── Terrain LOD ─────────────────────────────────────────────────────────────

export type TerrainLODLevel = 'high' | 'medium' | 'low'

export type TerrainLODLayers = {
  /** High-detail radius around the camera (metres). */
  highRadius: number
  /** Medium-detail radius (metres). Beyond this → low detail. */
  mediumRadius: number
  /** Grid step (metres) for each LOD tier. */
  steps: Record<TerrainLODLevel, number>
}

const DEFAULT_TERRAIN_LOD: TerrainLODLayers = {
  highRadius: 20,
  mediumRadius: 50,
  steps: { high: 1, medium: 2, low: 4 },
}

const MOBILE_TERRAIN_LOD: TerrainLODLayers = {
  highRadius: 12,
  mediumRadius: 30,
  steps: { high: 2, medium: 4, low: 8 },
}

export const getTerrainLOD = (mobile = isMobileDevice()): TerrainLODLayers =>
  mobile ? { ...MOBILE_TERRAIN_LOD } : { ...DEFAULT_TERRAIN_LOD }

// ── Aggregated service ──────────────────────────────────────────────────────

export const virtualChurchService = {
  get3DConfig,
  getPerformanceConfig,
  getTerrainLOD,
  detectVRSupport,
}
