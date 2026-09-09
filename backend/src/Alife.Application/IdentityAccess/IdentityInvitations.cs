using System.Net.Mail;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.IdentityAccess;

public sealed partial class IdentityAccessService
{
    private static string? NormalizeEmail(string? value)
        => value?.Trim() is { Length: > 0 and <= 254 } email && MailAddress.TryCreate(email, out var parsed) && parsed.Address == email
            ? email.ToLowerInvariant() : null;

    public Task<AppResult<OnboardingContextDto>> AcceptInvitationAsync(string flowToken, CancellationToken token)
        => serializableExecutor.ExecuteAsync(async ct =>
        {
            var flow = await FindActiveFlowAsync(flowToken, ct);
            var invitation = flow?.ActivationInvitationId is Guid id ? await dbContext.MemberActivationInvitations.FindAsync([id], ct) : null;
            if (invitation is null || invitation.Status != ActivationStatus.Active || invitation.ExpiresUtc <= DateTime.UtcNow)
                return AppResult<OnboardingContextDto>.Conflict("activation_not_active");
            invitation.AcceptedUtc ??= DateTime.UtcNow;
            AddAudit(null, "identity.activation.accepted", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
            await dbContext.SaveChangesAsync(ct);
            return AppResult<OnboardingContextDto>.Success(await ToContextAsync(flow!, ct));
        }, token);

    private async Task<bool> CanManageInvitationAsync(Guid actor, MemberActivationInvitation invitation, CancellationToken token)
    {
        if (actor == invitation.MemberId || invitation.IsDeploymentAdministrator) return false;
        if (await groupAuthorization.IsAdminAsync(actor, token)) return true;
        var church = await dbContext.Groups.Where(x => x.IsChurch).Select(x => x.Id).SingleOrDefaultAsync(token);
        if (church == Guid.Empty || !await CanManageChurchAsync(actor, church, token) || !await IsOrdinaryMemberAsync(invitation.MemberId, token)) return false;
        foreach (var grant in invitation.Grants)
            if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(grant.GroupId, actor, token)) return false;
        return true;
    }

