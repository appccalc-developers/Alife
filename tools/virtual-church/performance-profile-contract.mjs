export const VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION = 7
export const VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET = 3

const sameFiniteNumber = (left, right, tolerance = 0) =>
  Number.isFinite(left)
  && Number.isFinite(right)
  && Math.abs(left - right) <= tolerance

const sameFiniteArray = (left, right, tolerance) =>
  Array.isArray(left)
  && Array.isArray(right)
  && left.length === right.length
  && left.every((value, index) =>
    sameFiniteNumber(value, right[index], tolerance),
  )

const quaternionOrientationMatches = (left, right) => {
  if (
    !Array.isArray(left)
    || !Array.isArray(right)
    || left.length !== 4
    || right.length !== 4
    || !left.every(Number.isFinite)
    || !right.every(Number.isFinite)
  ) return false
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0)
  return Math.abs(dot) >= 0.99999
}

export const virtualChurchProfileUsesFallback = (profile) =>
  profile?.fallback?.church === true
  || profile?.fallback?.character === true

export const virtualChurchProfileSamplingIsValid = (profile) =>
  // CPU/GPU instrumentation changes submission cost. Its figures are
  // diagnostic only, even when the callback window otherwise looks valid.
  // Startup tracing also changes readiness cost, before the steady window.
  !Object.hasOwn(profile ?? {}, 'cpuSubmissionDiagnostics')
  && !Object.hasOwn(profile ?? {}, 'gpuTimingDiagnostics')
  && !Object.hasOwn(profile?.loading ?? {}, 'startupPassTimings')
  && profile?.sampling?.documentVisibilityState === 'visible'
  && profile?.sampling?.uninterruptedForeground === true
  && profile?.sampling?.interruptionCount === 0
  && Number.isFinite(profile?.sampling?.maximumCallbackGapMs)
  && profile.sampling.maximumCallbackGapMs <= 250

const pathCount = (timeline, predicate) =>
  timeline.filter((entry) => predicate(entry?.path ?? '')).length

