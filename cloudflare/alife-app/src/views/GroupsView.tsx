import { useEffect, useState } from 'react'
import { Check, ChevronRight, Church, UsersRound } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import AccessTypeBadge from '../components/group/AccessTypeBadge'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { activeEntityService } from '../services/activeEntityService'
import { groupService } from '../services/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import { useActiveEntityIds } from '../hooks/useActiveEntityIds'
import type { GroupSummaryDto, PageDetailDto } from '../types'
import { localizeText } from '../utils/localizedText'

const fallbackGroupImages = [
  '/media/alife-groups.jpg',
  '/media/alife-visit.jpg',
  '/media/alife-church-community-hero.jpg',
  '/media/alife-message-poster.jpg',
]

const readSectionImage = (page: PageDetailDto) => {
  for (const section of page.sections ?? []) {
    const content = section.contentJson ?? {}
    const mediaValue = content.media && typeof content.media === 'object' && !Array.isArray(content.media)
      ? content.media as Record<string, unknown>
      : null
    const candidate =
      content.backgroundImageUrl ||
      content.backgroundImage ||
      content.imageUrl ||
      mediaValue?.url
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return ''
}

const GroupsView = () => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const { groupId: activeGroupId } = useActiveEntityIds()
  const [groups, setGroups] = useState<GroupSummaryDto[]>([])
  const [groupImages, setGroupImages] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const language = auth.language

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    groupService.getVisibleGroups()
      .then((data) => {
        if (cancelled) return
        setGroups(data)
        setLoading(false)
        // Load images in background — cards already visible with fallback images
        Promise.all(data.slice(0, 12).map(async (group, index) => {
          let imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
          try {
            const pages = await groupService.getGroupPages(group.id)
            const firstPage = pages[0]
            if (firstPage?.id) {
              const page = await pageService.getPageById(firstPage.id)
              imageUrl = readSectionImage(page) || imageUrl
            }
          } catch {
            imageUrl = fallbackGroupImages[index % fallbackGroupImages.length]
          }
          return [group.id, imageUrl] as const
        })).then((entries) => {
          if (!cancelled) setGroupImages(Object.fromEntries(entries))
        }).catch(() => {})
      })
      .catch(() => {
        if (!cancelled) {
          setError(language === 'zh' ? '无法加载小组列表。' : 'Unable to load groups.')
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [language])

  const openGroup = (group: GroupSummaryDto) => {
    const membership = auth.memberships.find((item) => item.groupId === group.id)
    activeEntityService.setGroup(group.id, { clearPage: true })
    navigate(membership?.status === 'approved' || group.isChurch ? '/groups' : '/groups/join')
  }

  return (
    <AppPageShell>
      <section className="overflow-hidden rounded-[2rem] border border-emerald-100 bg-gradient-to-br from-white via-emerald-50 to-[#fff4ea] px-6 py-7 text-[#18332d] shadow-[0_20px_55px_rgba(23,107,90,0.08)] sm:px-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
          {language === 'zh' ? '工作区选择' : 'Workspace selection'}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">
          {language === 'zh' ? '选择或切换小组' : 'Select or switch group'}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5f716a]">
          {language === 'zh'
            ? '已加入的小组可以直接打开；其他小组会进入申请加入流程。'
            : 'Open joined groups immediately. Other groups continue through the existing join workflow.'}
        </p>
      </section>

      {error ? <AppEmptyState title={language === 'zh' ? '加载失败' : 'Unable to load'} description={error} /> : null}

      {!error && loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="overflow-hidden rounded-[1.75rem] border border-emerald-100 bg-white p-5">
              <div className="-m-2 mb-4 h-36 animate-pulse rounded-[1.35rem] bg-emerald-100/60" />
              <div className="h-5 w-3/5 animate-pulse rounded-lg bg-emerald-100/50" />
              <div className="mt-3 h-4 w-4/5 animate-pulse rounded-lg bg-emerald-50/80" />
              <div className="mt-5 h-4 w-2/5 animate-pulse rounded-lg bg-emerald-50/60" />
            </div>
          ))}
        </div>
      ) : null}

      {!error && !loading && groups.length === 0 ? (
        <AppEmptyState
          title={language === 'zh' ? '暂时没有可用小组' : 'No groups available'}
          description={language === 'zh' ? '小组创建后会显示在这里。' : 'Groups will appear here when available.'}
        />
      ) : null}

      {!error && !loading && groups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((group) => {
            const membership = auth.memberships.find((item) => item.groupId === group.id)
            const approved = membership?.status === 'approved'
            const active = activeGroupId === group.id
            const Icon = group.isChurch ? Church : UsersRound
            const action = active
              ? (language === 'zh' ? '当前工作区' : 'Current workspace')
              : approved || group.isChurch
                ? (language === 'zh' ? '切换到此小组' : 'Switch to this group')
                : membership?.status === 'requested'
                  ? (language === 'zh' ? '查看申请状态' : 'View request status')
                  : membership?.status === 'invited'
                    ? (language === 'zh' ? '查看邀请' : 'Review invitation')
                    : (language === 'zh' ? '申请加入' : 'Apply to join')

            return (
              <button
                key={group.id}
                type="button"
                className={[
                  'group alife-panel w-full rounded-[1.75rem] p-5 text-left transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(24,51,45,0.12)]',
                  active ? 'ring-2 ring-[#176b5a]/35' : '',
                ].join(' ')}
                onClick={() => openGroup(group)}
              >
                <div className="relative -m-2 mb-4 h-36 overflow-hidden rounded-[1.35rem] bg-emerald-100">
                  <img src={groupImages[group.id] || fallbackGroupImages[0]} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/58 via-emerald-950/8 to-transparent" />
                  <span className="absolute left-4 top-4 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/88 text-[#176b5a] shadow-sm">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="absolute right-4 top-4 flex flex-wrap justify-end gap-2">
                    <AccessTypeBadge accessType={group.accessType} />
                    {approved ? <AppBadge variant="success">{language === 'zh' ? '已加入' : 'Joined'}</AppBadge> : null}
                    {membership?.status === 'requested' ? <AppBadge variant="warning">{language === 'zh' ? '申请中' : 'Requested'}</AppBadge> : null}
                  </span>
                </div>
                <h2 className="mt-5 text-lg font-bold text-[#18332d]">{localizeText(group.name, language)}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 text-[#66766f]">
                  {localizeText(group.description, language) || (language === 'zh' ? '打开此小组查看页面、活动与成员内容。' : 'Open this group for pages, events, and member content.')}
                </p>
                <span className="mt-5 flex items-center justify-between text-sm font-bold text-[#176b5a]">
                  <span className="inline-flex items-center gap-2">
                    {active ? <Check className="h-4 w-4" /> : null}
                    {action}
                  </span>
                  <ChevronRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
    </AppPageShell>
  )
}

export default GroupsView
