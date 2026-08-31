import { http } from './http'

export type IdentityCapabilities = {
  passkeysEnabled: boolean
  lineLegacyEnabled: boolean
}

export type ManualActivationMessage = {
  recipientPhoneE164: string
  message: string
}

export type OnboardingContext = {
  intent: 'signIn' | 'activation' | 'groupJoin' | 'accessRecovery' | 'applicationResponse' | 'lineLegacy'
  isPublicDevice: boolean
  returnPath: string
  activationInvitationId?: string | null
  groupJoinInviteId?: string | null
  groupApplicationId?: string | null
  groupNameEn?: string | null
  groupNameZh?: string | null
  state?: string | null
}

export type PasskeyCredential = {
  id: string
  displayName: string
  createdUtc: string
  lastUsedUtc?: string | null
  isBackedUp: boolean
  transports: string[]
}

export type MembershipApplication = {
  id: string
  churchPersonApplicationId: string
  groupId: string
  groupNameEn: string
  groupNameZh: string
  displayName: string
  maskedPhone: string
  replyPreference: string
  preferredLanguage: string
  declaration: string
  isContactVerified: boolean
  matchState: string
  personStatus: string
  status: string
  source: string
  responseDeliveryStatus?: string | null
  activationDeliveryStatus?: string | null
  manualActivationMessage?: ManualActivationMessage | null
  submittedUtc: string
  rowVersion: string
  history: Array<{
    id: string
    kind: string
    fromStatus: string
    toStatus: string
    note?: string | null
    actorMemberId?: string | null
    createdUtc: string
  }>
}

export type MembershipApplicationPage = {
  items: MembershipApplication[]
  page: number
  pageSize: number
  total: number
}

export type GroupJoinInvite = {
  id: string
  groupId: string
  status: string
  expiresUtc: string
  lastUsedUtc?: string | null
  submissionCount: number
  joinUrl?: string | null
}

export type ActivationInvitation = {
  id: string
  memberId: string
  displayName: string
  maskedPhone: string
  purpose: string
  status: string
  deliveryStatus: string
  expiresUtc: string
  manualActivationMessage?: ManualActivationMessage | null
  grants: Array<{ groupId: string; role: string; status: string; conflictCode?: string | null }>
}

type PasskeyOptions = { ceremonyId: string; publicKey: Record<string, unknown> }