export const virtualChurchResourceTimingChecks = (profile, { characterEncodedBodySizeBytesMax } = {}) => {
  const timeline = Array.isArray(profile?.loading?.criticalResourceTimeline)
    ? profile.loading.criticalResourceTimeline
    : []
  const isMobile = profile?.preset?.isMobile === true
  const isV3 = profile?.visualVersion === 'v3'
  // Use the reported active Hero, never infer selection from whichever assets
  // happened to load. Historical female fixtures omitted this field.
  let reportedCharacterPath = ''
  if (typeof profile?.characterAssetPath === 'string') {
    try { reportedCharacterPath = new URL(profile.characterAssetPath, 'https://profile.invalid').pathname }
    catch { /* Invalid identity must fail the selected-asset check below. */ }
  }
  const maleLodPattern = /^\/virtual-church-assets\/v3\/releases\/male-hero-v14-r1\/characters\/character-hero-male-(?:high|medium|low)\.glb$/u
  const selectedMale = isV3 && maleLodPattern.test(reportedCharacterPath)
  const expectedChurchPath = isV3
    ? `/virtual-church-assets/v3/releases/gate-a-baseline-r9/buildings/church-hero${isMobile ? '-low' : ''}.glb`
    : `/virtual-church-assets/buildings/church-hero${isMobile ? '-low' : ''}.glb`
  const expectedCharacterPath = isV3
    ? `/virtual-church-assets/v3/releases/${selectedMale ? 'male-hero-v14-r1' : 'gate-a-baseline-r9'}/characters/character-hero-${selectedMale ? 'male' : 'female'}-${isMobile ? 'low' : 'medium'}.glb`
    : '/virtual-church-assets/characters/believer-woman.gltf'
  const routeChunks = timeline.filter((entry) =>
    /\/assets\/VirtualChurchView-[^/]+\.js$/u.test(entry?.path ?? ''),
  )
  const vendorChunks = timeline.filter((entry) =>
    /\/assets\/vendor-3d-[^/]+\.js$/u.test(entry?.path ?? ''),
  )
  const selectedAssets = timeline.filter((entry) =>
    entry?.path === expectedChurchPath || entry?.path === expectedCharacterPath,
  )
  const uniquePaths = new Set(timeline.map((entry) => entry?.path))
  const ordered = timeline.every((entry, index) =>
    entry?.sequence === index + 1
    && Number.isFinite(entry?.startMs)
    && Number.isFinite(entry?.responseStartMs)
    && Number.isFinite(entry?.responseEndMs)
    && entry.startMs >= 0
    && entry.responseStartMs >= entry.startMs
    && entry.responseEndMs >= entry.responseStartMs
    && (
      index === 0
      || timeline[index - 1].startMs < entry.startMs
      || (
        timeline[index - 1].startMs === entry.startMs
        && timeline[index - 1].responseEndMs <= entry.responseEndMs
      )
    ),
  )
  const chunksFinishBeforeSelectedAssets =
    routeChunks.length === 1
    && vendorChunks.length === 1
    && selectedAssets.length === 2
    && Math.max(routeChunks[0].responseEndMs, vendorChunks[0].responseEndMs)
      <= Math.min(...selectedAssets.map((entry) => entry.startMs))
  const directNetworkRequired = profile?.loading?.diagnosticTransport === 'network'
  const directNetworkSatisfied = !directNetworkRequired || timeline.every((entry) =>
    entry?.serviceWorkerIntercepted === false
    && Number.isFinite(entry?.transferSizeBytes)
    && entry.transferSizeBytes > 0,
  )
  const legacyCharacterPattern = /\/virtual-church-assets\/characters\/(?:cleric|ranger|wizard|pastor|sister|believer-man|believer-woman)\.gltf$/u
  const v3CharacterLodPattern = /^\/virtual-church-assets\/v3\/releases\/(?:gate-a-baseline-r9\/characters\/character-hero-female|male-hero-v14-r1\/characters\/character-hero-male)-(?:high|medium|low)\.glb$/u
  const churchLodPattern = isV3
    ? /\/virtual-church-assets\/v3\/releases\/gate-a-baseline-r9\/buildings\/church-hero(?:-medium|-low)?\.glb$/u
    : /\/virtual-church-assets\/buildings\/church-hero(?:-medium|-low)?\.glb$/u

  return [
    {
      name: 'Timeline coverage',
      passed:
        timeline.length >= 4
        && timeline.length === profile?.loading?.criticalResourceCount,
      detail: `${timeline.length} timeline entries vs ${profile?.loading?.criticalResourceCount ?? 'missing'} critical resources`,
    },
    {
      name: 'Chronological sequence',
      passed: ordered,
      detail: 'contiguous sequence with monotonic session-relative request times',
    },
    {
      name: 'No duplicate critical request paths',
      passed: uniquePaths.size === timeline.length,
      detail: `${uniquePaths.size} unique paths vs ${timeline.length} requests`,
    },
    {
      name: 'Route and 3D chunks load once',
      passed: routeChunks.length === 1 && vendorChunks.length === 1,
      detail: `route=${routeChunks.length}, vendor=${vendorChunks.length}`,
    },
    {
      name: 'Selected church asset only',
      passed:
        pathCount(timeline, (path) => path === expectedChurchPath) === 1
        && pathCount(timeline, (path) => churchLodPattern.test(path)) === 1,
      detail: expectedChurchPath,
    },
    {
      name: 'Selected character asset only',
      passed:
        (!isV3 || profile?.characterAssetPath === undefined || reportedCharacterPath === expectedCharacterPath)
        && pathCount(timeline, (path) => path === expectedCharacterPath) === 1
        && (
          isV3
            ? pathCount(timeline, (path) => v3CharacterLodPattern.test(path)) === 1
            : true
        ),
      detail: expectedCharacterPath,
    },
    {
      name: 'Retired characters excluded from V3',
      passed:
        !isV3
        || pathCount(timeline, (path) => legacyCharacterPattern.test(path)) === 0,
      detail: 'no cleric/ranger/wizard/pastor/sister/believer legacy GLTF in V3 session',
    },
    {
      name: 'Selected asset timing',
      passed:
        selectedAssets.length === 2
        && selectedAssets.find((entry) => entry.path === expectedChurchPath)?.initial === true
        && selectedAssets.find((entry) => entry.path === expectedCharacterPath)?.initial === isV3,
      detail: isV3
        ? 'V3 church and character must both finish before Hero ready'
        : 'V2 church is initial; its intentionally delayed legacy character finishes after entrance ready',
    },
    {
      name: 'Chunks precede selected GLBs',
      passed: chunksFinishBeforeSelectedAssets,
      detail: 'route and vendor responses finish before church/character request start',
    },
    {
      name: 'Declared direct-network transport',
      passed: directNetworkSatisfied,
      detail: directNetworkRequired
        ? 'all critical resources have transfer bytes and bypass Service Worker'
        : 'not required for this transport',
    },
    ...(isV3 && characterEncodedBodySizeBytesMax !== undefined ? [{
      name: 'Selected character body budget',
      passed: Number.isFinite(characterEncodedBodySizeBytesMax)
        && characterEncodedBodySizeBytesMax > 0
        && timeline.some(entry => entry.path === expectedCharacterPath
          && Number.isFinite(entry.encodedBodySizeBytes)
          && entry.encodedBodySizeBytes > 0
          && entry.encodedBodySizeBytes <= characterEncodedBodySizeBytesMax),
      detail: `${timeline.find(entry => entry.path === expectedCharacterPath)?.encodedBodySizeBytes ?? 'missing'} bytes ≤ ${characterEncodedBodySizeBytesMax} bytes`,
    }] : []),
  ]
}

