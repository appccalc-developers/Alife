import { identityWorkflowErrorText } from '../i18n/identityWorkflowError.ts'
import { normalizeApiError } from './http'

const messages: Record<string, [string, string]> = {
  identity_verification_required: [identityWorkflowErrorText.verifyThePersonAndTheRequestOnTheirPhone.en, identityWorkflowErrorText.verifyThePersonAndTheRequestOnTheirPhone.zh],
  application_link_invalid: [identityWorkflowErrorText.checkTheOriginalApplicationReferenceItMustBelongTo.en, identityWorkflowErrorText.checkTheOriginalApplicationReferenceItMustBelongTo.zh],
  application_recovery_required: [identityWorkflowErrorText.thisAccountRequiresAccountRecoveryAskTheMemberTo.en, identityWorkflowErrorText.thisAccountRequiresAccountRecoveryAskTheMemberTo.zh],
  passkey_recovery_forbidden: [identityWorkflowErrorText.youCannotRecoverThisAccountALeaderOrAnother.en, identityWorkflowErrorText.youCannotRecoverThisAccountALeaderOrAnother.zh],
  application_changed: [identityWorkflowErrorText.thisRequestChangedRefreshAndVerifyItAgain.en, identityWorkflowErrorText.thisRequestChangedRefreshAndVerifyItAgain.zh],
  activation_not_active: [identityWorkflowErrorText.thisInvitationIsUnavailableOrStillAwaitingApprovalCheck.en, identityWorkflowErrorText.thisInvitationIsUnavailableOrStillAwaitingApprovalCheck.zh],
  activation_contact_mismatch: [identityWorkflowErrorText.theContactDetailsDoNotMatchTheSelectedAccount.en, identityWorkflowErrorText.theContactDetailsDoNotMatchTheSelectedAccount.zh],
  email_provider_unavailable: [identityWorkflowErrorText.emailIsNotConfiguredContactTheDeploymentMaintainerOr.en, identityWorkflowErrorText.emailIsNotConfiguredContactTheDeploymentMaintainerOr.zh],
  activation_email_unavailable: [identityWorkflowErrorText.thisInvitationCannotBeEmailedCheckTheRecordedEmail.en, identityWorkflowErrorText.thisInvitationCannotBeEmailedCheckTheRecordedEmail.zh],
  activation_approval_forbidden: [identityWorkflowErrorText.youCannotApproveThisInvitationAskAnAuthorizedAdministrator.en, identityWorkflowErrorText.youCannotApproveThisInvitationAskAnAuthorizedAdministrator.zh],
  administrator_deployment_required: [identityWorkflowErrorText.askTheDeploymentMaintainerToIssueANewAdministrator.en, identityWorkflowErrorText.askTheDeploymentMaintainerToIssueANewAdministrator.zh],
}

export function identityWorkflowError(error: unknown, language: string) {
  const api = normalizeApiError(error)
  const message = messages[api.code ?? '']
  return message ? message[language === 'zh' ? 1 : 0] : api.message
}
