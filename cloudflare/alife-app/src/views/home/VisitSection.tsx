import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { entranceAnimation, createSectionHandler, media } from './homeUtils'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
}

const VisitSection = ({ copy }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const entrance = entranceAnimation(prefersReducedMotion)
  const scrollToSection = createSectionHandler()

  return (
    <section id="visit" className="px-5 py-20 sm:px-8 lg:px-10 lg:py-28">
      <motion.div {...entrance} className="mx-auto grid max-w-6xl overflow-hidden rounded-2xl bg-white shadow-[0_12px_40px_rgba(30,18,10,0.08)] lg:grid-cols-[0.46fr_0.54fr]">
        <div className="relative min-h-[22rem]">
          <img src={media.visit} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-gradient-to-t from-home-dark/50 to-transparent" />
        </div>
        <div className="flex items-center p-7 sm:p-10 lg:p-14">
          <div>
            <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{copy.visitTitle}</h2>
            <p className="mt-4 max-w-[45ch] text-[0.94rem] leading-7 text-home-muted">{copy.visitBody}</p>
            <a className="mt-6 inline-flex items-center gap-2 rounded-lg bg-home-green px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-home-green-hover" href="#location" onClick={(event) => scrollToSection(event, '#location')}>
              {copy.visitAction} <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}

export default VisitSection
