import type { MouseEvent, ReactNode } from 'react'
import { ExternalLink, MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

type LocationSectionPresentationProps = {
  id?: string
  sectionClassName?: string
  locationTitle: string
  locationName: ReactNode
  streetAddress: ReactNode
  locationAddress?: ReactNode
  mapUrl: string
  mapEmbedUrl: string
  openMapLabel: ReactNode
  mapPlaceholder?: ReactNode
  onMapClick?: (event: MouseEvent<HTMLAnchorElement>) => void
}

const defaultSectionClassName = 'px-5 py-20 sm:px-8 lg:px-10 lg:py-28'

const entranceAnimation = (prefersReducedMotion: boolean | null) =>
  prefersReducedMotion
    ? {}
    : {
      initial: { opacity: 0, y: 24 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, margin: '-80px' },
      transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
    }

const LocationSectionPresentation = ({
  id = 'location',
  sectionClassName = defaultSectionClassName,
  locationTitle,
  locationName,
  streetAddress,
  locationAddress,
  mapUrl,
  mapEmbedUrl,
  openMapLabel,
  mapPlaceholder,
  onMapClick,
}: LocationSectionPresentationProps) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)

  return (
    <section id={id} className={sectionClassName}>
      <motion.div {...entrance} className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl bg-home-dark text-white lg:grid-cols-[0.36fr_0.64fr]">
        <div className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
          <div>
            <MapPin className="h-7 w-7 text-home-gold" />
            <div className="mt-5 text-2xl font-bold leading-tight tracking-tight">{locationName}</div>
            <div className="mt-3 max-w-sm text-[0.94rem] leading-7 text-white/55">{streetAddress}</div>
            {locationAddress ? <div className="mt-2 max-w-sm text-sm leading-6 text-white/40">{locationAddress}</div> : null}
            <a
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white"
              href={mapUrl || undefined}
              target={mapUrl ? '_blank' : undefined}
              rel={mapUrl ? 'noreferrer' : undefined}
              onClick={onMapClick}
            >
              {openMapLabel} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="m-2 min-h-[24rem] overflow-hidden rounded-xl bg-[#d9ddd8] sm:m-3">
          {mapEmbedUrl ? (
            <iframe title={locationTitle} src={mapEmbedUrl} className="h-full min-h-[24rem] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          ) : (
            <div className="flex h-full min-h-[24rem] items-center justify-center px-6 text-center text-sm font-semibold text-slate-600">
              {mapPlaceholder || locationTitle}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  )
}

export default LocationSectionPresentation
