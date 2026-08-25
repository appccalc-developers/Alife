export const VISIT_CONTACT_COUNTRY_CODES = [
  { value: '+86', en: 'Mainland China', zh: '中国大陆' },
  { value: '+852', en: 'Hong Kong', zh: '香港' },
  { value: '+853', en: 'Macau', zh: '澳门' },
  { value: '+886', en: 'Taiwan', zh: '台湾' },
  { value: '+64', en: 'New Zealand', zh: '新西兰' },
  { value: '+61', en: 'Australia', zh: '澳洲' },
] as const

export type VisitContactCountryCode = (typeof VISIT_CONTACT_COUNTRY_CODES)[number]['value']
export type VisitContactMethod = 'email' | 'phone'

const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

const phonePatterns: Record<VisitContactCountryCode, RegExp> = {
  '+86': /^1[3-9]\d{9}$/,
  '+852': /^[5-9]\d{7}$/,
  '+853': /^[6-9]\d{7}$/,
  '+886': /^9\d{8}$/,
  '+64': /^[2-9]\d{8,9}$/,
  '+61': /^[2-9]\d{8,9}$/,
}

const countryCodesWithLocalTrunkPrefix: VisitContactCountryCode[] = ['+886', '+64', '+61']

export const isVisitContactEmailValid = (value: string) => emailPattern.test(value.trim())

export const normalizeVisitContactPhoneNumber = (countryCode: VisitContactCountryCode, value: string) => {
  const compact = value.trim().replace(/[\s()-]/g, '')
  return countryCodesWithLocalTrunkPrefix.includes(countryCode) && compact.startsWith('0')
    ? compact.slice(1)
    : compact
}

export const isVisitContactPhoneValid = (countryCode: VisitContactCountryCode, value: string) =>
  phonePatterns[countryCode].test(normalizeVisitContactPhoneNumber(countryCode, value))

export const buildVisitContactPhone = (countryCode: VisitContactCountryCode, value: string) =>
  `${countryCode}${normalizeVisitContactPhoneNumber(countryCode, value)}`

export const isSelectedVisitContactValid = (
  method: VisitContactMethod,
  email: string,
  countryCode: VisitContactCountryCode,
  phoneNumber: string,
) => method === 'email'
  ? isVisitContactEmailValid(email)
  : isVisitContactPhoneValid(countryCode, phoneNumber)
