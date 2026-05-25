type SourceMap = Record<string, unknown>

export const readText = (source: SourceMap, ...keys: string[]) => {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const map = value as Record<string, unknown>
      const text = map.en || map.cn || Object.values(map)[0]
      if (typeof text === 'string' && text.trim()) {
        return text
      }
    }
  }

  return ''
}

export const parseLimit = (source: SourceMap, key: string, fallback = 5) => {
  const raw = source[key]
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw)
  }

  if (typeof raw === 'string') {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed
    }
  }

  return fallback
}
