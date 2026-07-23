const normalizeYouTubeVideoId = (value?: string | null) => {
  const candidate = value?.trim() ?? ''
  return /^[a-zA-Z0-9_-]{6,128}$/.test(candidate) ? candidate : ''
}

export const extractYouTubeVideoId = (rawUrl?: string | null) => {
  const value = rawUrl?.trim()
  if (!value) {
    return ''
  }

  const rawVideoId = normalizeYouTubeVideoId(value)
  if (rawVideoId) return rawVideoId

  try {
    const url = new URL(value)

    if (url.hostname.includes('youtu.be')) {
      return normalizeYouTubeVideoId(url.pathname.split('/').filter(Boolean)[0])
    }

    if (url.hostname.includes('youtube.com') || url.hostname.includes('youtube-nocookie.com')) {
      const videoId = normalizeYouTubeVideoId(url.searchParams.get('v'))
      if (videoId) {
        return videoId
      }

      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts[0] === 'embed' || pathParts[0] === 'shorts' || pathParts[0] === 'live') {
        return normalizeYouTubeVideoId(pathParts[1])
      }
    }
  } catch {
    return ''
  }

  return ''
}

export const toYouTubeEmbedUrl = (videoId?: string | null) => {
  const normalizedVideoId = extractYouTubeVideoId(videoId)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const originParam = origin ? `&origin=${encodeURIComponent(origin)}` : ''
  return normalizedVideoId ? `https://www.youtube.com/embed/${encodeURIComponent(normalizedVideoId)}?enablejsapi=1&feature=oembed${originParam}` : ''
}

export const buildSermonVideoPath = (sermonId: string, videoId?: string | null) => {
  const searchParams = new URLSearchParams()
  const normalizedVideoId = extractYouTubeVideoId(videoId)

  if (normalizedVideoId) {
    searchParams.set('videoId', normalizedVideoId)
  }

  const search = searchParams.toString()
  return search ? `/sermons/${sermonId}?${search}` : `/sermons/${sermonId}`
}
