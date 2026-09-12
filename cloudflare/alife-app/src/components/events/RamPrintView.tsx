import { createPortal } from 'react-dom'
import { useEffect, useRef } from 'react'
import type { RamPrint } from '../../types/ramGovernance'
import { displayRamText as text, ramActionLabels, ramValidityLabels, upgradeRam } from '../../types/ramGovernance'
import { RamLevelBadge, RamMatrix } from './RamFields'
import AppActionButton from '../layout/AppActionButton'
import RamLegacyDetails from './RamLegacyDetails'

export default function RamPrintView({ document, zh, onClose }: { document: RamPrint; zh: boolean; onClose: () => void }) {
  const draft = upgradeRam(document.ramDataJson)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null
    const overflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    return () => { window.document.body.style.overflow = overflow; previous?.focus() }
  }, [])
  return createPortal(<section role="dialog" aria-modal="true" onKeyDown={e => {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    if (e.key === 'Tab') {
      const focusable = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button, summary'))
      const first = focusable[0], last = focusable.at(-1)
      if (e.shiftKey && window.document.activeElement === first) { e.preventDefault(); last?.focus() }
      if (!e.shiftKey && window.document.activeElement === last) { e.preventDefault(); first?.focus() }
    }
  }} className="ram-print-sheet fixed inset-0 z-[100] overflow-y-auto bg-white p-5 text-[#18332d] sm:p-10" aria-label={zh ? 'RAM 版本打印预览' : 'RAM version print preview'}>
    <style>{`@media print { @page { margin: 15mm; } html, body { background: white !important; overflow: visible !important; min-height: 0 !important; height: auto !important; } body > *:not(.ram-print-sheet) { display: none !important; } .ram-print-sheet { position: static !important; overflow: visible !important; padding: 0 !important; } .ram-print-controls { display: none !important; } .ram-print-sheet article, .ram-print-sheet tr { break-inside: avoid; } .ram-print-sheet h2 { break-after: avoid; } .ram-print-sheet thead { display: table-header-group; } }`}</style>
    <div className="ram-print-controls mb-6 flex flex-wrap gap-3"><AppActionButton onClick={() => window.print()}>{zh ? '打印／另存 PDF' : 'Print / save PDF'}</AppActionButton><AppActionButton ref={closeRef} variant="secondary" onClick={onClose}>{zh ? '关闭预览' : 'Close preview'}</AppActionButton></div>
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="border-b pb-4"><h1 className="text-2xl font-bold">ALIFE RAM · v{document.revision.version}</h1>
        {document.isDraft ? <p className="text-3xl font-black text-red-800">{zh ? '草稿 — 未经批准' : 'DRAFT — NOT APPROVED'}</p> : null}
        <p>{document.isCurrent ? (zh ? '当前版本' : 'Current version') : (zh ? '历史版本' : 'Historical version')} · {text(ramValidityLabels[document.validity], zh) || document.validity}</p>
        <p>{zh ? '政策／矩阵版本' : 'Policy / matrix version'}: {document.policy?.version ?? (zh ? '旧版／未指定' : 'Legacy / unspecified')} · {document.revision.createdUtc}</p>
        <p className="break-all text-xs">{document.revision.contentHash}</p><RamLevelBadge level={document.revision.residualLevel} zh={zh} />
      </header>
      <p>{zh ? '参与人数' : 'Participants'}: {draft.participantCount ?? '—'} · {zh ? '现场负责人账号' : 'On-site member account'}: {document.revision.onsiteMemberId || '—'}</p>
      {draft.activities.map(activity => <section key={activity.id} className="space-y-4"><h2 className="text-xl font-bold">{text(activity.name, zh)}</h2>
        {draft.hazards.filter(h => h.activityId === activity.id).map((risk, index) => <article key={risk.id} className="space-y-2 rounded border p-4">
          <h3 className="font-bold">{index + 1}. {text(risk.hazard, zh)} · {text(document.policy?.data.categories.find(c => c.code === risk.categoryCode)?.name, zh) || risk.categoryCode}</h3><p>{zh ? '后果' : 'Consequence'}: {text(risk.consequence, zh) || '—'}</p>
          <p>{zh ? '初始评分' : 'Initial rating'}: {risk.likelihood ?? '—'} × {risk.impact ?? '—'} = {risk.riskScore ?? '—'} <RamLevelBadge level={risk.initialLevel} zh={zh} /></p>
          <p>{zh ? '控制措施' : 'Controls'}: {text(risk.controlMeasures, zh)}</p><p>{zh ? '负责人' : 'Responsible person'}: {risk.personResponsible}</p>
          <p>{zh ? '剩余评分' : 'Residual rating'}: {risk.residualLikelihood ?? '—'} × {risk.residualImpact ?? '—'} = {risk.residualScore ?? '—'} <RamLevelBadge level={risk.residualLevel} zh={zh} /></p>
          <p>{zh ? '额外行动' : 'Additional action'}: {text(risk.additionalAction, zh) || '—'}</p>
        </article>)}
        {draft.answers.filter(a => a.activityId === activity.id).map(a => <article key={a.questionCode} className="border-l-2 pl-3"><h3 className="font-semibold">{text(document.policy?.data.questions.find(q => `${q.activityType}:${q.code}` === a.questionCode)?.text, zh) || a.questionCode}</h3><p>{a.notApplicable ? `${zh ? '不适用' : 'Not applicable'}: ${text(a.reason, zh)}` : text(a.answer, zh)}</p></article>)}
      </section>)}
      <article><h2 className="text-lg font-bold">{zh ? '天气、住宿与交通确认' : 'Weather, accommodation and transport'}</h2>{[draft.weatherConfirmation, draft.accommodation, draft.transport].map((t, i) => <p key={i}>{text(t, zh) || '—'}</p>)}</article>
      <RamLegacyDetails json={document.ramDataJson} zh={zh} expanded />
      {document.policy ? <section><RamMatrix policy={document.policy.data} zh={zh} /><p className="mt-2 text-xs">{document.policy.data.source}</p></section> : null}
      <section><h2 className="text-lg font-bold">{zh ? '本人确认与审核记录' : 'Personal confirmation and review history'}</h2>{document.actions.map(action => <article key={action.id} className="border-b py-3 text-sm"><p>{text(ramActionLabels[action.action], zh) || action.action} · {action.createdUtc}</p><p className="break-all">{zh ? '账号' : 'Account'}: {action.actorMemberId}</p><p>{action.reason}</p>{action.healthSafetySigned ? <p>{zh ? '已明确签署健康安全审核' : 'Explicit health and safety sign-off recorded'}</p> : null}</article>)}</section>
    </div>
  </section>, window.document.body)
}
