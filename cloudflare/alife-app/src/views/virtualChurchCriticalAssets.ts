import type { Config3D } from '../services/virtualChurchService'

export type VirtualChurchHeroReadyAssets = {
  churchHero: string
  characterHero: string
}

/**
 * Assets that must be ready before the V3 performance probe records Hero ready.
 *
 * Keep this selection pure so the production scene and the static transfer
 * budget validator use the same desktop/mobile LOD contract.
 */
export const selectVirtualChurchHeroReadyAssets = (
  config: Pick<Config3D, 'buildings' | 'characters'>,
  isMobile: boolean,
  heroId: 'female' | 'male' = 'female',
): VirtualChurchHeroReadyAssets => ({
  churchHero: isMobile
    ? config.buildings.churchHeroLow
    : config.buildings.churchHeroHigh,
  characterHero: heroId === 'male'
    ? isMobile ? config.characters.gateAMaleLow : config.characters.gateAMaleMedium
    : isMobile
    ? config.characters.gateAFemaleLow
    // The medium mesh preserves the reviewed VRoid face, wardrobe, skeleton,
    // materials, and animation set while avoiding high-mesh skinning cost in
    // the interactive entrance view. Keep the high mesh in the release for
    // DCC/review renders; the live desktop scene is a runtime, not a turntable.
    : config.characters.gateAFemaleMedium,
})
