import { useEffect, useId, useRef, useState } from 'react'
import type { PolicyEditorDefaults, PolicyRules, PolicyTier, EventPackagePolicyAdmin } from '../../types/eventPackagePolicyAdmin'
import { policyTiers, validityDays } from '../../utils/eventPackagePolicyEditor'

export const policyFieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#2f4b42]/20 bg-white px-3 py-2 text-sm text-[#18332d] focus:border-[#176b5a] focus:ring-2 focus:ring-[#176b5a]/15 disabled:bg-[#f4f8f6]'
export const tierLabel = (tier: PolicyTier, zh: boolean) => ({ light: zh ? '简易审批' : 'Light approval', standard: zh ? '标准审批' : 'Standard approval', enhanced: zh ? '加强审批' : 'Enhanced approval' })[tier]
export const modeLabel = (mode: EventPackagePolicyAdmin['enforcementMode'], zh: boolean) => ({ off: zh ? '关闭' : 'Off', dryRun: zh ? '试运行' : 'Dry run', enforced: zh ? '正式执行' : 'Enforced' })[mode]
export const sectionLabel = (key: string, zh: boolean) => ({ tierRules: ['Approval triggers', '审批触发条件'], authorityByTier: ['Approver counts', '审批人数'], approvalValidityByTier: ['Approval validity', '审批有效期'], preEventConfirmationWindowHours: ['Pre-event confirmation', '活动前确认'], delegationRules: ['Delegation', '审批委托'], conditionWaiverAllowed: ['Condition waivers', '条件豁免'], materialChangeRules: ['Material changes', '重大变更'], legacyRollout: ['Transition dates and strategy', '过渡日期与策略'] }[key]?.[zh ? 1 : 0] ?? (zh ? '政策规则' : 'Policy rules'))