// Presence is part of equivalence: undefined === undefined is not evidence.
export const virtualChurchProfileQualityIsComplete = (preset) => {
  const positive = (value) => Number.isFinite(value) && value > 0
  return preset != null
    && ['isMobile', 'postProcessing', 'glassTransmission', 'vrSupport']
      .every((field) => typeof preset[field] === 'boolean')
    && ['maxTextureResolution', 'shadowMapSize', 'maxDevicePixelRatio']
      .every((field) => positive(preset[field]))
    && ['low', 'medium', 'high', 'ultra'].includes(preset.shadowQuality)
    && ['none', 'fxaa', 'smaa', 'taa'].includes(preset.antiAliasing)
    && ['tree', 'detail', 'building'].every((field) => positive(preset.lodDistances?.[field]))
}

export const virtualChurchProfileComparisonChecks = (current, baseline) => {
  const currentPreset = current?.preset ?? {}
  const baselinePreset = baseline?.preset ?? {}
  const currentEnvironment = current?.environment ?? {}
  const baselineEnvironment = baseline?.environment ?? {}

  return [
    {
      name: 'Current schema',
      passed: current?.schemaVersion === VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
      detail:
        `${current?.schemaVersion ?? 'missing'} vs ${VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION}`,
    },
    {
      name: 'Baseline schema',
      passed: baseline?.schemaVersion === VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
      detail:
        `${baseline?.schemaVersion ?? 'missing'} vs ${VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION}`,
    },
    {
      name: 'Visual-version direction',
      passed:
        baseline?.visualVersion === 'v2'
        && current?.visualVersion === 'v3',
      detail:
        `${baseline?.visualVersion ?? 'missing'} baseline → ${current?.visualVersion ?? 'missing'} current`,
    },
    {
      name: 'Quality preset',
      passed:
        virtualChurchProfileQualityIsComplete(currentPreset)
        && virtualChurchProfileQualityIsComplete(baselinePreset)
        && currentPreset.isMobile === baselinePreset.isMobile
        && currentPreset.maxTextureResolution === baselinePreset.maxTextureResolution
        && currentPreset.shadowQuality === baselinePreset.shadowQuality
        && currentPreset.shadowMapSize === baselinePreset.shadowMapSize
        && currentPreset.antiAliasing === baselinePreset.antiAliasing
        && currentPreset.postProcessing === baselinePreset.postProcessing
        && currentPreset.glassTransmission === baselinePreset.glassTransmission
        && currentPreset.maxDevicePixelRatio === baselinePreset.maxDevicePixelRatio
        && currentPreset.vrSupport === baselinePreset.vrSupport
        && currentPreset.lodDistances?.tree === baselinePreset.lodDistances?.tree
        && currentPreset.lodDistances?.detail === baselinePreset.lodDistances?.detail
        && currentPreset.lodDistances?.building === baselinePreset.lodDistances?.building,
      detail: !virtualChurchProfileQualityIsComplete(currentPreset) || !virtualChurchProfileQualityIsComplete(baselinePreset)
        ? 'incomplete or invalid quality evidence; capture a new profile'
        : currentPreset.isMobile ? 'mobile' : 'desktop',
    },
    {
      name: 'Drawing buffer',
      passed:
        sameFiniteNumber(
          current?.drawingBuffer?.width,
          baseline?.drawingBuffer?.width,
        )
        && sameFiniteNumber(
          current?.drawingBuffer?.height,
          baseline?.drawingBuffer?.height,
        )
        && sameFiniteNumber(
          current?.drawingBuffer?.pixelRatio,
          baseline?.drawingBuffer?.pixelRatio,
          0.001,
        ),
      detail:
        `${baseline?.drawingBuffer?.width ?? '?'}×${baseline?.drawingBuffer?.height ?? '?'}`
        + ` @ ${baseline?.drawingBuffer?.pixelRatio ?? '?'} → `
        + `${current?.drawingBuffer?.width ?? '?'}×${current?.drawingBuffer?.height ?? '?'}`
        + ` @ ${current?.drawingBuffer?.pixelRatio ?? '?'}`,
    },
    {
      name: 'Diagnostic transport',
      passed:
        typeof current?.loading?.diagnosticTransport === 'string'
        && current.loading.diagnosticTransport
          === baseline?.loading?.diagnosticTransport,
      detail:
        `${baseline?.loading?.diagnosticTransport ?? 'missing'} → `
        + `${current?.loading?.diagnosticTransport ?? 'missing'}`,
    },
    {
      name: 'Diagnostic network',
      passed:
        current?.loading?.diagnosticTransport !== 'network'
        || (
          sameFiniteNumber(
            current?.loading?.diagnosticNetwork?.kilobitsPerSecond,
            baseline?.loading?.diagnosticNetwork?.kilobitsPerSecond,
          )
          && sameFiniteNumber(
            current?.loading?.diagnosticNetwork?.latencyMs,
            baseline?.loading?.diagnosticNetwork?.latencyMs,
          )
        ),
      detail:
        `${baseline?.loading?.diagnosticNetwork?.kilobitsPerSecond ?? '?'} kbps / `
        + `${baseline?.loading?.diagnosticNetwork?.latencyMs ?? '?'} ms → `
        + `${current?.loading?.diagnosticNetwork?.kilobitsPerSecond ?? '?'} kbps / `
        + `${current?.loading?.diagnosticNetwork?.latencyMs ?? '?'} ms`,
    },
    {
      name: 'Camera mode',
      passed:
        typeof current?.camera?.mode === 'string'
        && current.camera.mode === baseline?.camera?.mode,
      detail:
        `${baseline?.camera?.mode ?? 'missing'} → ${current?.camera?.mode ?? 'missing'}`,
    },
    {
      name: 'Camera position',
      passed: sameFiniteArray(
        current?.camera?.position,
        baseline?.camera?.position,
        0.05,
      ),
      detail: 'maximum axis delta 0.05 m',
    },
    {
      name: 'Camera orientation',
      passed: quaternionOrientationMatches(
        current?.camera?.quaternion,
        baseline?.camera?.quaternion,
      ),
      detail: 'absolute quaternion dot ≥ 0.99999',
    },
    {
      name: 'Camera field of view',
      passed: sameFiniteNumber(
        current?.camera?.fov,
        baseline?.camera?.fov,
        0.01,
      ),
      detail:
        `${baseline?.camera?.fov ?? 'missing'}° → ${current?.camera?.fov ?? 'missing'}°`,
    },
    {
      name: 'Browser and device class',
      passed:
        typeof currentEnvironment.userAgent === 'string'
        && currentEnvironment.userAgent === baselineEnvironment.userAgent
        && currentEnvironment.hardwareConcurrency
          === baselineEnvironment.hardwareConcurrency
        && currentEnvironment.deviceMemoryGiB
          === baselineEnvironment.deviceMemoryGiB
        && currentEnvironment.webGlRenderer
          === baselineEnvironment.webGlRenderer,
      detail:
        `${baselineEnvironment.webGlRenderer ?? 'missing'} → `
        + `${currentEnvironment.webGlRenderer ?? 'missing'}`,
    },
    {
      name: 'Normal assets only',
      passed:
        !virtualChurchProfileUsesFallback(current)
        && !virtualChurchProfileUsesFallback(baseline),
      detail:
        `baseline fallback=${virtualChurchProfileUsesFallback(baseline)}, `
        + `current fallback=${virtualChurchProfileUsesFallback(current)}`,
    },
    {
      name: 'Foreground sampling integrity',
      passed:
        virtualChurchProfileSamplingIsValid(current)
        && virtualChurchProfileSamplingIsValid(baseline),
      detail:
        `baseline valid=${virtualChurchProfileSamplingIsValid(baseline)}, `
        + `current valid=${virtualChurchProfileSamplingIsValid(current)}, `
        + `CPU instrumented baseline=${Object.hasOwn(baseline ?? {}, 'cpuSubmissionDiagnostics')}, current=${Object.hasOwn(current ?? {}, 'cpuSubmissionDiagnostics')}, `
        + `startup instrumented baseline=${Object.hasOwn(baseline?.loading ?? {}, 'startupPassTimings')}, current=${Object.hasOwn(current?.loading ?? {}, 'startupPassTimings')}`
        + `; GPU instrumented baseline=${Object.hasOwn(baseline ?? {}, 'gpuTimingDiagnostics')}, current=${Object.hasOwn(current ?? {}, 'gpuTimingDiagnostics')}`,
    },
  ]
}

