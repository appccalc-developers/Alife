import { recoveryMemberSelectText } from '../../i18n/recoveryMemberSelect.ts'
import { useEffect, useState } from 'react'
import { groupService } from '../../services/groupService'

export default function RecoveryMemberSelect({ groupId, value, onChange, zh }: {
  groupId: string; value: string; onChange: (value: string) => void; zh: boolean
}) {
  const [members, setMembers] = useState<Awaited<ReturnType<typeof groupService.getGroupMemberships>>>([])
  const [state, setState] = useState('loading')
  useEffect(() => {
    let active = true
    setState('loading')
    groupService.getGroupMemberships(groupId).then(result => {
      if (active) { setMembers(result); setState('ready') }
    }).catch(() => { if (active) setState('error') })
    return () => { active = false }
  }, [groupId])
  return <><select className="alife-input mt-1" disabled={state !== 'ready'} value={value} onChange={event => onChange(event.target.value)}>
    <option value="">{state === 'loading' ? (zh ? recoveryMemberSelectText.loadingMembers.zh : recoveryMemberSelectText.loadingMembers.en) : (zh ? recoveryMemberSelectText.selectTheVerifiedOriginalMember.zh : recoveryMemberSelectText.selectTheVerifiedOriginalMember.en)}</option>
    {members.filter(member => member.memberId && member.status === 'approved').map(member => <option key={member.memberId} value={member.memberId}>{member.displayName} · {member.memberId}</option>)}
  </select>{state === 'error' ? <span role="alert">{zh ? recoveryMemberSelectText.unableToLoadMembersRefreshAndTryAgain.zh : recoveryMemberSelectText.unableToLoadMembersRefreshAndTryAgain.en}</span> : null}</>
}
