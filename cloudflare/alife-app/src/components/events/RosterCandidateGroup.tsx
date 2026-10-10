import { rosterCandidateGroupText } from '../../i18n/rosterCandidateGroup.ts'
import { useArrangementDraft } from './ArrangementTileDeck'
import { useEffect, useState } from 'react'
import AppActionButton from '../layout/AppActionButton'
import type { EventRosterGroup } from '../../types/eventOperations'
import type { MemberSummaryDto } from '../../services/groupService'

const modules = [
  ['TEAM.WORK', rosterCandidateGroupText.teamWork.en, rosterCandidateGroupText.teamWork.zh], ['PEOPLE.REGISTRATION', rosterCandidateGroupText.peopleRegistration.en, rosterCandidateGroupText.peopleRegistration.zh],
  ['SERVICE.ROSTER', rosterCandidateGroupText.serviceRoster.en, rosterCandidateGroupText.serviceRoster.zh], ['SAFETY.RAM', rosterCandidateGroupText.safetyRam.en, rosterCandidateGroupText.safetyRam.zh],
  ['SAFEGUARDING.CHILD', rosterCandidateGroupText.safeguardingChild.en, rosterCandidateGroupText.safeguardingChild.zh], ['PROGRAM.PRODUCTION', rosterCandidateGroupText.programProduction.en, rosterCandidateGroupText.programProduction.zh],
  ['PLACE.RESOURCE', rosterCandidateGroupText.placeResource.en, rosterCandidateGroupText.placeResource.zh], ['MOVE.STAY', rosterCandidateGroupText.moveStay.en, rosterCandidateGroupText.moveStay.zh],
  ['FOOD.HOSPITALITY', rosterCandidateGroupText.foodHospitality.en, rosterCandidateGroupText.foodHospitality.zh], ['MONEY.FINANCE', rosterCandidateGroupText.moneyFinance.en, rosterCandidateGroupText.moneyFinance.zh],
  ['FESTIVAL.OPERATIONS', rosterCandidateGroupText.festivalOperations.en, rosterCandidateGroupText.festivalOperations.zh], ['COMMS.FOLLOWUP', rosterCandidateGroupText.commsFollowup.en, rosterCandidateGroupText.commsFollowup.zh],
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
    <summary className="cursor-pointer font-semibold">{zh ? rosterCandidateGroupText.roleCandidateGroup.zh(ids.length) : rosterCandidateGroupText.roleCandidateGroup.en(ids.length)}</summary>
    <p className="my-2 text-sm text-[#66766f]">{zh ? rosterCandidateGroupText.beingACandidateGrantsNoModulePermissionAndDoes.zh : rosterCandidateGroupText.beingACandidateGrantsNoModulePermissionAndDoes.en}</p>
    <label className="block text-sm">{zh ? rosterCandidateGroupText.owningModule.zh : rosterCandidateGroupText.owningModule.en}<select aria-label={zh ? rosterCandidateGroupText.owningModule.zh : rosterCandidateGroupText.owningModule.en} className="my-2 min-h-11 w-full rounded-xl border px-2" value={module} onChange={e => setModule(e.target.value)} disabled={busy}>{modules.map(([code, en, cn]) => <option key={code} value={code}>{zh ? cn : en}</option>)}</select></label>
    <div className="grid gap-2 tablet:grid-cols-2"><label className="text-sm">{zh ? rosterCandidateGroupText.findCandidate.zh : rosterCandidateGroupText.findCandidate.en}<input className="mt-1 min-h-11 w-full rounded-xl border px-2" value={search} onChange={e => { setSearch(e.target.value); setSelected('') }} /></label><label className="text-sm">{zh ? rosterCandidateGroupText.memberOrder.zh : rosterCandidateGroupText.memberOrder.en}<select className="mt-1 min-h-11 w-full rounded-xl border px-2" value={order} onChange={e => setOrder(e.target.value)}><option value="name">{zh ? rosterCandidateGroupText.nameAZ.zh : rosterCandidateGroupText.nameAZ.en}</option><option value="reverse">{zh ? rosterCandidateGroupText.nameZA.zh : rosterCandidateGroupText.nameZA.en}</option></select></label></div>
    <label className="mt-2 block text-sm">{zh ? rosterCandidateGroupText.addToThisRoleGroup.zh : rosterCandidateGroupText.addToThisRoleGroup.en}<select aria-label={zh ? rosterCandidateGroupText.addToThisRoleGroup.zh : rosterCandidateGroupText.addToThisRoleGroup.en} className="my-2 min-h-11 w-full rounded-xl border px-2" value={selected} onChange={e => setSelected(e.target.value)} disabled={busy}><option value="">{zh ? rosterCandidateGroupText.selectMember.zh : rosterCandidateGroupText.selectMember.en}</option>{available.map(x => <option key={x.id} value={x.id}>{name(x.id)}</option>)}</select></label>
    <AppActionButton disabled={busy || !selected} onClick={() => { setIds([...ids, selected]); setSelected('') }}>{zh ? rosterCandidateGroupText.addCandidate.zh : rosterCandidateGroupText.addCandidate.en}</AppActionButton>
    <ol className="my-3 space-y-2" start={page * 6 + 1}>{ids.slice(page * 6, page * 6 + 6).map((id, offset) => { const index = page * 6 + offset; return <li key={id} className="flex flex-wrap items-center gap-2 text-sm"><span className="min-w-0 flex-1 break-words">{index + 1}. {name(id)}</span><AppActionButton size="sm" aria-label={`${zh ? rosterCandidateGroupText.moveUp.zh : rosterCandidateGroupText.moveUp.en} ${name(id)}`} disabled={busy || index === 0} onClick={() => move(index, -1)}>↑</AppActionButton><AppActionButton size="sm" aria-label={`${zh ? rosterCandidateGroupText.moveDown.zh : rosterCandidateGroupText.moveDown.en} ${name(id)}`} disabled={busy || index === ids.length - 1} onClick={() => move(index, 1)}>↓</AppActionButton><AppActionButton size="sm" disabled={busy} onClick={() => { setIds(ids.filter(x => x !== id)); setPage(0) }}>{zh ? rosterCandidateGroupText.remove.zh : rosterCandidateGroupText.remove.en}</AppActionButton></li> })}</ol>
    {ids.length > 6 ? <div className="mb-3 flex gap-2"><AppActionButton disabled={page === 0} onClick={() => setPage(page - 1)}>{zh ? rosterCandidateGroupText.previous.zh : rosterCandidateGroupText.previous.en}</AppActionButton><AppActionButton disabled={(page + 1) * 6 >= ids.length} onClick={() => setPage(page + 1)}>{zh ? rosterCandidateGroupText.next.zh : rosterCandidateGroupText.next.en}</AppActionButton></div> : null}
    <AppActionButton variant="primary" disabled={busy} onClick={() => void onSave({ roleCode, moduleCode: module, memberIds: ids }, group?.eTag || '"new"').catch(() => {})}>{zh ? rosterCandidateGroupText.saveRoleCandidateGroup.zh : rosterCandidateGroupText.saveRoleCandidateGroup.en}</AppActionButton>
  </details>
}
