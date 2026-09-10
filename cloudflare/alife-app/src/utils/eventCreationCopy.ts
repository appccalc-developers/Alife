import type { LocalizedText, ModuleDecision } from '../types/eventComposition'

const readinessCopy: Record<string, [string, string]> = {
  'accountable-owner-assigned': ['Assign the accountable owner', '指定活动负责人'],
  'registration-window-valid': ['Confirm the registration window', '确认报名时间范围'],
  'capacity-defined': ['Set participant capacity', '设定参加人数上限'],
  'privacy-notice-confirmed': ['Confirm the privacy notice', '确认隐私告知'],
  'required-slots-filled': ['Fill required service roles', '安排必需服务岗位'],
  'assignees-eligible': ['Verify volunteer eligibility', '核实同工资格'],
  'assignees-confirmed': ['Confirm volunteer assignments', '确认同工安排'],
  'currency-defined': ['Confirm the currency', '确认币种'],
  'budget-approved': ['Obtain budget approval', '取得预算批准'],
  'payment-and-refund-terms-published': ['Publish payment and refund terms', '公布付款与退款条款'],
  'ram-complete': ['Complete the risk assessment', '完成风险评估'],
  'ram-submitted': ['Submit the risk assessment', '提交风险评估'],
  'ram-approved': ['Obtain risk assessment approval', '取得风险评估批准'],
  'current-policy-loaded': ['Confirm the applicable safeguarding policy', '确认适用的儿童保护政策'],
  'guardianship-complete': ['Complete guardianship information', '完善监护资料'],
  'eligible-workers-and-policy-ratios-satisfied': ['Verify safeguarding workers and required ratios', '核实儿童保护同工资格与规定配比'],
  'programme-owner-assigned': ['Assign the programme coordinator', '指定节目负责人'],
  'required-items-confirmed': ['Confirm required programme items', '确认必需节目项目'],
  'production-check-complete': ['Complete production checks', '完成节目制作检查'],
  'capacity-sufficient': ['Verify venue capacity', '核实场地容量'],
  'bookings-confirmed': ['Confirm reservations', '确认预订'],
  'conflicts-resolved': ['Resolve booking conflicts', '解决预订冲突'],
  'transport-and-stay-facts-confirmed': ['Confirm transport and accommodation arrangements', '确认交通与住宿安排'],
  'drivers-and-vehicles-qualified': ['Verify drivers and vehicles', '核实驾驶员与车辆资格'],
  'manifests-and-night-roles-complete': ['Complete passenger lists and overnight duty arrangements', '完善乘客名单与夜间值守安排'],
  'food-policy-loaded': ['Confirm the applicable food safety policy', '确认适用的食品安全政策'],
  'allergy-process-confirmed': ['Confirm allergy handling arrangements', '确认过敏处理安排'],
  'service-and-cleaning-roles-filled': ['Assign food service and cleanup roles', '安排餐饮服务与清洁岗位'],
  'zone-leads-assigned': ['Assign area coordinators', '指定各区域负责人'],
  'command-and-escalation-confirmed': ['Confirm command and escalation arrangements', '确认现场指挥与升级处理安排'],
  'evacuation-and-first-aid-confirmed': ['Confirm evacuation and first aid arrangements', '确认疏散与急救安排'],
  'audience-and-channels-confirmed': ['Confirm the audience and communication channels', '确认通知对象与沟通渠道'],
  'public-copy-approved-when-applicable': ['Approve public copy where required', '按要求审核公开文案'],
  'retention-purpose-defined': ['Define why information is retained', '明确资料保留目的'],
}

export const creationMessage = (message: LocalizedText, zh: boolean, modules: ModuleDecision[]): string => {
  let text = (zh ? message.zh : message.en) || message.en || message.zh
  // The current API wraps readiness codes in a bilingual sentence. Present the
  // authoritative task without exposing its implementation key or changing its gate.
  const rule = Object.keys(readinessCopy).find(code => text.includes(code))
  if (rule) {
    const owner = modules.find(item => text.includes(item.label.en) || text.includes(item.label.zh))
    return `${owner ? `${zh ? owner.label.zh || owner.label.en : owner.label.en || owner.label.zh}: ` : ''}${readinessCopy[rule][zh ? 1 : 0]}`
  }
  for (const item of modules) text = text.replaceAll(item.moduleCode, zh ? item.label.zh || item.label.en : item.label.en || item.label.zh)
  return text
}
