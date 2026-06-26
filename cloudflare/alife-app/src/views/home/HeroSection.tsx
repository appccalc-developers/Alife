import { useRef } from 'react'
import { ArrowRight, PlayCircle } from 'lucide-react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { createSectionHandler, homepageHeroVideo, media } from './homeUtils'
import type { HomeCopy, Language } from './homeCopy'
import GuardedLink from './LoginPromptOverlay'

type Props = {
  copy: HomeCopy
  language: Language
}

const HeroSection = ({ copy, language }: Props) => {
  const prefersReducedMotion = useReducedMotion()
  const heroRef = useRef<HTMLElement | null>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroTextY = useTransform(scrollYProgress, [0, 1], [0, prefersReducedMotion ? 0 : 80])
  const heroGlow = useTransform(scrollYProgress, [0, 1], [1, 0.4])
  const scrollToSection = createSectionHandler()

  return (
    <section ref={heroRef} className="relative isolate min-h-dvh overflow-hidden bg-home-dark text-white">
      <video
        className="absolute inset-0 z-0 h-full w-full scale-105 object-cover opacity-60"
        src={homepageHeroVideo}
        poster={media.hero}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <motion.div style={{ opacity: heroGlow }} className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(0deg,rgba(30,18,10,0.78)_0%,rgba(30,18,10,0.2)_50%,rgba(30,18,10,0.12)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-48 bg-gradient-to-t from-home-surface to-transparent" />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-6xl items-end px-5 pb-24 pt-24 sm:px-8 lg:px-10">
        <motion.div style={{ y: heroTextY }} className="max-w-xl">
          <motion.h1
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="whitespace-pre-line text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.5rem]"
          >
            {copy.heroTitle}
          </motion.h1>
          <motion.p
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="mt-5 max-w-md text-base leading-7 text-white/65"
          >
            {copy.heroBody}
          </motion.p>
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mt-8 flex flex-wrap items-center gap-4"
          >
            <a className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-home-dark transition hover:bg-white/90" href="#visit" onClick={(event) => scrollToSection(event, '#visit')}>
              {copy.heroPrimary} <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <GuardedLink language={language} to="/sermons" className="inline-flex items-center gap-2 text-sm font-medium text-white/60 transition hover:text-white">
              <PlayCircle className="h-4 w-4" /> {copy.heroSecondary}
            </GuardedLink>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default HeroSection
