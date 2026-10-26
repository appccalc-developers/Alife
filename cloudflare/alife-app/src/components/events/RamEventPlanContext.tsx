import { ramEventPlanContextText } from '../../i18n/ramEventPlanContext.ts'
import AppBadge from '../layout/AppBadge'
import AppSectionCard from '../layout/AppSectionCard'
import type { RamEventPlanContext } from '../../types/ramGovernance'

const localize = (value: { en: string; zh: string }, zh: boolean) =>
  value[zh ? 'zh' : 'en'] || value[zh ? 'en' : 'zh'] || ''

const factValue = (value: unknown, zh: boolean) => {
  if (value === true) return zh ? ramEventPlanContextText.yes.zh : ramEventPlanContextText.yes.en
  if (value === false) return zh ? ramEventPlanContextText.no.zh : ramEventPlanContextText.no.en
  if (value === null || value === undefined || value === '') return zh ? ramEventPlanContextText.notProvided.zh : ramEventPlanContextText.notProvided.en
  if (typeof value === 'object' && !Array.isArray(value)) {
    const text = value as { en?: unknown; zh?: unknown }
    const localized = text[zh ? 'zh' : 'en'] ?? text[zh ? 'en' : 'zh']
    if (typeof localized === 'string') return localized
  }
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  return JSON.stringify(value)
}

