type Disposable = { dispose: () => void }

/** An owned request avoids Three FileLoader's URL-global in-flight deduplication:
 * cancelling an old room must not abort a new room loading the same character.
 * HTTP/PWA caching remains unchanged; a service worker may finish its own cache fill.
 */
export async function fetchStudyRoomSource<T>(url: string, signal: AbortSignal, parse: (bytes: ArrayBuffer, base: string) => Promise<T>) {
  const response = await fetch(url, { signal, credentials: 'same-origin' })
  if (!response.ok) throw new Error(`Study model request failed (${response.status})`)
  const bytes = await response.arrayBuffer()
  if (signal.aborted) throw new DOMException('Study room closed', 'AbortError')
  return parse(bytes, url.slice(0, url.lastIndexOf('/') + 1))
}

/** Keep the first decoded model owned if an optional review model fails. */
export async function loadStudyRoomSourcePair<T>(
  signal: AbortSignal,
  loadPrimary: (signal: AbortSignal) => Promise<T>,
  loadSecondary: (signal: AbortSignal) => Promise<T>,
  dispose: (source: T) => void,
): Promise<[T, T]> {
  const primary = await loadPrimary(signal)
  try {
    return [primary, await loadSecondary(signal)]
  } catch (error) {
    dispose(primary)
    throw error
  }
}

/** Own one loading attempt, including partial clones and late decoder results. */
export function startStudyRoomLoad<Source, Companion extends Disposable>(options: {
  load: (signal: AbortSignal) => Promise<Source>
  count: number
  clone: (source: Source, index: number) => Companion
  disposeSource: (source: Source) => void
  disposeDecoder: () => void
  ready: (companions: Companion[]) => void
  failed: () => void
  // Injection only for deterministic deadline tests; production uses 30 seconds.
  deadline?: (callback: () => void) => () => void
}) {
  const controller = new AbortController()
  let retired = false, completed = false, source: Source | undefined, companions: Companion[] = []
  const release = () => {
    companions.forEach(companion => companion.dispose())
    companions = []
    if (source !== undefined) { options.disposeSource(source); source = undefined }
  }
  const stopDeadline = (options.deadline ?? (callback => {
    const timer = setTimeout(callback, 30000)
    return () => clearTimeout(timer)
  }))(() => {
    if (retired || completed) return
    retired = true
    controller.abort()
    release()
    options.failed()
  })
  const settled = (async () => {
    try {
      const result = await options.load(controller.signal)
      if (retired) { options.disposeSource(result); return }
      source = result
      for (let index = 0; index < options.count; index++) companions.push(options.clone(source, index))
      completed = true
      stopDeadline()
      options.ready(companions)
    } catch {
      if (!retired) {
        retired = true
        release()
        options.failed()
      }
    } finally {
      stopDeadline()
      // Do not terminate a Draco worker mid-parse: its pending promises can hang.
      // Late completed results above are disposed without mounting or publishing.
      options.disposeDecoder()
    }
  })()
  return {
    settled,
    cancel: () => { retired = true; stopDeadline(); controller.abort(); release() },
  }
}
