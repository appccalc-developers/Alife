import { pageSectionsChromeClass } from '../page-sections/sectionPresets'

type Props = {
  label: string
}

const PageViewSkeleton = ({ label }: Props) => (
  <section className="min-h-[70vh] w-full" role="status" aria-live="polite">
    <span className="sr-only">{label}</span>
    <div className="motion-safe:animate-pulse" aria-hidden="true">
      <div className="flex min-h-[28rem] items-end bg-gradient-to-br from-[#29473f] via-[#49625b] to-[#888276] sm:min-h-[34rem]">
        <div className={`${pageSectionsChromeClass} space-y-4 pb-14 sm:pb-20`}>
          <div className="h-3 w-24 rounded-full bg-white/20" />
          <div className="h-10 w-full max-w-2xl rounded-xl bg-white/25 sm:h-12" />
          <div className="h-4 w-full max-w-xl rounded-full bg-white/20" />
          <div className="h-4 w-4/5 max-w-lg rounded-full bg-white/15" />
        </div>
      </div>
      <div className={`${pageSectionsChromeClass} space-y-8 py-14 sm:py-20`}>
        <div className="space-y-3">
          <div className="alife-skeleton h-7 w-3/4 max-w-56 rounded-lg" />
          <div className="alife-skeleton h-4 w-full rounded-full" />
          <div className="alife-skeleton h-4 w-5/6 rounded-full" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="alife-skeleton h-36 rounded-[var(--alife-radius-card)]" />
          <div className="alife-skeleton h-36 rounded-[var(--alife-radius-card)]" />
        </div>
      </div>
    </div>
  </section>
)

export default PageViewSkeleton