export const policySummary = (rules: PolicyRules | null, key: string, catalog: PolicyEditorDefaults, zh: boolean): string => {
  if (!rules) return zh ? '无可比较的有效规则' : 'No comparable current rules'
  const yes = (value: boolean) => value ? (zh ? '允许' : 'Allowed') : (zh ? '不允许' : 'Not allowed')
  const names = (codes: string[], options: PolicyEditorDefaults['facts']) => codes.map(code => {
    const option = options.find(o => o.code === code)
    return option ? (zh ? option.label.zh || option.label.en : option.label.en || option.label.zh) : (zh ? '已停用条件' : 'Retired condition')
  }).join(zh ? '、' : ', ')
  switch (key) {
    case 'preEventConfirmationWindowHours': return `${rules.preEventConfirmationWindowHours} ${zh ? '小时' : 'hours'}`
    case 'conditionWaiverAllowed': return yes(rules.conditionWaiverAllowed)
    case 'delegationRules': return `${yes(rules.delegationRules.enabled)}${rules.delegationRules.enabled ? ` · ${(rules.delegationRules.allowedTiers ?? []).map(t => tierLabel(t, zh)).join(' / ')}` : ''}`
    case 'authorityByTier': return policyTiers.map(t => `${tierLabel(t, zh)}: ${rules.authorityByTier[t].minimumApproverCount}`).join(' / ')
    case 'approvalValidityByTier': return policyTiers.map(t => `${tierLabel(t, zh)}: ${validityDays(rules.approvalValidityByTier[t])} ${zh ? '天' : 'days'}`).join(' / ')
    case 'tierRules': return policyTiers.filter(t => t !== 'light').map(t => {
      const rule = rules.tierRules.find(r => r.tier === t)!
      const triggers = [names(rule.whenAnyConfirmedFactCodes, catalog.facts), names(rule.whenAnyActivityTypeCodes, catalog.activityTypes), names(rule.whenAnyModuleCodes, catalog.modules)].filter(Boolean)
      return `${tierLabel(t, zh)}: ${triggers.join(' / ') || (zh ? '无触发条件' : 'No triggers')}`
    }).join('； ')
    case 'legacyRollout': return `${zh ? '起始' : 'From'} ${rules.legacyRollout.effectiveFromUtc.slice(0, 16).replace('T', ' ')} UTC; ${zh ? '期限' : 'until'} ${rules.legacyRollout.transitionDeadlineUtc.slice(0, 16).replace('T', ' ')} UTC`
    default: return zh ? '保留系统重大变更规则' : 'System material-change rules retained'
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
    <label className="block text-sm font-semibold">{zh ? '执行方式' : 'Enforcement'}<select disabled={disabled} aria-label={zh ? '执行方式' : 'Enforcement'} className={policyFieldClass} value={mode} onChange={e => onMode(e.target.value as Props['mode'])}>{(['off', 'dryRun', 'enforced'] as const).map(m => <option key={m} value={m}>{modeLabel(m, zh)}</option>)}</select></label>
    <p className="rounded-xl bg-[#e3f0eb] p-3 text-sm leading-6 text-[#31544b]">{zh ? '试运行会记录正式执行时将被拦截的操作，但不由这套规则阻止操作。原有权限和安全检查仍然有效；生成审批包仍需有效政策。' : 'Dry run records operations that these rules would block, without enforcing this gate. Existing permissions and safety checks still apply. Package generation still requires a valid policy.'}</p>
    <div><h3 className="font-bold">{zh ? '审批级别与触发条件' : 'Approval tiers and triggers'}</h3><p className="mt-1 text-sm text-[#66766f]">{zh ? '如果满足任一加强审批条件，采用加强审批；否则，如果满足任一标准审批条件，采用标准审批；否则，采用简易审批。事实条件只匹配已确认的“是”，未知和 AI 候选不会被确认。' : 'If any enhanced condition matches, use enhanced approval; else if any standard condition matches, use standard approval; else use light approval. Fact conditions require a confirmed yes; unknown and AI candidate facts are not confirmed.'}</p></div>
    <div ref={tabsRef} role="tablist" aria-label={zh ? '审批判断顺序' : 'Approval decision order'} className="flex flex-nowrap gap-1 overflow-x-auto border-b border-[#2f4b42]/15"
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
        {tier === 'enhanced' ? (zh ? '如果' : 'If') : tier === 'standard' ? (zh ? '否则如果' : 'Else if') : (zh ? '否则' : 'Else')} · {tierLabel(tier, zh)}
      </button>)}
    </div>
    {[activeTier].map(tier => {
      const rule = rules.tierRules.find(r => r.tier === tier)!
      return <section key={tier} role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tier}`} tabIndex={0} className="space-y-3 rounded-xl border border-[#2f4b42]/15 p-3 sm:p-4">
        <h4 className="font-bold text-[#176b5a]">{tierLabel(tier, zh)}</h4>
        <p className="text-sm text-[#66766f]">{tier === 'light' ? (zh ? '否则：加强与标准条件均未满足时，采用简易审批，无需设置条件。负责人明确确认；其他资格限制由服务器检查。' : 'Else: when neither enhanced nor standard conditions match, use light approval. No conditions need configuring. The owner explicitly confirms; the server checks eligibility.') : tier === 'standard' ? (zh ? '否则如果：未满足加强条件，但满足以下任一条件，采用标准审批。由合资格的小组负责人或升级后的教会负责人审批，并遵守职责分离。' : 'Else if: no enhanced condition matches, but any condition below matches, use standard approval. An eligible group or escalated church leader approves, subject to separation of duties.') : (zh ? '如果：满足以下任一条件，采用加强审批，不再判断标准条件。由合资格的教会负责人或有活动审批权限的管理员审批，并遵守职责分离。' : 'If: any condition below matches, use enhanced approval without checking standard conditions. An eligible church leader or administrator with event approval permission approves, subject to separation of duties.')}</p>
        {tier !== 'light' && ([['whenAnyConfirmedFactCodes', catalog.facts, zh ? '已确认的活动安排' : 'Confirmed arrangements'], ['whenAnyActivityTypeCodes', catalog.activityTypes, zh ? '活动模板' : 'Activity templates'], ['whenAnyModuleCodes', catalog.modules, zh ? '已启用的管理功能' : 'Enabled management features']] as const).map(([key, options, label]) => <details key={key} open={key === 'whenAnyConfirmedFactCodes'}>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">{label} · {rule[key].length}</summary>
          <div className="grid gap-x-4 md:grid-cols-2">{options.map(option => <label key={option.code} className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rule[key].includes(option.code)} onChange={e => update(next => { const item = next.tierRules.find(r => r.tier === tier)!; item[key] = e.target.checked ? [...item[key], option.code] : item[key].filter(c => c !== option.code) })} /><span>{zh ? option.label.zh || option.label.en : option.label.en || option.label.zh}</span></label>)}</div>
        </details>)}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm">{zh ? '最少合资格审批人数' : 'Minimum eligible approvers'}<input disabled={disabled} className={policyFieldClass} required type="number" min="1" max="5" step="1" value={rules.authorityByTier[tier].minimumApproverCount || ''} onChange={e => update(next => { next.authorityByTier[tier].minimumApproverCount = Number(e.target.value) })} /></label>
          <label className="text-sm">{zh ? '审批有效期（天）' : 'Approval validity (days)'}<input disabled={disabled} className={policyFieldClass} required type="number" min="0.00001" max="3650" step="any" value={rules.approvalValidityByTier[tier] === '' ? '' : validityDays(rules.approvalValidityByTier[tier])} onChange={e => update(next => { next.approvalValidityByTier[tier] = Number(e.target.value) > 0 ? `PT${Math.round(Number(e.target.value) * 86400000) / 1000}S` : '' })} /></label>
        </div>
      </section>
    })}
    <label className="block text-sm">{zh ? '活动开始前多少小时开放最终确认' : 'Hours before the event when final confirmation opens'}<input disabled={disabled} className={policyFieldClass} type="number" required min="1" step="1" value={rules.preEventConfirmationWindowHours || ''} onChange={e => update(next => { next.preEventConfirmationWindowHours = Number(e.target.value) })} /></label>
    <div className="space-y-2"><label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.delegationRules.enabled} onChange={e => update(next => { next.delegationRules.enabled = e.target.checked })} />{zh ? '允许合资格人员委托审批' : 'Allow eligible approval delegation'}</label>
      {rules.delegationRules.enabled && <div className="flex flex-wrap gap-4">{policyTiers.map(tier => <label className="flex min-h-11 items-center gap-2 text-sm" key={tier}><input disabled={disabled} type="checkbox" checked={rules.delegationRules.allowedTiers?.includes(tier) ?? false} onChange={e => update(next => { const values = next.delegationRules.allowedTiers ?? []; next.delegationRules.allowedTiers = e.target.checked ? [...values, tier] : values.filter(t => t !== tier) })} />{tierLabel(tier, zh)}</label>)}</div>}
      <label className="flex min-h-11 items-center gap-3 text-sm"><input disabled={disabled} type="checkbox" checked={rules.conditionWaiverAllowed} onChange={e => update(next => { next.conditionWaiverAllowed = e.target.checked })} />{zh ? '允许合资格人员明确豁免审批附带条件' : 'Allow eligible people to explicitly waive approval conditions'}</label>
    </div>
    <label className="block text-sm">{zh ? '过渡期限（UTC，发布前请确认）' : 'Transition deadline (UTC; review before publishing)'}<input disabled={disabled} className={policyFieldClass} type="datetime-local" required value={rules.legacyRollout.transitionDeadlineUtc.slice(0, 16)} onChange={e => update(next => { next.legacyRollout.transitionDeadlineUtc = e.target.value ? `${e.target.value}:00Z` : '' })} /></label>
    <p className="text-sm leading-6 text-[#66766f]">{zh ? '默认天数、72 小时确认窗口及 90 天过渡期是软件建议，不是 SOP 的规定。过渡日期保留在政策记录中，不表示系统已实现按期限自动切换模式。审批人数不等于多阶段审批链。' : 'Default validity, the 72-hour window and the 90-day transition are software suggestions, not SOP requirements. Transition dates are recorded; they do not automatically switch enforcement mode. Approver counts do not define sequential approval stages.'}</p>
    <div className="rounded-xl bg-[#f4f8f6] p-3 text-sm leading-6"><strong>{zh ? '重大变更与安全规则' : 'Material changes and safety rules'}</strong><p>{zh ? '日期、地点、儿童参与、交通住宿、收支、风险或政策等重大变更继续触发重新审阅。已有安全检查与职责分离不能在此关闭；其他未实现的策略不提供编辑选项。' : 'Material changes to dates, venue, children, travel, money, risk or policy continue to require review. Existing safety checks and separation of duties cannot be disabled here; unimplemented strategies have no editable controls.'}</p></div>
  </div>
}
