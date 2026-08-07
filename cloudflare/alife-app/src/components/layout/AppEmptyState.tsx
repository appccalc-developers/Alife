import { Inbox } from 'lucide-react'

type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

const AppEmptyState = ({ title, description, actionLabel, onAction }: Props) => (
  <div className="rounded-2xl border border-dashed border-[#176b5a]/25 bg-white/64 p-7 text-center shadow-[0_10px_30px_rgba(31,56,48,0.05)]">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e3f0eb] text-[#176b5a] shadow-sm">
      <Inbox className="h-5 w-5" aria-hidden="true" />
    </div>
    <p className="text-base font-black text-[#18332d] desktop:font-bold">{title}</p>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#66766f]">{description}</p>
    {actionLabel ? (
      <button
        type="button"
        className="mt-5 rounded-xl border border-[#176b5a]/20 bg-white px-4 py-2 text-sm font-bold text-[#176b5a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#176b5a]/35"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
)

export default AppEmptyState
