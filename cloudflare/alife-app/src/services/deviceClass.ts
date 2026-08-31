export type DeviceNavigator = {
  userAgent?: string
  maxTouchPoints?: number
  userAgentData?: { mobile?: boolean }
}

export const isLikelyMobileDevice = (
  value: DeviceNavigator = navigator as DeviceNavigator,
) => {
  if (typeof value.userAgentData?.mobile === 'boolean') {
    return value.userAgentData.mobile
  }

  const userAgent = value.userAgent ?? ''
  if (/Android|iPhone|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent)) {
    return true
  }

  return /Macintosh/i.test(userAgent) && (value.maxTouchPoints ?? 0) > 1
}
