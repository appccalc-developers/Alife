import type { Color } from 'three'

export type VirtualChurchOutfitId = 'classic' | 'service' | 'community'

/** Reapply from an immutable authored colour; never accumulate preset tints. */
export const gateAApplyOutfitMaterialTint = (
  target: Color,
  tint: Color,
  authoredColor?: Color,
) => {
  target.copy(authoredColor ?? tint)
  if (authoredColor) target.multiply(tint)
}

export const VIRTUAL_CHURCH_OUTFIT_SWATCHES: Record<VirtualChurchOutfitId, string> = {
  classic: '#f1eee6',
  service: '#345f54',
  community: '#b48155',
}

/**
 * Multiplied with the authored colours on the outfit material set. Classic
 * stays pure white so the approved Gate A character is unchanged at the
 * material-input level.
 * The other presets are intentionally subtle to retain the cream/jade/gold
 * separation instead of flattening the whole outfit into one colour.
 */
export const GATE_A_OUTFIT_MATERIAL_TINTS: Record<VirtualChurchOutfitId, string> = {
  classic: '#ffffff',
  service: '#d2dcd9',
  community: '#f0e3d9',
}

export const GATE_A_OUTFIT_MATERIAL_NAME = 'M_VC3_HeroFemale_Outfit'
// The skin textures already contain the intended fair-peach anime shading.
// Render those two slots without scene lighting so a dusk backlight cannot
// reinterpret the approved complexion as grey or dark brown.
export const GATE_A_SKIN_UNLIT_COLOR = '#ffffff'
export const GATE_A_OPAQUE_ALPHA_MATERIAL_NAMES = [
  'N00_000_00_FaceMouth_00_FACE (Instance)',
  'N00_000_00_Face_00_SKIN (Instance)',
  'N00_000_00_EyeWhite_00_EYE (Instance)',
  'N00_000_Hair_00_HAIR_01 (Instance)',
  'N00_000_Hair_00_HAIR_02 (Instance)',
] as const

const GATE_A_VROID_OUTFIT_MATERIAL_PATTERN = /_CLOTH(?:_| \()/
const GATE_A_VROID_SKIN_MATERIAL_PATTERN = /_SKIN(?:_| \()/
const GATE_A_OPAQUE_ALPHA_MATERIAL_SET = new Set<string>(
  GATE_A_OPAQUE_ALPHA_MATERIAL_NAMES,
)

export const gateAOutfitMaterialTint = (
  outfitId: VirtualChurchOutfitId,
) => GATE_A_OUTFIT_MATERIAL_TINTS[outfitId]

export const gateAIsOutfitMaterial = (materialName: string) =>
  materialName === GATE_A_OUTFIT_MATERIAL_NAME
  || GATE_A_VROID_OUTFIT_MATERIAL_PATTERN.test(materialName)

export const gateAIsSkinMaterial = (materialName: string) =>
  GATE_A_VROID_SKIN_MATERIAL_PATTERN.test(materialName)

export const gateAUsesOpaqueAlphaPath = (materialName: string) =>
  GATE_A_OPAQUE_ALPHA_MATERIAL_SET.has(materialName)
