import { useCallback, useEffect, useRef, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import useConfirmation from '../../hooks/useConfirmation'
import { groupService, type GroupDissolutionDto } from '../../services/groupService'

const reasons: Record<string, [string, string]> = {
  church: ['教会根组不能解散。', 'The root church cannot be dissolved.'],
  members: ['还有其他活跃成员（已批准的成员）。', 'Other active (approved) members remain.'],
  subgroups: ['还有下属事工组或小组。', 'Child ministries or groups remain.'],
  pages: ['还有页面（包括草稿）。', 'Pages remain, including drafts.'],
  events: ['还有活动或定期活动。', 'Events or event series remain.'],
  albums: ['还有相册。', 'Albums remain.'],
  announcements: ['还有公告。', 'Announcements remain.'],
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
        title: zh ? `解散「${groupName}」？` : `Dissolve “${groupName}”?`,
        description: zh
          ? '此操作会永久删除小组、所有组内成员关系及论坛、联系人、邀请等其他资料，无法撤销。文件对象将在解散后清理，失败会重试。个人账号、其他小组身份和审计记录会保留。'
          : 'This permanently deletes the group, all its memberships and other information such as forum content, contacts and invitations. It cannot be undone. File objects are cleaned up afterwards, with retries on failure. Accounts, other memberships and audit history remain.',
        confirmLabel: zh ? '确认解散小组' : 'Confirm dissolution', tone: 'danger',
      })) return
      await groupService.dissolveGroup(groupId)
      setDeleted(true)
      await onDissolved()
    } catch { setError(true); setResult(null) }
    finally { locked.current = false; setBusy(false) }
  }

  return <section aria-label={zh ? '解散小组' : 'Dissolve group'} className="space-y-3 border-t border-rose-200 pt-5">
    <h2 className="text-base font-bold text-[#18332d]">{zh ? '解散小组' : 'Dissolve group'}</h2>
    <p className="text-sm text-[#66766f]">{zh
      ? '只有组长一名活跃成员（已批准），且没有下属事工组、页面、活动、相册或公告，即为空小组。邀请、申请、已退出成员及其他资料不影响解散。草稿与已关闭内容也会计入检查。'
      : 'An empty group has only its leader as an active (approved) member and no child groups, pages, events, albums or announcements. Invitations, requests, former members and other information do not prevent dissolution. Drafts and closed content also count.'}</p>
    {deleted ? <>
      <p role="status">{zh ? '小组已解散。' : 'The group has been dissolved.'}</p>
      <AppActionButton disabled={busy} onClick={() => void finish()}>{zh ? '刷新并返回小组生活' : 'Refresh and return to Group Life'}</AppActionButton>
    </> : <>
      {loading && <p role="status">{zh ? '正在检查解散条件…' : 'Checking dissolution requirements…'}</p>}
      {error && <p role="alert" className="text-sm text-rose-700">{zh ? '未能完成操作。请重新检查小组及你的权限后再试。' : 'The operation could not be completed. Check the group and your permissions again before retrying.'}</p>}
      {result && !result.canDissolve && <ul className="list-disc space-y-1 pl-5 text-sm text-[#66766f]">
        {result.blockers.map(reason => <li key={reason}>{(reasons[reason] ?? ['请重新检查解散条件。', 'Please check the dissolution requirements again.'])[zh ? 0 : 1]}</li>)}
      </ul>}
      <div className="flex flex-wrap gap-2">
        <AppActionButton variant="danger" disabled={busy || loading || !result?.canDissolve} onClick={() => void dissolve()}>
          {busy ? (zh ? '正在处理…' : 'Processing…') : (zh ? '解散小组' : 'Dissolve group')}
        </AppActionButton>
        <AppActionButton disabled={busy || loading} onClick={() => void refresh()}>{zh ? '重新检查' : 'Check again'}</AppActionButton>
      </div>
    </>}
    {confirmationModal}
  </section>
}
