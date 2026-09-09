import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import AppPageShell from '../components/layout/AppPageShell'
import AppActionButton from '../components/layout/AppActionButton'
import AppEmptyState from '../components/layout/AppEmptyState'
import { http, normalizeApiError } from '../services/http'
import { resolveFileAssetAccessUrl } from '../services/fileAssetService'
import { useAuthStore } from '../stores/auth'

type BulletinList = { canManage: boolean; items: { date: string; hasFile: boolean }[] }
const endpoint = '/api/church-life/bulletins'

export default function SundayBulletinsView() {
  const auth = useAuthStore()
  const zh = auth.language === 'zh'
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [page, setPage] = useState(1)
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null)
  const query = useQuery({
    queryKey: ['sunday-bulletins', auth.me?.id],
    queryFn: async () => (await http.get<BulletinList>(endpoint)).data,
    enabled: Boolean(auth.me?.id),
    gcTime: 0,
    refetchOnWindowFocus: true,
  })
  const items = (query.data?.items ?? []).filter(item => filter === 'all' || (filter === 'uploaded' ? item.hasFile : !item.hasFile))
    .toSorted((a, b) => sort === 'desc' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
  const pages = Math.max(1, Math.ceil(items.length / 8))
  const currentPage = Math.min(page, pages)
  const upload = async (date: string, file: File) => {
    setNotice(null)
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 20 * 1024 * 1024 || file.size < 5) {
      setNotice({ error: true, text: zh ? '请选择不超过 20 MB 的 PDF 文件。' : 'Choose a PDF file up to 20 MB.' })
      return
    }
    setBusyDate(date)
    try {
      const data = new FormData()
      data.append('file', file)
      await http.put(`${endpoint}/${date}`, data)
      await query.refetch()
      setNotice({ error: false, text: zh ? `${date} 周报上传成功。` : `Bulletin for ${date} uploaded.` })
    } catch (error) {
      const status = normalizeApiError(error).status
      const denied = status === 403
      setNotice({ error: true, text: denied
        ? (zh ? '你没有上传周报的权限。' : 'You do not have permission to upload bulletins.')
        : status === 503
          ? (zh ? '周报存储暂时不可用，请联系教会管理员检查存储配置。' : 'Bulletin storage is unavailable. Please contact a church administrator.')
          : (zh ? '上传失败，请检查 PDF 文件后重试。' : 'Upload failed. Check the PDF file and try again.') })
    } finally { setBusyDate(null) }
  }

  return <AppPageShell title={zh ? '主日周报' : 'Sunday Bulletins'}
    context={zh ? '教会生活 / 主日周报' : 'Church Life / Sunday Bulletins'}
    subtitle={zh ? '教会内可见 · 最近三个月及来临的主日（新西兰时间）' : 'Church members only · Last three months and the upcoming Sunday (New Zealand time)'}>
    {notice && <p role={notice.error ? 'alert' : 'status'} className={`mb-4 rounded-xl p-3 ${notice.error ? 'bg-rose-50 text-rose-800' : 'bg-[#e3f0eb] text-[#0d4f43]'}`}>{notice.text}</p>}
    {query.isPending && <p role="status">{zh ? '正在加载周报…' : 'Loading bulletins…'}</p>}
    {query.isError && <AppEmptyState title={zh ? '无法加载周报' : 'Unable to load bulletins'}
      description={normalizeApiError(query.error).status === 403 ? (zh ? '仅教会成员可查看周报。' : 'Bulletins are available to church members.') : (zh ? '请稍后重试。' : 'Please try again.')}
      actionLabel={zh ? '重试' : 'Retry'} onAction={() => void query.refetch()} />}
    {query.data && !query.isError && <>
      <div className="mb-4 flex flex-wrap gap-3">
        <label className="text-sm">{zh ? '文件状态' : 'File status'}
          <select className="ml-2 min-h-10 rounded-xl border bg-white px-3" value={filter} onChange={event => { setFilter(event.target.value); setPage(1) }}>
            <option value="all">{zh ? '全部' : 'All'}</option><option value="uploaded">{zh ? '已上传' : 'Uploaded'}</option><option value="missing">{zh ? '待上传' : 'Not uploaded'}</option>
          </select>
        </label>
        <label className="text-sm">{zh ? '日期排序' : 'Date order'}
          <select className="ml-2 min-h-10 rounded-xl border bg-white px-3" value={sort} onChange={event => { setSort(event.target.value); setPage(1) }}>
            <option value="desc">{zh ? '最新在前' : 'Newest first'}</option><option value="asc">{zh ? '最早在前' : 'Oldest first'}</option>
          </select>
        </label>
      </div>
      <div className="space-y-3">
        {items.slice((currentPage - 1) * 8, currentPage * 8).map(item => <details key={item.date} className="rounded-2xl border border-[#2f4b42]/10 bg-white p-4 shadow-sm">
          <summary className="min-h-11 cursor-pointer content-center font-bold text-[#18332d]">
            <time dateTime={item.date}>{new Intl.DateTimeFormat(zh ? 'zh-CN' : 'en-NZ', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${item.date}T12:00:00`))}</time>
            <span className="ml-3 inline-block text-xs font-normal text-[#66766f]">{item.hasFile ? (zh ? '已上传' : 'Uploaded') : (zh ? '待上传' : 'Not uploaded')}</span>
          </summary>
          <div className="mt-3 border-t border-[#2f4b42]/10 pt-4">
            <div className="flex flex-wrap items-center gap-3">
              {item.hasFile ? <a href={resolveFileAssetAccessUrl(`${endpoint}/${item.date}/open`)!} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-bold text-[#176b5a]" aria-label={zh ? `查看 ${item.date} 周报` : `View bulletin for ${item.date}`}><FileText className="h-4 w-4" />{zh ? '查看' : 'View'}</a>
                : <AppActionButton disabled>{zh ? '查看' : 'View'}</AppActionButton>}
              {query.data.canManage && <label className={`relative inline-flex min-h-10 items-center gap-2 overflow-hidden rounded-xl bg-[#176b5a] px-4 py-2 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-[#176b5a] focus-within:ring-offset-2 ${busyDate ? 'opacity-50' : 'cursor-pointer'}`}>
                <Upload className="h-4 w-4" />{busyDate === item.date ? (zh ? '正在上传…' : 'Uploading…') : (zh ? '上传' : 'Upload')}
                <input type="file" accept="application/pdf,.pdf" disabled={busyDate !== null} aria-label={zh ? `上传 ${item.date} 周报` : `Upload bulletin for ${item.date}`} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(item.date, file) }} />
              </label>}
            </div>
            <p className="mt-3 text-sm text-[#66766f]">{query.data.canManage ? (zh ? 'PDF，最大 20 MB。同一日期再次上传将替换已有周报。' : 'PDF, up to 20 MB. Uploading again replaces the bulletin for this date.') : !item.hasFile ? (zh ? '本周周报尚未上传。' : 'This bulletin has not been uploaded yet.') : ''}</p>
          </div>
        </details>)}
      </div>
      {!items.length && <AppEmptyState title={zh ? '没有符合条件的周报' : 'No matching bulletins'} description={zh ? '请尝试其他文件状态。' : 'Try another file status.'} />}
      <nav aria-label={zh ? '周报分页' : 'Bulletin pages'} className="mt-4 flex items-center justify-between gap-2">
        <AppActionButton disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton>
        <span className="text-sm">{currentPage} / {pages}</span>
        <AppActionButton disabled={currentPage >= pages} onClick={() => setPage(currentPage + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton>
      </nav>
    </>}
  </AppPageShell>
}