    public Task<AppResult<ActivationInvitationDto>> ApproveInvitationAsync(Guid actor, Guid invitationId, bool identityVerified, CancellationToken token)
        => serializableExecutor.ExecuteAsync(async ct =>
        {
            var invitation = await dbContext.MemberActivationInvitations.Include(x => x.Member).Include(x => x.Grants).SingleOrDefaultAsync(x => x.Id == invitationId, ct);
            if (invitation is null || !identityVerified || !await CanManageInvitationAsync(actor, invitation, ct))
                return AppResult<ActivationInvitationDto>.Forbidden("activation_approval_forbidden");
            if (!invitation.ApprovalRequired || invitation.Status != ActivationStatus.Active || invitation.ExpiresUtc <= DateTime.UtcNow)
                return AppResult<ActivationInvitationDto>.Conflict("activation_not_active");
            invitation.ApprovalRequired = false;
            AddAudit(actor, "identity.activation.approved", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
            await dbContext.SaveChangesAsync(ct);
            return AppResult<ActivationInvitationDto>.Success(ToActivationDto(invitation, invitation.Member, null));
        }, token);

    // Reissue before sending: raw link secrets are never stored for later retrieval.
    public async Task<AppResult<ActivationInvitationDto>> EmailInvitationAsync(Guid actor, Guid invitationId, CancellationToken token)
    {
        if (emailSender?.IsAvailable != true) return AppResult<ActivationInvitationDto>.Conflict("email_provider_unavailable");
        var result = await serializableExecutor.ExecuteAsync(async ct =>
        {
            var invitation = await dbContext.MemberActivationInvitations.Include(x => x.Member).Include(x => x.Grants).SingleOrDefaultAsync(x => x.Id == invitationId, ct);
            if (invitation is null || !await CanManageInvitationAsync(actor, invitation, ct))
                return AppResult<ActivationInvitationDto>.Forbidden("activation_send_forbidden");
            if (invitation.Purpose != ActivationPurpose.FirstActivation || invitation.Member.IsRegistered || NormalizeEmail(invitation.DeliveryEmail) is null ||
                invitation.Status is ActivationStatus.Used or ActivationStatus.Revoked or ActivationStatus.IdentityMismatch)
                return AppResult<ActivationInvitationDto>.Conflict("activation_email_unavailable");
            return await IssueActivationAsync(actor, invitation.Member, invitation.Purpose,
                invitation.Grants.Select(x => new ActivationGrantRequest(x.GroupId, x.Role)).ToArray(), ct,
                approvalRequired: invitation.ApprovalRequired, deliveryEmail: invitation.DeliveryEmail);
        }, token);
        if (!result.IsSuccess) return result;
        return await DeliverInvitationEmailAsync(result.Value!, "Your ALIFE account invitation / 您的 ALIFE 帐号邀请", token);
    }

    private async Task<AppResult<ActivationInvitationDto>> DeliverInvitationEmailAsync(ActivationInvitationDto dto, string subject, CancellationToken token)
    {
        var invitation = await dbContext.MemberActivationInvitations.Include(x => x.Member).Include(x => x.Grants).SingleAsync(x => x.Id == dto.Id, token);
        var sent = await emailSender!.SendAsync(invitation.DeliveryEmail!, subject, dto.ManualActivationMessage!.Message, token);
        invitation.DeliveryStatus = sent.Sent ? MessageDeliveryStatus.Sent : MessageDeliveryStatus.Failed;
        invitation.DeliveryErrorCode = sent.ErrorCode;
        if (sent.Sent) invitation.SentUtc = DateTime.UtcNow;
        AddAudit(null, sent.Sent ? "identity.email.accepted" : "identity.email.failed", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
        await dbContext.SaveChangesAsync(token);
        return AppResult<ActivationInvitationDto>.Success(ToActivationDto(invitation, invitation.Member, null));
    }

    // Invoked only by the deployment executable. There is deliberately no HTTP route.
    public async Task<AppResult<bool>> InitializeAdministratorAsync(bool recovery, CancellationToken token)
    {
        if (configuration.DeploymentAdministratorId is not Guid id || NormalizeEmail(configuration.DeploymentAdministratorEmail) is not { } email)
            return AppResult<bool>.Conflict("administrator_configuration_required");
        if (emailSender?.IsAvailable != true) return AppResult<bool>.Conflict("email_provider_unavailable");
        var result = await serializableExecutor.ExecuteAsync(async ct =>
        {
            var member = await dbContext.Members.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (member is null || !await groupAuthorization.IsAdminAsync(id, ct))
                return AppResult<ActivationInvitationDto>.Forbidden("administrator_configuration_invalid");
            if (!recovery && (await dbContext.MemberActivationInvitations.AnyAsync(x => x.MemberId == id && x.IsDeploymentAdministrator, ct) ||
                await dbContext.MemberPasskeyCredentials.AnyAsync(x => x.MemberId == id, ct)))
                return AppResult<ActivationInvitationDto>.Success(null!);
            return await IssueActivationAsync(id, member, recovery ? ActivationPurpose.PasskeyRecovery : ActivationPurpose.FirstActivation,
                [], ct, deliveryEmail: email, deploymentAdministrator: true);
        }, token);
        if (!result.IsSuccess) return AppResult<bool>.Conflict(result.Message ?? "administrator_activation_failed");
        if (result.Value is null) return AppResult<bool>.Success(false);
        var delivered = await DeliverInvitationEmailAsync(result.Value, "Activate your ALIFE administrator account", token);
        return delivered.Value?.DeliveryStatus == MessageDeliveryStatus.Sent
            ? AppResult<bool>.Success(true) : AppResult<bool>.Conflict("administrator_email_failed");
    }
}
