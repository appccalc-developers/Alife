import type { MouseEvent, ReactNode } from 'react'
import { ExternalLink, MapPin, Phone, UserRound } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'

type LocationSectionPresentationProps = {
  id?: string
  sectionClassName?: string
  locationTitle: string
  locationName: ReactNode
  streetAddress: ReactNode
  locationAddress?: ReactNode
  contactName?: ReactNode
  contactNameLabel?: ReactNode
  contactPhone?: string
  contactPhoneLabel?: ReactNode
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
  contactName,
  contactNameLabel,
  contactPhone,
  contactPhoneLabel,
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
      <motion.div {...entrance} className="mx-auto grid max-w-7xl overflow-hidden rounded-[2rem] bg-[#211812] text-white shadow-[0_28px_90px_rgba(34,25,17,0.18)] lg:grid-cols-[0.4fr_0.6fr]">
        <div className="flex items-center px-7 py-12 sm:px-10 lg:px-14 lg:py-16">
          <div>
            <MapPin className="h-8 w-8 text-home-gold" strokeWidth={1.7} />
            <div className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.03em]">{locationName}</div>
            <div className="mt-4 max-w-sm text-[0.95rem] leading-7 text-white/64">{streetAddress}</div>
            {locationAddress ? <div className="mt-2 max-w-sm text-sm leading-6 text-white/45">{locationAddress}</div> : null}
            {contactName || contactPhone ? (
              <div className="mt-6 grid gap-4 border-t border-white/10 pt-5">
                {contactName ? (
                  <div className="flex items-start gap-3">
                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-home-gold" aria-hidden="true" />
                    <div>
                      {contactNameLabel ? (
                        <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-white/40">{contactNameLabel}</p>
                      ) : null}
                      <div className="mt-1 text-sm font-semibold text-white/80">{contactName}</div>
                    </div>
                  </div>
                ) : null}
                {contactPhone ? (
                  <div className="flex items-start gap-3">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-home-gold" aria-hidden="true" />
                    <div>
                      {contactPhoneLabel ? (
                        <p className="text-[0.68rem] font-medium uppercase tracking-[0.12em] text-white/40">{contactPhoneLabel}</p>
                      ) : null}
                      <a
                        className="mt-1 block text-sm font-semibold text-white/80 transition hover:text-white"
                        href={`tel:${contactPhone.replace(/[^\d+]/g, '')}`}
                      >
                        {contactPhone}
                      </a>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <a
              className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 px-5 py-2.5 text-sm font-semibold text-white/76 transition duration-300 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/[0.06] hover:text-white"
              href={mapUrl || undefined}
              target={mapUrl ? '_blank' : undefined}
              rel={mapUrl ? 'noreferrer' : undefined}
              onClick={onMapClick}
            >
              {openMapLabel} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="m-2 min-h-[26rem] overflow-hidden rounded-[1.55rem] bg-[#d9ddd8] sm:m-3 lg:min-h-[34rem]">
          {mapEmbedUrl ? (
            <iframe title={locationTitle} src={mapEmbedUrl} className="h-full min-h-[26rem] w-full border-0 lg:min-h-[34rem]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
          ) : (
            <div className="flex h-full min-h-[26rem] items-center justify-center px-6 text-center text-sm font-semibold text-slate-600 lg:min-h-[34rem]">
              {mapPlaceholder || locationTitle}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  )
}

export default LocationSectionPresentation