export const virtualChurchMedian = (values) => {
  if (
    !Array.isArray(values)
    || values.length === 0
    || !values.every(Number.isFinite)
  ) return Number.NaN

  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2
}

const profileRunConditionChecks = (candidate, reference) =>
  virtualChurchProfileComparisonChecks(
    { ...candidate, visualVersion: 'v3' },
    { ...reference, visualVersion: 'v2' },
  ).filter((check) => ![
    'Current schema',
    'Baseline schema',
    'Visual-version direction',
    'Normal assets only',
    'Foreground sampling integrity',
  ].includes(check.name))

const comparableCharacterPath = (profile) => {
  // Old female-only reports omitted identity. Keep equally old sets readable,
  // but never pool those reports with a newly recorded male/female selection.
  if (profile?.characterAssetPath === undefined) return undefined
  if (typeof profile.characterAssetPath !== 'string') return null
  try { return new URL(profile.characterAssetPath, 'https://profile.invalid').pathname }
  catch { return null }
}

export const virtualChurchProfileSetChecks = (
  profiles,
  expectedVisualVersion,
) => {
  const runs = Array.isArray(profiles) ? profiles : []
  const checks = [{
    name: 'Run count',
    passed: runs.length === VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET,
    detail: `${runs.length} vs ${VIRTUAL_CHURCH_PROFILE_RUNS_PER_SET}`,
  }]
  const reference = runs[0]

  runs.forEach((profile, index) => {
    const runLabel = `Run ${index + 1}`
    if (expectedVisualVersion === 'v3') {
      const identity = comparableCharacterPath(profile)
      checks.push({
        name: `${runLabel} same character identity`,
        passed: identity !== null && identity === comparableCharacterPath(reference),
        detail: `${comparableCharacterPath(reference) ?? 'missing'} → ${identity ?? 'missing'}`,
      })
    }
    checks.push(
      {
        name: `${runLabel} schema`,
        passed:
          profile?.schemaVersion === VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION,
        detail:
          `${profile?.schemaVersion ?? 'missing'} vs `
          + `${VIRTUAL_CHURCH_PROFILE_SCHEMA_VERSION}`,
      },
      {
        name: `${runLabel} visual version`,
        passed: profile?.visualVersion === expectedVisualVersion,
        detail:
          `${profile?.visualVersion ?? 'missing'} vs ${expectedVisualVersion}`,
      },
      {
        name: `${runLabel} normal assets`,
        passed: !virtualChurchProfileUsesFallback(profile),
        detail: `fallback=${virtualChurchProfileUsesFallback(profile)}`,
      },
      {
        name: `${runLabel} complete quality evidence`,
        passed: virtualChurchProfileQualityIsComplete(profile?.preset),
        detail: 'all quality dimensions must be recorded with valid values',
      },
      {
        name: `${runLabel} foreground sampling`,
        passed: virtualChurchProfileSamplingIsValid(profile),
        detail:
          `cpuInstrumented=${Object.hasOwn(profile ?? {}, 'cpuSubmissionDiagnostics')}, `
          + `startupInstrumented=${Object.hasOwn(profile?.loading ?? {}, 'startupPassTimings')}, `
          + `gpuInstrumented=${Object.hasOwn(profile ?? {}, 'gpuTimingDiagnostics')}, `
          + `visibility=${profile?.sampling?.documentVisibilityState ?? 'missing'}, `
          + `interruptions=${profile?.sampling?.interruptionCount ?? 'missing'}, `
          + `maxGap=${profile?.sampling?.maximumCallbackGapMs ?? 'missing'} ms`,
      },
    )

    if (index > 0) {
      for (const condition of profileRunConditionChecks(profile, reference)) {
        checks.push({
          ...condition,
          name: `${runLabel} ${condition.name}`,
        })
      }
    }
  })

  return checks
}

