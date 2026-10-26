import { personalCenterViewText } from '../i18n/personalCenterView.ts'
import { withDutyReturn } from '../utils/eventDutyNavigation'
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
import { countCurrentTasks, formatNotificationDate, localizeNotificationText, normalizeNotificationActionUrl } from '../utils/currentTasks'
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
    queryFn: ({ signal }) => bibleReadingProgressService.get(signal),
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
    ? { label: zh ? personalCenterViewText.handleUrgentTasks.zh : personalCenterViewText.handleUrgentTasks.en, to: '/tasks?type=urgent', icon: <AlertCircle className="h-4 w-4" /> }
    : primary === 'general'
      ? { label: zh ? personalCenterViewText.reviewNotifications.zh : personalCenterViewText.reviewNotifications.en, to: '/tasks?type=general', icon: <BellRing className="h-4 w-4" /> }
      : primary === 'continue-study'
        ? { label: zh ? personalCenterViewText.continueStudy.zh : personalCenterViewText.continueStudy.en, to: studyPath, icon: <BookOpen className="h-4 w-4" /> }
        : { label: zh ? personalCenterViewText.startBibleStudy.zh : personalCenterViewText.startBibleStudy.en, to: '/study', icon: <BookOpen className="h-4 w-4" /> }

  if (!me) {
    return <AppPageShell title={zh ? personalCenterViewText.personalCenter.zh : personalCenterViewText.personalCenter.en} context={zh ? personalCenterViewText.personalCenterOverview.zh : personalCenterViewText.personalCenterOverview.en}><AppEmptyState title={zh ? personalCenterViewText.loadingAccount.zh : personalCenterViewText.loadingAccount.en} description={zh ? personalCenterViewText.pleaseWait.zh : personalCenterViewText.pleaseWait.en} /></AppPageShell>
  }

  return (
    <AppPageShell
      title={me.displayName || (zh ? personalCenterViewText.personalCenter2.zh : personalCenterViewText.personalCenter2.en)}
      context={zh ? personalCenterViewText.personalCenterOverview2.zh : personalCenterViewText.personalCenterOverview2.en}
      subtitle={zh ? personalCenterViewText.yourTasksBibleProgressAndAccountAttentionItemsIn.zh : personalCenterViewText.yourTasksBibleProgressAndAccountAttentionItemsIn.en}
      status={<AppBadge variant={me.isRegistered ? 'success' : 'neutral'}>{me.isRegistered ? (zh ? personalCenterViewText.registeredMember.zh : personalCenterViewText.registeredMember.en) : (zh ? personalCenterViewText.guest.zh : personalCenterViewText.guest.en)}</AppBadge>}
      primaryAction={<AppTitleBarAction label={primaryAction.label} to={primaryAction.to} icon={primaryAction.icon} />}
      overflowLabel={zh ? personalCenterViewText.moreActions.zh : personalCenterViewText.moreActions.en}
      overflowActions={[{
        label: zh ? personalCenterViewText.editProfile.zh : personalCenterViewText.editProfile.en,
        icon: <Pencil className="h-4 w-4" />,
        to: '/profile/settings',
      }]}
    >
      <Link to="/event-work" className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border border-[#176b5a]/20 bg-[#e3f0eb] p-5 font-semibold text-[#176b5a]">
        <span>{zh ? personalCenterViewText.myEventWork.zh : personalCenterViewText.myEventWork.en}<span className="mt-1 block text-xs font-normal">{zh ? personalCenterViewText.preparationRegistrationDeliveryAndFollowUpOngoingAccessTo.zh : personalCenterViewText.preparationRegistrationDeliveryAndFollowUpOngoingAccessTo.en}</span></span><ArrowRight className="h-5 w-5 shrink-0" />
      </Link>
      <section aria-labelledby="personal-tasks-heading">
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <div>
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#176b5a]">{zh ? personalCenterViewText.upNext.zh : personalCenterViewText.upNext.en}</p>
            <h2 id="personal-tasks-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{zh ? personalCenterViewText.currentTasks.zh : personalCenterViewText.currentTasks.en}</h2>
          </div>
          <Link to="/tasks" className="inline-flex items-center gap-1 text-xs font-black text-[#176b5a] hover:text-[#0d4f43]">{zh ? personalCenterViewText.viewAll.zh : personalCenterViewText.viewAll.en}<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
        {tasksQuery.isLoading ? (
          <div className="rounded-[1.5rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] px-5 py-8 text-sm font-semibold text-[#60716a]">{zh ? personalCenterViewText.preparingYourCurrentTasks.zh : personalCenterViewText.preparingYourCurrentTasks.en}</div>
        ) : tasksQuery.isError ? (
          <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-5 text-sm text-amber-900">{zh ? personalCenterViewText.tasksCouldNotBeLoadedOpenCurrentTasksTo.zh : personalCenterViewText.tasksCouldNotBeLoadedOpenCurrentTasksTo.en}</div>
        ) : overviewTasks.length ? (
          <div className="grid gap-3 lg:grid-cols-3">
            {overviewTasks.map((task) => {
              const urgent = task.category === 'urgent'
              const duty = task.completionMode === 'workflow'
              const title = localizeNotificationText(task.title, auth.language) || (urgent ? (zh ? personalCenterViewText.urgentTask.zh : personalCenterViewText.urgentTask.en) : (zh ? personalCenterViewText.notification.zh : personalCenterViewText.notification.en))
              const body = localizeNotificationText(task.body, auth.language)
              const destination = duty && task.actionUrl
                ? withDutyReturn(normalizeNotificationActionUrl(task.actionUrl), '/profile')
                : `/tasks?type=${urgent ? 'urgent' : 'general'}`
              return (
                <Link key={task.taskKey ?? task.id} to={destination} className="group relative min-h-40 overflow-hidden rounded-[1.4rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] p-5 shadow-[var(--alife-shadow-soft)] transition hover:-translate-y-0.5 hover:border-[#9fc3b5]">
                  <span className={['absolute inset-y-0 left-0 w-1.5', urgent ? 'bg-[#f08b72]' : 'bg-[#1f6756]'].join(' ')} aria-hidden="true" />
                  <div className="flex items-center justify-between gap-3 pl-1">
                    <AppBadge variant={urgent ? 'danger' : 'info'}>{duty ? (zh ? personalCenterViewText.duty.zh : personalCenterViewText.duty.en) : urgent ? (zh ? personalCenterViewText.urgent.zh : personalCenterViewText.urgent.en) : (zh ? personalCenterViewText.general.zh : personalCenterViewText.general.en)}</AppBadge>
                    <ArrowRight className="h-4 w-4 text-[#91a099] transition group-hover:translate-x-0.5 group-hover:text-[#176b5a]" />
                  </div>
                  <h3 className="mt-4 line-clamp-2 pl-1 text-base font-black leading-6 text-[#18332d]">{title}</h3>
                  {task.occurrenceId ? <p className="mt-2 pl-1 text-xs text-[#60716a]">{zh ? personalCenterViewText.occurrence.zh : personalCenterViewText.occurrence.en} · {task.occurrenceId.slice(0, 8)}</p> : null}
                  {task.dueUtc ? <p className={`mt-2 pl-1 text-xs font-semibold ${new Date(task.dueUtc).getTime() < Date.now() ? 'text-red-700' : 'text-[#60716a]'}`}>{new Date(task.dueUtc).getTime() < Date.now() ? (zh ? personalCenterViewText.overdue.zh : personalCenterViewText.overdue.en) : (zh ? personalCenterViewText.due.zh : personalCenterViewText.due.en)}{formatNotificationDate(task.dueUtc, auth.language)}</p> : null}
                  {body ? <p className="mt-2 line-clamp-2 pl-1 text-xs leading-5 text-[#718079]">{body}</p> : null}
                  <p className="mt-3 pl-1 text-[11px] font-semibold text-[#8a9792]">{formatNotificationDate(task.createdUtc, auth.language)}</p>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-[#cbdad3] bg-white/70 px-6 py-8 text-center">
            <BellRing className="mx-auto h-8 w-8 text-[#176b5a]" />
            <p className="mt-3 text-sm font-black text-[#18332d]">{zh ? personalCenterViewText.nothingNeedsYourAttention.zh : personalCenterViewText.nothingNeedsYourAttention.en}</p>
          </div>
        )}
      </section>

      <section aria-labelledby="reading-progress-heading" className="overflow-hidden rounded-[1.6rem] border border-[var(--alife-line)] bg-[var(--alife-surface-strong)] shadow-[var(--alife-shadow-soft)]">
        <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#dceee7] text-[#176b5a]"><BookOpen className="h-6 w-6" /></span>
            <div className="min-w-0">
              <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#176b5a]">{zh ? personalCenterViewText.bibleProgress.zh : personalCenterViewText.bibleProgress.en}</p>
              <h2 id="reading-progress-heading" className="mt-1 text-xl font-black text-[#18332d]">
                {readingProgress && readingBook
                  ? `${zh ? readingBook.zh : readingBook.en} ${readingProgress.chapter}`
                  : (zh ? personalCenterViewText.beginWithAPassage.zh : personalCenterViewText.beginWithAPassage.en)}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#60716a]">{readingProgress
                ? (zh ? personalCenterViewText.yourLatestReadingPositionIsSyncedAndRemainsAvailable.zh : personalCenterViewText.yourLatestReadingPositionIsSyncedAndRemainsAvailable.en)
                : (zh ? personalCenterViewText.chooseABookAndChapterToEstablishYourReading.zh : personalCenterViewText.chooseABookAndChapterToEstablishYourReading.en)}</p>
            </div>
          </div>
          <Link to={studyPath} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#b9cec5] bg-white px-4 text-sm font-black text-[#176b5a] transition hover:bg-[#edf5f1]">{readingProgress ? (zh ? personalCenterViewText.continueReading.zh : personalCenterViewText.continueReading.en) : (zh ? personalCenterViewText.openBibleStudy.zh : personalCenterViewText.openBibleStudy.en)}<ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {me.needsPasskey || invitations.length ? (
        <section aria-labelledby="account-attention-heading">
          <div className="mb-4 px-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-[#a7553d]">{zh ? personalCenterViewText.needsAttention.zh : personalCenterViewText.needsAttention.en}</p>
            <h2 id="account-attention-heading" className="mt-1 text-2xl font-black tracking-[-0.035em] text-[#18332d]">{zh ? personalCenterViewText.accountAndInvitations.zh : personalCenterViewText.accountAndInvitations.en}</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {me.needsPasskey ? (
              <Link to="/profile/settings" className="flex min-h-36 items-start gap-4 rounded-[1.4rem] border border-amber-200 bg-amber-50 p-5 transition hover:-translate-y-0.5 hover:border-amber-300">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-amber-700"><ShieldCheck className="h-5 w-5" /></span>
                <div><h3 className="font-black text-amber-950">{zh ? personalCenterViewText.addAPasskey.zh : personalCenterViewText.addAPasskey.en}</h3><p className="mt-2 text-xs leading-5 text-amber-800">{zh ? personalCenterViewText.setUpThePrimarySignInMethodForYour.zh : personalCenterViewText.setUpThePrimarySignInMethodForYour.en}</p></div>
              </Link>
            ) : null}
            {invitations.map((membership) => (
              <Link key={membership.groupId} to="/profile/settings" className="flex min-h-36 items-start gap-4 rounded-[1.4rem] border border-[#c7ddd4] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#91b9aa]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#dceee7] text-[#176b5a]"><UsersRound className="h-5 w-5" /></span>
                <div><h3 className="font-black text-[#18332d]">{localizeText(membership.groupName, auth.language) || (zh ? personalCenterViewText.groupInvitation.zh : personalCenterViewText.groupInvitation.en)}</h3><p className="mt-2 text-xs leading-5 text-[#60716a]">{zh ? personalCenterViewText.acceptOrDeclineThisGroupInvitation.zh : personalCenterViewText.acceptOrDeclineThisGroupInvitation.en}</p></div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </AppPageShell>
  )
}

export default PersonalCenterView
