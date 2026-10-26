import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditProductionHeroSource } from './gate-a-character-delivery.mjs'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDirectory, '..', '..')
const distRootOption = process.argv.find((argument) => argument.startsWith('--dist-root='))
const planPath = resolve(
  repositoryRoot,
  'docs',
  'virtual-church-visual-upgrade-plan.zh-CN.md',
)
const fullV3CharacterDelivery = await auditProductionHeroSource(
  await readFile(resolve(repositoryRoot, 'cloudflare/alife-app/src/services/virtualChurchService.ts'), 'utf8'),
  resolve(repositoryRoot, 'cloudflare/alife-app/public'),
)

const machineChecks = [
  ['runtimeAssetIntegrity', 'validate-runtime-asset-integrity.mjs'],
  ['animationRuntime', 'validate-gate-a-animation-runtime.mjs'],
  ['animationKinematics', 'validate-gate-a-animation-kinematics.mjs'],
  ['wardrobeRuntime', 'validate-gate-a-wardrobe-runtime.mjs'],
  ['heroDccSource', 'validate-gate-a-hero-dcc-source.mjs'],
  ['churchBaseline', 'validate-gate-a-church-baseline.mjs'],
  ['parkingLayout', 'render-gate-a-parking-layout-review.mjs'],
  ['faithfulEntranceComposition', 'render-gate-a-faithful-entrance-review.mjs'],
  ['gateAStyleSliceReview', 'render-gate-a-style-slice-review.mjs'],
  ['interactionRuntime', 'validate-interaction-runtime.mjs'],
  ['entranceInformation', 'validate-gate-a-entrance-information.mjs'],
  ['accessibilityRuntime', 'validate-accessibility-runtime.mjs'],
  ['statusRuntime', 'validate-status-runtime.mjs'],
  ['loadingBoundaries', 'validate-loading-boundaries.mjs'],
  ['fallbackRuntime', 'validate-fallback-runtime.mjs'],
  ['recoveryRuntime', 'validate-recovery-runtime.mjs'],
  ['sessionRuntime', 'validate-session-runtime.mjs'],
  ['resourceTimingRuntime', 'validate-resource-timing-runtime.mjs'],
  ['staticPayload', 'validate-static-critical-payload.mjs'],
  ['productionChunkClosure', 'validate-production-chunk-closure.mjs'],
  ['assetRelease', 'validate-asset-release-cache.mjs'],
]

const machineResults = {}
const machineErrors = []
for (const [name, filename] of machineChecks) {
  const distArguments = distRootOption && ['staticPayload', 'productionChunkClosure', 'assetRelease'].includes(name)
    ? [distRootOption]
    : []
  const result = spawnSync(process.execPath, [resolve(scriptDirectory, filename), ...distArguments], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    timeout: 180_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error) {
    machineErrors.push(`${name}: ${result.error.message}`)
    machineResults[name] = { passed: false, error: result.error.message }
    continue
  }
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout).trim()
    machineErrors.push(`${name}: exited ${result.status}${detail ? ` — ${detail}` : ''}`)
    machineResults[name] = { passed: false, exitCode: result.status, detail }
    continue
  }
  try {
    const evidence = JSON.parse(result.stdout)
    const identityMatches = name === 'heroDccSource'
      ? evidence.contract === 'vroid-fair-hero-source'
        && evidence.status === 'runtime-integrated-awaiting-motion-review'
        && evidence.visualVariant === 'vroid-fair-v1'
        && evidence.appearance?.skinTone === 'fair-warm'
        && evidence.appearance?.skinBaseColor === '#DFAB94'
        && evidence.authoring?.blenderEvidence?.meshCount === 3
        && evidence.authoring?.blenderEvidence?.bones === 187
        && evidence.lods?.length === 3
        && evidence.lods.every((lod) => lod.animations === 14)
        && evidence.lods.every((lod) => lod.dracoPrimitives === lod.primitives)
        && new Set(evidence.lods.map((lod) => lod.animationDigest)).size === 1
      : name === 'parkingLayout'
        ? evidence.referenceAuthority?.layoutRelationships === 'user-confirmed-overhead-view'
          && evidence.parkingRows?.find((row) => row.id === 'entry-gate-right')?.bays === 6
          && evidence.assertions?.entryRightSeparatedFromCentralParking === true
          && evidence.assertions?.centralWheelStopsFacePedestrianSpine === true
          && evidence.assertions?.centralCrossAisleHasNoPlantingIsland === true
          && evidence.assertions?.entranceHasNoPhysicalPlantersOrWelcomeBoards === true
          && evidence.assertions?.churchAssetChanged === false
        : true
    const passed = evidence.passed === true && identityMatches
    if (!passed) {
      machineErrors.push(`${name}: output did not satisfy the current Gate A identity contract`)
    }
    machineResults[name] = { passed, evidence }
  } catch (error) {
    machineErrors.push(`${name}: did not return one JSON document — ${error.message}`)
    machineResults[name] = { passed: false, error: error.message }
  }
}

