import { ExternalLink, MapPin } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { churchMapEmbedUrl, churchMapUrl, entranceAnimation } from './homeUtils'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
}

const churchStreetAddress = '182 The Runway, Wigram, Christchurch 8042'

const LocationSection = ({ copy }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)

  return (
    <section id="location" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <motion.div {...entrance} className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl bg-home-dark text-white lg:grid-cols-[0.36fr_0.64fr]">
        <div className="flex items-center px-6 py-10 sm:px-10 lg:px-12">
          <div>
            <MapPin className="h-7 w-7 text-home-gold" />
            <h3 className="mt-5 text-2xl font-bold leading-tight tracking-tight">{copy.locationName}</h3>
            <p className="mt-3 max-w-sm text-[0.94rem] leading-7 text-white/55">{churchStreetAddress}</p>
            <p className="mt-2 max-w-sm text-sm leading-6 text-white/40">{copy.locationAddress}</p>
            <a className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white" href={churchMapUrl} target="_blank" rel="noreferrer">
              {copy.openMap} <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <div className="m-2 min-h-[24rem] overflow-hidden rounded-xl bg-[#d9ddd8] sm:m-3">
          <iframe title={copy.locationTitle} src={churchMapEmbedUrl} className="h-full min-h-[24rem] w-full border-0" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen />
        </div>
      </motion.div>
    </section>
  )
}

export default LocationSection
