import { gunzipSync } from 'node:zlib'

// Preserve recorded profile fields in one small, lossless, task-owned artifact.
// This is an input container, not evidence: the normal set/network/budget
// validators still inspect every decoded run and reject mixed selections.
export const decodeVirtualChurchProfileCapture = (value) => {
  if (value?.captureFormat !== 'virtual-church-profile-set-gzip-v1') return [value]
  const encoded = value.profilesGzipBase64
  if (typeof encoded !== 'string' || encoded.length > 1024 * 1024
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error('Invalid or oversized compressed performance capture')
  }
  const profiles = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64'), {
    maxOutputLength: 16 * 1024 * 1024,
  }).toString('utf8'))
  if (!Array.isArray(profiles) || profiles.length === 0
    || profiles.length !== value.runCount
    || profiles.some(profile => !profile || typeof profile !== 'object' || Array.isArray(profile))) {
    throw new Error('Performance capture run count or record shape is invalid')
  }
  return profiles
}
