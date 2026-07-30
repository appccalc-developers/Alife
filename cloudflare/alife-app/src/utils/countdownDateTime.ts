export const formatCountdownTargetDateTime = (
  value: string | null | undefined,
  language: string,
  timeZone?: string,
) => {
  if (!value) return ''

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return value

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-NZ', {
      timeZone,
      day: '2-digit',
      month: language === 'zh' ? '2-digit' : 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  const time = `${parts.hour}:${parts.minute}`
  return language === 'zh'
    ? `${parts.month}-${parts.day} ${time}`
    : `${parts.day} ${parts.month} ${time}`
}
