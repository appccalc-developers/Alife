import { groupDissolutionPanelText } from '../../i18n/groupDissolutionPanel.ts'
import { useCallback, useEffect, useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'
import { groupService, type GroupDissolutionDto } from '../../services/groupService'

const reasons: Record<string, [string, string]> = {
  church: [groupDissolutionPanelText.theRootChurchCannotBeDissolved.zh, groupDissolutionPanelText.theRootChurchCannotBeDissolved.en],
  members: [groupDissolutionPanelText.otherActiveApprovedMembersRemain.zh, groupDissolutionPanelText.otherActiveApprovedMembersRemain.en],
  subgroups: [groupDissolutionPanelText.childMinistriesOrGroupsRemain.zh, groupDissolutionPanelText.childMinistriesOrGroupsRemain.en],
  pages: [groupDissolutionPanelText.pagesRemainIncludingDrafts.zh, groupDissolutionPanelText.pagesRemainIncludingDrafts.en],
  events: [groupDissolutionPanelText.eventsOrEventSeriesRemain.zh, groupDissolutionPanelText.eventsOrEventSeriesRemain.en],
  albums: [groupDissolutionPanelText.albumsRemain.zh, groupDissolutionPanelText.albumsRemain.en],
  announcements: [groupDissolutionPanelText.announcementsRemain.zh, groupDissolutionPanelText.announcementsRemain.en],
}

type Props = { groupId: string; groupName: string; language: string; beforeDissolve: () => boolean; onDissolved: () => Promise<void> }

export default function GroupDissolutionPanel({ groupId, groupName, language, beforeDissolve, onDissolved }: Props) {
  const zh = language === 'zh'
  const [result, setResult] = useState<GroupDissolutionDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleted, setDeleted] = useState(false)
  const sequence = useRef(0)
  const locked = useRef(false)
  const { requestConfirmation, confirmationModal } = useConfirmation()
  const refresh = useCallback(async () => {
    const request = ++sequence.current
    setLoading(true); setResult(null); setError(false)
    try {
      const next = await groupService.getDissolution(groupId)
      if (request === sequence.current) setResult(next)
    } catch {
      if (request === sequence.current) setError(true)
    } finally {
      if (request === sequence.current) setLoading(false)
    }
  }, [groupId])
  useEffect(() => { void refresh(); return () => { sequence.current++ } }, [refresh])

  const finish = async () => {
    if (locked.current) return
    locked.current = true; setBusy(true)
    try { await onDissolved() } catch { setError(true) } finally { locked.current = false; setBusy(false) }
  }
  const dissolve = async () => {
    if (locked.current || loading || !result?.canDissolve || !beforeDissolve()) return
    locked.current = true; setBusy(true)
    try {
      if (!await requestConfirmation({
        title: zh ? groupDissolutionPanelText.dissolve.zh(groupName) : groupDissolutionPanelText.dissolve.en(groupName),
        description: zh
          ? groupDissolutionPanelText.thisPermanentlyDeletesTheGroupAllItsMembershipsAnd.zh
          : groupDissolutionPanelText.thisPermanentlyDeletesTheGroupAllItsMembershipsAnd.en,
        confirmLabel: zh ? groupDissolutionPanelText.confirmDissolution.zh : groupDissolutionPanelText.confirmDissolution.en, tone: 'danger',
      })) return
      await groupService.dissolveGroup(groupId)
      setDeleted(true)
      await onDissolved()
    } catch { setError(true); setResult(null) }
    finally { locked.current = false; setBusy(false) }
  }

  return <section aria-label={zh ? groupDissolutionPanelText.dissolveGroup.zh : groupDissolutionPanelText.dissolveGroup.en} className="space-y-3 border-t border-rose-200 pt-5">
    <h2 className="text-base font-bold text-[#18332d]">{zh ? groupDissolutionPanelText.dissolveGroup.zh : groupDissolutionPanelText.dissolveGroup.en}</h2>
    <p className="text-sm text-[#66766f]">{zh
      ? groupDissolutionPanelText.anEmptyGroupHasOnlyItsLeaderAsAn.zh
      : groupDissolutionPanelText.anEmptyGroupHasOnlyItsLeaderAsAn.en}</p>
    {deleted ? <>
      <p role="status">{zh ? groupDissolutionPanelText.theGroupHasBeenDissolved.zh : groupDissolutionPanelText.theGroupHasBeenDissolved.en}</p>
      <AppActionButton disabled={busy} onClick={() => void finish()}>{zh ? groupDissolutionPanelText.refreshAndReturnToGroupLife.zh : groupDissolutionPanelText.refreshAndReturnToGroupLife.en}</AppActionButton>
    </> : <>
      {loading && <p role="status">{zh ? groupDissolutionPanelText.checkingDissolutionRequirements.zh : groupDissolutionPanelText.checkingDissolutionRequirements.en}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{zh ? groupDissolutionPanelText.theOperationCouldNotBeCompletedCheckTheGroup.zh : groupDissolutionPanelText.theOperationCouldNotBeCompletedCheckTheGroup.en}</p>}
      {result && !result.canDissolve && <ul className="list-disc space-y-1 pl-5 text-sm text-[#66766f]">
        {result.blockers.map(reason => <li key={reason}>{(reasons[reason] ?? [groupDissolutionPanelText.pleaseCheckTheDissolutionRequirementsAgain.zh, groupDissolutionPanelText.pleaseCheckTheDissolutionRequirementsAgain.en])[zh ? 0 : 1]}</li>)}
      </ul>}
      <div className="flex flex-wrap gap-2">
        <AppActionButton variant="danger" disabled={busy || loading || !result?.canDissolve} onClick={() => void dissolve()}>
          {busy ? (zh ? groupDissolutionPanelText.processing.zh : groupDissolutionPanelText.processing.en) : (zh ? groupDissolutionPanelText.dissolveGroup.zh : groupDissolutionPanelText.dissolveGroup.en)}
        </AppActionButton>
        <AppActionButton disabled={busy || loading} onClick={() => void refresh()}>{zh ? groupDissolutionPanelText.checkAgain.zh : groupDissolutionPanelText.checkAgain.en}</AppActionButton>
      </div>
    </>}
    {confirmationModal}
  </section>
}
