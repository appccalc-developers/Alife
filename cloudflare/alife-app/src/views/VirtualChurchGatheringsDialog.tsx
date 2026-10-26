import { virtualChurchGatheringsText } from '../i18n/virtualChurchGatherings'
import { useMemo } from 'react'
import { X } from 'lucide-react'
import { usePublicPageDetailQuery, usePublicPagesQuery } from '../hooks/usePublicPageQueries'
import { getFirstPageMenuPage } from './home/homeUtils'
import { useVirtualChurchDialogFocus } from './virtualChurchAccessibility'
import { gatheringTableColumnHeaders, readHomeGatheringSectionHtml } from './virtualChurchGatheringsContent'

/** Read the published homepage table, never a second hard-coded schedule.
 * Only text is rendered; authored HTML, links and scripts cannot execute here. */
export function readHomeGatheringTables(sections: Array<{ order: number; contentJson: unknown }>, language: string) {
  const tables: string[][][] = []
  for (const section of [...sections].sort((a, b) => a.order - b.order)) {
    const html = readHomeGatheringSectionHtml(section.contentJson, language)
    if (!/<table\b/i.test(html)) continue
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    for (const table of parsed.querySelectorAll('table')) {
      const text = table.textContent ?? ''
      if (!/\d{1,2}[:：]\d{2}/.test(text) || !/主日|崇拜|聚[会會]|青年|Sunday|service|worship|gathering/i.test(text)) continue
      const rows = [...table.rows].map(row => [...row.cells].map(cell => (cell.textContent ?? '').trim()))
      if (rows.length) tables.push(rows)
    }
  }
  return tables
}

export default function VirtualChurchGatheringsDialog({ language, onClose }: { language: string; onClose: () => void }) {
  const zh = language === 'zh'
  const dialogRef = useVirtualChurchDialogFocus(onClose)
  const pages = usePublicPagesQuery()
  const home = getFirstPageMenuPage(pages.data ?? [], language)
  const detail = usePublicPageDetailQuery(home?.id ?? '')
  // Do not display an unrelated retained page while the homepage changes.
  const page = detail.data?.id === home?.id && detail.data?.visibility === 'public' ? detail.data : null
  const tables = useMemo(() => readHomeGatheringTables(page?.sections ?? [], language), [page, language])
  const loading = !page && (pages.isPending || (Boolean(home) && detail.isPending))
  const failed = !page && (pages.isError || detail.isError)
  return <div className="pointer-events-auto absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" onPointerDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="vc-gatherings-title" tabIndex={-1} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-[#ead7b6] bg-[#f7efe2] p-5 text-[#21160e] shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div><h2 id="vc-gatherings-title" className="text-2xl font-bold">{zh ? virtualChurchGatheringsText.gatheringTimes.zh : virtualChurchGatheringsText.gatheringTimes.en}</h2><p className="mt-2 text-sm text-[#715e45]">{zh ? virtualChurchGatheringsText.theSameTimetablePublishedOnTheChurchHomepage.zh : virtualChurchGatheringsText.theSameTimetablePublishedOnTheChurchHomepage.en}</p></div>
        <button type="button" data-autofocus onClick={onClose} aria-label={zh ? virtualChurchGatheringsText.closeGatheringTimes.zh : virtualChurchGatheringsText.closeGatheringTimes.en} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#aa8b59] focus-visible:outline focus-visible:outline-2"><X size={20} /></button>
      </div>
      {page && (pages.isError || detail.isError) ? <p role="status" className="mt-4 text-sm">{zh ? virtualChurchGatheringsText.updatesAreUnavailableShowingTheCachedHomepageTimetable.zh : virtualChurchGatheringsText.updatesAreUnavailableShowingTheCachedHomepageTimetable.en}</p> : null}
      {loading ? <p role="status" className="py-8">{zh ? virtualChurchGatheringsText.loadingTheHomepageTimetable.zh : virtualChurchGatheringsText.loadingTheHomepageTimetable.en}</p> : tables.length ? tables.map((rows, index) => {
        const headers = gatheringTableColumnHeaders(rows, language)
        return <div key={index} className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm sm:text-base">
            <caption className="sr-only">{zh ? virtualChurchGatheringsText.churchHomepageGatheringTimetable.zh : virtualChurchGatheringsText.churchHomepageGatheringTimetable.en}</caption>
            {headers ? <thead className="sr-only"><tr>{headers.map((header, column) => <th key={column} scope="col">{header}</th>)}</tr></thead> : null}
            <tbody>{rows.map((cells, row) => <tr key={row} className="border-b border-[#d6c3a2]">{cells.map((cell, column) => column === 0 ? <th key={column} scope="row" className="px-2 py-4 font-bold">{cell}</th> : <td key={column} className="px-2 py-4">{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      }) : <div className="py-8" role={failed ? 'alert' : 'status'}><p>{failed ? zh ? virtualChurchGatheringsText.theHomepageTimetableCouldNotBeLoaded.zh : virtualChurchGatheringsText.theHomepageTimetableCouldNotBeLoaded.en : zh ? virtualChurchGatheringsText.noGatheringTimetableIsCurrentlyPublishedOnThe.zh : virtualChurchGatheringsText.noGatheringTimetableIsCurrentlyPublishedOnThe.en}</p><button type="button" className="mt-4 min-h-11 underline" onClick={() => { void pages.refetch(); if (home) void detail.refetch() }}>{zh ? virtualChurchGatheringsText.tryAgain.zh : virtualChurchGatheringsText.tryAgain.en}</button></div>}
    </div>
  </div>
}
