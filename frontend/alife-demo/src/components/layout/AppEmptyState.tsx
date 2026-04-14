type Props = {
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

const AppEmptyState = ({ title, description, actionLabel, onAction }: Props) => (
  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-400">*</div>
    <p className="text-sm font-semibold text-slate-900">{title}</p>
    <p className="mt-1 text-sm text-slate-600">{description}</p>
    {actionLabel ? (
      <button
        type="button"
        className="mt-4 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    ) : null}
  </div>
)

export default AppEmptyState
