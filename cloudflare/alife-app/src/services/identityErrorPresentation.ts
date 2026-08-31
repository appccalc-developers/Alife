import type { UiTextKey } from '../i18n/uiText.ts'
import { normalizeApiError } from './http.ts'

type TranslateIdentityText = (key: UiTextKey, values?: Record<string, string | number>) => string

export const normalizeIdentityError = (
  error: unknown,
  fallback: string,
  translate: TranslateIdentityText,
) => {
  if (error instanceof Error && error.message === 'passkey_not_supported') {
    return translate('passkeyUnavailable')
  }
  if (error instanceof Error && error.message === 'passkey_cancelled') {
    return translate('passkeyCancelled')
  }
  if (error instanceof DOMException && ['AbortError', 'NotAllowedError', 'TimeoutError'].includes(error.name)) {
    return translate('passkeyCancelled')
  }

  const api = normalizeApiError(error)
  if (api.code === 'passkey_unknown') {
    return translate('passkeyUnknown')
  }
  if (api.code === 'passkey_verification_failed') {
    return api.traceId
      ? translate('passkeyVerificationFailedWithReference', { traceId: api.traceId })
      : translate('passkeyVerificationFailed')
  }
  if (api.code === 'rate_limited') return api.message
  return api.message || fallback
}