const plan = await readFile(planPath, 'utf8')
const requiredPlanFragments = [
  '总分至少 10/12',
  '任一维度不得为 0 分',
  '性能、功能与用户确认是独立硬条件',
  'vroid-fair-v1',
  '浅暖肤色 `#DFAB94`',
  'V3 清澈晨光与脸部放大更新',
  '六车位＋独立横向车道＋中央无树＋正门无实体物件',
  'Gate A 仍未通过',
]
const planErrors = requiredPlanFragments
  .filter((fragment) => !plan.includes(fragment))
  .map((fragment) => `master plan lost current Gate A contract: ${fragment}`)

const heroEvidence = machineResults.heroDccSource?.evidence ?? null
const parkingEvidence = machineResults.parkingLayout?.evidence ?? null
const styleSliceEvidence = machineResults.gateAStyleSliceReview?.evidence ?? null
const staticPayloadPassed = machineResults.staticPayload?.passed === true
const faithfulBrowserFrameCaptured = plan.includes(
  '正式 Gate A 浏览器实景已完成当前帧捕获',
)
const mobilePerformanceSetRecorded = plan.includes(
  '正式移动三轮完成（覆盖上一段的未完成状态）',
)
const desktopPairedPerformanceRecorded = plan.includes(
  '浅肤色修正后的同状态性能复测',
)
const desktopRelativePerformancePassedRecorded =
  plan.includes('权威 V2/V3 配对性能收口')
  && plan.includes('FPS 相对 V2 仅回归 `2.2%`')
  && plan.includes('桌面绝对与相对 Gate 均通过')
const insideFenceDesktopPerformancePassedRecorded =
  plan.includes('栅栏内固定视口性能收口')
  && plan.includes('FPS 相对回退 `9.1%`')
  && plan.includes('当前相对性能 Gate 重新通过')
const daylightDesktopPerformancePassedRecorded =
  plan.includes('晨光版固定视口性能收口')
  && plan.includes('FPS 相对回退 `3.1%`')
  && plan.includes('当前晨光版桌面绝对与相对性能 Gate 均通过')
const mobileRelativePerformancePassedRecorded =
  plan.includes('权威 V2/V3 配对性能收口')
  && plan.includes('FPS 相对 V2 提升 `4.9%`')
  && plan.includes('全部移动绝对与相对 Gate 通过')
const producerVisualScoreRecorded = plan.includes('制作方初评为 `10/12`')
const edgeContextLossRecoveryRecorded = plan.includes('Edge 恢复回归更新')
const edgeRepeatedContextLossRecorded = plan.includes('Edge 连续故障更新')
const avatarFacingAndCameraOcclusionRecorded = plan.includes(
  '人物朝向与入口相机更新',
)
const bilingualEntranceRepeatRecorded = plan.includes(
  '场景内双语入口与重复触发更新',
)
const animationAndAssistiveTechnologyRecorded = plan.includes(
  '动画混合与辅助技术更新',
)
const pwaOfflineShellAndPrivacyRecorded = plan.includes(
  'PWA 离线外壳与隐私边界更新',
)
const sustainedLocomotionFacingRecorded = plan.includes(
  '持续移动与反向平移更新',
)
const gpuRouteExitReleaseRecorded = plan.includes(
  'GPU 退出释放更新',
)
const edgeOfflineHandoffRecorded = plan.includes(
  'Edge 真实停服离线更新',
)
const entranceSpawnPerformanceRetestPending =
  plan.includes('栅栏内首帧构图与性能复测更新')
  && plan.includes('当前相对性能 Gate 不记为通过')
  && !insideFenceDesktopPerformancePassedRecorded