export const virtualChurchMedianProfile = (profiles) => {
  if (!Array.isArray(profiles) || profiles.length === 0) return null
  const reference = profiles[0]
  const metric = (selector) =>
    virtualChurchMedian(profiles.map(selector))

  return {
    ...reference,
    sampledAt: profiles.map((profile) => profile.sampledAt),
    profileSet: {
      aggregation: 'median',
      runs: profiles.length,
    },
    averageFps: metric((profile) => profile?.averageFps),
    frameTimeMs: {
      ...reference.frameTimeMs,
      p50: metric((profile) => profile?.frameTimeMs?.p50),
      p95: metric((profile) => profile?.frameTimeMs?.p95),
      max: metric((profile) => profile?.frameTimeMs?.max),
    },
    loading: {
      ...reference.loading,
      heroReadyMs: metric((profile) => profile?.loading?.heroReadyMs),
      initialCriticalEncodedBodySizeBytes: metric(
        (profile) => profile?.loading?.initialCriticalEncodedBodySizeBytes,
      ),
    },
    render: {
      ...reference.render,
      visibleTrianglesEstimate: metric(
        (profile) => profile?.render?.visibleTrianglesEstimate,
      ),
      visibleDrawCallsEstimate: metric(
        (profile) => profile?.render?.visibleDrawCallsEstimate,
      ),
    },
    memory: {
      ...reference.memory,
      estimate: {
        ...reference.memory?.estimate,
        totalBytes: metric(
          (profile) => profile?.memory?.estimate?.totalBytes,
        ),
      },
    },
  }
}
