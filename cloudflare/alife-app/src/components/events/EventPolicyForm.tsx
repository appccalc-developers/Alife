import { eventPolicyFormText } from '../../i18n/eventPolicyForm.ts'
import { Check } from 'lucide-react'
import EventPolicyHelp from './EventPolicyHelp'
import type { PolicyEditorDefaults, PolicyRules, PolicyTier, EventPackagePolicyAdmin } from '../../types/eventPackagePolicyAdmin'
import { policyTiers, validityDays } from '../../utils/eventPackagePolicyEditor'

export const policyFieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 py-2 text-sm text-[#18332d] focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15 disabled:bg-[#f4f8f6]'
export const tierLabel = (tier: PolicyTier, zh: boolean) => ({ light: zh ? eventPolicyFormText.lightApproval.zh : eventPolicyFormText.lightApproval.en, standard: zh ? eventPolicyFormText.standardApproval.zh : eventPolicyFormText.standardApproval.en, enhanced: zh ? eventPolicyFormText.enhancedApproval.zh : eventPolicyFormText.enhancedApproval.en })[tier]
export const modeLabel = (mode: EventPackagePolicyAdmin['enforcementMode'], zh: boolean) => ({ off: zh ? eventPolicyFormText.off.zh : eventPolicyFormText.off.en, dryRun: zh ? eventPolicyFormText.dryRun.zh : eventPolicyFormText.dryRun.en, enforced: zh ? eventPolicyFormText.enforced.zh : eventPolicyFormText.enforced.en })[mode]
export const sectionLabel = (key: string, zh: boolean) => ({ tierRules: [eventPolicyFormText.approvalTriggers.en, eventPolicyFormText.approvalTriggers.zh], authorityByTier: [eventPolicyFormText.approverCounts.en, eventPolicyFormText.approverCounts.zh], approvalValidityByTier: [eventPolicyFormText.approvalValidity.en, eventPolicyFormText.approvalValidity.zh], preEventConfirmationWindowHours: [eventPolicyFormText.preEventConfirmation.en, eventPolicyFormText.preEventConfirmation.zh], delegationRules: [eventPolicyFormText.delegation.en, eventPolicyFormText.delegation.zh], conditionWaiverAllowed: [eventPolicyFormText.conditionWaivers.en, eventPolicyFormText.conditionWaivers.zh], materialChangeRules: [eventPolicyFormText.materialChanges.en, eventPolicyFormText.materialChanges.zh], legacyRollout: [eventPolicyFormText.transitionDatesAndStrategy.en, eventPolicyFormText.transitionDatesAndStrategy.zh] }[key]?.[zh ? 1 : 0] ?? (zh ? eventPolicyFormText.policyRules.zh : eventPolicyFormText.policyRules.en))

export const policySummary = (rules: PolicyRules | null, key: string, catalog: PolicyEditorDefaults, zh: boolean): string => {
  if (!rules) return zh ? eventPolicyFormText.noComparableCurrentRules.zh : eventPolicyFormText.noComparableCurrentRules.en
  const yes = (value: boolean) => value ? (zh ? eventPolicyFormText.allowed.zh : eventPolicyFormText.allowed.en) : (zh ? eventPolicyFormText.notAllowed.zh : eventPolicyFormText.notAllowed.en)
  const names = (codes: string[], options: PolicyEditorDefaults['facts']) => codes.map(code => {
    const option = options.find(o => o.code === code)
    return option ? (zh ? option.label.zh || option.label.en : option.label.en || option.label.zh) : (zh ? eventPolicyFormText.retiredCondition.zh : eventPolicyFormText.retiredCondition.en)
  }).join(zh ? '、' : ', ')
  switch (key) {
    case 'preEventConfirmationWindowHours': return `${rules.preEventConfirmationWindowHours} ${zh ? eventPolicyFormText.hours.zh : eventPolicyFormText.hours.en}`
    case 'conditionWaiverAllowed': return yes(rules.conditionWaiverAllowed)
    case 'delegationRules': return `${yes(rules.delegationRules.enabled)}${rules.delegationRules.enabled ? ` · ${(rules.delegationRules.allowedTiers ?? []).map(t => tierLabel(t, zh)).join(' / ')}` : ''}`
    case 'authorityByTier': return policyTiers.map(t => `${tierLabel(t, zh)}: ${rules.authorityByTier[t].minimumApproverCount}`).join(' / ')
    case 'approvalValidityByTier': return policyTiers.map(t => `${tierLabel(t, zh)}: ${validityDays(rules.approvalValidityByTier[t])} ${zh ? eventPolicyFormText.days.zh : eventPolicyFormText.days.en}`).join(' / ')
    case 'tierRules': return policyTiers.filter(t => t !== 'light').map(t => {
      const rule = rules.tierRules.find(r => r.tier === t)!
      const triggers = [names(rule.whenAnyConfirmedFactCodes, catalog.facts), names(rule.whenAnyActivityTypeCodes, catalog.activityTypes), names(rule.whenAnyModuleCodes, catalog.modules)].filter(Boolean)
      return `${tierLabel(t, zh)}: ${triggers.join(' / ') || (zh ? eventPolicyFormText.noTriggers.zh : eventPolicyFormText.noTriggers.en)}`
    }).join('； ')
    case 'legacyRollout': return `${zh ? eventPolicyFormText.from.zh : eventPolicyFormText.from.en} ${rules.legacyRollout.effectiveFromUtc.slice(0, 16).replace('T', ' ')} UTC; ${zh ? eventPolicyFormText.until.zh : eventPolicyFormText.until.en} ${rules.legacyRollout.transitionDeadlineUtc.slice(0, 16).replace('T', ' ')} UTC`
    default: return zh ? eventPolicyFormText.systemMaterialChangeRulesRetained.zh : eventPolicyFormText.systemMaterialChangeRulesRetained.en
  }
}

type Props = { rules: PolicyRules; mode: EventPackagePolicyAdmin['enforcementMode']; catalog: PolicyEditorDefaults; zh: boolean; readOnly: boolean; disabled: boolean; onRules: (rules: PolicyRules) => void; onMode: (mode: EventPackagePolicyAdmin['enforcementMode']) => void }
export default function EventPolicyForm({ rules, mode, catalog, zh, readOnly, disabled, onRules, onMode }: Props) {
  const copy = (text: { en: string; zh: string }) => zh ? text.zh : text.en
  const update = (edit: (next: PolicyRules) => void) => { const next = structuredClone(rules); edit(next); onRules(next) }
  const tierColor = (tier: PolicyTier) => tier === 'enhanced' ? 'text-[#9F1239]' : tier === 'standard' ? 'text-[#31544b]' : 'text-[#66766f]'
  return <div className="min-w-0 space-y-5">
    <div><div className="flex items-center gap-1"><label htmlFor="policy-enforcement" className="text-sm font-semibold">{copy(eventPolicyFormText.enforcement)}</label><EventPolicyHelp zh={zh} label={copy(eventPolicyFormText.enforcement)} text={copy(eventPolicyFormText.dryRunRecordsOperationsThatTheseRulesWouldBlock)} /></div>
      <select id="policy-enforcement" disabled={disabled} className={policyFieldClass} value={mode} onChange={e => onMode(e.target.value as Props['mode'])}>{(['off', 'dryRun', 'enforced'] as const).map(m => <option key={m} value={m}>{modeLabel(m, zh)}</option>)}</select></div>
    <div className="flex items-center gap-1"><h3 className="font-bold">{copy(eventPolicyFormText.approvalTiersAndTriggers)}</h3><EventPolicyHelp zh={zh} label={copy(eventPolicyFormText.approvalDecisionOrder)} text={copy(eventPolicyFormText.ifAnyEnhancedConditionMatchesUseEnhancedApprovalElse)} /></div>
    <div className="grid items-start gap-3 xl:grid-cols-3">{policyTiers.map(tier => {
      const rule = rules.tierRules.find(r => r.tier === tier)!
      const count = rule.whenAnyConfirmedFactCodes.length + rule.whenAnyActivityTypeCodes.length + rule.whenAnyModuleCodes.length
      const explanation = tier === 'light' ? eventPolicyFormText.elseWhenNeitherEnhancedNorStandardConditionsMatchUse : tier === 'standard' ? eventPolicyFormText.elseIfNoEnhancedConditionMatchesButAnyCondition : eventPolicyFormText.ifAnyConditionBelowMatchesUseEnhancedApprovalWithout
      return <section key={tier} aria-labelledby={`policy-tier-${tier}`} className="min-w-0 rounded-xl border border-[#2f4b42]/15 bg-white p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2"><h4 id={`policy-tier-${tier}`} className={`font-bold ${tierColor(tier)}`}>{tierLabel(tier, zh)}</h4><EventPolicyHelp zh={zh} label={tierLabel(tier, zh)} text={copy(explanation)} /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <label className="text-sm">{copy(eventPolicyFormText.minimumEligibleApprovers)}<input disabled={disabled} className={policyFieldClass} required type="number" min="1" max="5" step="1" value={rules.authorityByTier[tier].minimumApproverCount || ''} onChange={e => update(next => { next.authorityByTier[tier].minimumApproverCount = Number(e.target.value) })} /></label>
          <label className="text-sm">{copy(eventPolicyFormText.approvalValidityDays)}<input disabled={disabled} className={policyFieldClass} required type="number" min="0.00001" max="3650" step="any" value={rules.approvalValidityByTier[tier] === '' ? '' : validityDays(rules.approvalValidityByTier[tier])} onChange={e => update(next => { next.approvalValidityByTier[tier] = Number(e.target.value) > 0 ? `PT${Math.round(Number(e.target.value) * 86400000) / 1000}S` : '' })} /></label>
        </div>
        <details className="mt-4 border-t border-[#2f4b42]/10"><summary className={`min-h-11 cursor-pointer py-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176b5a] ${tierColor(tier)}`}>
          {tier === 'light' ? copy(eventPolicyFormText.fallbackConditions) : (zh ? eventPolicyFormText.selectedTriggers.zh(count) : eventPolicyFormText.selectedTriggers.en(count))}</summary>
          {tier === 'light' ? <p className="pb-2 text-sm leading-6 text-[#66766f]">{copy(explanation)}</p> : <div className="space-y-4 pb-2">
            {([['whenAnyConfirmedFactCodes', catalog.facts, eventPolicyFormText.confirmedArrangements], ['whenAnyActivityTypeCodes', catalog.activityTypes, eventPolicyFormText.activityTemplates], ['whenAnyModuleCodes', catalog.modules, eventPolicyFormText.enabledManagementFeatures]] as const).map(([key, options, label]) => {
              const visibleOptions = readOnly ? options.filter(option => rule[key].includes(option.code)) : options
              if (!visibleOptions.length) return null
              return <div key={key} className="space-y-1"><h5 className="text-xs font-semibold text-[#66766f]">{copy(label)}</h5>{visibleOptions.map(option => {
                const checked = rule[key].includes(option.code)
                const name = zh ? option.label.zh || option.label.en : option.label.en || option.label.zh
                const selectionClass = checked ? `border-[#2f4b42]/15 bg-[#f4f8f6] font-semibold ${tierColor(tier)}` : 'border-transparent text-[#66766f]'
                return readOnly ? <div key={option.code} className={`flex min-h-11 items-center gap-2 rounded-lg border px-2 py-2 text-sm ${selectionClass}`}><Check aria-hidden="true" className="h-4 w-4 shrink-0" /><span>{name}</span></div> : <label key={option.code} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-2 py-2 text-sm ${selectionClass}`}><input disabled={disabled} type="checkbox" checked={checked} className="shrink-0 accent-[#176b5a]" onChange={e => update(next => { const item = next.tierRules.find(r => r.tier === tier)!; item[key] = e.target.checked ? [...item[key], option.code] : item[key].filter(c => c !== option.code) })} /><span>{name}</span></label>
              })}</div>
            })}
            {!count && <p className="text-sm text-[#66766f]">{copy(eventPolicyFormText.noTriggers)}</p>}
          </div>}
        </details>
      </section>
    })}</div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="block text-sm">{copy(eventPolicyFormText.hoursBeforeTheEventWhenFinalConfirmationOpens)}<input disabled={disabled} className={policyFieldClass} type="number" required min="1" step="1" value={rules.preEventConfirmationWindowHours || ''} onChange={e => update(next => { next.preEventConfirmationWindowHours = Number(e.target.value) })} /></label>
      <label className="block text-sm">{copy(eventPolicyFormText.transitionDeadlineUtcReviewBeforePublishing)}<input disabled={disabled} className={policyFieldClass} type="datetime-local" required value={rules.legacyRollout.transitionDeadlineUtc.slice(0, 16)} onChange={e => update(next => { next.legacyRollout.transitionDeadlineUtc = e.target.value ? `${e.target.value}:00Z` : '' })} /></label>
    </div>
    <div className="space-y-2"><label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.delegationRules.enabled} onChange={e => update(next => { next.delegationRules.enabled = e.target.checked })} />{copy(eventPolicyFormText.allowEligibleApprovalDelegation)}</label>
      {rules.delegationRules.enabled && <div className="flex flex-wrap gap-4">{policyTiers.filter(tier => !readOnly || rules.delegationRules.allowedTiers?.includes(tier)).map(tier => <label className={`flex min-h-11 items-center gap-2 text-sm ${tierColor(tier)}`} key={tier}><input disabled={disabled} type="checkbox" checked={rules.delegationRules.allowedTiers?.includes(tier) ?? false} onChange={e => update(next => { const values = next.delegationRules.allowedTiers ?? []; next.delegationRules.allowedTiers = e.target.checked ? [...values, tier] : values.filter(t => t !== tier) })} />{tierLabel(tier, zh)}</label>)}</div>}
      <label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.conditionWaiverAllowed} onChange={e => update(next => { next.conditionWaiverAllowed = e.target.checked })} />{copy(eventPolicyFormText.allowEligiblePeopleToExplicitlyWaiveApprovalConditions)}</label>
    </div>
    <div className="flex flex-wrap items-center gap-x-5 border-t border-[#2f4b42]/10 pt-2 text-sm text-[#66766f]">
      <div className="flex items-center">{copy(eventPolicyFormText.configurationNotes)}<EventPolicyHelp zh={zh} warning label={copy(eventPolicyFormText.configurationNotes)} text={copy(eventPolicyFormText.defaultValidityThe72HourWindowAndThe90)} /></div>
      <div className="flex items-center">{copy(eventPolicyFormText.materialChangesAndSafetyRules)}<EventPolicyHelp zh={zh} warning label={copy(eventPolicyFormText.materialChangesAndSafetyRules)} text={copy(eventPolicyFormText.materialChangesToDatesVenueChildrenTravelMoneyRisk)} /></div>
    </div>
  </div>
}
