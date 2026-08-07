const SermonCardSkeleton = () => (
  <article className="overflow-hidden rounded-[var(--alife-radius-card)] border border-[#ddd7ca] bg-white/85 shadow-sm">
    <div className="alife-skeleton h-44 w-full" />
    <div className="space-y-3 p-4">
      <div className="alife-skeleton h-5 w-4/5 rounded-lg" />
      <div className="alife-skeleton h-4 w-3/5 rounded-lg" />
      <div className="alife-skeleton h-4 w-2/5 rounded-lg" />
    </div>
  </article>
)

export default SermonCardSkeleton
