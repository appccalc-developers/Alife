export const extractYouTubeVideoId = (rawUrl?: string | null) => {
  const value = rawUrl?.trim()
  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)

    if (url.hostname.includes('youtu.be')) {
      return url.pathname.replace('/', '').trim()
    }

    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v')?.trim()
      if (videoId) {
        return videoId
      }

      const pathParts = url.pathname.split('/').filter(Boolean)
      if (pathParts[0] === 'embed' || pathParts[0] === 'shorts') {
        return pathParts[1]?.trim() ?? ''
      }
    }
  } catch {
    return ''
  }

  return ''
}

export const toYouTubeEmbedUrl = (videoId?: string | null) => {
  const normalizedVideoId = videoId?.trim()
  return normalizedVideoId ? `https://www.youtube.com/embed/${encodeURIComponent(normalizedVideoId)}` : ''
}

export const buildSermonVideoPath = (sermonId: string, videoId?: string | null) => {
  const searchParams = new URLSearchParams()
  const normalizedVideoId = videoId?.trim()

  if (normalizedVideoId) {
    searchParams.set('videoId', normalizedVideoId)
  }

  const search = searchParams.toString()
  return search ? `/sermons/${sermonId}?${search}` : `/sermons/${sermonId}`
}