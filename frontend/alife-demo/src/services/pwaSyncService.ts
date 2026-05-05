import { http } from './http'

export type ApiUpdateMessage = {
  type: 'ENTITY_UPDATED'
  entityType: string
  entityId: string
  apiPath?: string | null
  versionKeys?: string[]
  version?: number
  receivedAt?: string
}

const API_UPDATE_CHANNEL = 'api-updates'

export const syncKeys = {
  member: (memberId: string) => `member:${normalizeId(memberId)}:v`,
  group: (groupId: string) => `group:${normalizeId(groupId)}:v`,
  groupTree: (groupId: string) => `group:${normalizeId(groupId)}:tree:v`,
  groupMemberships: (groupId: string) => `group:${normalizeId(groupId)}:memberships:v`,
  groupPages: (groupId: string, language: string) => `group:${normalizeId(groupId)}:pages:${language.trim().toLowerCase()}:v`,
  globalPages: (language: string) => `pages:global:${language.trim().toLowerCase()}:v`,
}

export const pwaSyncService = {
  async subscribeToPushIfAllowed() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission !== 'granted') {
      return
    }

    const registration = await navigator.serviceWorker.ready
    const existing = await registration.pushManager.getSubscription()
    const subscription = existing ?? (await createPushSubscription(registration))
    if (!subscription) {
      return
    }

    await http.post('/api/sync/subscriptions', subscription.toJSON())
  },

  async requestPushSubscription() {
    if (!('Notification' in window)) {
      return false
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return false
    }

    await this.subscribeToPushIfAllowed()
    return true
  },

  postVersionCheck(keys: string[]) {
    if (!navigator.serviceWorker.controller || keys.length === 0) {
      return
    }

    navigator.serviceWorker.controller.postMessage({
      type: 'SYNC_CHECK',
      keys,
    })
  },

  listen(onUpdate: (message: ApiUpdateMessage) => void) {
    const channel = 'BroadcastChannel' in window ? new BroadcastChannel(API_UPDATE_CHANNEL) : null
    const onBroadcast = (event: MessageEvent<ApiUpdateMessage>) => {
      if (event.data?.type === 'ENTITY_UPDATED') {
        onUpdate(event.data)
      }
    }
    const onServiceWorkerMessage = (event: MessageEvent<ApiUpdateMessage & { channel?: string }>) => {
      if (event.data?.channel === API_UPDATE_CHANNEL && event.data.type === 'ENTITY_UPDATED') {
        onUpdate(event.data)
      }
    }

    channel?.addEventListener('message', onBroadcast)
    navigator.serviceWorker?.addEventListener('message', onServiceWorkerMessage)

    return () => {
      channel?.removeEventListener('message', onBroadcast)
      channel?.close()
      navigator.serviceWorker?.removeEventListener('message', onServiceWorkerMessage)
    }
  },
}

async function createPushSubscription(registration: ServiceWorkerRegistration) {
  const { data } = await http.get<{ publicKey?: string | null }>('/api/sync/vapid-public-key')
  if (!data.publicKey) {
    return null
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(data.publicKey),
  })
}

function normalizeId(id: string) {
  return id.replaceAll('-', '').toLowerCase()
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = `${base64String}${padding}`.replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}
