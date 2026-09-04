import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { Loader2, Search } from 'lucide-react'
import type { AdminPagedResultDto } from '../../services/groupService'

export type LabelFn = (key: string, values?: Record<string, string | number>) => string

export const Panel = ({ title, description, count, children, className, connected = false }: { title: string; description: string; count?: number; children: ReactNode; className?: string; connected?: boolean }) => (
  <section className={`overflow-hidden bg-white ${connected ? '' : 'rounded-3xl border border-slate-200 shadow-sm'} ${className || ''}`}>
    {!connected ? <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-5"><div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div>{typeof count === 'number' ? <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-black text-emerald-700">{count}</span> : null}</div> : null}
    {children}
  </section>
)

export const FilterBar = ({ children }: { children: ReactNode }) => <div className="grid items-stretch gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>

export const TextInput = (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} className={`min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />

export const SearchInput = (props: InputHTMLAttributes<HTMLInputElement>) => <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><TextInput {...props} className="w-full pl-9" /></div>

export const SelectInput = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 disabled:bg-slate-100 disabled:text-slate-400" />

export const FilterActions = ({ l, apply, reset }: { l: LabelFn; apply: () => Promise<void>; reset: () => void }) => (
  <div className="flex gap-2">
    <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 sm:flex-none" type="button" onClick={() => apply().catch(() => undefined)}>{l('apply')}</button>
    <button className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 sm:flex-none" type="button" onClick={reset}>{l('reset')}</button>
  </div>
)

export const DataTable = ({ headers, children }: { headers: string[]; children: ReactNode }) => <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-200 text-sm"><thead className="bg-white text-left text-xs font-black uppercase tracking-wide text-slate-500"><tr>{headers.map((header) => <th key={header} className="px-5 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>

export const Loading = ({ text }: { text: string }) => <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>

export const Empty = ({ text }: { text: string }) => <p className="p-5 text-sm text-slate-500">{text}</p>

export const Pill = ({ tone, children }: { tone: 'green' | 'slate' | 'sky'; children: ReactNode }) => {
  const classes = tone === 'green' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : tone === 'sky' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-50 text-slate-600'
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${classes}`}>{children}</span>
}

export const LabeledField = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="grid gap-1.5">
    <span className="text-xs font-semibold text-slate-600">{label}</span>
    {children}
    {hint ? <span className="text-xs font-normal leading-5 text-slate-500">{hint}</span> : null}
  </label>
)

export const TextAreaInput = (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...props} className={`min-h-28 rounded-xl border border-slate-200 px-3 py-2 text-sm font-normal leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 ${props.className || ''}`} />
)

export const JsonBlock = ({ title, value }: { title: string; value: string }) => (
  <div>
    <div className="mb-1 font-bold text-slate-700">{title}</div>
    <pre className="max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white p-3 font-mono text-[11px] leading-5 text-slate-600">{value}</pre>
  </div>
)

export const Pager = <T,>({ l, page, goToPage, compact = false }: { l: LabelFn; page: AdminPagedResultDto<T>; goToPage: (page: number) => Promise<void>; compact?: boolean }) => (
  <div className={`flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/70 text-slate-500 ${compact ? 'p-2 text-xs' : 'p-4 text-sm'}`}>
    <span className="flex flex-wrap items-center gap-2">
      <span>{l('total')}: {page.totalCount}</span>
      <span className={`rounded-lg bg-white font-black text-slate-600 shadow-sm ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'}`}>{l('page')} {page.page}/{page.totalPages || 1}</span>
      <span className={`rounded-lg bg-white font-black text-emerald-700 shadow-sm ${compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'}`}>{l('pageSize')}: {page.pageSize}</span>
    </span>
    <div className="flex gap-1.5">
      <button className={`rounded-lg border border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 ${compact ? 'min-h-8 px-2 py-1 text-xs' : 'min-h-10 px-3 py-1.5'}`} disabled={page.page <= 1} type="button" onClick={() => goToPage(page.page - 1).catch(() => undefined)}>{l('previous')}</button>
      <button className={`rounded-lg border border-slate-200 bg-white font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 ${compact ? 'min-h-8 px-2 py-1 text-xs' : 'min-h-10 px-3 py-1.5'}`} disabled={page.totalPages === 0 || page.page >= page.totalPages} type="button" onClick={() => goToPage(page.page + 1).catch(() => undefined)}>{l('next')}</button>
    </div>
  </div>
)
