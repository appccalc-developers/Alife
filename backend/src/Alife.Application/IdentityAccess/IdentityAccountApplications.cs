using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.IdentityAccess;

public sealed partial class IdentityAccessService
{
    private async Task<AppResult<MembershipApplicationDto>> ApproveAccountApplicationAsync(
        Guid actor, GroupMembershipApplication current, DecideMembershipApplicationRequest request, CancellationToken token)
    {
        if (!request.IdentityVerified || current.BrowserTokenHash is null || current.BrowserTokenConsumedUtc is not null ||
            current.BrowserTokenExpiresUtc <= DateTime.UtcNow)
            return AppResult<MembershipApplicationDto>.Conflict("identity_verification_required");

        GroupMembershipApplication? original = null;
        Member? member;
        if (current.Source == "recoveryQr")
        {
            if (request.LinkedMemberId is not Guid target || !await CanIssuePersonalPasskeyAsync(actor, current.GroupId, target, token))
                return AppResult<MembershipApplicationDto>.Forbidden("passkey_recovery_forbidden");
            member = await dbContext.Members.SingleAsync(x => x.Id == target, token);
        }
        else
        {
            original = request.OriginalApplicationId is Guid id ? await LoadApplicationAsync(id, token) : null;
            if (original is null || original.Id == current.Id || original.GroupId != current.GroupId ||
                original.Source is "recoveryQr" or "continuationQr" || original.Status == MembershipApplicationStatus.Rejected ||
                original.ApplicantMemberId == actor || original.ChurchPersonApplication.LinkedMemberId == actor)
                return AppResult<MembershipApplicationDto>.Conflict("application_link_invalid");
            member = original.ChurchPersonApplication.LinkedMemberId is Guid memberId
                ? await dbContext.Members.SingleOrDefaultAsync(x => x.Id == memberId, token) : null;
            if (member is not null && (member.IsRegistered || !await IsOrdinaryMemberAsync(member.Id, token) ||
                await dbContext.MemberPasskeyCredentials.AnyAsync(x => x.MemberId == member.Id, token)))
                return AppResult<MembershipApplicationDto>.Conflict("application_recovery_required");
        }

        // Validate everything before replacing any browser's authority. Preserve the original history.
        var now = DateTime.UtcNow;
        if (original is not null)
        {
            original.BrowserTokenConsumedUtc = now;
            var oldInvitations = await dbContext.MemberActivationInvitations.Where(x => x.SourceApplicationId == original.Id &&
                (x.Status == ActivationStatus.Active || x.Status == ActivationStatus.PendingDelivery)).ToListAsync(token);
            foreach (var old in oldInvitations) { old.Status = ActivationStatus.Revoked; old.RevokedUtc = now; }
            var replies = await dbContext.ApplicationResponseTokens.Where(x => x.GroupMembershipApplicationId == original.Id &&
                x.ConsumedUtc == null && x.RevokedUtc == null).ToListAsync(token);
            foreach (var reply in replies) reply.RevokedUtc = now;
            // Transfer the browser receipt to the original application; do not manufacture approval.
            original.BrowserTokenHash = current.BrowserTokenHash;
            original.BrowserTokenExpiresUtc = current.BrowserTokenExpiresUtc;
            original.BrowserTokenConsumedUtc = null;
            original.UpdatedUtc = now;
            current.BrowserTokenConsumedUtc = now;
            current.ContinuedApplicationId = original.Id;
            current.Status = MembershipApplicationStatus.Rejected;
            current.ChurchPersonApplication.Status = MembershipApplicationStatus.Rejected;
            current.UpdatedUtc = now;
            AddHistory(original, actor, ApplicationDecisionKind.LinkedToMember, original.Status, original.Status, "Browser continuation reverified");
            AddHistory(current, actor, ApplicationDecisionKind.LinkedToMember, MembershipApplicationStatus.Submitted, current.Status, "Linked to original application");
            AddAudit(actor, "identity.application.browser_reassociated", nameof(GroupMembershipApplication), original.Id, member?.Id, original.GroupId);
            if (member is not null && original.Status == MembershipApplicationStatus.Approved)
                await IssueActivationAsync(actor, member, ActivationPurpose.FirstActivation, [], token, sourceApplicationId: original.Id);
            await dbContext.SaveChangesAsync(token);
            return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(original));
        }

        var person = current.ChurchPersonApplication;
        person.LinkedMemberId = member!.Id;
        person.MatchState = ApplicantMatchState.Linked;
        person.IsIdentityVerified = true;
        person.IdentityVerifiedByMemberId = actor;
        person.IdentityVerifiedUtc = now;
        person.Status = MembershipApplicationStatus.Approved;
        current.Status = MembershipApplicationStatus.Approved;
        current.UpdatedUtc = now;
        await IssueActivationAsync(actor, member, ActivationPurpose.PasskeyRecovery, [], token,
            recoveryGroupId: current.GroupId, sourceApplicationId: current.Id);
        AddHistory(current, actor, ApplicationDecisionKind.Approved, MembershipApplicationStatus.Submitted, current.Status, request.Note);
        AddAudit(actor, "identity.recovery.application_approved", nameof(GroupMembershipApplication), current.Id, member.Id, current.GroupId);
        await dbContext.SaveChangesAsync(token);
        return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(current));
    }
}
