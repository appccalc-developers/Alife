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
    <option value="">{state === 'loading' ? (zh ? '正在加载成员…' : 'Loading members…') : (zh ? '选择已核实的原成员' : 'Select the verified original member')}</option>
    {members.filter(member => member.memberId && member.status === 'approved').map(member => <option key={member.memberId} value={member.memberId}>{member.displayName} · {member.memberId}</option>)}
  </select>{state === 'error' ? <span role="alert">{zh ? '无法读取成员，请刷新后重试。' : 'Unable to load members. Refresh and try again.'}</span> : null}</>
}
