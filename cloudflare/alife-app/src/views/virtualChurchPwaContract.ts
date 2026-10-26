export type VirtualChurchCodeRequest = {
  destination: string
}

export type VirtualChurchCodeUrl = {
  origin: string
  pathname: string
}

export type VirtualChurchRuntimeRequest = VirtualChurchCodeRequest & {
  mode: string
}

declare const self: { location: { origin: string } }

export const virtualChurchCodeChunkMatches = (
  {
    request,
    url,
  }: {
    request: VirtualChurchCodeRequest
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && request.destination === 'script'
  && /\/assets\/(?:[Vv]irtualChurch[^/]*|vendor-(?:3d|postprocessing))-[^/]+\.js$/.test(url.pathname)

export const virtualChurchAssetRequestMatches = (
  {
    url,
  }: {
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && url.pathname.startsWith('/virtual-church-assets/')

export const virtualChurchAppShellRequestMatches = (
  {
    request,
    url,
  }: {
    request: VirtualChurchRuntimeRequest
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && !url.pathname.startsWith('/api/')
  && !url.pathname.startsWith('/images/')
  && !url.pathname.startsWith('/virtual-church-assets/')
  && (
    request.mode === 'navigate'
    || request.destination === 'document'
    || request.destination === 'script'
    || request.destination === 'style'
  )

export const virtualChurchPublicVideoRequestMatches = (
  {
    request,
    url,
  }: {
    request: VirtualChurchCodeRequest
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && request.destination === 'video'
  && url.pathname.startsWith('/media/')

export const virtualChurchPublicImageOrFontRequestMatches = (
  {
    request,
    url,
  }: {
    request: VirtualChurchCodeRequest
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && (request.destination === 'image' || request.destination === 'font')
  && (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/media/')
    || url.pathname === '/vite.svg'
  )

export const virtualChurchPublicRuntimeRequestMatches = (
  {
    url,
  }: {
    url: VirtualChurchCodeUrl
  },
  appOrigin = self.location.origin,
) =>
  url.origin === appOrigin
  && (
    url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/media/')
    || url.pathname === '/manifest.json'
    || url.pathname === '/vite.svg'
  )