const daylightPerformanceRetestPending =
  plan.includes('V3 清澈晨光与脸部放大更新')
  && plan.includes('当前版本须完成新的同视口 V2/V3 配对')
  && !daylightDesktopPerformancePassedRecorded
const currentVisualPerformanceRetestPending =
  entranceSpawnPerformanceRetestPending || daylightPerformanceRetestPending
const currentDesktopRelativePerformancePassedRecorded =
  daylightDesktopPerformancePassedRecorded
  || (!daylightPerformanceRetestPending
    && (insideFenceDesktopPerformancePassedRecorded
    || (!plan.includes('栅栏内首帧构图与性能复测更新')
      && desktopRelativePerformancePassedRecorded)))

const manualHardGates = {
  visualReview: {
    passed: false,
    heroAccepted: true,
    score: producerVisualScoreRecorded ? 10 : null,
    requiredScore: 10,
    maximumScore: 12,
    zeroScoreDimensionsAllowed: false,
    faithfulBrowserFrameCaptured,
    historicalPlanClaims: faithfulBrowserFrameCaptured
      ? [
          'The accepted VRoid heroine was captured in the faithful browser scene with the unchanged church.',
          ...(producerVisualScoreRecorded
            ? ['The producer recorded a six-dimension 10/12 assessment with no zero dimension.']
            : []),
        ]
      : [],
    missingEvidence: [
      ...(!faithfulBrowserFrameCaptured
        ? ['The accepted VRoid heroine has not yet been captured inside the faithful browser scene with the unchanged church.']
        : []),
      ...(!producerVisualScoreRecorded
        ? ['The current faithful Gate A browser frame has not yet received six-dimension scoring.']
        : ['The producer 10/12 assessment has not yet received explicit user approval.']),
    ],
  },
  currentStateBrowserFunction: {
    passed: false,
    historicalPlanClaims: [
      ...(edgeContextLossRecoveryRecorded
        ? [
            'Authenticated Edge context-loss fallback and manual 3D recovery.',
            'Two current V3 route entries completed and each route exit removed the Canvas.',
            'Chinese 390x844 controls remained accessible without horizontal body overflow.',
          ]
        : []),
      ...(edgeRepeatedContextLossRecorded
        ? [
            'Authenticated Edge remained in a stable fallback after a second forced context loss without an automatic recovery loop.',
          'Manual reload recovered the 3D Canvas after the second context loss.',
          ]
        : []),
      ...(avatarFacingAndCameraOcclusionRecorded
        ? [
            'Production-style member fixture verified V3 forward, backward, left and right avatar facing.',
            'Entrance-adjacent third-person camera remained outside the facade with the avatar and controls visible.',
          ]
        : []),
      ...(bilingualEntranceRepeatRecorded
        ? [
            'The in-scene language control switched the current V3 Canvas between English and Chinese without remounting it.',
            'The 390x844 entrance card and bilingual long text remained within the viewport without overflow.',
            'Returning from the parking preview restored the follow camera and repeated the entrance information trigger.',
          ]
        : []),
      ...(animationAndAssistiveTechnologyRecorded
        ? [
            'The production-style V3 route verified both idle loops, greet return, and jump loop/land/idle transitions.',
            'Walk and Run now preserve normalized gait phase across a 0.18-second cross-fade.',
            'The bilingual entrance announcement uses a persistent atomic polite live region and the computed scene font stack includes reviewed Chinese system fallbacks.',
          ]
        : []),
      ...(pwaOfflineShellAndPrivacyRecorded
        ? [
            'The production Service Worker precaches the public SPA shell and contains the offline navigation fallback.',
            'API, member-image, unknown-download and public-static cache boundaries are covered by source and built-worker contract cases.',
          ]
        : []),
      ...(edgeOfflineHandoffRecorded
        ? [
            'Edge loaded the public SPA shell twice after the production server stopped.',
            'The protected /api/me request remained network-only and failed closed instead of receiving cached identity data or the public navigation fallback.',
          ]
        : []),
      ...(sustainedLocomotionFacingRecorded
        ? [
            'Production-style V3 completed deterministic idle, walk, run, two-turn and completion phases after the released character became ready.',
            'All 52 translated browser samples faced their travel direction; the minimum facing dot was 0.99999973 with no reverse translation.',
          ]
        : []),
    ],
    missingEvidence: [
      ...(sustainedLocomotionFacingRecorded
        ? ['Final human keyboard/joystick sustained-input feel and visual approval.']
        : animationAndAssistiveTechnologyRecorded
        ? ['Authenticated sustained Walk/Run/Turn input feel and final human visual inspection.']
        : ['Authenticated route verification of complete animation loops, blends and sustained input feel.']),
      ...(animationAndAssistiveTechnologyRecorded
        ? ['Screen reader announcement on representative assistive technology.']
        : bilingualEntranceRepeatRecorded
          ? ['Screen reader announcement and system font fallback verification.']
        : ['Responsive entrance information trigger, screen reader, font fallback and complete bilingual long-text behaviour.']),
      ...(!edgeOfflineHandoffRecorded
        ? ['Real-browser legacy Service Worker handoff, authenticated offline behaviour and server-stopped repeat visit.']
        : []),
    ],
  },
  currentStatePerformance: {
    // Narrative matches locate prior work; they do not bind a measured sample
    // to today's source, build, assets, camera or device. Fail closed until
    // actual current-state evidence is validated, even if every phrase exists.
    passed: false,
    currentStateEvidenceVerified: false,
    staticPayloadBudgetPassed: staticPayloadPassed,
    historicalPlanClaims: [
      ...(desktopPairedPerformanceRecorded && !currentVisualPerformanceRetestPending
        ? ['Matched current-state v2/v3 desktop sets, three runs per visual version.']
        : []),
      ...(mobilePerformanceSetRecorded
        ? ['Current-state v3 mobile set, three runs at 390x844 and 10 Mbps / 150 ms.']
        : []),
      ...(currentDesktopRelativePerformancePassedRecorded && !currentVisualPerformanceRetestPending
        ? [daylightDesktopPerformancePassedRecorded
          ? 'For the current clear-morning treatment, desktop V3 median FPS regression is 3.1% versus V2 and p95 increased by 0.7%; both relative gates passed.'
          : insideFenceDesktopPerformancePassedRecorded
            ? 'At the current inside-fence spawn, desktop V3 median FPS regression is 9.1% versus V2 and p95 increased by 10.3%; both relative gates passed.'
            : 'Desktop V3 median FPS regression is 2.2% versus V2, within the 10% relative gate; p95 improved by 7.9%.']
        : []),
      ...(mobileRelativePerformancePassedRecorded
        ? ['Mobile V3 median FPS improved by 4.9% versus V2 and passed the absolute and relative gates.']
        : []),
      ...(gpuRouteExitReleaseRecorded
        ? [
            'Two production-style V3 SPA route exits each removed the Canvas and released the populated WebGL context.',
            'Both released renderers held 6 geometries and 34 textures; created/released context totals balanced at 2/2 with zero console errors.',
          ]
        : []),
    ],
    missingEvidence: [
      'Validate actual desktop and mobile performance sample sets against the current build and asset identities; matching historical plan text is not verification.',
      'Verify current character-switch resource residency and route-exit release; historical context counters do not prove current GPU memory behavior.',
      ...(!desktopPairedPerformanceRecorded && !currentVisualPerformanceRetestPending
        ? ['Matched v2/v3 desktop samples, three runs per state.']
        : []),
      ...(currentVisualPerformanceRetestPending
        ? [daylightPerformanceRetestPending
          ? 'Fixed-viewport matched v2/v3 desktop sets for the current clear-morning V3 treatment, proving no more than 10% median FPS regression without visual loss.'
          : 'Fixed-viewport matched v2/v3 desktop sets at the current inside-fence spawn, followed by evidence proving no more than 10% median FPS regression without visual loss.']
        : []),
      ...(!mobilePerformanceSetRecorded
        ? ['Current-state v3 mobile samples, three runs at the formal network preset.']
        : []),
      ...(!gpuRouteExitReleaseRecorded
        ? ['Post-exit GPU residency evidence from a representative browser/device.']
        : []),
      ...(!currentDesktopRelativePerformancePassedRecorded && !currentVisualPerformanceRetestPending
        ? ['Matched desktop evidence proving no more than 10% median FPS regression without visual loss.']
        : []),
      ...(!mobileRelativePerformancePassedRecorded
        ? ['Matched mobile V2/V3 evidence passing the absolute and relative performance gates.']
        : []),
    ],
  },
  realDevice: {
    passed: false,
    missingEvidence: [
      'Representative Android verification.',
      'Representative iOS verification.',
    ],
  },
  userConfirmation: {
    passed: false,
    heroineAccepted: true,
    missingEvidence: [
      'Explicit user approval of the complete faithful Gate A style slice after browser review.',
    ],
  },
}

