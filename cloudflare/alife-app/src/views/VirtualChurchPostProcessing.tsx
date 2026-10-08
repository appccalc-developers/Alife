import { Bloom, EffectComposer, N8AO, Vignette } from '@react-three/postprocessing'
import { ALIFE_BLOOM, ALIFE_N8AO } from './alifeVisualTheme'

const VirtualChurchPostProcessing = () => (
  <EffectComposer multisampling={2}>
    <N8AO
      aoRadius={ALIFE_N8AO.aoRadius}
      intensity={ALIFE_N8AO.intensity}
      distanceFalloff={ALIFE_N8AO.distanceFalloff}
      screenSpaceRadius={ALIFE_N8AO.screenSpaceRadius}
      halfRes
      quality="medium"
    />
    <Bloom
      luminanceThreshold={ALIFE_BLOOM.luminanceThreshold}
      luminanceSmoothing={ALIFE_BLOOM.luminanceSmoothing}
      intensity={ALIFE_BLOOM.intensity}
    />
    <Vignette eskil={false} offset={0.15} darkness={0.6} />
  </EffectComposer>
)

export default VirtualChurchPostProcessing
