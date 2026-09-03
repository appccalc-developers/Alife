import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, BellRing, BookOpen, Pencil, ShieldCheck, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppTitleBarAction from '../components/layout/AppTitleBarAction'
import { useCurrentTasks } from '../hooks/useCurrentTasks'
import { bibleReadingProgressService } from '../services/bibleReadingProgressService'
import { useAuthStore } from '../stores/auth'
import { bibleBooks } from '../utils/bibleBooks'
import { normalizeReadingPosition, readSavedReadingPosition } from '../utils/bibleReadingProgress'
import { countCurrentTasks, formatNotificationDate, localizeNotificationText } from '../utils/currentTasks'
import { getPersonalCenterPrimaryAction, selectPersonalCenterTasks } from '../utils/personalCenter'
import { localizeText } from '../utils/localizedText'

const PersonalCenterView = () => {
  const auth = useAuthStore()
  const me = auth.me
  const zh = auth.language === 'zh'
  const tasksQuery = useCurrentTasks()
  const tasks = tasksQuery.data ?? []
  const counts = countCurrentTasks(tasks)
  const overviewTasks = selectPersonalCenterTasks(tasks)
  const localProgress = useMemo(
    () => me?.id ? readSavedReadingPosition(me.id) : null,
    [me?.id],
  )
  const progressQuery = useQuery({
    queryKey: ['personal-center', 'bible-reading-progress', me?.id ?? ''],
    queryFn: bibleReadingProgressService.get,
    enabled: Boolean(me?.id && !auth.isGuest),
    retry: false,
    staleTime: 30_000,
  })
  const remoteProgress = progressQuery.data ? normalizeReadingPosition(progressQuery.data) : null
  const readingProgress = localProgress && (!remoteProgress || Date.parse(localProgress.updatedUtc) > Date.parse(remoteProgress.updatedUtc))
    ? localProgress
    : remoteProgress
  const readingBook = readingProgress ? bibleBooks.find((book) => book.id === readingProgress.book) : null
  const invitations = me?.memberships.filter((membership) => membership.status === 'invited') ?? []
  const primary = getPersonalCenterPrimaryAction({
    urgentCount: counts.urgent,
    generalCount: counts.general,
    hasReadingProgress: Boolean(readingProgress),
  })
  const studyPath = readingProgress
    ? `/study?book=${encodeURIComponent(readingProgress.book)}&chapter=${readingProgress.chapter}&lang=${readingProgress.language}${readingProgress.zhVersion ? `&zhVersion=${encodeURIComponent(readingProgress.zhVersion)}` : ''}${readingProgress.enVersion ? `&enVersion=${encodeURIComponent(readingProgress.enVersion)}` : ''}`
    : '/study'
  const primaryAction = primary === 'urgent'
    ? { label: zh ? '处理紧要事务' : 'Handle urgent tasks', to: '/tasks?type=urgent', icon: <AlertCircle className="h-4 w-4" /> }
    : primary === 'general'
      ? { label: zh ? '查看一般通知' : 'Review notifications', to: '/tasks?type=general', icon: <BellRing className="h-4 w-4" /> }
      : primary === 'continue-study'
        ? { label: zh ? '继续查经' : 'Continue study', to: studyPath, icon: <BookOpen className="h-4 w-4" /> }
        : { label: zh ? '开始查经' : 'Start Bible study', to: '/study', icon: <BookOpen className="h-4 w-4" /> }

  if (!me) {
    return <AppPageShell title={zh ? '个人中心' : 'Personal Center'} context={zh ? '个人中心 / 总览' : 'Personal Center / Overview'}><AppEmptyState title={zh ? '正在载入账号' : 'Loading account'} description={zh ? '请稍候。' : 'Please wait.'} /></AppPageShell>
  }

  return (
    <AppPageShell
      title={me.displayName || (zh ? '个人中心' : 'Personal Center')}
      context={zh ? '个人中心 / 总览' : 'Personal Center / Overview'}
      subtitle={zh ? '把当前事务、查经进度和需要留意的账号事项集中在一处。' : 'Your tasks, Bible progress, and account attention items in one place.'}
      status={<AppBadge variant={me.isRegistered ? 'success' : 'neutral'}>{me.isRegistered ? (zh ? '已注册成员' : 'Registered member') : (zh ? '访客' : 'Guest')}</AppBadge>}
      primaryAction={<AppTitleBarAction label={primaryAction.label} to={primaryAction.to} icon={primaryAction.icon} />}
      overflowLabel={zh ? '更多操作' : 'More actions'}
      overflowActions={[{
        label: zh ? '编辑个人资料' : 'Edit profile',
        icon: <Pencil className="h-4 w-4" />,
        to: '/profile/settings',
      }]}
    >
      <section aria-labelledby="personal-tasks-heading">
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#176b5a]">{zh ? '现在要做' : 'Up next'}</p>
            <h2 id="personal-tasks-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{zh ? '当前事务' : 'Current tasks'}</h2>
          </div>
          <Link to="/tasks" className="inline-flex items-center gap-1 text-xs font-black text-[#176b5a] hover:text-[#0d4f43]">{zh ? '查看全部' : 'View all'}<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {tasksQuery.isLoading ? (
          <div className="rounded-[1.5rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] px-5 py-8 text-sm font-semibold text-[#60716a]">{zh ? '正在整理当前事务…' : 'Preparing your current tasks…'}</div>
        ) : tasksQuery.isError ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">{zh ? '暂时无法加载事务；你仍可打开当前事务页重试。' : 'Tasks could not be loaded. Open Current tasks to try again.'}</div>
        ) : overviewTasks.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {overviewTasks.map((task) => {
              const urgent = task.category === 'urgent'
              const title = localizeNotificationText(task.title, auth.language) || (urgent ? (zh ? '紧要事务' : 'Urgent task') : (zh ? '一般通知' : 'Notification'))
              const body = localizeNotificationText(task.body, auth.language)
              return (
                <Link key={task.id} to={`/tasks?type=${urgent ? 'urgent' : 'general'}`} className="group relative min-h-40 overflow-hidden rounded-[1.4rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] p-5 shadow-[var(--alife-shadow-soft)] transition hover:-translate-y-0.5 hover:border-[#9fc3b5]">
                  <span className={['absolute inset-y-0 left-0 w-1.5', urgent ? 'bg-[#f08b72]' : 'bg-[#1f6756]'].join(' ')} aria-hidden="true" />
                  <div className="flex items-center justify-between gap-3 pl-1">
                    <AppBadge variant={urgent ? 'danger' : 'info'}>{urgent ? (zh ? '紧要' : 'Urgent') : (zh ? '一般' : 'General')}</AppBadge>
                    <ArrowRight className="h-4 w-4 text-[#91a099] transition group-hover:translate-x-0.5 group-hover:text-[#176b5a]" />
                  </div>
                  <h3 className="mt-4 line-clamp-2 pl-1 text-base font-black leading-6 text-[#18332d]">{title}</h3>
                  {body ? <p className="mt-2 line-clamp-2 pl-1 text-xs leading-5 text-[#718079]">{body}</p> : null}
                  <p className="mt-3 pl-1 text-[11px] font-semibold text-[#8a9792]">{formatNotificationDate(task.createdUtc, auth.language)}</p>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[#cbdad3] bg-white/70 px-6 py-8 text-center">
            <BellRing className="mx-auto h-8 w-8 text-[#176b5a]" />
            <p className="mt-3 text-sm font-black text-[#18332d]">{zh ? '目前没有待处理事务' : 'Nothing needs your attention'}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="reading-progress-heading" className="overflow-hidden rounded-[1.6rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] shadow-[var(--alife-shadow-soft)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dceee7] text-[#176b5a]"><BookOpen className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#176b5a]">{zh ? '查经进度' : 'Bible progress'}</p>
              <h2 id="reading-progress-heading" className="mt-1 text-xl font-black text-[#18332d]">
                {readingProgress && readingBook
                  ? `${zh ? readingBook.zh : readingBook.en} ${readingProgress.chapter}`
                  : (zh ? '从一段经文开始' : 'Begin with a passage')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#60716a]">{readingProgress
                ? (zh ? '已同步你最近阅读的位置，离线时也会保留在此设备。' : 'Your latest reading position is synced and remains available offline on this device.')
                : (zh ? '选择经卷和章节，建立你的阅读进度。' : 'Choose a book and chapter to establish your reading progress.')}</p>
            </div>
          </div>
          <Link to={studyPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b9cec5] bg-white px-4 text-sm font-black text-[#176b5a] transition hover:bg-[#edf5f1]">{readingProgress ? (zh ? '继续阅读' : 'Continue reading') : (zh ? '打开查经' : 'Open Bible study')}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {me.needsPasskey || invitations.length ? (
        <section aria-labelledby="account-attention-heading">
          <div className="mb-4 px-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#a7553d]">{zh ? '需要留意' : 'Needs attention'}</p>
            <h2 id="account-attention-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{zh ? '账号与邀请' : 'Account and invitations'}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {me.needsPasskey ? (
              <Link to="/profile/settings" className="flex min-h-36 items-start gap-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-5 transition hover:-translate-y-0.5 hover:border-amber-300">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><ShieldCheck className="h-5 w-5" /></span>
                <div><h3 className="font-black text-amber-950">{zh ? '添加 Passkey' : 'Add a passkey'}</h3><p className="mt-2 text-xs leading-5 text-amber-800">{zh ? '为账号建立主要登录方式。' : 'Set up the primary sign-in method for your account.'}</p></div>
              </Link>
            ) : null}
            {invitations.map((membership) => (
              <Link key={membership.groupId} to="/profile/settings" className="flex min-h-36 items-start gap-4 rounded-[1.4rem] border border-[#c7ddd4] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#91b9aa]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dceee7] text-[#176b5a]"><UsersRound className="h-5 w-5" /></span>
                <div><h3 className="font-black text-[#18332d]">{localizeText(membership.groupName, auth.language) || (zh ? '小组邀请' : 'Group invitation')}</h3><p className="mt-2 text-xs leading-5 text-[#60716a]">{zh ? '接受或拒绝这项小组邀请。' : 'Accept or decline this group invitation.'}</p></div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AppPageShell>
  )
}

export default PersonalCenterView
