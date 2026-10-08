export type VirtualChurchRecoverySignals = {
  webGlAvailable: boolean
  webGlLost: boolean
  automaticRecoveryAttempted: boolean
  diagnosticFailureMode: string | null
  documentVisible: boolean
}

export const virtualChurchContextLossDiagnosticLimit = (
  diagnosticFailureMode: string | null,
) => diagnosticFailureMode === 'context-loss-repeat'
  ? 2
  : diagnosticFailureMode === 'context-loss'
    ? 1
    : 0

// React Three Fiber deliberately loses an old WebGL context after Canvas
// unmount. That release is useful diagnostic evidence, but only the currently
// displayed canvas should put the page into its context-loss recovery state.
export const virtualChurchShouldReportContextLoss = (
  canvasConnected: boolean,
  canvasIsCurrent: boolean,
) => canvasConnected && canvasIsCurrent

export const virtualChurchShouldAutomaticallyRecover = ({
  webGlAvailable,
  webGlLost,
  automaticRecoveryAttempted,
  diagnosticFailureMode,
  documentVisible,
}: VirtualChurchRecoverySignals) =>
  webGlAvailable
  && webGlLost
  && !automaticRecoveryAttempted
  && diagnosticFailureMode === null
  && documentVisible
