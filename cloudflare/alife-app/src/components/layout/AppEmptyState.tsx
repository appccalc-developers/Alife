type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

const AppEmptyState = ({ title, description, actionLabel, onAction }: Props) => (
  <div className="rounded-[1.75rem] border border-dashed border-[#176b5a]/25 bg-[#e3f0eb]/50 p-7 text-center">
    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl text-[#176b5a] shadow-sm">+</div>
    <p className="text-base font-semibold text-[#18332d]">{title}</p>
    <p className="mx-auto mt-1.5 max-w-lg text-sm leading-relaxed text-[#66766f]">{description}</p>
    {actionLabel ? (
      <button
        type="button"
        className="mt-5 rounded-full border border-[#176b5a]/20 bg-white px-4 py-2 text-sm font-semibold text-[#176b5a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#176b5a]/35"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
)

export default AppEmptyState