export default function RamEventPlanContext({ context, zh, review = true }: { context: RamEventPlanContext; zh: boolean; review?: boolean }) {
  const snapshot = context.acceptedPlan
  const plan = snapshot?.plan
  const activeModules = plan?.moduleDecisions.filter(item => item.status !== 'inactive') ?? []

  return <div data-ram-plan-context><AppSectionCard
    title={review ? zh ? ramEventPlanContextText.completeEventPlanForIndependentReview.zh : ramEventPlanContextText.completeEventPlanForIndependentReview.en : zh ? ramEventPlanContextText.completeEventPlanReadOnly.zh : ramEventPlanContextText.completeEventPlanReadOnly.en}
    subtitle={zh
      ? ramEventPlanContextText.thisIsAFixedPlanVersionAfterRamConfirmation.zh
      : ramEventPlanContextText.thisIsAFixedPlanVersionAfterRamConfirmation.en}
    action={snapshot ? <AppBadge variant="info">Plan v{snapshot.planVersion}</AppBadge> : undefined}
  >
    <div className="grid gap-3 tablet:grid-cols-2">
      <div className="rounded-xl bg-[#f4f8f6] p-4 tablet:col-span-2">
        <h2 className="break-words text-xl font-black text-[#18332d]">{localize(context.title, zh)}</h2>
        <p className="mt-2 text-sm text-[#40554e]">{new Date(context.startUtc).toLocaleString()} – {new Date(context.endUtc).toLocaleString()}</p>
        {plan ? <p className="mt-2 text-xs text-[#66766f]">{zh ? ramEventPlanContextText.activityType.zh : ramEventPlanContextText.activityType.en}: {plan.activityTypeCode || '—'} · {zh ? ramEventPlanContextText.archetype.zh : ramEventPlanContextText.archetype.en}: {plan.archetypeCode || '—'}</p> : null}
      </div>
    </div>

    {!plan ? <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{zh ? ramEventPlanContextText.thisEventHasNoAcceptedEventPlanSoThe.zh : ramEventPlanContextText.thisEventHasNoAcceptedEventPlanSoThe.en}</p> : <div className="mt-4 space-y-4">
      {(context.venues?.length || context.weeklyVenues?.length) ? <section className="space-y-2"><h3 className="font-semibold">{zh ? ramEventPlanContextText.venueArrangements.zh : ramEventPlanContextText.venueArrangements.en}</h3>
        {context.venues?.map((v, index) => <p key={index} className="rounded-xl border p-3 text-sm">{localize(v.name, zh)} · {new Date(v.startUtc).toLocaleString(zh ? 'zh' : 'en')} – {new Date(v.endUtc).toLocaleString(zh ? 'zh' : 'en')} · {v.capacity} {zh ? ramEventPlanContextText.people.zh : ramEventPlanContextText.people.en}</p>)}
        {context.weeklyVenues?.map((v, index) => <div key={index} className="rounded-xl border p-3 text-sm"><p>{localize(v.name, zh)} · {zh ? ramEventPlanContextText.weeklyFrom.zh : ramEventPlanContextText.weeklyFrom.en} {v.firstDate} {zh ? ramEventPlanContextText.to.zh : ramEventPlanContextText.to.en} {v.lastDate || (zh ? ramEventPlanContextText.noEndDate.zh : ramEventPlanContextText.noEndDate.en)} · {String(Math.floor(v.startMinute / 60) % 24).padStart(2, '0')}:{String(v.startMinute % 60).padStart(2, '0')} – {String(Math.floor(v.endMinute / 60) % 24).padStart(2, '0')}:{String(v.endMinute % 60).padStart(2, '0')}{v.endMinute >= 1440 ? zh ? ramEventPlanContextText.nextDay.zh : ramEventPlanContextText.nextDay.en : ''} · {v.timeZone} · {v.capacity} {zh ? ramEventPlanContextText.people.zh : ramEventPlanContextText.people.en}</p>{v.releasedDates.length ? <p>{zh ? ramEventPlanContextText.releasedDates.zh : ramEventPlanContextText.releasedDates.en}{v.releasedDates.join(', ')}</p> : null}</div>)}
      </section> : null}
      {context.rosterNeeds?.length ? <section className="space-y-2"><h3 className="font-semibold">{zh ? ramEventPlanContextText.defaultStaffingRequirements.zh : ramEventPlanContextText.defaultStaffingRequirements.en}</h3>{context.rosterNeeds.map((r, index) => <p key={index} className="rounded-xl border p-3 text-sm">{r.roleCode} · {r.requiredCount} {zh ? ramEventPlanContextText.people.zh : ramEventPlanContextText.people.en} · {zh ? ramEventPlanContextText.fromOccurrenceStart.zh : ramEventPlanContextText.fromOccurrenceStart.en} {r.startOffsetMinutes}–{r.endOffsetMinutes} {zh ? ramEventPlanContextText.minutes.zh : ramEventPlanContextText.minutes.en}{r.eligibilityCode ? ` · ${r.eligibilityCode}` : ''}</p>)}</section> : null}
      {context.details ? <section className="space-y-3"><h3 className="font-semibold">{zh ? ramEventPlanContextText.eventContentAndArrangements.zh : ramEventPlanContextText.eventContentAndArrangements.en}</h3>{Object.entries(context.details).map(([key, value]) => <div key={key} className="rounded-xl border p-3 text-sm"><strong>{({ purpose: zh ? ramEventPlanContextText.purpose.zh : ramEventPlanContextText.purpose.en, description: zh ? ramEventPlanContextText.description.zh : ramEventPlanContextText.description.en, locationName: zh ? ramEventPlanContextText.location.zh : ramEventPlanContextText.location.en, timeZone: zh ? ramEventPlanContextText.timeZone.zh : ramEventPlanContextText.timeZone.en, hardConstraints: zh ? ramEventPlanContextText.participationRequirements.zh : ramEventPlanContextText.participationRequirements.en, registrationDeadline: zh ? ramEventPlanContextText.registrationDeadline.zh : ramEventPlanContextText.registrationDeadline.en, maxCapacity: zh ? ramEventPlanContextText.capacity.zh : ramEventPlanContextText.capacity.en, capacityUnit: zh ? ramEventPlanContextText.capacityUnit.zh : ramEventPlanContextText.capacityUnit.en } as Record<string, string>)[key] || key}</strong><p className="mt-1 whitespace-pre-wrap break-words">{Array.isArray(value) ? value.map(item => factValue(item, zh)).join('\n') : factValue(value, zh)}</p></div>)}</section> : null}
      {context.reports?.map(report => <section key={report.revisionId} className="rounded-xl border p-4"><h3 className="font-semibold">{report.moduleCode} · {zh ? ramEventPlanContextText.adoptedReport.zh : ramEventPlanContextText.adoptedReport.en} v{report.version}</h3><p className="mt-3 whitespace-pre-wrap break-words text-sm">{localize(report.text, zh)}</p></section>)}
      {context.registrationRules ? <details className="rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{zh ? ramEventPlanContextText.registrationRulesAndProcedures.zh : ramEventPlanContextText.registrationRulesAndProcedures.en} v{context.registrationRulesVersion}</summary>{(['purpose', 'eligibility', 'terms', 'privacyNotice', 'cancellationTerms', 'paymentInstructions', 'refundTerms'] as const).map((key, index) => <div key={key} className="mt-3 text-sm"><strong>{(zh ? [...ramEventPlanContextText.localizedCopy.zh] : [...ramEventPlanContextText.localizedCopy.en])[index]}</strong><p className="mt-1 whitespace-pre-wrap">{context.registrationRules?.[key] ? localize(context.registrationRules[key], zh) : '—'}</p></div>)}<p className="mt-3 text-sm">{zh ? ramEventPlanContextText.participantCapacity.zh : ramEventPlanContextText.participantCapacity.en}: {context.registrationRules.capacity}</p></details> : null}
      <section aria-labelledby="ram-plan-facts">
        {context.programme?.length ? <section className="mb-4 space-y-3"><h3 className="font-semibold">{zh ? ramEventPlanContextText.programmeAndSessions.zh : ramEventPlanContextText.programmeAndSessions.en}</h3>{context.programme.map((session, index) => <details key={index} className="rounded-xl border p-3"><summary className="min-h-11 cursor-pointer text-sm font-semibold">{localize(session.title, zh)} · {new Date(session.startUtc).toLocaleString(zh ? 'zh' : 'en')} – {new Date(session.endUtc).toLocaleString(zh ? 'zh' : 'en')}</summary><ol className="space-y-2 text-sm">{session.items.map((item, i) => <li key={i} className="border-t pt-2"><strong>{localize(item.title, zh)}</strong><p>{zh ? ramEventPlanContextText.startsAtMinute.zh : ramEventPlanContextText.startsAtMinute.en} {item.startOffsetMinutes} · {zh ? ramEventPlanContextText.duration.zh : ramEventPlanContextText.duration.en} {item.durationMinutes} {zh ? ramEventPlanContextText.minutes.zh : ramEventPlanContextText.minutes.en}</p><p className="whitespace-pre-wrap break-words">{localize(item.description, zh)}</p></li>)}</ol></details>)}</section> : null}
        {context.registrationRules ? <section className="mb-4 rounded-xl border p-3 text-sm"><h3 className="font-semibold">{zh ? ramEventPlanContextText.registrationStepsAndConditions.zh : ramEventPlanContextText.registrationStepsAndConditions.en}</h3><dl className="mt-3 grid gap-2 sm:grid-cols-2">{[
          [zh ? ramEventPlanContextText.audience.zh : ramEventPlanContextText.audience.en, ({ invited: zh ? ramEventPlanContextText.namedInvitations.zh : ramEventPlanContextText.namedInvitations.en, group: zh ? ramEventPlanContextText.specifiedGroupMembers.zh : ramEventPlanContextText.specifiedGroupMembers.en, church: zh ? ramEventPlanContextText.churchMembers.zh : ramEventPlanContextText.churchMembers.en, public: zh ? ramEventPlanContextText.publishedEventAudience.zh : ramEventPlanContextText.publishedEventAudience.en } as Record<string, string>)[context.registrationRules.audience]],
          [zh ? ramEventPlanContextText.opens.zh : ramEventPlanContextText.opens.en, new Date(context.registrationRules.opensUtc).toLocaleString(zh ? 'zh' : 'en')],
          [zh ? ramEventPlanContextText.deadline.zh : ramEventPlanContextText.deadline.en, new Date(context.registrationRules.deadlineUtc).toLocaleString(zh ? 'zh' : 'en')],
          [zh ? ramEventPlanContextText.channel.zh : ramEventPlanContextText.channel.en, ({ app: zh ? ramEventPlanContextText.inApp.zh : ramEventPlanContextText.inApp.en, manual: zh ? ramEventPlanContextText.manual.zh : ramEventPlanContextText.manual.en, both: zh ? ramEventPlanContextText.appAndManual.zh : ramEventPlanContextText.appAndManual.en } as Record<string, string>)[context.registrationRules.channel]],
          [zh ? ramEventPlanContextText.waitlist.zh : ramEventPlanContextText.waitlist.en, context.registrationRules.allowWaitlist ? zh ? ramEventPlanContextText.allowed.zh : ramEventPlanContextText.allowed.en : zh ? ramEventPlanContextText.notAllowed.zh : ramEventPlanContextText.notAllowed.en],
          [zh ? ramEventPlanContextText.manualEligibilityAndMaterialReview.zh : ramEventPlanContextText.manualEligibilityAndMaterialReview.en, context.registrationRules.manualReview ? zh ? ramEventPlanContextText.required.zh : ramEventPlanContextText.required.en : zh ? ramEventPlanContextText.notRequired.zh : ramEventPlanContextText.notRequired.en],
          [zh ? ramEventPlanContextText.feePerParticipant.zh : ramEventPlanContextText.feePerParticipant.en, new Intl.NumberFormat(zh ? 'zh-CN' : 'en', { style: 'currency', currency: context.registrationRules.currency }).format(context.registrationRules.feeMinor / 10 ** (new Intl.NumberFormat('en', { style: 'currency', currency: context.registrationRules.currency }).resolvedOptions().maximumFractionDigits ?? 2))],
        ].map(([label, value]) => <div key={label}><dt className="font-semibold">{label}</dt><dd className="break-words">{value}</dd></div>)}</dl><ul className="mt-3 space-y-2">{context.registrationRules.materials.map(m => <li key={m.id}>{localize(m.label, zh)} · {m.required ? zh ? ramEventPlanContextText.requiredLabel.zh : ramEventPlanContextText.requiredLabel.en : zh ? ramEventPlanContextText.optional.zh : ramEventPlanContextText.optional.en} · {m.kind === 'text' ? zh ? ramEventPlanContextText.text.zh : ramEventPlanContextText.text.en : `${m.kind === 'image' ? 'JPG / PNG' : 'JPG / PNG / PDF / TXT'} · ${m.maxCount} ${zh ? ramEventPlanContextText.filesEachUpTo.zh : ramEventPlanContextText.filesEachUpTo.en} ${Math.round(m.maxBytes / 1024)} KB`}</li>)}</ul></section> : null}
        <h3 id="ram-plan-facts" className="font-black text-[#18332d]">{zh ? ramEventPlanContextText.eventFacts.zh : ramEventPlanContextText.eventFacts.en}</h3>
        {plan.facts.items.length ? <dl className="mt-2 grid gap-2 tablet:grid-cols-2">{plan.facts.items.map(item => <div key={item.code} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><dt className="break-all text-xs font-bold text-[#66766f]">{item.code} · {item.certainty}</dt><dd className="mt-1 break-words font-semibold text-[#18332d]">{factValue(item.value, zh)}</dd></div>)}</dl> : <p className="mt-2 text-sm text-[#66766f]">{zh ? ramEventPlanContextText.noEventFactsAreRecordedInThisVersion.zh : ramEventPlanContextText.noEventFactsAreRecordedInThisVersion.en}</p>}
      </section>

      <section aria-labelledby="ram-plan-modules">
        <h3 id="ram-plan-modules" className="font-black text-[#18332d]">{zh ? ramEventPlanContextText.preparationModulesAndStatus.zh : ramEventPlanContextText.preparationModulesAndStatus.en}</h3>
        <div className="mt-2 grid gap-2 tablet:grid-cols-2">{activeModules.map(item => <div key={item.moduleCode} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong>{localize(item.label, zh)}</strong><AppBadge variant={item.status === 'required' ? 'warning' : 'info'}>{item.status}</AppBadge></div><p className="mt-1 break-all text-xs text-[#66766f]">{item.moduleCode}</p>{item.reasonCodes.length ? <p className="mt-2 text-xs text-[#40554e]">{item.reasonCodes.join(' · ')}</p> : null}</div>)}</div>
      </section>

      <section aria-labelledby="ram-plan-roles">
        <h3 id="ram-plan-roles" className="font-black text-[#18332d]">{zh ? ramEventPlanContextText.responsibilitiesAndSeparation.zh : ramEventPlanContextText.responsibilitiesAndSeparation.en}</h3>
        {plan.roleRequirements.length ? <ul className="mt-2 space-y-2">{plan.roleRequirements.map(item => <li key={item.requirementKey} className="rounded-xl border border-[#2f4b42]/10 bg-white p-3 text-sm"><strong>{item.roleCode}</strong><span className="ml-2 text-xs text-[#66766f]">{item.moduleCode} · {zh ? ramEventPlanContextText.minimum.zh : ramEventPlanContextText.minimum.en} {item.minimum}</span>{item.separationFrom.length ? <p className="mt-1 text-xs text-[#40554e]">{zh ? ramEventPlanContextText.mustBeSeparateFrom.zh : ramEventPlanContextText.mustBeSeparateFrom.en}{item.separationFrom.join(' · ')}</p> : null}</li>)}</ul> : <p className="mt-2 text-sm text-[#66766f]">{zh ? ramEventPlanContextText.noAdditionalRoleRequirementsAreRecorded.zh : ramEventPlanContextText.noAdditionalRoleRequirementsAreRecorded.en}</p>}
      </section>

      {(plan.readiness.blockers.length || plan.readiness.warnings.length) ? <section aria-labelledby="ram-plan-readiness">
        <h3 id="ram-plan-readiness" className="font-black text-[#18332d]">{zh ? ramEventPlanContextText.readinessAndCautions.zh : ramEventPlanContextText.readinessAndCautions.en}</h3>
        <ul className="mt-2 space-y-2">{[...plan.readiness.blockers, ...plan.readiness.warnings].map((item, index) => <li key={`${item.en}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{localize(item, zh)}</li>)}</ul>
      </section> : null}

      <details className="rounded-xl border border-[#2f4b42]/10 bg-white px-3 py-2 text-xs text-[#66766f]">
        <summary className="min-h-10 cursor-pointer py-2 font-bold text-[#40554e]">{zh ? ramEventPlanContextText.versionAndHumanDecisions.zh : ramEventPlanContextText.versionAndHumanDecisions.en}</summary>
        <p>{zh ? ramEventPlanContextText.accepted.zh : ramEventPlanContextText.accepted.en}: {snapshot.acceptedUtc ? new Date(snapshot.acceptedUtc).toLocaleString() : '—'}</p>
        <p className="mt-1 break-all">{zh ? ramEventPlanContextText.proposalHash.zh : ramEventPlanContextText.proposalHash.en}: {plan.proposalHash}</p>
        {snapshot.humanDecisions.length ? <ul className="mt-2 space-y-1">{snapshot.humanDecisions.map((item, index) => <li key={`${item.code}-${index}`}>{item.code}: {item.decision}{item.reason ? ` · ${item.reason}` : ''}</li>)}</ul> : null}
      </details>
    </div>}
  </AppSectionCard></div>
}
