import { phoneNumberText } from '../i18n/phoneNumber.ts'
export const supportedPhoneRegions = [
  { code: '+64', countryCode: 'NZ', en: phoneNumberText.text64.en, zh: phoneNumberText.text64.zh, minLength: 8, maxLength: 10 },
  { code: '+86', countryCode: 'CN', en: phoneNumberText.text86.en, zh: phoneNumberText.text86.zh, minLength: 10, maxLength: 12 },
  { code: '+886', countryCode: 'TW', en: phoneNumberText.text886.en, zh: phoneNumberText.text886.zh, minLength: 8, maxLength: 9 },
  { code: '+852', countryCode: 'HK', en: phoneNumberText.text852.en, zh: phoneNumberText.text852.zh, minLength: 8, maxLength: 8 },
  { code: '+853', countryCode: 'MO', en: phoneNumberText.text853.en, zh: phoneNumberText.text853.zh, minLength: 8, maxLength: 8 },
  { code: '+61', countryCode: 'AU', en: phoneNumberText.text61.en, zh: phoneNumberText.text61.zh, minLength: 9, maxLength: 9 },
] as const

export type SupportedPhoneRegionCode = (typeof supportedPhoneRegions)[number]['code']

export type PhoneNumberParts = {
  regionCode: SupportedPhoneRegionCode
  nationalNumber: string
}

const digitsOnly = (value: string) => value.replace(/\D/g, '')

export const splitPhoneNumber = (value?: string | null): PhoneNumberParts => {
  const trimmed = value?.trim() ?? ''
  const region = [...supportedPhoneRegions]
    .sort((left, right) => right.code.length - left.code.length)
    .find((candidate) => trimmed.startsWith(candidate.code))

  if (!region) {
    return { regionCode: '+64', nationalNumber: digitsOnly(trimmed) }
  }

  return {
    regionCode: region.code,
    nationalNumber: digitsOnly(trimmed.slice(region.code.length)),
  }
}

export const composePhoneNumber = (
  regionCode: SupportedPhoneRegionCode,
  nationalNumber: string,
) => {
  const trimmed = nationalNumber.trim()
  if (!trimmed) return ''

  const significantNumber = digitsOnly(trimmed).replace(/^0+/, '')
  return significantNumber ? `${regionCode}${significantNumber}` : ''
}

export const isValidPhoneNumber = (value?: string | null) => {
  if (!value) return true
  if (!/^\+[1-9]\d{6,14}$/.test(value)) return false

  const region = [...supportedPhoneRegions]
    .sort((left, right) => right.code.length - left.code.length)
    .find((candidate) => value.startsWith(candidate.code))
  if (!region) return false

  const nationalNumber = digitsOnly(value.slice(region.code.length))
  return Boolean(
    nationalNumber.length >= region.minLength &&
    nationalNumber.length <= region.maxLength,
  )
}
