import type { ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

type Props = {
  busy: boolean
  children: ReactNode
  language: string
}

const ChurchLifeResultsRegion = ({ busy, children, language }: Props) => (
  <div className="relative" aria-busy={busy || undefined}>
    {busy ? (
      <div
        className="pointer-events-none absolute right-3 top-3 z-10 inline-flex items-center gap-2 rounded-full border border-[#cddbd5] bg-white/95 px-3 py-1.5 text-xs font-black text-[#176b5a] shadow-sm backdrop-blur"
        role="status"
      >
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        {language === 'zh' ? '正在更新结果' : 'Updating results'}
      </div>
    ) : null}
    {children}
  </div>
)

export default ChurchLifeResultsRegion
