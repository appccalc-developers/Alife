import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Upload } from 'lucide-react'
import { churchQueryKey } from '../../db/collections/groupCollection'
import { groupService } from '../../services/groupService'
import { normalizeApiError } from '../../services/http'
import { resolveFileAssetAccessUrl } from '../../services/fileAssetService'
import { sundayBulletinEndpoint, sundayBulletinService } from '../../services/sundayBulletinService'
import { useAuthStore } from '../../stores/auth'
import { bulletinDateForSermon } from '../../utils/sermonPresentation'

export const useSermonBulletins = (sermonDates: (string | null | undefined)[]) => {
  const auth = useAuthStore()
  const client = useQueryClient()
  const churchQuery = useQuery({ queryKey: churchQueryKey, queryFn: groupService.getChurch,
    enabled: !auth.isGuest && auth.isRegistered, staleTime: 5 * 60_000 })
  const churchId = churchQuery.data?.id
  const canRead = Boolean(!auth.loading && !auth.isGuest && auth.isRegistered && churchId &&
    (auth.hasLeaderAccess(churchId) || auth.memberships.some(item => item.groupId === churchId && item.status === 'approved')))
  const dates = [...new Set(sermonDates.map(date => bulletinDateForSermon(date)).filter((date): date is string => Boolean(date)))].sort()
  const query = useQuery({
    queryKey: ['sunday-bulletins', auth.me?.id, dates],
    queryFn: () => sundayBulletinService.list(dates),
    enabled: canRead && dates.length > 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  })
  const uploading = useRef(false)
  const [busyDate, setBusyDate] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ date: string; code: 'invalid' | 'uploaded' | 'denied' | 'unavailable' | 'failed'; error: boolean } | null>(null)
  const upload = async (date: string, file: File) => {
    if (uploading.current) return
    setNotice(null)
    if (!file.name.toLowerCase().endsWith('.pdf') || file.size > 20 * 1024 * 1024 || file.size < 5) {
      setNotice({ date, code: 'invalid', error: true })
      return
    }
    uploading.current = true
    setBusyDate(date)
    try {
      await sundayBulletinService.upload(date, file)
      await client.invalidateQueries({ queryKey: ['sunday-bulletins', auth.me?.id] })
      setNotice({ date, code: 'uploaded', error: false })
    } catch (error) {
      const status = normalizeApiError(error).status
      setNotice({ date, code: status === 403 ? 'denied' : status === 503 ? 'unavailable' : 'failed', error: true })
    } finally {
      uploading.current = false
      setBusyDate(null)
    }
  }
  return { canRead, query, busyDate, notice, upload }
}

const SermonBulletinActions = ({ date, bulletins }: { date: string | null | undefined; bulletins: ReturnType<typeof useSermonBulletins> }) => {
  const { language } = useAuthStore()
  const zh = language === 'zh'
  if (!bulletins.canRead) return null
  const bulletinDate = bulletinDateForSermon(date)
  const { query, busyDate, notice, upload } = bulletins
  const item = query.data?.items.find(item => item.date === bulletinDate)
  const canManage = Boolean(bulletinDate && item && !query.isError && query.data?.canManage)
  const messages = {
    invalid: zh ? '请选择不超过 20 MB 的 PDF 文件。' : 'Choose a PDF file up to 20 MB.',
    uploaded: zh ? '周报上传成功。' : 'Bulletin uploaded.',
    denied: zh ? '你没有上传周报的权限。' : 'You do not have permission to upload bulletins.',
    unavailable: zh ? '周报存储暂时不可用，请联系教会管理员检查存储配置。' : 'Bulletin storage is unavailable. Please contact a church administrator.',
    failed: zh ? '上传失败，请检查 PDF 后重试。' : 'Upload failed. Check the PDF and try again.',
  }
  return <footer className="mt-auto flex flex-col items-end gap-2 px-4 pb-4 pt-2">
    <div className="flex flex-wrap justify-end gap-2">
      {bulletinDate && !query.isError && item?.hasFile ? <a
        href={resolveFileAssetAccessUrl(`${sundayBulletinEndpoint}/${bulletinDate}/open`)!}
        target="_blank" rel="noopener noreferrer"
        aria-label={zh ? `查看 ${bulletinDate} 主日周报` : `View Sunday bulletin for ${bulletinDate}`}
        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-[#176b5a] hover:bg-[#e3f0eb] focus-visible:outline focus-visible:outline-2"
      ><FileText className="h-4 w-4" aria-hidden="true" />{zh ? '主日周报' : 'Sunday bulletin'}</a>
        : <button type="button" disabled className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm text-[#66766f] disabled:opacity-70">
          <FileText className="h-4 w-4" aria-hidden="true" />{!bulletinDate ? (zh ? '无对应主日周报' : 'No matching Sunday bulletin') : query.isError ? (zh ? '周报暂不可用' : 'Bulletin unavailable') : query.isPending ? (zh ? '正在加载周报…' : 'Loading bulletin…') : (zh ? '周报待上传' : 'Bulletin not uploaded')}
        </button>}
      {canManage && <label className={`relative inline-flex min-h-10 items-center gap-1.5 overflow-hidden rounded-lg bg-[#176b5a] px-3 text-sm font-bold text-white focus-within:ring-2 focus-within:ring-[#176b5a] focus-within:ring-offset-2 ${busyDate ? 'opacity-50' : 'cursor-pointer'}`}>
        <Upload className="h-4 w-4" aria-hidden="true" />{busyDate === bulletinDate ? (zh ? '正在上传…' : 'Uploading…') : (zh ? '上传周报' : 'Upload bulletin')}
        <input type="file" accept="application/pdf,.pdf" disabled={busyDate !== null}
          aria-label={zh ? `上传 ${bulletinDate} 周报 PDF` : `Upload bulletin PDF for ${bulletinDate}`}
          title={zh ? 'PDF，最大 20 MB。再次上传将替换这一天的周报。' : 'PDF, up to 20 MB. Uploading again replaces this date’s bulletin.'}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file && bulletinDate) void upload(bulletinDate, file) }} />
      </label>}
      {bulletinDate && query.isError && <button type="button" className="min-h-10 px-2 text-sm font-bold text-[#176b5a]" onClick={() => void query.refetch()}>{zh ? '重试' : 'Retry'}</button>}
    </div>
    {notice?.date === bulletinDate && <p role={notice.error ? 'alert' : 'status'} className={`text-sm ${notice.error ? 'text-rose-700' : 'text-[#176b5a]'}`}>{messages[notice.code]}</p>}
  </footer>
}

export default SermonBulletinActions
