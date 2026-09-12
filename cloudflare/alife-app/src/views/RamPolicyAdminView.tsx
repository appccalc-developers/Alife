import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../stores/auth'
import { ramService } from '../services/ramGovernanceService'
import { groupService } from '../services/groupService'
import { normalizeApiError } from '../services/http'
import { setUnsavedChangesGuard } from '../utils/unsavedChangesGuard'
import type { RamPolicy, RamPolicyData } from '../types/ramGovernance'
import { displayRamText as text, ramActivityLabels, ramActivityTypes, ramText } from '../types/ramGovernance'
import { RamMatrix, RamTextField, ramInput } from '../components/events/RamFields'
import AppActionButton from '../components/layout/AppActionButton'
import AppPageShell from '../components/layout/AppPageShell'
import AppConfirmationModal from '../components/layout/AppConfirmationModal'
import SystemManagementFrame from './admin/SystemManagementFrame'

export default function RamPolicyAdminView() {
  const { language, me } = useAuthStore()
  const zh = language === 'zh'
  const [churches, setChurches] = useState<{ id: string; name: { en: string; zh: string } }[]>([])
  const [church, setChurch] = useState('')
  const [policies, setPolicies] = useState<RamPolicy[]>([])
  const [selected, setSelected] = useState<RamPolicy | null>(null)
  const [draft, setDraft] = useState<RamPolicyData | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [tab, setTab] = useState('matrix')
  const [filter, setFilter] = useState('')
  const [activityFilter, setActivityFilter] = useState('')
  const [sort, setSort] = useState('asc')
  const [page, setPage] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [historyFilter, setHistoryFilter] = useState('')
  const [historySort, setHistorySort] = useState('desc')
  const [historyPage, setHistoryPage] = useState(0)
  useEffect(() => {
    void groupService.getVisibleGroups(me?.id).then(groups => {
      const list = groups.filter(g => g.isChurch).map(g => ({ id: g.id, name: { en: g.name?.en || g.id, zh: g.name?.zh || g.id } }))
      setChurches(list); setChurch(list[0]?.id || '')
    }).catch(e => setError(normalizeApiError(e).message))
  }, [me?.id])
  const load = useCallback(async () => {
    if (!church) return
    const list = await ramService.policies(church)
    setPolicies(list); setSelected(list[0]); setDraft(structuredClone(list[0].data)); setDirty(false)
  }, [church])
  useEffect(() => { setSelected(null); setDraft(null); void load().catch(e => setError(normalizeApiError(e).message)) }, [load])
  useEffect(() => { setUnsavedChangesGuard(dirty, zh ? '政策有未保存修改。' : 'Policy has unsaved changes.', 'confirm'); return () => setUnsavedChangesGuard(false) }, [dirty, zh])
  const run = async (work: () => Promise<void>) => { setBusy(true); setError(''); setDone(false); try { await work(); setDone(true) } catch (e) { setError(normalizeApiError(e).message); setConfirm(false) } finally { setBusy(false) } }
  const change = (data: RamPolicyData) => { setDraft(data); setDirty(true); setDone(false) }
  const save = () => run(async () => {
    if (!draft || !selected) return
    const p = await ramService.savePolicy(church, draft, selected.isPublished ? null : selected.id, selected.eTag)
    setSelected(p); setDraft(p.data); setPolicies(list => [p, ...list.filter(x => x.id !== p.id && x.id)]); setDirty(false)
  })
  const editable = !selected?.isPublished && !busy
  const tabs = [['matrix', zh ? '评分矩阵' : 'Matrix'], ['categories', zh ? '风险类别' : 'Categories'], ['questions', zh ? '活动题库' : 'Questions'], ['rules', zh ? '审核规则' : 'Review rules'], ['history', zh ? '版本历史' : 'History']]
  const questions = (draft?.questions || []).map((q, index) => ({ q, index })).filter(({ q }) => (!activityFilter || q.activityType === activityFilter) && (!filter || `${q.code} ${q.text.en} ${q.text.zh}`.toLowerCase().includes(filter.toLowerCase()))).sort((a, b) => (sort === 'asc' ? 1 : -1) * a.q.code.localeCompare(b.q.code))
  const history = policies.filter(p => !historyFilter || String(p.version).includes(historyFilter)).sort((a, b) => (historySort === 'desc' ? -1 : 1) * (a.version - b.version))
  return <AppPageShell><SystemManagementFrame language={language} iconKey="ramPolicies" title={zh ? 'RAM 政策与题库' : 'RAM policies and questions'} subtitle={zh ? '所属小组继承教会政策。发布版本不可变；恢复历史配置会产生新版本。' : 'Groups inherit their church policy. Published versions are immutable; restoring history creates a new version.'}>
    <div className="space-y-5 p-4 sm:p-6"><label className="block text-sm font-semibold">{zh ? '教会' : 'Church'}<select className={ramInput} value={church} disabled={busy || dirty} onChange={e => { setChurch(e.target.value); setError('') }}><option value="">{zh ? '选择所属教会' : 'Select your church'}</option>{churches.map(c => <option value={c.id} key={c.id}>{text(c.name, zh)}</option>)}</select></label>
      {!churches.length ? <p>{zh ? '暂无可管理教会。需要教会成员资格及独立政策管理权限。' : 'No church is available. Church membership and the separate policy management permission are required.'}</p> : null}
      {error ? <p role="alert" className="whitespace-pre-wrap rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p> : null}{done ? <p role="status" className="text-sm text-emerald-800">{zh ? '操作已完成。' : 'Action completed.'}</p> : null}
      {selected && draft ? <><div className="flex flex-wrap items-center gap-3"><strong>v{selected.version || 1} · {selected.isPublished ? (zh ? '已发布，只读' : 'Published, read-only') : (zh ? '草稿' : 'Draft')}</strong>{selected.isPublished ? <AppActionButton disabled={busy || policies.some(p => p.id && !p.isPublished)} onClick={() => { setSelected({ ...selected, id: null, isPublished: false, eTag: 'new' }); setDirty(true) }}>{zh ? '以此配置建立新版本' : 'Create a new version from this policy'}</AppActionButton> : <AppActionButton disabled={busy} onClick={() => void save()}>{zh ? '保存政策草稿' : 'Save policy draft'}</AppActionButton>}
        <AppActionButton disabled={busy || dirty || selected.isPublished || !selected.id || draft.matrix.some(c => !c.level)} onClick={() => setConfirm(true)}>{zh ? '预览并发布' : 'Preview and publish'}</AppActionButton></div>
        {!selected.isPublished ? <p className="rounded-xl bg-amber-50 p-3 text-sm">{zh ? '手册矩阵颜色存在歧义。必须逐格确认全部 25 格，再明确发布；系统不会代为设定阈值或发布。' : 'The manual matrix has ambiguous colours. Confirm all 25 cells and explicitly publish. The system does not infer thresholds or publish automatically.'}</p> : null}
        <div role="tablist" aria-label={zh ? 'RAM 政策设置' : 'RAM policy settings'} className="flex flex-nowrap gap-2 overflow-x-auto border-b pb-2">{tabs.map(([id, label], index) => <button key={id} type="button" role="tab" id={`ram-policy-tab-${id}`} aria-controls={`ram-policy-panel-${id}`} aria-selected={tab === id} tabIndex={tab === id ? 0 : -1} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold ${tab === id ? 'bg-[#176b5a] text-white' : 'bg-[#e3f0eb] text-[#18332d]'}`} onClick={() => { setTab(id); setPage(0) }} onKeyDown={e => { if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return; e.preventDefault(); const next = tabs[(index + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length][0]; setTab(next); document.getElementById(`ram-policy-tab-${next}`)?.focus() }}>{label}</button>)}</div>
        <section role="tabpanel" id={`ram-policy-panel-${tab}`} aria-labelledby={`ram-policy-tab-${tab}`} className="space-y-5">
          {tab === 'matrix' ? <><RamMatrix policy={draft} zh={zh} onChange={editable ? change : undefined} />{(['likelihood', 'impact'] as const).map(kind => <fieldset key={kind} disabled={!editable} className="space-y-4"><legend className="mb-3 text-lg font-bold">{kind === 'likelihood' ? (zh ? '可能性定义' : 'Likelihood definitions') : (zh ? '影响程度定义' : 'Impact definitions')}</legend>{draft[kind].map((scale, index) => <details className="rounded-xl border p-3" key={scale.value}><summary className="min-h-11 cursor-pointer font-semibold">{scale.value}. {text(scale.label, zh)}</summary><div className="space-y-3"><RamTextField label={zh ? '档位名称' : 'Scale label'} value={scale.label} onChange={label => change({ ...draft, [kind]: draft[kind].map((s, i) => i === index ? { ...s, label } : s) })} /><RamTextField label={zh ? '定义说明' : 'Definition'} value={scale.description} onChange={description => change({ ...draft, [kind]: draft[kind].map((s, i) => i === index ? { ...s, description } : s) })} /></div></details>)}</fieldset>)}</> : null}
          {tab === 'categories' ? <fieldset disabled={!editable} className="space-y-5">{draft.categories.map((c, index) => <article className="space-y-3 rounded-xl border p-4" key={c.code}><h3 className="font-semibold">{c.code}</h3><RamTextField label={zh ? '类别名称' : 'Category name'} value={c.name} onChange={name => change({ ...draft, categories: draft.categories.map((x, i) => i === index ? { ...x, name } : x) })} /><RamTextField label={zh ? '风险识别提示' : 'Risk identification guidance'} value={c.guidance} onChange={guidance => change({ ...draft, categories: draft.categories.map((x, i) => i === index ? { ...x, guidance } : x) })} /></article>)}</fieldset> : null}
          {tab === 'questions' ? <><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">{zh ? '搜索题目' : 'Search questions'}<input className={ramInput} value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} /></label><label className="text-sm">{zh ? '活动题集' : 'Activity set'}<select className={ramInput} value={activityFilter} onChange={e => { setActivityFilter(e.target.value); setPage(0) }}><option value="">{zh ? '全部' : 'All'}</option>{ramActivityTypes.map(t => <option value={t} key={t}>{text(ramActivityLabels[t], zh)}</option>)}</select></label><label className="text-sm">{zh ? '排序' : 'Sort'}<select className={ramInput} value={sort} onChange={e => setSort(e.target.value)}><option value="asc">A–Z</option><option value="desc">Z–A</option></select></label></div>
            {questions.slice(page * 6, page * 6 + 6).map(({ q, index }) => <details key={index} className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{text(q.text, zh) || q.code} · {text(ramActivityLabels[q.activityType], zh)}</summary><fieldset disabled={!editable} className="space-y-3"><label className="block text-sm">{zh ? '稳定题目代码' : 'Stable question code'}<input className={ramInput} value={q.code} onChange={e => change({ ...draft, questions: draft.questions.map((x, i) => i === index ? { ...x, code: e.target.value } : x) })} /></label><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? '适用活动' : 'Activity type'}<select className={ramInput} value={q.activityType} onChange={e => change({ ...draft, questions: draft.questions.map((x, i) => i === index ? { ...x, activityType: e.target.value } : x) })}>{ramActivityTypes.map(t => <option value={t} key={t}>{text(ramActivityLabels[t], zh)}</option>)}</select></label><label className="text-sm">{zh ? '类别' : 'Category'}<select className={ramInput} value={q.categoryCode} onChange={e => change({ ...draft, questions: draft.questions.map((x, i) => i === index ? { ...x, categoryCode: e.target.value } : x) })}>{draft.categories.map(c => <option key={c.code} value={c.code}>{text(c.name, zh)}</option>)}</select></label></div><RamTextField label={zh ? '题目' : 'Question'} value={q.text} onChange={text => change({ ...draft, questions: draft.questions.map((x, i) => i === index ? { ...x, text } : x) })} /><RamTextField label={zh ? '解释与追问' : 'Explanation and follow-ups'} value={q.guidance} onChange={guidance => change({ ...draft, questions: draft.questions.map((x, i) => i === index ? { ...x, guidance } : x) })} /><button className="min-h-11 text-sm text-red-800" type="button" onClick={() => change({ ...draft, questions: draft.questions.filter((_, i) => i !== index) })}>{zh ? '删除草稿题目' : 'Remove draft question'}</button></fieldset></details>)}
            <div className="flex flex-wrap items-center gap-3"><AppActionButton variant="secondary" disabled={!editable} onClick={() => { change({ ...draft, questions: [...draft.questions, { code: `question-${crypto.randomUUID().slice(0, 8)}`, activityType: activityFilter || 'generic', categoryCode: 'environment', text: ramText(), guidance: ramText() }] }); setFilter(''); setSort('desc'); setPage(0) }}>{zh ? '添加题目' : 'Add question'}</AppActionButton><AppActionButton variant="secondary" disabled={page === 0} onClick={() => setPage(p => p - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton><span>{page + 1} / {Math.max(1, Math.ceil(questions.length / 6))}</span><AppActionButton variant="secondary" disabled={(page + 1) * 6 >= questions.length} onClick={() => setPage(p => p + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton></div></> : null}
          {tab === 'rules' ? <fieldset disabled={!editable} className="space-y-4"><p className="text-sm">{zh ? '固定规则：所有 RAM 独立审核；禁止作者、提交人或现场确认人自审；黄色需额外控制；红色需健康安全明确签署及活动方案加强审批。' : 'Fixed rules: independent review for every RAM; no review by its author, submitter or on-site signer; extra controls for yellow; explicit health and safety sign-off and Enhanced Event Package approval for red.'}</p><label className="block text-sm">{zh ? '重审跟进间隔（天）' : 'Re-review follow-up interval (days)'}<input className={ramInput} type="number" min={1} max={365} value={draft.reviewRules.reviewReminderDays} onChange={e => change({ ...draft, reviewRules: { reviewReminderDays: Number(e.target.value) } })} /></label><label className="block text-sm">{zh ? '政策来源及修订说明' : 'Policy source and revision notes'}<textarea className={ramInput} rows={4} value={draft.source} onChange={e => change({ ...draft, source: e.target.value })} /></label></fieldset> : null}
          {tab === 'history' ? <><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">{zh ? '过滤版本号' : 'Filter version number'}<input className={ramInput} value={historyFilter} onChange={e => { setHistoryFilter(e.target.value); setHistoryPage(0) }} /></label><label className="text-sm">{zh ? '排序' : 'Sort'}<select className={ramInput} value={historySort} onChange={e => setHistorySort(e.target.value)}><option value="desc">{zh ? '最新在前' : 'Newest first'}</option><option value="asc">{zh ? '最旧在前' : 'Oldest first'}</option></select></label></div>{history.slice(historyPage * 6, historyPage * 6 + 6).map((p, i) => <article key={p.id || i} className="space-y-2 border-b py-3"><h3 className="font-bold">v{p.version || 1} · {p.isPublished ? (zh ? '已发布' : 'Published') : (zh ? '草稿' : 'Draft')}</h3><p className="break-all text-sm">{p.publishedUtc} · {p.publishedByMemberId}</p><p className="text-sm">{p.data.source}</p><AppActionButton variant="secondary" disabled={dirty || busy} onClick={() => { setSelected(p); setDraft(structuredClone(p.data)); setTab('matrix') }}>{zh ? '查看此配置' : 'View configuration'}</AppActionButton></article>)}<div className="flex items-center gap-3"><AppActionButton variant="secondary" disabled={historyPage === 0} onClick={() => setHistoryPage(p => p - 1)}>{zh ? '上一页' : 'Previous'}</AppActionButton><span>{historyPage + 1} / {Math.max(1, Math.ceil(history.length / 6))}</span><AppActionButton variant="secondary" disabled={(historyPage + 1) * 6 >= history.length} onClick={() => setHistoryPage(p => p + 1)}>{zh ? '下一页' : 'Next'}</AppActionButton></div></> : null}
        </section>
        <AppConfirmationModal open={confirm} title={zh ? '发布已确认的 RAM 政策' : 'Publish the confirmed RAM policy'} description={<span>{zh ? '我已预览并逐格确认全部 25 格颜色及题库。发布后此版本不可修改；不会自动撤销已有 RAM 批准。' : 'I have previewed and confirmed all 25 cell colours and the question library. Publication makes this version immutable and does not revoke existing RAM approvals.'}</span>} confirmLabel={zh ? '确认全部配置并发布' : 'Confirm configuration and publish'} cancelLabel={zh ? '返回检查' : 'Return to review'} closeLabel={zh ? '关闭' : 'Close'} busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void run(async () => { await ramService.publishPolicy(selected); setConfirm(false); await load() })} />
      </> : church && !error ? <p role="status">{zh ? '正在载入政策…' : 'Loading policy…'}</p> : null}
    </div>
  </SystemManagementFrame></AppPageShell>
}
