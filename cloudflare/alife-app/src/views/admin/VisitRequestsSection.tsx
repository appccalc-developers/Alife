import type { Dispatch, SetStateAction } from 'react'
import { CheckCircle2, Clock3, Globe2, Handshake, Loader2, Mail, Phone } from 'lucide-react'
import type { AdminPagedResultDto, VisitContactRequestDto, VisitContactRequestStatus } from '../../services/groupService'
import { Empty, FilterActions, FilterBar, Loading, Panel, Pager, SearchInput, SelectInput } from './AdminUi'
import type { LabelFn } from './AdminUi'
import { formatDate } from './adminUtils'

const visitRequestStatusLabel = (status: string, language: string) => {
  if (status === 'contacted') return language === 'zh' ? '已联系' : 'Contacted'
  if (status === 'followUp') return language === 'zh' ? '待跟进' : 'Follow-up'
  return language === 'zh' ? '新请求' : 'New request'
}

const visitRequestStatusTone = (status: string) =>
  status === 'contacted'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'followUp'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-sky-200 bg-sky-50 text-sky-700'

const visitRequestLanguageLabel = (language: string, uiLanguage: string) => {
  if (language === 'zh') return uiLanguage === 'zh' ? '中文' : 'Chinese'
  if (language === 'en') return uiLanguage === 'zh' ? '英文' : 'English'
  if (language === 'bilingual') return uiLanguage === 'zh' ? '中英双语' : 'Bilingual'
  return language
}

const visitRequestLanguageTone = (language: string) =>
  language === 'zh'
    ? 'border-rose-100 bg-rose-50 text-rose-700'
    : language === 'en'
      ? 'border-indigo-100 bg-indigo-50 text-indigo-700'
      : 'border-violet-100 bg-violet-50 text-violet-700'

export const VisitRequestsSection = ({ l, loading, page, filters, setFilters, apply, goToPage, updateStatus, updatingId, language }: {
  l: LabelFn
  loading: boolean
  page: AdminPagedResultDto<VisitContactRequestDto>
  filters: { search: string; status: string }
  setFilters: Dispatch<SetStateAction<{ search: string; status: string }>>
  apply: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  updateStatus: (item: VisitContactRequestDto, status: VisitContactRequestStatus) => Promise<void>
  updatingId: string | null
  language: string
}) => (
  <Panel title={l('visitRequests')} description={l('visitRequestsDescription')} count={page.totalCount}>
    <FilterBar>
      <SearchInput placeholder={l('search')} value={filters.search} onChange={(e) => setFilters((x) => ({ ...x, search: e.target.value }))} />
      <SelectInput value={filters.status} onChange={(e) => setFilters((x) => ({ ...x, status: e.target.value }))}>
        <option value="">{l('allStatus')}</option>
        <option value="new">{l('newVisitRequest')}</option>
        <option value="followUp">{l('followUp')}</option>
        <option value="contacted">{l('contacted')}</option>
      </SelectInput>
      <FilterActions l={l} apply={apply} reset={() => setFilters({ search: '', status: '' })} />
    </FilterBar>
    {loading ? <Loading text={l('loading')} /> : page.items.length ? (
      <>
        <div className="grid gap-3 p-4">
          {page.items.map((item) => (
            <article key={item.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md hover:border-slate-300">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${visitRequestStatusTone(item.status)}`}>
                      {item.status === 'contacted' ? <CheckCircle2 className="h-3 w-3" /> : item.status === 'followUp' ? <Handshake className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                      {visitRequestStatusLabel(item.status, language)}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatDate(item.submittedUtc)}
                    </span>
                    {item.preferredLanguage ? (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${visitRequestLanguageTone(item.preferredLanguage)}`}>
                        <Globe2 className="h-3 w-3" />
                        {visitRequestLanguageLabel(item.preferredLanguage, language)}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 break-words text-base font-bold text-slate-950">{item.displayName || l('visitorName')}</h3>
                  {item.salutation ? (
                    <p className="mt-1 text-sm font-medium text-slate-500">
                      {language === 'zh' ? '称谓' : 'Preferred address'}: <span className="text-slate-700">{item.salutation}</span>
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.email ? (
                      <a className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" href={`mailto:${item.email}`}>
                        <Mail className="h-3.5 w-3.5" />
                        <span className="max-w-[16ch] truncate sm:max-w-[24ch]">{item.email}</span>
                      </a>
                    ) : null}
                    {item.phone ? (
                      <a className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700" href={`tel:${item.phone}`}>
                        <Phone className="h-3.5 w-3.5" />
                        <span>{item.phone}</span>
                      </a>
                    ) : null}
                  </div>
                  {item.message ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item.message}</p> : null}
                  {item.handledByDisplayName ? (
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      {l('handledBy')}: <span className="text-slate-700">{item.handledByDisplayName}</span>
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col">
                  <button
                    type="button"
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50 sm:w-36"
                    disabled={updatingId === item.id || item.status === 'followUp'}
                    onClick={() => updateStatus(item, 'followUp').catch(() => undefined)}
                  >
                    {updatingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
                    {l('contactAgain')}
                  </button>
                  <button
                    type="button"
                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-36"
                    disabled={updatingId === item.id || item.status === 'contacted'}
                    onClick={() => updateStatus(item, 'contacted').catch(() => undefined)}
                  >
                    {updatingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    {l('markContacted')}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        <Pager l={l} page={page} goToPage={goToPage} />
      </>
    ) : <Empty text={l('noVisitRequests')} />}
  </Panel>
)
