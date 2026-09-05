using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.IdentityAccess;

public sealed partial class IdentityAccessService
{
    private async Task<GroupMembershipApplication?> FindBrowserApplicationAsync(
        string browserToken, Guid? applicationId, Guid? inviteId, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(browserToken) || (applicationId is null && inviteId is null)) return null;
        var hash = tokenService.HashToken(browserToken);
        var query = dbContext.GroupMembershipApplications
            .Include(x => x.Group).Include(x => x.ChurchPersonApplication).Include(x => x.History)
            .Where(x => x.BrowserTokenHash == hash && x.BrowserTokenExpiresUtc > DateTime.UtcNow && x.BrowserTokenConsumedUtc == null);
        if (applicationId is Guid id) query = query.Where(x => x.Id == id);
        if (inviteId is Guid invitationId)
        {
            var invite = await dbContext.GroupJoinInvites.SingleOrDefaultAsync(x => x.Id == invitationId, cancellationToken);
            if (invite is null || invite.Status != GroupJoinInviteStatus.Active || invite.ExpiresUtc <= DateTime.UtcNow) return null;
            query = query.Where(x => x.GroupId == invite.GroupId);
        }
        return await query.OrderByDescending(x => x.SubmittedUtc).FirstOrDefaultAsync(cancellationToken);
    }

    private static MembershipApplicationDto ToBrowserApplicationDto(GroupMembershipApplication application)
        => ToApplicationDto(application) with
        {
            History = ToApplicationDto(application).History.Where(x => x.Kind == "needsInfo" || x.Kind == "supplemented")
                .Select(x => x with { ActorMemberId = null }).ToArray()
        };

    private async Task<bool> CanActivateApplicationAsync(GroupMembershipApplication application, CancellationToken cancellationToken)
    {
        if (application.Status != MembershipApplicationStatus.Approved || !application.ChurchPersonApplication.IsIdentityVerified ||
            application.ChurchPersonApplication.LinkedMemberId is not Guid memberId) return false;
        // An existing account must use the separately authorized recovery path.
        return await IsOrdinaryMemberAsync(memberId, cancellationToken) && await dbContext.Members.AnyAsync(x => x.Id == memberId && !x.IsRegistered, cancellationToken) &&
            !await dbContext.MemberPasskeyCredentials.AnyAsync(x => x.MemberId == memberId, cancellationToken);
    }

    public async Task<AppResult<BrowserApplicationStatus>> GetBrowserApplicationAsync(
        string browserToken, Guid? applicationId, Guid? inviteId, CancellationToken cancellationToken)
    {
        var application = await FindBrowserApplicationAsync(browserToken, applicationId, inviteId, cancellationToken);
        return application is null
            ? AppResult<BrowserApplicationStatus>.NotFound("application_browser_unavailable")
            : AppResult<BrowserApplicationStatus>.Success(new(ToBrowserApplicationDto(application), await CanActivateApplicationAsync(application, cancellationToken)));
    }

    public Task<AppResult<OnboardingFlowStart>> StartBrowserActivationAsync(
        string browserToken, Guid applicationId, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(async token =>
        {
            var application = await FindBrowserApplicationAsync(browserToken, applicationId, null, token);
            if (application is null || !await CanActivateApplicationAsync(application, token))
                return AppResult<OnboardingFlowStart>.Conflict("application_activation_unavailable");
            var memberId = application.ChurchPersonApplication.LinkedMemberId!.Value;
            var invitation = await dbContext.MemberActivationInvitations.Where(x => x.MemberId == memberId &&
                x.SourceApplicationId == application.Id && x.Purpose == ActivationPurpose.FirstActivation &&
                x.Status == ActivationStatus.Active && x.ExpiresUtc > DateTime.UtcNow).FirstOrDefaultAsync(token);
            // Approval issues the invitation. A revoked invitation must never be recreated by its applicant.
            if (invitation is null) return AppResult<OnboardingFlowStart>.Conflict("application_activation_unavailable");
            var (flow, flowToken) = CreateFlowEntity(OnboardingIntent.Activation, false, null);
            flow.ActivationInvitationId = invitation.Id;
            dbContext.OnboardingFlows.Add(flow);
            await dbContext.SaveChangesAsync(token);
            return AppResult<OnboardingFlowStart>.Success(new(flowToken,
                new("activation", false, string.Empty, invitation.Id, State: "active", DisplayName: application.ChurchPersonApplication.DisplayName, ActivationMemberId: memberId)));
        }, cancellationToken);

    public Task<AppResult<MembershipApplicationDto>> SupplementBrowserApplicationAsync(
        string browserToken, Guid applicationId, string note, string? rowVersion, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(async token =>
        {
            var application = await FindBrowserApplicationAsync(browserToken, applicationId, null, token);
            if (application is null) return AppResult<MembershipApplicationDto>.NotFound("application_browser_unavailable");
            if (!MatchesRowVersion(application.RowVersion, rowVersion)) return AppResult<MembershipApplicationDto>.Conflict("application_changed");
            if (application.Status != MembershipApplicationStatus.NeedsInfo) return AppResult<MembershipApplicationDto>.Conflict("application_response_not_required");
            if (note.Trim().Length is < 2 or > 2000) return AppResult<MembershipApplicationDto>.Validation("application_supplement_invalid");
            var from = application.Status;
            application.Status = MembershipApplicationStatus.Submitted;
            application.UpdatedUtc = DateTime.UtcNow;
            if (application.ChurchPersonApplication.Status == MembershipApplicationStatus.NeedsInfo)
                application.ChurchPersonApplication.Status = MembershipApplicationStatus.Submitted;
            AddHistory(application, null, ApplicationDecisionKind.Supplemented, from, application.Status, note);
            AddAudit(null, "identity.membership_application.supplemented", nameof(GroupMembershipApplication), application.Id, null, application.GroupId);
            await dbContext.SaveChangesAsync(token);
            return AppResult<MembershipApplicationDto>.Success(ToBrowserApplicationDto(application));
        }, cancellationToken);

    private async Task<bool> IsOrdinaryMemberAsync(Guid memberId, CancellationToken token)
        => !await dbContext.GroupMemberships.AnyAsync(x => x.MemberId == memberId && x.Status == MembershipStatus.Approved && x.Role != MembershipRole.Member, token) &&
            !await dbContext.Members.Where(x => x.Id == memberId).AnyAsync(x => x.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code != "user"), token);

    private async Task<bool> CanIssuePersonalPasskeyAsync(Guid actor, Guid groupId, Guid memberId, CancellationToken token)
    {
        if (actor == memberId || !await dbContext.Groups.AnyAsync(x => x.Id == groupId && !x.IsClosed, token) || !await dbContext.GroupMemberships.AnyAsync(x => x.GroupId == groupId &&
            x.MemberId == memberId && x.Status == MembershipStatus.Approved, token)) return false;
        if (await groupAuthorization.IsAdminAsync(actor, token)) return true;
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actor, token)) return false;
        return await IsOrdinaryMemberAsync(memberId, token);
    }

    public Task<AppResult<PersonalPasskeyInvitation>> IssuePersonalPasskeyAsync(
        Guid actor, Guid groupId, Guid memberId, bool identityVerified, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(async token =>
        {
            if (!identityVerified || !await CanIssuePersonalPasskeyAsync(actor, groupId, memberId, token))
            {
                AddAudit(actor, "identity.recovery.denied", nameof(Member), memberId, memberId, groupId);
                await dbContext.SaveChangesAsync(token);
                return AppResult<PersonalPasskeyInvitation>.Forbidden("passkey_recovery_forbidden");
            }
            var member = await dbContext.Members.SingleAsync(x => x.Id == memberId, token);
            var result = await IssueActivationAsync(actor, member, ActivationPurpose.PasskeyRecovery, [], token, recoveryGroupId: groupId);
            var invitation = await dbContext.MemberActivationInvitations.SingleAsync(x => x.Id == result.Value!.Id, token);
            var message = result.Value!.ManualActivationMessage!.Message;
            return AppResult<PersonalPasskeyInvitation>.Success(new(invitation.Id, memberId, member.DisplayName ?? string.Empty,
                message[(message.LastIndexOf('\n') + 1)..], invitation.ExpiresUtc));
        }, cancellationToken);

    public Task<AppResult<bool>> RevokePersonalPasskeyAsync(Guid actor, Guid groupId, Guid memberId, Guid invitationId, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(async token =>
        {
            if (!await CanIssuePersonalPasskeyAsync(actor, groupId, memberId, token)) return AppResult<bool>.Forbidden("passkey_recovery_forbidden");
            var invitation = await dbContext.MemberActivationInvitations.SingleOrDefaultAsync(x => x.Id == invitationId &&
                x.MemberId == memberId && x.RecoveryGroupId == groupId, token);
            if (invitation is null) return AppResult<bool>.NotFound("activation_not_found");
            if (invitation.Status != ActivationStatus.Active) return AppResult<bool>.Conflict("activation_not_active");
            invitation.Status = ActivationStatus.Revoked;
            invitation.RevokedUtc = DateTime.UtcNow;
            AddAudit(actor, "identity.recovery.revoked", nameof(MemberActivationInvitation), invitation.Id, memberId, groupId);
            await dbContext.SaveChangesAsync(token);
            return AppResult<bool>.Success(true);
        }, cancellationToken);
}
