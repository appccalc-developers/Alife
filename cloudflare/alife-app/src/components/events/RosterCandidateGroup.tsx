import { useArrangementDraft } from './ArrangementTileDeck'
import { useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import type { EventRosterGroup } from '../../types/eventOperations'
import type { MemberSummaryDto } from '../../services/groupService'

const modules = [
  ['TEAM.WORK', 'Team coordination', '团队协调'], ['PEOPLE.REGISTRATION', 'Registration', '邀请与报名'],
  ['SERVICE.ROSTER', 'Other service roles', '其他服务岗位'], ['SAFETY.RAM', 'RAM and safety', 'RAM 与安全'],
  ['SAFEGUARDING.CHILD', 'Child safeguarding', '儿童保护'], ['PROGRAM.PRODUCTION', 'Programme', '节目'],
  ['PLACE.RESOURCE', 'Venue and resources', '场地与资源'], ['MOVE.STAY', 'Travel and stay', '交通与住宿'],
  ['FOOD.HOSPITALITY', 'Food and hospitality', '餐饮接待'], ['MONEY.FINANCE', 'Finance', '财务'],
  ['FESTIVAL.OPERATIONS', 'Site operations', '现场运营'], ['COMMS.FOLLOWUP', 'Follow-up', '沟通跟进'],
]
export function RosterCandidateGroup({ roleCode, moduleCode, group, candidates, language, busy, onSave }: {
  roleCode: string; moduleCode: string; group?: EventRosterGroup; candidates: MemberSummaryDto[]; language: 'en' | 'zh'; busy: boolean
  onSave: (request: Omit<EventRosterGroup, 'eTag'>, eTag: string) => Promise<void>
}) {
  const zh = language === 'zh'
  const [ids, setIds] = useState(group?.memberIds || []), [module, setModule] = useState(group?.moduleCode || moduleCode)
  const [search, setSearch] = useState(''), [selected, setSelected] = useState(''), [page, setPage] = useState(0)
  const [order, setOrder] = useState('name')
  useEffect(() => { setIds(group?.memberIds || []); setModule(group?.moduleCode || moduleCode); setPage(0) }, [group?.eTag, moduleCode])
  useArrangementDraft(JSON.stringify(ids) !== JSON.stringify(group?.memberIds || []) || module !== (group?.moduleCode || moduleCode))
  const name = (id: string) => candidates.find(x => x.id === id)?.displayName || id
  const available = candidates.filter(x => !ids.includes(x.id) && (x.displayName || x.id).toLowerCase().includes(search.toLowerCase())).sort((a, b) => order === 'name' ? name(a.id).localeCompare(name(b.id)) : name(b.id).localeCompare(name(a.id)))
  const move = (index: number, delta: number) => { const next = [...ids], target = index + delta; if (target < 0 || target >= ids.length) return; [next[index], next[target]] = [next[target], next[index]]; setIds(next) }
  return <details className="my-4 rounded-xl border border-[#176b5a]/20 bg-[#f5f2eb] p-3" data-roster-candidate-group>
    <summary className="cursor-pointer font-semibold">{zh ? `岗位候选组 · ${ids.length} 人` : `Role candidate group · ${ids.length}`}</summary>
    <p className="my-2 text-sm text-[#66766f]">{zh ? '候选资格不会授予模块权限，也不代表本人接受班次。调整顺序不会自动轮流排班。' : 'Being a candidate grants no module permission and does not accept a shift. Reordering does not schedule a rotation.'}</p>
    <label className="block text-sm">{zh ? '所属模块' : 'Owning module'}<select aria-label={zh ? '所属模块' : 'Owning module'} className="my-2 min-h-11 w-full rounded-xl border px-2" value={module} onChange={e => setModule(e.target.value)} disabled={busy}>{modules.map(([code, en, cn]) => <option key={code} value={code}>{zh ? cn : en}</option>)}</select></label>
    <div className="grid gap-2 tablet:grid-cols-2"><label className="text-sm">{zh ? '搜索候选成员' : 'Find candidate'}<input className="mt-1 min-h-11 w-full rounded-xl border px-2" value={search} onChange={e => { setSearch(e.target.value); setSelected('') }} /></label><label className="text-sm">{zh ? '成员排序' : 'Member order'}<select className="mt-1 min-h-11 w-full rounded-xl border px-2" value={order} onChange={e => setOrder(e.target.value)}><option value="name">{zh ? '姓名升序' : 'Name A–Z'}</option><option value="reverse">{zh ? '姓名降序' : 'Name Z–A'}</option></select></label></div>
    <label className="mt-2 block text-sm">{zh ? '加入此岗位候选组' : 'Add to this role group'}<select aria-label={zh ? '加入此岗位候选组' : 'Add to this role group'} className="my-2 min-h-11 w-full rounded-xl border px-2" value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">{zh ? '选择成员' : 'Select member'}</option>{available.map(x => <option key={x.id} value={x.id}>{name(x.id)}</option>)}</select></label>
    <AppActionButton disabled={busy || !selected} onClick={() => { setIds([...ids, selected]); setSelected('') }}>{zh ? '加入候选组' : 'Add candidate'}</AppActionButton>
    <ol className="my-3 space-y-2" start={page * 6 + 1}>{ids.slice(page * 6, page * 6 + 6).map((id, offset) => { const index = page * 6 + offset; return <li key={id} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-words">{index + 1}. {name(id)}</span><AppActionButton size="sm" aria-label={`${zh ? '上移' : 'Move up'} ${name(id)}`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</AppActionButton><AppActionButton size="sm" aria-label={`${zh ? '下移' : 'Move down'} ${name(id)}`} disabled={busy || index === ids.length - 1} onClick={() => move(index, 1)}>↓</AppActionButton><AppActionButton size="sm" disabled={busy} onClick={() => { setIds(ids.filter(x => x !== id)); setPage(0) }}>{zh ? '移出' : 'Remove'}</AppActionButton></li> })}</ol>
    {ids.length > 6 ? <div className="mb-3 flex gap-2"><AppActionButton disabled={page === 0} onClick={() => setPage(page - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton><AppActionButton disabled={(page + 1) * 6 >= ids.length} onClick={() => setPage(page + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton></div> : null}
    <AppActionButton variant="primary" disabled={busy} onClick={() => void onSave({ roleCode, moduleCode: module, memberIds: ids }, group?.eTag || '"new"').catch(() => {})}>{zh ? '保存岗位候选组' : 'Save role candidate group'}</AppActionButton>
  </details>
}
