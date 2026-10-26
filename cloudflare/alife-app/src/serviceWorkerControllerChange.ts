/** Only an update replacing an already-controlling worker needs a page reload. */
export const createServiceWorkerControllerChangeHandler = (
  initialController: object | null,
  reload: () => void,
) => {
  let previousController = initialController
  let refreshing = false

  return (controller: object | null) => {
    const replacingController = previousController !== null
      && controller !== null
      && previousController !== controller
    previousController = controller
    if (!replacingController || refreshing) return

    refreshing = true
    reload()
  }
}

const DEVELOPMENT_CLEANUP_RELOAD_KEY = 'alife:dev-service-worker-cleanup-reload'

/** A reused dev origin may still be controlled by an old production worker.
 * Do not mount that old scene while its caches are being removed and a clean
 * navigation is already scheduled. A cleanup failure remains non-fatal.
 */
export const prepareDevelopmentServiceWorker = async ({
  wasControlled,
  cleanup,
  storage,
  reload,
  onError,
}: {
  wasControlled: boolean
  cleanup: () => Promise<void>
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  reload: () => void
  onError: (error: unknown) => void
}): Promise<boolean> => {
  try {
    await cleanup()
    if (wasControlled && storage.getItem(DEVELOPMENT_CLEANUP_RELOAD_KEY) !== 'done') {
      storage.setItem(DEVELOPMENT_CLEANUP_RELOAD_KEY, 'done')
      reload()
      return false
    }
    storage.removeItem(DEVELOPMENT_CLEANUP_RELOAD_KEY)
  } catch (error) {
    onError(error)
  }
  return true
}