const report = {
  schemaVersion: 6,
  release: 'gate-a-baseline-r9',
  buildArtifactChecked: distRootOption?.slice('--dist-root='.length) ?? null,
  auditPurpose: 'Machine checks run now. historicalPlanClaims are unverified narrative references, not current-state evidence; this report cannot replace browser, device, performance, visual scoring, or overall user approval.',
  machineContracts: {
    passed: machineErrors.length === 0,
    checks: Object.fromEntries(
      Object.entries(machineResults).map(([name, result]) => [name, result.passed]),
    ),
    errors: machineErrors,
  },
  masterPlanContract: {
    passed: planErrors.length === 0,
    requiredFragments: requiredPlanFragments,
    errors: planErrors,
  },
  currentEvidence: {
    heroine: heroEvidence ? {
      contract: heroEvidence.contract,
      status: heroEvidence.status,
      visualVariant: heroEvidence.visualVariant,
      appearance: heroEvidence.appearance,
      sourceBlendSha256: heroEvidence.authoring?.sourceBlendSha256,
      lods: heroEvidence.lods,
      passed: machineResults.heroDccSource?.passed === true,
    } : null,
    parking: parkingEvidence ? {
      status: parkingEvidence.status,
      authority: parkingEvidence.referenceAuthority?.layoutRelationships,
      gateRightBays: parkingEvidence.parkingRows?.find((row) => row.id === 'entry-gate-right')?.bays,
      crossAisleWidthMetres: parkingEvidence.measurementsMetres?.entryRightToCentralDriveAisleWidth,
      assertions: parkingEvidence.assertions,
      passed: machineResults.parkingLayout?.passed === true,
    } : null,
    faithfulEntrance: machineResults.faithfulEntranceComposition?.passed === true,
    styleSliceStatus: styleSliceEvidence?.status ?? null,
  },
  manualHardGates,
  fullV3CharacterDelivery,
  // Gate A historically examined one style-slice heroine. It is not the full
  // two-hero V3 delivery gate, even when all of its machine checks pass.
  fullV3Passed: false,
  gateAPassed: false,
  nextDecision: 'Reconcile the current build and both character states with the remaining acceptance requirements. Validate current-state performance and browser evidence, then review the current complete scene; do not request approval of an obsolete frame or infer approval from historical text.',
}
report.auditPassed = report.machineContracts.passed
  && report.masterPlanContract.passed
  && Object.values(manualHardGates).every((gate) => gate.passed)
report.gateAPassed = report.auditPassed

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
if (!report.auditPassed) process.exitCode = 1
