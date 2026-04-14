import AppBadge from '../layout/AppBadge'
import type { ReactNode } from 'react'

const ManagementBanner = ({ children }: { children?: ReactNode }) => (
  <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <AppBadge variant="warning">Management Mode</AppBadge>
          <p className="text-sm font-medium text-amber-900">Leader tools are enabled for this group workspace.</p>
        </div>
        <p className="text-xs text-amber-800">You can manage subgroups, pages, and member invitations without leaving this context.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  </div>
)

export default ManagementBanner
