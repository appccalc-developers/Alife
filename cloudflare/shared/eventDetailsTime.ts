import { isTimeZone, localTimeToUtc } from './eventDetails.ts'

// Deliberately bounded: one explicit calendar date and one clock range. Other
// phrases still use the assistant's clarification flow; never infer DST/AM/PM.
export function explicitLocalRange(message: string, timeZone: string | null, reference = new Date()) {
  if (message.length > 400 || !isTimeZone(timeZone) || /不要|不是|取消|如果|假如|是否|要不要|[?？]|\b(?:not|if|maybe)\b/i.test(message)) return null
  const number = (token: string) => {
    const digits = '零一二三四五六七八九'
    if (token === '十') return '10'
    const parts = token.replaceAll('〇', '零').split('十')
    return String(parts.length === 2 ? (parts[0] ? digits.indexOf(parts[0]) : 1) * 10 + (parts[1] ? digits.indexOf(parts[1]) : 0) : digits.indexOf(parts[0]))
  }
  const input = message.replace(/[零〇一二三四五六七八九十]{1,3}(?=月|日|号|点|时|分)/g, number)
  const dates = [...input.matchAll(/(?:(\d{4})年\s*)?(\d{1,2})月\s*(\d{1,2})[日号]?|(\d{4})-(\d{2})-(\d{2})/g)]
  if (dates.length !== 1) return null
  const date = dates[0]
  const year = date[1] || date[4] || new Intl.DateTimeFormat('en', { timeZone, year: 'numeric' }).format(reference)
  const day = `${year}-${(date[2] || date[5]).padStart(2, '0')}-${(date[3] || date[6]).padStart(2, '0')}`
  const rest = input.slice(date.index! + date[0].length)
  const ranges = [...rest.matchAll(/(上午|早上|下午|晚上|中午)?\s*的?\s*(\d{1,2})(?:点|时|:)(?:(\d{1,2})分?|(半))?\s*(am|pm)?\s*(?:到|至|[-–]|to)\s*(上午|早上|下午|晚上|中午)?\s*的?\s*(\d{1,2})(?:点|时|:)(?:(\d{1,2})分?|(半))?\s*(am|pm)?/gi)]
  if (ranges.length !== 1) return null
  const r = ranges[0]
  const clock = (hour: string, minute: string, half: string, period: string, colon: boolean) => {
    let h = Number(hour); const m = half ? 30 : Number(minute || 0)
    if (m > 59 || h > 23 || (!period && !colon)) return null
    if (period) {
      if (h < 1 || h > 12) return null
      h %= 12
      if (/下午|晚上|中午|pm/i.test(period)) h += 12
    }
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  const p1 = r[1] || r[5] || r[6] || r[10] || ''
  const p2 = r[6] || r[10] || p1
  const start = clock(r[2], r[3], r[4], p1, r[0].includes(':'))
  const end = clock(r[7], r[8], r[9], p2, r[0].includes(':'))
  if (!start || !end) return null
  const startLocal = `${day}T${start}`, endLocal = `${day}T${end}`
  try {
    if (localTimeToUtc(endLocal, timeZone) <= localTimeToUtc(startLocal, timeZone)) return null
  } catch { return null }
  return { startLocal, endLocal, evidence: message }
}
