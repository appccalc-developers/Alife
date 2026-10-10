import { eventPolicyFormText } from '../../i18n/eventPolicyForm.ts'
import { useEffect, useId, useRef, useState } from 'react'
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

type Props = { rules: PolicyRules; mode: EventPackagePolicyAdmin['enforcementMode']; catalog: PolicyEditorDefaults; zh: boolean; disabled: boolean; onRules: (rules: PolicyRules) => void; onMode: (mode: EventPackagePolicyAdmin['enforcementMode']) => void }
export default function EventPolicyForm({ rules, mode, catalog, zh, disabled, onRules, onMode }: Props) {
  const [activeTier, setActiveTier] = useState<PolicyTier>('enhanced')
  const tabId = useId()
  const tabsRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const tabs = tabsRef.current
    if (!tabs) return
    const reveal = () => {
      const current = tabs.querySelector<HTMLElement>('[aria-selected="true"]')
      if (!current) return
      const bounds = tabs.getBoundingClientRect()
      const item = current.getBoundingClientRect()
      if (item.left < bounds.left) tabs.scrollLeft -= bounds.left - item.left
      else if (item.right > bounds.right) tabs.scrollLeft += item.right - bounds.right
    }
    reveal()
    const observer = new ResizeObserver(reveal)
    observer.observe(tabs)
    return () => observer.disconnect()
  }, [activeTier, zh])
  const update = (edit: (next: PolicyRules) => void) => { const next = structuredClone(rules); edit(next); onRules(next) }
  return <div className="min-w-0 space-y-5">
    <label className="block text-sm font-semibold">{zh ? eventPolicyFormText.enforcement.zh : eventPolicyFormText.enforcement.en}<select disabled={disabled} aria-label={zh ? eventPolicyFormText.enforcement.zh : eventPolicyFormText.enforcement.en} className={policyFieldClass} value={mode} onChange={e => onMode(e.target.value as Props['mode'])}>{(['off', 'dryRun', 'enforced'] as const).map(m => <option key={m} value={m}>{modeLabel(m, zh)}</option>)}</select></label>
    <p className="rounded-xl bg-[#e3f0eb] p-3 text-sm leading-6 text-[#31544b]">{zh ? eventPolicyFormText.dryRunRecordsOperationsThatTheseRulesWouldBlock.zh : eventPolicyFormText.dryRunRecordsOperationsThatTheseRulesWouldBlock.en}</p>
    <div><h3 className="font-bold">{zh ? eventPolicyFormText.approvalTiersAndTriggers.zh : eventPolicyFormText.approvalTiersAndTriggers.en}</h3><p className="mt-1 text-sm text-[#66766f]">{zh ? eventPolicyFormText.ifAnyEnhancedConditionMatchesUseEnhancedApprovalElse.zh : eventPolicyFormText.ifAnyEnhancedConditionMatchesUseEnhancedApprovalElse.en}</p></div>
    <div ref={tabsRef} role="tablist" aria-label={zh ? eventPolicyFormText.approvalDecisionOrder.zh : eventPolicyFormText.approvalDecisionOrder.en} className="flex flex-nowrap gap-1 overflow-x-auto border-b border-[#2f4b42]/15"
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
        event.preventDefault()
        const index = policyTiers.indexOf(activeTier)
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? policyTiers.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + policyTiers.length) % policyTiers.length
        const next = policyTiers[nextIndex]!
        setActiveTier(next)
        tabsRef.current?.querySelector<HTMLButtonElement>(`[data-tier="${next}"]`)?.focus()
      }}>
      {policyTiers.map(tier => <button key={tier} type="button" role="tab" data-tier={tier}
        id={`${tabId}-${tier}`} aria-controls={`${tabId}-panel`} aria-selected={activeTier === tier} tabIndex={activeTier === tier ? 0 : -1}
        onClick={() => setActiveTier(tier)}
        className={`min-h-11 shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#176b5a] ${activeTier === tier ? 'border-[#176b5a] bg-[#e3f0eb] text-[#176b5a]' : 'border-transparent text-[#66766f] hover:bg-[#f4f8f6]'}`}>
        {tier === 'enhanced' ? (zh ? eventPolicyFormText.if.zh : eventPolicyFormText.if.en) : tier === 'standard' ? (zh ? eventPolicyFormText.elseIf.zh : eventPolicyFormText.elseIf.en) : (zh ? eventPolicyFormText.else.zh : eventPolicyFormText.else.en)} · {tierLabel(tier, zh)}
      </button>)}
    </div>
    {[activeTier].map(tier => {
      const rule = rules.tierRules.find(r => r.tier === tier)!
      return <section key={tier} role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tier}`} tabIndex={0} className="space-y-3 rounded-xl border border-[#2f4b42]/15 p-3 sm:p-4">
        <h4 className="font-bold text-[#176b5a]">{tierLabel(tier, zh)}</h4>
        <p className="text-sm text-[#66766f]">{tier === 'light' ? (zh ? eventPolicyFormText.elseWhenNeitherEnhancedNorStandardConditionsMatchUse.zh : eventPolicyFormText.elseWhenNeitherEnhancedNorStandardConditionsMatchUse.en) : tier === 'standard' ? (zh ? eventPolicyFormText.elseIfNoEnhancedConditionMatchesButAnyCondition.zh : eventPolicyFormText.elseIfNoEnhancedConditionMatchesButAnyCondition.en) : (zh ? eventPolicyFormText.ifAnyConditionBelowMatchesUseEnhancedApprovalWithout.zh : eventPolicyFormText.ifAnyConditionBelowMatchesUseEnhancedApprovalWithout.en)}</p>
        {tier !== 'light' && ([['whenAnyConfirmedFactCodes', catalog.facts, zh ? eventPolicyFormText.confirmedArrangements.zh : eventPolicyFormText.confirmedArrangements.en], ['whenAnyActivityTypeCodes', catalog.activityTypes, zh ? eventPolicyFormText.activityTemplates.zh : eventPolicyFormText.activityTemplates.en], ['whenAnyModuleCodes', catalog.modules, zh ? eventPolicyFormText.enabledManagementFeatures.zh : eventPolicyFormText.enabledManagementFeatures.en]] as const).map(([key, options, label]) => <details key={key} open={key === 'whenAnyConfirmedFactCodes'}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{label} · {rule[key].length}</summary>
          <div className="grid gap-x-4 md:grid-cols-2">{options.map(option => <label key={option.code} className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rule[key].includes(option.code)} onChange={e => update(next => { const item = next.tierRules.find(r => r.tier === tier)!; item[key] = e.target.checked ? [...item[key], option.code] : item[key].filter(c => c !== option.code) })} /><span>{zh ? option.label.zh || option.label.en : option.label.en || option.label.zh}</span></label>)}</div>
        </details>)}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">{zh ? eventPolicyFormText.minimumEligibleApprovers.zh : eventPolicyFormText.minimumEligibleApprovers.en}<input disabled={disabled} className={policyFieldClass} required type="number" min="1" max="5" step="1" value={rules.authorityByTier[tier].minimumApproverCount || ''} onChange={e => update(next => { next.authorityByTier[tier].minimumApproverCount = Number(e.target.value) })} /></label>
          <label className="text-sm">{zh ? eventPolicyFormText.approvalValidityDays.zh : eventPolicyFormText.approvalValidityDays.en}<input disabled={disabled} className={policyFieldClass} required type="number" min="0.00001" max="3650" step="any" value={rules.approvalValidityByTier[tier] === '' ? '' : validityDays(rules.approvalValidityByTier[tier])} onChange={e => update(next => { next.approvalValidityByTier[tier] = Number(e.target.value) > 0 ? `PT${Math.round(Number(e.target.value) * 86400000) / 1000}S` : '' })} /></label>
        </div>
      </section>
    })}
    <label className="block text-sm">{zh ? eventPolicyFormText.hoursBeforeTheEventWhenFinalConfirmationOpens.zh : eventPolicyFormText.hoursBeforeTheEventWhenFinalConfirmationOpens.en}<input disabled={disabled} className={policyFieldClass} type="number" required min="1" step="1" value={rules.preEventConfirmationWindowHours || ''} onChange={e => update(next => { next.preEventConfirmationWindowHours = Number(e.target.value) })} /></label>
    <div className="space-y-2"><label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.delegationRules.enabled} onChange={e => update(next => { next.delegationRules.enabled = e.target.checked })} />{zh ? eventPolicyFormText.allowEligibleApprovalDelegation.zh : eventPolicyFormText.allowEligibleApprovalDelegation.en}</label>
      {rules.delegationRules.enabled && <div className="flex flex-wrap gap-4">{policyTiers.map(tier => <label className="flex min-h-11 items-center gap-2 text-sm" key={tier}><input disabled={disabled} type="checkbox" checked={rules.delegationRules.allowedTiers?.includes(tier) ?? false} onChange={e => update(next => { const values = next.delegationRules.allowedTiers ?? []; next.delegationRules.allowedTiers = e.target.checked ? [...values, tier] : values.filter(t => t !== tier) })} />{tierLabel(tier, zh)}</label>)}</div>}
      <label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.conditionWaiverAllowed} onChange={e => update(next => { next.conditionWaiverAllowed = e.target.checked })} />{zh ? eventPolicyFormText.allowEligiblePeopleToExplicitlyWaiveApprovalConditions.zh : eventPolicyFormText.allowEligiblePeopleToExplicitlyWaiveApprovalConditions.en}</label>
    </div>
    <label className="block text-sm">{zh ? eventPolicyFormText.transitionDeadlineUtcReviewBeforePublishing.zh : eventPolicyFormText.transitionDeadlineUtcReviewBeforePublishing.en}<input disabled={disabled} className={policyFieldClass} type="datetime-local" required value={rules.legacyRollout.transitionDeadlineUtc.slice(0, 16)} onChange={e => update(next => { next.legacyRollout.transitionDeadlineUtc = e.target.value ? `${e.target.value}:00Z` : '' })} /></label>
    <p className="text-sm leading-6 text-[#66766f]">{zh ? eventPolicyFormText.defaultValidityThe72HourWindowAndThe90.zh : eventPolicyFormText.defaultValidityThe72HourWindowAndThe90.en}</p>
    <div className="rounded-xl bg-[#f4f8f6] p-3 text-sm leading-6"><strong>{zh ? eventPolicyFormText.materialChangesAndSafetyRules.zh : eventPolicyFormText.materialChangesAndSafetyRules.en}</strong><p>{zh ? eventPolicyFormText.materialChangesToDatesVenueChildrenTravelMoneyRisk.zh : eventPolicyFormText.materialChangesToDatesVenueChildrenTravelMoneyRisk.en}</p></div>
  </div>
}
