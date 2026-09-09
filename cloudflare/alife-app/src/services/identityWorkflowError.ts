import { normalizeApiError } from './http'

const messages: Record<string, [string, string]> = {
  identity_verification_required: ['Verify the person and the request on their phone before approval.', '批准前请核实本人及其手机上的具体申请。'],
  application_link_invalid: ['Check the original application reference. It must belong to this group and be eligible to continue.', '请核对原申请编号，原申请须属于本小组且可继续办理。'],
  application_recovery_required: ['This account requires account recovery. Ask the member to submit a recovery request.', '此帐号需要走帐号恢复流程，请成员提交恢复申请。'],
  passkey_recovery_forbidden: ['You cannot recover this account. A leader or another platform administrator must verify the request.', '您无权恢复此帐号，请具备权限的组长或另一位平台管理员核实办理。'],
  application_changed: ['This request changed. Refresh and verify it again.', '申请已更新，请刷新后重新核对。'],
  activation_not_active: ['This invitation is unavailable or still awaiting approval. Check its status or request a new link.', '邀请已失效或仍待批准，请检查状态或申请新链接。'],
  activation_contact_mismatch: ['The contact details do not match the selected account. Verify them before continuing.', '联系方式与原帐号不一致，请核实后继续。'],
  email_provider_unavailable: ['Email is not configured. Contact the deployment maintainer or use a manually delivered link.', '邮件服务尚未配置，请联系部署维护者，或人工发送专属链接。'],
  activation_email_unavailable: ['This invitation cannot be emailed. Check the recorded email and invitation status.', '此邀请无法发送邮件，请检查预登记邮箱及邀请状态。'],
  activation_approval_forbidden: ['You cannot approve this invitation. Ask an authorized administrator to verify it.', '您无权批准此邀请，请有权限的管理员核实处理。'],
  administrator_deployment_required: ['Ask the deployment maintainer to issue a new administrator email.', '请部署维护者重新签发管理员邮件。'],
}

export function identityWorkflowError(error: unknown, language: string) {
  const api = normalizeApiError(error)
  const message = messages[api.code ?? '']
  return message ? message[language === 'zh' ? 1 : 0] : api.message
}