const toBase64Url = (value: ArrayBuffer | null) => {
  if (!value) return null
  const bytes = new Uint8Array(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const fromBase64Url = (value: unknown) => {
  if (typeof value !== 'string') return value
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const creationOptions = (source: Record<string, unknown>): PublicKeyCredentialCreationOptions => {
  const value = structuredClone(source) as Record<string, any>
  value.challenge = fromBase64Url(value.challenge)
  value.user.id = fromBase64Url(value.user.id)
  value.excludeCredentials = (value.excludeCredentials ?? []).map((credential: Record<string, unknown>) => ({
    ...credential,
    id: fromBase64Url(credential.id),
  }))
  return value as PublicKeyCredentialCreationOptions
}

const requestOptions = (source: Record<string, unknown>, preferHybrid = false): PublicKeyCredentialRequestOptions => {
  const value = structuredClone(source) as Record<string, any>
  value.challenge = fromBase64Url(value.challenge)
  value.allowCredentials = (value.allowCredentials ?? []).map((credential: Record<string, unknown>) => ({
    ...credential,
    id: fromBase64Url(credential.id),
  }))
  if (preferHybrid) value.hints = ['hybrid']
  return value as PublicKeyCredentialRequestOptions
}

const serializeRegistration = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAttestationResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: toBase64Url(response.attestationObject),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

const serializeAssertion = (credential: PublicKeyCredential) => {
  const response = credential.response as AuthenticatorAssertionResponse
  return {
    id: credential.id,
    rawId: toBase64Url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: toBase64Url(response.authenticatorData),
      clientDataJSON: toBase64Url(response.clientDataJSON),
      signature: toBase64Url(response.signature),
      userHandle: toBase64Url(response.userHandle),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  }
}

export const identityAccessService = {
  async capabilities() {
    return (await http.get<IdentityCapabilities>('/api/onboarding/capabilities')).data
  },
  async createFlow(returnPath: string, isPublicDevice: boolean, intent = 'signIn') {
    return (await http.post<OnboardingContext>('/api/onboarding/flows', { returnPath, isPublicDevice, intent })).data
  },
  async resume() {
    return (await http.post<OnboardingContext>('/api/onboarding/resume')).data
  },
  async resolveActivation(selector: string, secret: string, isPublicDevice: boolean, returnPath = '') {
    return (await http.post<OnboardingContext>('/api/onboarding/activation/resolve', {
      selector, secret, isPublicDevice, returnPath,
    })).data
  },
  async activationNotMe() {
    await http.post('/api/onboarding/activation/not-me')
  },
  async resolveGroupInvite(selector: string, signature: string, isPublicDevice: boolean, returnPath = '') {
    return (await http.post<OnboardingContext>('/api/onboarding/group-invites/resolve', {
      selector, secret: signature, isPublicDevice, returnPath,
    })).data
  },
  async resolveApplicationResponse(selector: string, secret: string) {
    return (await http.post<OnboardingContext>('/api/onboarding/application-responses/resolve', {
      selector, secret, isPublicDevice: false, returnPath: '',
    })).data
  },
  async supplementAnonymousApplication(note: string) {
    return (await http.post<MembershipApplication>('/api/onboarding/application-responses/supplement', { note })).data
  },
  async authenticatePasskey(preferHybrid = false, signal?: AbortSignal) {
    if (!window.PublicKeyCredential || !navigator.credentials) throw new Error('passkey_not_supported')
    const options = (await http.post<PasskeyOptions>('/api/auth/passkeys/authentication/options')).data
    const credential = await navigator.credentials.get({ publicKey: requestOptions(options.publicKey, preferHybrid), signal }) as PublicKeyCredential | null
    if (!credential) throw new Error('passkey_cancelled')
    return (await http.post<{ returnPath: string; sessionKind: string }>('/api/auth/passkeys/authentication/complete', {
      ceremonyId: options.ceremonyId,
      response: serializeAssertion(credential),
    })).data
  },
  async registerPasskey(displayName?: string, signal?: AbortSignal) {
    if (!window.PublicKeyCredential || !navigator.credentials) throw new Error('passkey_not_supported')
    const options = (await http.post<PasskeyOptions>('/api/auth/passkeys/registration/options')).data
    const credential = await navigator.credentials.create({ publicKey: creationOptions(options.publicKey), signal }) as PublicKeyCredential | null
    if (!credential) throw new Error('passkey_cancelled')
    return (await http.post<{ returnPath: string }>('/api/auth/passkeys/registration/complete', {
      ceremonyId: options.ceremonyId,
      response: serializeRegistration(credential),
      displayName,
    })).data
  },
  async listPasskeys() {
    return (await http.get<PasskeyCredential[]>('/api/me/passkeys')).data
  },
  async revokePasskey(id: string) {
    await http.delete(`/api/me/passkeys/${id}`)
  },
  async listActivations() {
    return (await http.get<ActivationInvitation[]>('/api/admin/member-activations')).data
  },
  async createActivation(payload: { displayName: string; phoneE164: string; purpose: string; grants: Array<{ groupId: string; role: string }> }) {
    return (await http.post<ActivationInvitation>('/api/admin/member-activations', payload)).data
  },
  async changeActivation(id: string, action: 'revoke' | 'resend') {
    return (await http.post<ActivationInvitation | boolean>(`/api/admin/member-activations/${id}/${action}`)).data
  },
  async submitGroupApplication(payload: Record<string, unknown>) {
    return (await http.post<MembershipApplication>('/api/onboarding/group-applications', payload)).data
  },
  async personalApplications() {
    return (await http.get<MembershipApplication[]>('/api/onboarding/personal-applications')).data
  },
  async supplementPersonalApplication(application: MembershipApplication, note: string) {
    return (await http.post<MembershipApplication>(`/api/onboarding/personal-applications/${application.id}/supplements`, {
      note, rowVersion: application.rowVersion,
    })).data
  },
  async generateGroupInvite(groupId: string) {
    return (await http.post<GroupJoinInvite>(`/api/groups/${groupId}/join-invite`)).data
  },
  async getGroupInvite(groupId: string) {
    return (await http.get<GroupJoinInvite>(`/api/groups/${groupId}/join-invite`)).data
  },
  async changeGroupInvite(groupId: string, action: 'pause' | 'resume' | 'revoke' | 'rotate') {
    return (await http.post<GroupJoinInvite>(`/api/groups/${groupId}/join-invite/${action}`)).data
  },
  async listGroupApplications(groupId: string, params: Record<string, string | number | undefined>) {
    return (await http.get<MembershipApplicationPage>(`/api/groups/${groupId}/membership-applications`, { params })).data
  },
  async decideGroupApplication(groupId: string, application: MembershipApplication, decision: string, note?: string, contactVerified = false, linkedMemberId?: string) {
    return (await http.post<MembershipApplication>(
      `/api/groups/${groupId}/membership-applications/${application.id}/decisions`,
      { decision, note, rowVersion: application.rowVersion, contactVerified, linkedMemberId: linkedMemberId || null },
    )).data
  },
  async listPersonApplications(params: Record<string, string | number | undefined>) {
    return (await http.get<MembershipApplicationPage>('/api/admin/person-applications', { params })).data
  },
  async decidePersonApplication(application: MembershipApplication, decision: string, note?: string, linkedMemberId?: string, contactVerified = false) {
    return (await http.post<MembershipApplication>(
      `/api/admin/person-applications/${application.id}/decisions`,
      { decision, note, linkedMemberId: linkedMemberId || null, contactVerified, rowVersion: application.rowVersion },
    )).data
  },
  async listAlphaAccounts() {
    return (await http.get<Array<{ accountId: string; label: string }>>('/api/internal/alpha-login/accounts')).data
  },
  async alphaLogin(accountId: string, passkeyBootstrapCode?: string) {
    return (await http.post<{ returnPath: string }>('/api/internal/alpha-login', {
      accountId,
      passkeyBootstrapCode: passkeyBootstrapCode || null,
    })).data
  },
}
