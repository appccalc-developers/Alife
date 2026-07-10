import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import type { MouseEvent } from 'react'
import type { GroupSummaryDto } from '../../types'
import AccessTypeBadge from '../../components/group/AccessTypeBadge'
import { useAuthStore } from '../../stores/auth'
import { useUiText } from '../../i18n/uiText'
import { localizeText } from '../../utils/localizedText'
import { confirmUnsavedChangesNavigation } from '../../utils/unsavedChangesGuard'
import { CloseIcon } from '../navigation/icons'

type Props = {
  currentGroup?: GroupSummaryDto | null
  churchGroup?: GroupSummaryDto | null
  items: GroupSummaryDto[]
  open: boolean
  onClose: () => void
  onOpenGroup: (groupId: string) => void
  onOpenSubgroup: (subgroupId: string) => void
}

const GroupDrawer = ({ currentGroup, churchGroup, items, open, onClose, onOpenGroup, onOpenSubgroup }: Props) => {
  const auth = useAuthStore()
  const navigate = useNavigate()
  const t = useUiText()
  const currentGroupName = localizeText(currentGroup?.name, auth.language) || t('group')
  const guardLinkNavigation = (event: MouseEvent<HTMLAnchorElement>, target: string) => {
    if (!confirmUnsavedChangesNavigation(target, () => {
      onClose()
      navigate(target)
    })) {
      event.preventDefault()
      return false
    }

    return true
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.25 }}
        className={['fixed inset-0 z-40 bg-emerald-950/25 backdrop-blur-[2px]', open ? 'pointer-events-auto' : 'pointer-events-none'].join(' ')}
        aria-hidden="true"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: open ? 0 : '100%' }}
        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-[#2f4b42]/10 bg-[#fffdf8] shadow-2xl sm:top-[4.5rem] sm:rounded-tl-[2rem]"
        aria-label={t('subgroupMenu')}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#2f4b42]/10 px-5 py-5">
          <div className="min-w-0">
            <p className="text-base font-semibold text-[#18332d]">{t('subgroupMenu')}</p>
            <p className="mt-1 truncate text-xs text-[#73817b]">{currentGroupName}</p>
          </div>
          <button type="button" className="alife-icon-button h-9 w-9" aria-label={t('close')} title={t('close')} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <Link
            to="/groups/select"
            className="mb-3 flex w-full items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-900 shadow-[0_10px_24px_rgba(23,107,90,0.08)] transition hover:bg-emerald-100"
            onClick={(event) => {
              if (guardLinkNavigation(event, '/groups/select')) {
                onClose()
              }
            }}
          >
            <span>{auth.language === 'zh' ? '选择或切换小组' : 'Select or switch group'}</span>
            <span aria-hidden="true">→</span>
          </Link>

          {currentGroup?.parentGroupId ? (
            <div className="mb-3 space-y-2 border-b border-slate-200 pb-3">
              <button type="button" className="w-full rounded-2xl border border-[#2f4b42]/10 bg-[#f0ece2]/70 px-4 py-3 text-left text-sm font-semibold text-[#18332d] transition hover:bg-[#e3f0eb]" onClick={() => onOpenGroup(currentGroup.parentGroupId!)}>
                {t('backToParentGroup')}
              </button>
              {churchGroup ? (
                <button type="button" className="w-full rounded-2xl border border-[#2f4b42]/10 bg-[#f0ece2]/70 px-4 py-3 text-left text-sm font-semibold text-[#18332d] transition hover:bg-[#e3f0eb]" onClick={() => onOpenGroup(churchGroup.id)}>
                  {t('backToChurch')}
                </button>
              ) : null}
            </div>
          ) : null}

          {items.length === 0 ? (
            <p className="rounded-2xl bg-[#f0ece2]/70 px-4 py-3 text-sm text-[#66766f]">{t('noSubgroupsYet')}</p>
          ) : (
            <motion.ul initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }} className="space-y-2">
              {items.map((subgroup) => {
                const membership = auth.memberships.find((item) => item.groupId === subgroup.id)
                const approved = membership?.status === 'approved'
                const status = approved ? t('approved') : membership?.status === 'requested' ? t('requested') : membership?.status === 'invited' ? t('invited') : t('notJoined')

                return (
                  <motion.li key={subgroup.id} variants={{ hidden: { opacity: 0, x: 20 }, visible: { opacity: 1, x: 0 } }}>
                    <motion.button type="button" whileTap={{ scale: 0.97 }} className="w-full rounded-2xl border border-[#2f4b42]/10 bg-white/80 px-4 py-3.5 text-left transition hover:bg-[#e3f0eb]/70" onClick={() => onOpenSubgroup(subgroup.id)}>
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-950">{localizeText(subgroup.name, auth.language)}</span>
                          <span className="mt-1 block text-xs text-slate-500">{approved ? t('openGroup') : t('applyToJoin')}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <AccessTypeBadge accessType={subgroup.accessType} />
                          <span className="text-[11px] font-medium text-slate-500">{status}</span>
                        </span>
                      </span>
                    </motion.button>
                  </motion.li>
                )
              })}
            </motion.ul>
          )}
        </div>
      </motion.aside>
    </>
  )
}

export default GroupDrawer
