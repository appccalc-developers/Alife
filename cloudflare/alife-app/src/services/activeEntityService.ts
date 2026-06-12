import { normalizeRouteGroupId } from '../utils/groupRouteIds'

export type ActiveEntityIds = {
  groupId: string
  pageId: string
  eventId: string
  sermonId: string
}

export type ActiveEntityUpdate = Partial<ActiveEntityIds>

export const ACTIVE_ENTITY_CHANGED_EVENT = 'alife-active-entity-changed'

const storageKeys: Record<keyof ActiveEntityIds, string> = {
  groupId: 'alife-active-group-id',
  pageId: 'alife-active-page-id',
  eventId: 'alife-active-event-id',
  sermonId: 'alife-active-sermon-id',
}

const emptyIds: ActiveEntityIds = {
  groupId: '',
  pageId: '',
  eventId: '',
  sermonId: '',
}

const hasWindow = () => typeof window !== 'undefined'

const normalizeId = (value: string | null | undefined) => value?.trim() ?? ''

const normalizeEntityId = (key: keyof ActiveEntityIds, value: string | null | undefined) =>
  key === 'groupId' ? normalizeRouteGroupId(value) : normalizeId(value)

const readId = (key: keyof ActiveEntityIds) => {
  if (!hasWindow()) {
    return ''
  }

  return normalizeEntityId(key, window.localStorage.getItem(storageKeys[key]))
}

const writeId = (key: keyof ActiveEntityIds, value: string) => {
  if (!hasWindow()) {
    return
  }

  const normalizedValue = normalizeEntityId(key, value)
  if (normalizedValue) {
    window.localStorage.setItem(storageKeys[key], normalizedValue)
  } else {
    window.localStorage.removeItem(storageKeys[key])
  }
}

const emitChanged = () => {
  if (!hasWindow()) {
    return
  }

  window.dispatchEvent(new CustomEvent(ACTIVE_ENTITY_CHANGED_EVENT, { detail: activeEntityService.getAll() }))
}

export const activeEntityService = {
  getAll(): ActiveEntityIds {
    return {
      groupId: readId('groupId'),
      pageId: readId('pageId'),
      eventId: readId('eventId'),
      sermonId: readId('sermonId'),
    }
  },

  resolve(overrides: ActiveEntityUpdate = {}): ActiveEntityIds {
    const current = this.getAll()
    return {
      groupId: normalizeId(overrides.groupId) || current.groupId,
      pageId: normalizeId(overrides.pageId) || current.pageId,
      eventId: normalizeId(overrides.eventId) || current.eventId,
      sermonId: normalizeId(overrides.sermonId) || current.sermonId,
    }
  },

  set(update: ActiveEntityUpdate) {
    const normalizedUpdate: ActiveEntityUpdate = {}
    let changed = false

    for (const key of Object.keys(storageKeys) as Array<keyof ActiveEntityIds>) {
      if (!(key in update)) {
        continue
      }

      if (update[key] === undefined || update[key] === null) {
        continue
      }

      const nextValue = normalizeEntityId(key, update[key])
      normalizedUpdate[key] = nextValue
      if (readId(key) !== nextValue) {
        writeId(key, nextValue)
        changed = true
      }
    }

    if (changed) {
      emitChanged()
    }

    return this.resolve(normalizedUpdate)
  },

  setGroup(groupId: string, options: { clearPage?: boolean; clearEvent?: boolean } = {}) {
    const current = this.getAll()
    const nextGroupId = normalizeId(groupId)
    const groupChanged = current.groupId !== nextGroupId
    this.set({
      groupId: nextGroupId,
      ...(groupChanged || options.clearPage ? { pageId: '' } : {}),
      ...(groupChanged || options.clearEvent ? { eventId: '' } : {}),
    })
  },

  setPage(pageId: string, groupId?: string) {
    this.set({
      pageId,
      ...(groupId ? { groupId } : {}),
    })
  },

  setEvent(eventId: string, groupId?: string) {
    this.set({
      eventId,
      ...(groupId ? { groupId } : {}),
    })
  },

  setSermon(sermonId: string) {
    this.set({ sermonId })
  },

  clear() {
    this.set(emptyIds)
  },
}
