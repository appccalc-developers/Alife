import { eventPermissionGuideText } from '../../i18n/eventPermissionGuide.ts'
import { Link } from 'react-router-dom'

export default function EventPermissionGuide({ zh, onFilter }: { zh: boolean; onFilter: () => void }) {
  const rows = zh ? [...eventPermissionGuideText.localizedCopy.zh] : [...eventPermissionGuideText.localizedCopy.en]
  return <details className="rounded-2xl border border-[#d9dfd7] bg-[#fffdf8] p-4">
    <summary className="min-h-10 cursor-pointer text-sm font-bold text-[#18332d]">{zh ? eventPermissionGuideText.eventsWhereAreRolesPermissionsAndResponsibilitiesConfigured.zh : eventPermissionGuideText.eventsWhereAreRolesPermissionsAndResponsibilitiesConfigured.en}</summary>
    <dl className="mt-3 divide-y divide-[#d9dfd7]">{rows.map(([title, description]) => <div key={title} className="grid gap-1 py-3 md:grid-cols-[12rem_minmax(0,1fr)]"><dt className="text-sm font-semibold text-[#18332d]">{title}</dt><dd className="text-sm leading-6 text-[#596a63]">{description}</dd></div>)}</dl>
    <p className="mt-2 text-xs leading-5 text-[#596a63]">{zh ? eventPermissionGuideText.configureEventRolesInPeopleAndResponsibilitiesAndPolicy.zh : eventPermissionGuideText.configureEventRolesInPeopleAndResponsibilitiesAndPolicy.en}</p>
    <p className="mt-2 text-xs leading-5 text-[#596a63]">{zh ? eventPermissionGuideText.groupLeadershipAloneGrantsNoPackageWithdrawalEventOwners.zh : eventPermissionGuideText.groupLeadershipAloneGrantsNoPackageWithdrawalEventOwners.en}</p>
    <div className="mt-3 flex flex-wrap gap-3">
      <button type="button" onClick={onFilter} className="min-h-11 rounded-xl border border-[#176b5a] px-3 text-sm font-semibold text-[#176b5a]">{zh ? eventPermissionGuideText.filterEventPermissions.zh : eventPermissionGuideText.filterEventPermissions.en}</button>
      <Link to="/event-work" className="inline-flex min-h-11 items-center rounded-xl border border-[#d9dfd7] px-3 text-sm text-[#176b5a]">{zh ? eventPermissionGuideText.openMyEventWorkspaces.zh : eventPermissionGuideText.openMyEventWorkspaces.en}</Link>
    </div>
  </details>
}
