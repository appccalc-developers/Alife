using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.IdentityAccess;

public sealed partial class IdentityAccessService(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorization,
    IIdentityTokenService tokenService,
    IIdentityMessageSender messageSender,
    IIdentityAccessConfiguration configuration,
    IJwtTokenService jwtTokenService,
    IIdentitySerializableExecutor serializableExecutor) : IIdentityAccessService
{
    private static readonly MembershipApplicationStatus[] ActiveApplicationStatuses =
    [
        MembershipApplicationStatus.Submitted,
        MembershipApplicationStatus.NeedsInfo,
        MembershipApplicationStatus.ApprovedWaitingForChurch
    ];

    public IdentityCapabilitiesDto GetCapabilities()
        => new(configuration.PasskeysEnabled, configuration.LineLegacyEnabled);

    public async Task<AppResult<OnboardingFlowStart>> CreateFlowAsync(
        string? returnPath,
        bool isPublicDevice,
        OnboardingIntent intent,
        CancellationToken cancellationToken)
    {
        var (flow, token) = CreateFlowEntity(intent, isPublicDevice, returnPath);
        dbContext.OnboardingFlows.Add(flow);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<OnboardingFlowStart>.Success(new OnboardingFlowStart(token, ToContext(flow)));
    }

    public async Task<AppResult<OnboardingContextDto>> ResumeFlowAsync(string token, CancellationToken cancellationToken)
    {
        var flow = await FindActiveFlowAsync(token, cancellationToken);
        return flow is null
            ? AppResult<OnboardingContextDto>.NotFound("onboarding_flow_invalid")
            : AppResult<OnboardingContextDto>.Success(await ToContextAsync(flow, cancellationToken));
    }

    public async Task<AppResult<bool>> BindLineStateAsync(
        string flowToken,
        string state,
        CancellationToken cancellationToken)
    {
        var flow = await FindActiveFlowAsync(flowToken, cancellationToken);
        if (flow is null || string.IsNullOrWhiteSpace(state))
        {
            return AppResult<bool>.NotFound("onboarding_flow_invalid");
        }
        flow.LineOAuthStateHash = tokenService.HashToken(state);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }

    public async Task<AppResult<OnboardingContextDto>> ConsumeLineStateAsync(
        string flowToken,
        string state,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => ConsumeLineStateCoreAsync(flowToken, state, token),
            cancellationToken);

    private async Task<AppResult<OnboardingContextDto>> ConsumeLineStateCoreAsync(
        string flowToken,
        string state,
        CancellationToken cancellationToken)
    {
        var flow = await FindActiveFlowAsync(flowToken, cancellationToken);
        if (flow?.LineOAuthStateHash is null || !tokenService.VerifyToken(state, flow.LineOAuthStateHash))
        {
            return AppResult<OnboardingContextDto>.NotFound("line_state_invalid");
        }
        flow.LineOAuthStateHash = null;
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<OnboardingContextDto>.Success(await ToContextAsync(flow, cancellationToken));
    }

    public async Task<ActiveOnboardingFlow?> GetActiveFlowAsync(string token, CancellationToken cancellationToken)
    {
        var flow = await FindActiveFlowAsync(token, cancellationToken);
        var now = DateTime.UtcNow;
        var activationMemberId = flow?.ActivationInvitationId is Guid activationId
            ? await dbContext.MemberActivationInvitations.AsNoTracking()
                .Where(item => item.Id == activationId &&
                               item.Status == ActivationStatus.Active &&
                               item.ExpiresUtc > now)
                .Select(item => (Guid?)item.MemberId)
                .SingleOrDefaultAsync(cancellationToken)
            : null;
        if (flow is null || (flow.ActivationInvitationId is not null && activationMemberId is null))
        {
            return null;
        }

        return new ActiveOnboardingFlow(
            flow.Id,
            flow.Intent,
            flow.IsPublicDevice,
            flow.ActivationInvitationId,
            activationMemberId,
            flow.GroupJoinInviteId,
            flow.ReturnPath ?? string.Empty);
    }

    public async Task<AppResult<OnboardingFlowStart>> ResolveActivationAsync(
        string selector,
        string secret,
        bool isPublicDevice,
        string? returnPath,
        CancellationToken cancellationToken)
    {
        var normalizedSelector = selector.Trim();
        var invitation = await dbContext.MemberActivationInvitations
            .AsNoTracking()
            .SingleOrDefaultAsync(item => item.Selector == normalizedSelector, cancellationToken);

        if (invitation is null || !tokenService.VerifyToken(secret, invitation.SecretHash))
        {
            return AppResult<OnboardingFlowStart>.NotFound("activation_invalid");
        }

        if (invitation.Status == ActivationStatus.Used)
        {
            return AppResult<OnboardingFlowStart>.Conflict("activation_used");
        }

        if (invitation.Status is ActivationStatus.Revoked or ActivationStatus.IdentityMismatch)
        {
            return AppResult<OnboardingFlowStart>.Conflict("activation_revoked");
        }

        if (invitation.ExpiresUtc <= DateTime.UtcNow)
        {
            return AppResult<OnboardingFlowStart>.Conflict("activation_expired");
        }

        if (invitation.Status != ActivationStatus.Active)
        {
            return AppResult<OnboardingFlowStart>.Conflict("activation_not_delivered");
        }

        // Activation always creates the long-lived credential on the member's phone.
        // Keep accepting the legacy request field for wire compatibility, but never
        // turn an activation link into a credential-free public-device session.
        var (flow, flowToken) = CreateFlowEntity(OnboardingIntent.Activation, false, returnPath);
        flow.ActivationInvitationId = invitation.Id;
        dbContext.OnboardingFlows.Add(flow);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<OnboardingFlowStart>.Success(new OnboardingFlowStart(
            flowToken,
            new OnboardingContextDto("activation", false, flow.ReturnPath ?? string.Empty, invitation.Id, State: "active", DisplayName: (await dbContext.Members.FindAsync([invitation.MemberId], cancellationToken))?.DisplayName, ActivationMemberId: invitation.MemberId)));
    }

    public async Task<AppResult<bool>> MarkActivationMismatchAsync(string flowToken, CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => MarkActivationMismatchCoreAsync(flowToken, token),
            cancellationToken);

    private async Task<AppResult<bool>> MarkActivationMismatchCoreAsync(string flowToken, CancellationToken cancellationToken)
    {
        var flow = await FindActiveFlowAsync(flowToken, cancellationToken);
        if (flow?.ActivationInvitationId is not Guid activationId)
        {
            return AppResult<bool>.NotFound("activation_invalid");
        }

        var invitation = await dbContext.MemberActivationInvitations.SingleAsync(item => item.Id == activationId, cancellationToken);
        if (invitation.Status is ActivationStatus.Used or ActivationStatus.Revoked)
        {
            return AppResult<bool>.Conflict("activation_not_active");
        }

        invitation.Status = ActivationStatus.IdentityMismatch;
        invitation.RevokedUtc = DateTime.UtcNow;
        flow.ConsumedUtc = DateTime.UtcNow;
        dbContext.NotificationMessages.Add(new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = invitation.IssuedByMemberId,
            CreatedByMemberId = invitation.IssuedByMemberId,
            OccurredUtc = DateTime.UtcNow,
            ActionType = "identity.activation.identity_mismatch",
            ActionDataJson = JsonSerializer.Serialize(new
            {
                title = new { en = "Activation invitation rejected by recipient", zh = "收件人拒绝了激活邀请" },
                body = new { en = "The invitation was immediately disabled. Review the pre-registration before issuing another.", zh = "邀请已立即失效，请核对预登记资料后再决定是否重发。" },
                actionUrl = "/church/manage?section=members",
                sourceType = "memberActivationInvitation",
                sourceId = invitation.Id
            }),
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        AddAudit(null, "identity.activation.identity_mismatch", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }

    public Task<AppResult<IdentitySession>> CompletePublicDeviceActivationAsync(string flowToken, CancellationToken cancellationToken)
        => Task.FromResult(AppResult<IdentitySession>.Conflict("activation_mobile_passkey_required"));

    public async Task<AppResult<IdentitySession>> CompletePasskeyActivationAsync(
        Guid flowId,
        Guid pendingCredentialId,
        CancellationToken cancellationToken)
    {
        var flow = await dbContext.OnboardingFlows.SingleOrDefaultAsync(
            item => item.Id == flowId && item.ConsumedUtc == null && item.ExpiresUtc > DateTime.UtcNow,
            cancellationToken);
        if (flow is null || flow.IsPublicDevice)
        {
            return AppResult<IdentitySession>.NotFound("activation_flow_invalid");
        }

        return await CompleteActivationAsync(
            flow,
            "passkey",
            "standard",
            TimeSpan.FromDays(30),
            pendingCredentialId,
            cancellationToken);
    }

    public Task<AppResult<ActivationInvitationDto>> CreateActivationAsync(Guid actorMemberId, CreateActivationRequest request, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(token => CreateActivationCoreAsync(actorMemberId, request, token), cancellationToken);

    private async Task<AppResult<ActivationInvitationDto>> CreateActivationCoreAsync(
        Guid actorMemberId,
        CreateActivationRequest request,
        CancellationToken cancellationToken)
    {
        var church = await dbContext.Groups.AsNoTracking().SingleOrDefaultAsync(group => group.IsChurch, cancellationToken);
        var isPlatformAdmin = await groupAuthorization.IsAdminAsync(actorMemberId, cancellationToken);
        if (church is null ||
            !(isPlatformAdmin || await groupAuthorization.IsLeaderOrCoLeaderAsync(church.Id, actorMemberId, cancellationToken)))
        {
            return AppResult<ActivationInvitationDto>.Forbidden("activation_create_forbidden");
        }

        if (request.Purpose == ActivationPurpose.PasskeyRecovery && (!isPlatformAdmin || !request.IdentityVerified))
            return AppResult<ActivationInvitationDto>.Forbidden("passkey_recovery_forbidden");
        var displayName = request.DisplayName.Trim();
        var phone = NormalizePhone(request.PhoneE164);
        if (displayName.Length is < 2 or > 150 || phone is null)
        {
            return AppResult<ActivationInvitationDto>.Validation("activation_profile_invalid");
        }

        var grants = request.Grants
            .Append(new ActivationGrantRequest(church.Id, MembershipRole.Member))
            .GroupBy(grant => grant.GroupId)
            .Select(group => group.OrderByDescending(grant => grant.Role).First())
            .ToArray();

        foreach (var grant in grants)
        {
            if (!isPlatformAdmin &&
                !await groupAuthorization.IsLeaderOrCoLeaderAsync(grant.GroupId, actorMemberId, cancellationToken))
            {
                return AppResult<ActivationInvitationDto>.Forbidden("activation_grant_forbidden");
            }
        }

        var matches = await dbContext.Members.Where(member => member.PhoneE164 == phone).ToListAsync(cancellationToken);
        if (matches.Count > 1)
        {
            return AppResult<ActivationInvitationDto>.Conflict("phone_match_ambiguous");
        }

        var member = matches.SingleOrDefault();
        if (request.Purpose == ActivationPurpose.PasskeyRecovery && (member is null || member.Id == actorMemberId))
            return AppResult<ActivationInvitationDto>.Forbidden("passkey_recovery_forbidden");
        if (member?.IsRegistered == true && request.Purpose == ActivationPurpose.FirstActivation)
        {
            return AppResult<ActivationInvitationDto>.Conflict("member_already_registered");
        }

        var now = DateTime.UtcNow;
        if (member is null)
        {
            member = new Member
            {
                Id = Guid.NewGuid(),
                DisplayName = displayName,
                PhoneE164 = phone,
                IsRegistered = false,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            dbContext.Members.Add(member);
        }
        else
        {
            member.DisplayName ??= displayName;
            member.PhoneE164 = phone;
            member.UpdatedUtc = now;
        }

        return await IssueActivationAsync(
            actorMemberId,
            member,
            request.Purpose,
            grants,
            cancellationToken);
    }

    private async Task<AppResult<ActivationInvitationDto>> IssueActivationAsync(
        Guid actorMemberId,
        Member member,
        ActivationPurpose purpose,
        IReadOnlyList<ActivationGrantRequest> grants,
        CancellationToken cancellationToken, Guid? recoveryGroupId = null, Guid? sourceApplicationId = null)
    {
        var now = DateTime.UtcNow;
        var previous = await dbContext.MemberActivationInvitations
            .Where(item => item.MemberId == member.Id &&
                           (item.Status == ActivationStatus.Active || item.Status == ActivationStatus.PendingDelivery))
            .ToListAsync(cancellationToken);
        foreach (var item in previous)
        {
            item.Status = ActivationStatus.Revoked;
            item.RevokedUtc = now;
            AddAudit(actorMemberId, "identity.activation.revoked_on_reissue", nameof(MemberActivationInvitation), item.Id, member.Id);
        }

        var selector = tokenService.CreateSecret(16);
        var secret = tokenService.CreateSecret();
        var invitation = new MemberActivationInvitation
        {
            Id = Guid.NewGuid(),
            MemberId = member.Id,
            IssuedByMemberId = actorMemberId,
            RecoveryGroupId = recoveryGroupId,
            SourceApplicationId = sourceApplicationId,
            Selector = selector,
            SecretHash = tokenService.HashToken(secret),
            Purpose = purpose,
            Status = ActivationStatus.Active,
            DeliveryStatus = MessageDeliveryStatus.Manual,
            CreatedUtc = now,
            ExpiresUtc = purpose == ActivationPurpose.PasskeyRecovery ? now.AddMinutes(10) : now.AddHours(72),
            Grants = grants.Select(grant => new ActivationGroupGrant
            {
                Id = Guid.NewGuid(),
                GroupId = grant.GroupId,
                Role = grant.Role,
                Status = StagedGrantStatus.Pending,
                CreatedUtc = now,
                UpdatedUtc = now
            }).ToList()
        };
        dbContext.MemberActivationInvitations.Add(invitation);
        AddAudit(actorMemberId, "identity.activation.created", nameof(MemberActivationInvitation), invitation.Id, member.Id);
        if (purpose == ActivationPurpose.PasskeyRecovery)
            AddAudit(actorMemberId, "identity.recovery.identity_verified", nameof(MemberActivationInvitation), invitation.Id, member.Id, recoveryGroupId);
        AddAudit(actorMemberId, "identity.activation.delivery_manual", nameof(MemberActivationInvitation), invitation.Id, member.Id);
        await dbContext.SaveChangesAsync(cancellationToken);

        var url = $"{configuration.FrontendBaseUrl}/activate/{selector}#{secret}";
        return AppResult<ActivationInvitationDto>.Success(ToActivationDto(
            invitation,
            member,
            new ManualActivationMessageDto(
                member.PhoneE164 ?? string.Empty,
                BuildManualActivationMessage(url))));
    }

    public async Task<AppResult<IReadOnlyList<ActivationInvitationDto>>> ListActivationsAsync(
        Guid actorMemberId,
        CancellationToken cancellationToken)
    {
        var churchId = await dbContext.Groups.AsNoTracking().Where(group => group.IsChurch).Select(group => group.Id).SingleOrDefaultAsync(cancellationToken);
        if (churchId == Guid.Empty || !await CanManageChurchAsync(actorMemberId, churchId, cancellationToken))
        {
            return AppResult<IReadOnlyList<ActivationInvitationDto>>.Forbidden("activation_list_forbidden");
        }

        var invitations = await dbContext.MemberActivationInvitations
            .AsNoTracking()
            .Include(item => item.Member)
            .Include(item => item.Grants)
            .OrderByDescending(item => item.CreatedUtc)
            .Take(100)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<ActivationInvitationDto>>.Success(
            invitations.Select(item => ToActivationDto(item, item.Member, null)).ToArray());
    }

    public async Task<AppResult<ActivationInvitationDto>> ResendActivationAsync(
        Guid actorMemberId,
        Guid activationId,
        CancellationToken cancellationToken)
    {
        var invitation = await dbContext.MemberActivationInvitations.AsNoTracking()
            .Include(item => item.Member)
            .Include(item => item.Grants)
            .SingleOrDefaultAsync(item => item.Id == activationId, cancellationToken);
        if (invitation is null)
        {
            return AppResult<ActivationInvitationDto>.NotFound("activation_not_found");
        }
        if (invitation.Purpose == ActivationPurpose.PasskeyRecovery)
            return await groupAuthorization.IsAdminAsync(actorMemberId, cancellationToken)
                ? AppResult<ActivationInvitationDto>.Conflict("recovery_reissue_requires_verification")
                : AppResult<ActivationInvitationDto>.Forbidden("passkey_recovery_forbidden");
        return await CreateActivationAsync(actorMemberId, new CreateActivationRequest(
            invitation.Member.DisplayName ?? string.Empty,
            invitation.Member.PhoneE164 ?? string.Empty,
            invitation.Purpose,
            invitation.Grants.Select(grant => new ActivationGrantRequest(grant.GroupId, grant.Role)).ToArray()), cancellationToken);
    }

    public async Task<AppResult<bool>> RevokeActivationAsync(Guid actorMemberId, Guid activationId, CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => RevokeActivationCoreAsync(actorMemberId, activationId, token),
            cancellationToken);

    private async Task<AppResult<bool>> RevokeActivationCoreAsync(Guid actorMemberId, Guid activationId, CancellationToken cancellationToken)
    {
        var invitation = await dbContext.MemberActivationInvitations
            .Include(item => item.Grants)
            .SingleOrDefaultAsync(item => item.Id == activationId, cancellationToken);
        if (invitation is null)
        {
            return AppResult<bool>.NotFound("activation_not_found");
        }

        var churchId = await dbContext.Groups.AsNoTracking().Where(group => group.IsChurch).Select(group => group.Id).SingleAsync(cancellationToken);
        if (!await CanManageChurchAsync(actorMemberId, churchId, cancellationToken))
        {
            return AppResult<bool>.Forbidden("activation_revoke_forbidden");
        }

        if (invitation.Status == ActivationStatus.Used)
        {
            return AppResult<bool>.Conflict("activation_used");
        }

        invitation.Status = ActivationStatus.Revoked;
        invitation.RevokedUtc = DateTime.UtcNow;
        foreach (var grant in invitation.Grants.Where(grant => grant.Status == StagedGrantStatus.Pending))
        {
            grant.Status = StagedGrantStatus.Revoked;
            grant.UpdatedUtc = DateTime.UtcNow;
        }
        AddAudit(actorMemberId, "identity.activation.revoked", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }

    public async Task<AppResult<GroupJoinInviteDto>> GetOrCreateGroupInviteAsync(
        Guid actorMemberId,
        Guid groupId,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => GetOrCreateGroupInviteCoreAsync(actorMemberId, groupId, token),
            cancellationToken);

    private async Task<AppResult<GroupJoinInviteDto>> GetOrCreateGroupInviteCoreAsync(
        Guid actorMemberId,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorMemberId, cancellationToken))
        {
            return AppResult<GroupJoinInviteDto>.Forbidden("join_invite_forbidden");
        }

        var invite = await dbContext.GroupJoinInvites
            .Where(item => item.GroupId == groupId &&
                           (item.Status == GroupJoinInviteStatus.Active || item.Status == GroupJoinInviteStatus.Paused))
            .OrderByDescending(item => item.CreatedUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (invite is null)
        {
            invite = CreateGroupInvite(groupId, actorMemberId);
            dbContext.GroupJoinInvites.Add(invite);
            AddAudit(actorMemberId, "identity.group_invite.created", nameof(GroupJoinInvite), invite.Id, groupId: groupId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        else if (invite.ExpiresUtc <= DateTime.UtcNow)
        {
            var expiredInviteId = invite.Id;
            invite.Status = GroupJoinInviteStatus.Expired;
            invite.UpdatedUtc = DateTime.UtcNow;
            invite = CreateGroupInvite(groupId, actorMemberId);
            dbContext.GroupJoinInvites.Add(invite);
            AddAudit(actorMemberId, "identity.group_invite.expired", nameof(GroupJoinInvite), expiredInviteId, groupId: groupId);
            AddAudit(actorMemberId, "identity.group_invite.created", nameof(GroupJoinInvite), invite.Id, groupId: groupId);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return AppResult<GroupJoinInviteDto>.Success(ToInviteDto(invite, includeUrl: true));
    }

    public async Task<AppResult<GroupJoinInviteDto>> GetGroupInviteAsync(
        Guid actorMemberId,
        Guid groupId,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorMemberId, cancellationToken))
        {
            return AppResult<GroupJoinInviteDto>.Forbidden("join_invite_forbidden");
        }
        var invite = await dbContext.GroupJoinInvites.AsNoTracking()
            .Where(item => item.GroupId == groupId &&
                           (item.Status == GroupJoinInviteStatus.Active || item.Status == GroupJoinInviteStatus.Paused))
            .OrderByDescending(item => item.CreatedUtc)
            .FirstOrDefaultAsync(cancellationToken);
        return invite is null
            ? AppResult<GroupJoinInviteDto>.NotFound("join_invite_not_found")
            : AppResult<GroupJoinInviteDto>.Success(ToInviteDto(invite, includeUrl: true));
    }

    public async Task<AppResult<GroupJoinInviteDto>> ChangeGroupInviteStatusAsync(
        Guid actorMemberId,
        Guid groupId,
        string action,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => ChangeGroupInviteStatusCoreAsync(actorMemberId, groupId, action, token),
            cancellationToken);

    private async Task<AppResult<GroupJoinInviteDto>> ChangeGroupInviteStatusCoreAsync(
        Guid actorMemberId,
        Guid groupId,
        string action,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorMemberId, cancellationToken))
        {
            return AppResult<GroupJoinInviteDto>.Forbidden("join_invite_forbidden");
        }

        var current = await dbContext.GroupJoinInvites
            .Where(item => item.GroupId == groupId &&
                           (item.Status == GroupJoinInviteStatus.Active || item.Status == GroupJoinInviteStatus.Paused))
            .OrderByDescending(item => item.CreatedUtc)
            .FirstOrDefaultAsync(cancellationToken);
        if (current is null)
        {
            return AppResult<GroupJoinInviteDto>.NotFound("join_invite_not_found");
        }

        var normalizedAction = action.Trim().ToLowerInvariant();
        GroupJoinInvite result = current;
        switch (normalizedAction)
        {
            case "pause" when current.Status == GroupJoinInviteStatus.Active:
                current.Status = GroupJoinInviteStatus.Paused;
                break;
            case "resume" when current.Status == GroupJoinInviteStatus.Paused && current.ExpiresUtc > DateTime.UtcNow:
                current.Status = GroupJoinInviteStatus.Active;
                break;
            case "revoke":
                current.Status = GroupJoinInviteStatus.Revoked;
                break;
            case "rotate":
                current.Status = GroupJoinInviteStatus.Rotated;
                result = CreateGroupInvite(groupId, actorMemberId);
                dbContext.GroupJoinInvites.Add(result);
                break;
            default:
                return AppResult<GroupJoinInviteDto>.Validation("join_invite_action_invalid");
        }

        current.UpdatedUtc = DateTime.UtcNow;
        AddAudit(actorMemberId, $"identity.group_invite.{normalizedAction}", nameof(GroupJoinInvite), current.Id, groupId: groupId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<GroupJoinInviteDto>.Success(ToInviteDto(result, includeUrl: true));
    }

    public async Task<AppResult<OnboardingFlowStart>> ResolveGroupInviteAsync(
        string selector,
        string signature,
        bool isPublicDevice,
        string? returnPath,
        CancellationToken cancellationToken)
    {
        var invite = await dbContext.GroupJoinInvites
            .AsNoTracking()
            .Include(item => item.Group)
            .SingleOrDefaultAsync(item => item.Selector == selector.Trim(), cancellationToken);
        if (invite is null || !tokenService.VerifyGroupInvite(invite.Selector, invite.Version, signature))
        {
            return AppResult<OnboardingFlowStart>.NotFound("join_invite_invalid");
        }

        if (invite.Status == GroupJoinInviteStatus.Expired || invite.ExpiresUtc <= DateTime.UtcNow)
        {
            return AppResult<OnboardingFlowStart>.Conflict("join_invite_expired");
        }
        if (invite.Status == GroupJoinInviteStatus.Paused)
        {
            return AppResult<OnboardingFlowStart>.Conflict("join_invite_paused");
        }
        if (invite.Status != GroupJoinInviteStatus.Active)
        {
            return AppResult<OnboardingFlowStart>.Conflict("join_invite_revoked");
        }
        var (flow, token) = CreateFlowEntity(OnboardingIntent.GroupJoin, isPublicDevice, returnPath);
        flow.GroupJoinInviteId = invite.Id;
        dbContext.OnboardingFlows.Add(flow);
        await dbContext.SaveChangesAsync(cancellationToken);
        var names = ReadLocalized(invite.Group.NameJson);
        return AppResult<OnboardingFlowStart>.Success(new OnboardingFlowStart(token, new OnboardingContextDto(
            "groupJoin",
            isPublicDevice,
            flow.ReturnPath ?? string.Empty,
            GroupJoinInviteId: invite.Id,
            GroupNameEn: names.En,
            GroupNameZh: names.Zh,
            State: "active")));
    }

    public async Task<AppResult<MembershipApplicationDto>> SubmitGroupApplicationAsync(
        string flowToken,
        Guid? applicantMemberId,
        SubmitGroupApplicationRequest request,
        CancellationToken cancellationToken, string? browserToken = null)
        => await serializableExecutor.ExecuteAsync(
            token => SubmitGroupApplicationCoreAsync(flowToken, applicantMemberId, request, token, browserToken),
            cancellationToken);

    private async Task<AppResult<MembershipApplicationDto>> SubmitGroupApplicationCoreAsync(
        string flowToken,
        Guid? applicantMemberId,
        SubmitGroupApplicationRequest request,
        CancellationToken cancellationToken, string? browserToken = null)
    {
        var flow = await FindActiveFlowAsync(flowToken, cancellationToken);
        if (flow?.GroupJoinInviteId is not Guid inviteId)
        {
            return AppResult<MembershipApplicationDto>.NotFound("join_flow_invalid");
        }

        var invite = await dbContext.GroupJoinInvites.Include(item => item.Group).SingleAsync(item => item.Id == inviteId, cancellationToken);
        if (invite.Status != GroupJoinInviteStatus.Active || invite.ExpiresUtc <= DateTime.UtcNow)
        {
            return AppResult<MembershipApplicationDto>.Conflict("join_invite_not_active");
        }

        if (!string.IsNullOrWhiteSpace(request.Honeypot) ||
            DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() - request.FormStartedUnixMilliseconds < 2000)
        {
            return AppResult<MembershipApplicationDto>.Validation("application_invalid");
        }

        var displayName = request.DisplayName.Trim();
        var phone = NormalizePhone(request.PhoneE164);
        if (displayName.Length is < 2 or > 150 || (!string.IsNullOrWhiteSpace(request.PhoneE164) && phone is null) ||
            !request.PrivacyConsent || request.Declaration.Trim().Length is < 2 or > 2000 ||
            request.PrivacyConsentVersion.Trim().Length == 0)
        {
            return AppResult<MembershipApplicationDto>.Validation("application_invalid");
        }

        if (applicantMemberId is Guid memberId && await dbContext.GroupMembershipApplications.AnyAsync(
                item => item.GroupId == invite.GroupId && item.ApplicantMemberId == memberId && ActiveApplicationStatuses.Contains(item.Status),
                cancellationToken))
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_already_active");
        }

        var phoneHash = phone is null ? null : tokenService.HashLookup(phone);
        var browserHash = string.IsNullOrWhiteSpace(browserToken) ? null : tokenService.HashToken(browserToken);
        if (browserHash is not null && await dbContext.GroupMembershipApplications.AnyAsync(item => item.GroupId == invite.GroupId && item.BrowserTokenHash == browserHash && item.BrowserTokenExpiresUtc > DateTime.UtcNow && item.BrowserTokenConsumedUtc == null && item.Status != MembershipApplicationStatus.Rejected, cancellationToken))
            return AppResult<MembershipApplicationDto>.Conflict("application_already_active");
        if (applicantMemberId is null && phoneHash is not null && await dbContext.GroupMembershipApplications.AnyAsync(
                item => item.GroupId == invite.GroupId &&
                        item.ChurchPersonApplication.PhoneLookupHash == phoneHash &&
                        ActiveApplicationStatuses.Contains(item.Status),
                cancellationToken))
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_already_active");
        }

        Member? applicant = null;
        var personStatus = MembershipApplicationStatus.Submitted;
        var matchState = ApplicantMatchState.None;
        if (applicantMemberId is Guid id)
        {
            applicant = await dbContext.Members.SingleOrDefaultAsync(member => member.Id == id && member.IsRegistered, cancellationToken);
            if (applicant is null)
            {
                return AppResult<MembershipApplicationDto>.Forbidden("registered_member_required");
            }
            displayName = applicant.DisplayName?.Trim() is { Length: > 1 } accountName ? accountName : displayName;
            var accountPhone = NormalizePhone(applicant.PhoneE164);
            if (accountPhone is not null && phone is not null && !string.Equals(accountPhone, phone, StringComparison.Ordinal))
            {
                return AppResult<MembershipApplicationDto>.Validation("application_profile_phone_mismatch");
            }
            phone = accountPhone ?? phone;
            phoneHash = phone is null ? null : tokenService.HashLookup(phone);
            matchState = ApplicantMatchState.Linked;
            var churchId = await dbContext.Groups.AsNoTracking().Where(group => group.IsChurch).Select(group => group.Id).SingleAsync(cancellationToken);
            if (await dbContext.GroupMemberships.AnyAsync(
                    membership => membership.GroupId == churchId && membership.MemberId == id && membership.Status == MembershipStatus.Approved,
                    cancellationToken))
            {
                personStatus = MembershipApplicationStatus.Approved;
            }
        }
        else
        {
            var matchCount = phone is null ? 0 : await dbContext.Members.CountAsync(member => member.PhoneE164 == phone, cancellationToken);
            matchState = matchCount switch
            {
                0 => ApplicantMatchState.None,
                1 => ApplicantMatchState.Possible,
                _ => ApplicantMatchState.Ambiguous
            };
        }

        var now = DateTime.UtcNow;
        var person = new ChurchPersonApplication
        {
            Id = Guid.NewGuid(),
            ApplicantMemberId = applicant?.Id,
            LinkedMemberId = applicant?.Id,
            DisplayName = displayName,
            PhoneE164 = phone,
            PhoneLookupHash = phoneHash,
            ReplyPreference = NormalizeReplyPreference(request.ReplyPreference),
            PreferredLanguage = NormalizeLanguage(request.PreferredLanguage),
            Declaration = request.Declaration.Trim(),
            PrivacyConsentVersion = request.PrivacyConsentVersion.Trim(),
            PrivacyConsentedUtc = now,
            IsContactVerified = applicant?.PhoneVerifiedUtc is not null,
            MatchState = matchState,
            Status = personStatus,
            SubmittedUtc = now,
            UpdatedUtc = now
        };
        var application = new GroupMembershipApplication
        {
            BrowserTokenHash = browserHash,
            BrowserTokenExpiresUtc = browserHash is null ? null : now.AddHours(72),
            Id = Guid.NewGuid(),
            ChurchPersonApplicationId = person.Id,
            GroupId = invite.GroupId,
            GroupJoinInviteId = invite.Id,
            ApplicantMemberId = applicant?.Id,
            DeduplicationKey = tokenService.HashLookup($"membership-application\n{invite.GroupId}\n{applicant?.Id.ToString() ?? phone ?? browserToken ?? tokenService.CreateSecret()}"),
            Status = MembershipApplicationStatus.Submitted,
            Source = "groupJoinQr",
            SubmittedUtc = now,
            UpdatedUtc = now
        };
        application.History.Add(new ApplicationHistory
        {
            Id = Guid.NewGuid(),
            ActorMemberId = applicant?.Id,
            Kind = ApplicationDecisionKind.Submitted,
            FromStatus = MembershipApplicationStatus.Submitted,
            ToStatus = MembershipApplicationStatus.Submitted,
            CreatedUtc = now
        });
        dbContext.ChurchPersonApplications.Add(person);
        dbContext.GroupMembershipApplications.Add(application);
        invite.LastUsedUtc = now;
        invite.SubmissionCount++;
        flow.ConsumedUtc = now;
        AddAudit(applicant?.Id, "identity.membership_application.submitted", nameof(GroupMembershipApplication), application.Id, applicant?.Id, invite.GroupId);
        await dbContext.SaveChangesAsync(cancellationToken);

        application.Group = invite.Group;
        application.ChurchPersonApplication = person;
        return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(application));
    }

    public async Task<AppResult<OnboardingFlowStart>> ResolveApplicationResponseAsync(
        string selector,
        string secret,
        CancellationToken cancellationToken)
    {
        var token = await dbContext.ApplicationResponseTokens.AsNoTracking()
            .Include(item => item.GroupMembershipApplication)
                .ThenInclude(item => item.Group)
            .SingleOrDefaultAsync(item => item.Selector == selector.Trim(), cancellationToken);
        if (token is null || !tokenService.VerifyToken(secret, token.SecretHash))
        {
            return AppResult<OnboardingFlowStart>.NotFound("application_response_invalid");
        }
        if (token.ConsumedUtc is not null || token.RevokedUtc is not null)
        {
            return AppResult<OnboardingFlowStart>.Conflict("application_response_used");
        }
        if (token.ExpiresUtc <= DateTime.UtcNow)
        {
            return AppResult<OnboardingFlowStart>.Conflict("application_response_expired");
        }
        if (token.GroupMembershipApplication.Status != MembershipApplicationStatus.NeedsInfo)
        {
            return AppResult<OnboardingFlowStart>.Conflict("application_response_not_required");
        }

        var (flow, flowToken) = CreateFlowEntity(OnboardingIntent.ApplicationResponse, false, null);
        flow.ApplicationResponseTokenId = token.Id;
        dbContext.OnboardingFlows.Add(flow);
        await dbContext.SaveChangesAsync(cancellationToken);
        var names = ReadLocalized(token.GroupMembershipApplication.Group.NameJson);
        return AppResult<OnboardingFlowStart>.Success(new OnboardingFlowStart(
            flowToken,
            new OnboardingContextDto(
                "applicationResponse",
                false,
                string.Empty,
                GroupApplicationId: token.GroupMembershipApplicationId,
                GroupNameEn: names.En,
                GroupNameZh: names.Zh,
                State: "needsInfo")));
    }

    public async Task<AppResult<MembershipApplicationDto>> SupplementApplicationAsync(
        string flowToken,
        Guid? memberId,
        Guid? applicationId,
        string note,
        string? rowVersion,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => SupplementApplicationCoreAsync(flowToken, memberId, applicationId, note, rowVersion, token),
            cancellationToken);

    private async Task<AppResult<MembershipApplicationDto>> SupplementApplicationCoreAsync(
        string flowToken,
        Guid? memberId,
        Guid? applicationId,
        string note,
        string? rowVersion,
        CancellationToken cancellationToken)
    {
        var normalizedNote = note.Trim();
        if (normalizedNote.Length is < 2 or > 2000)
        {
            return AppResult<MembershipApplicationDto>.Validation("application_supplement_invalid");
        }

        OnboardingFlow? flow = null;
        ApplicationResponseToken? responseToken = null;
        GroupMembershipApplication? application;
        if (memberId is Guid actorMemberId && applicationId is Guid selectedApplicationId)
        {
            application = await LoadApplicationAsync(selectedApplicationId, cancellationToken);
            if (application is null ||
                (application.ApplicantMemberId != actorMemberId && application.ChurchPersonApplication.LinkedMemberId != actorMemberId))
            {
                return AppResult<MembershipApplicationDto>.NotFound("application_not_found");
            }
            if (!MatchesRowVersion(application.RowVersion, rowVersion))
            {
                return AppResult<MembershipApplicationDto>.Conflict("application_changed");
            }
        }
        else
        {
            flow = await FindActiveFlowAsync(flowToken, cancellationToken);
            if (flow?.ApplicationResponseTokenId is not Guid responseTokenId)
            {
                return AppResult<MembershipApplicationDto>.NotFound("application_response_invalid");
            }
            responseToken = await dbContext.ApplicationResponseTokens
                .SingleOrDefaultAsync(item => item.Id == responseTokenId, cancellationToken);
            if (responseToken is null || responseToken.ConsumedUtc is not null || responseToken.RevokedUtc is not null || responseToken.ExpiresUtc <= DateTime.UtcNow)
            {
                return AppResult<MembershipApplicationDto>.Conflict("application_response_used");
            }
            application = await LoadApplicationAsync(responseToken.GroupMembershipApplicationId, cancellationToken);
        }

        if (application is null || application.Status != MembershipApplicationStatus.NeedsInfo)
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_response_not_required");
        }

        var from = application.Status;
        application.Status = MembershipApplicationStatus.Submitted;
        application.UpdatedUtc = DateTime.UtcNow;
        if (application.ChurchPersonApplication.Status == MembershipApplicationStatus.NeedsInfo)
        {
            application.ChurchPersonApplication.Status = MembershipApplicationStatus.Submitted;
            application.ChurchPersonApplication.UpdatedUtc = application.UpdatedUtc;
        }
        if (responseToken is not null) responseToken.ConsumedUtc = application.UpdatedUtc;
        if (flow is not null) flow.ConsumedUtc = application.UpdatedUtc;
        AddHistory(application, memberId, ApplicationDecisionKind.Supplemented, from, application.Status, normalizedNote);
        AddAudit(memberId, "identity.membership_application.supplemented", nameof(GroupMembershipApplication), application.Id, application.ApplicantMemberId, application.GroupId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(application));
    }

    public async Task<AppResult<MembershipApplicationPageDto>> ListGroupApplicationsAsync(
        Guid actorMemberId,
        Guid groupId,
        string? status,
        string? search,
        string? sort,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorMemberId, cancellationToken))
        {
            return AppResult<MembershipApplicationPageDto>.Forbidden("application_list_forbidden");
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 50);
        var query = dbContext.GroupMembershipApplications.AsNoTracking()
            .Include(item => item.Group)
            .Include(item => item.ChurchPersonApplication)
            .Include(item => item.History)
            .Where(item => item.GroupId == groupId);

        if (Enum.TryParse<MembershipApplicationStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(item => item.Status == parsedStatus);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item => item.ChurchPersonApplication.DisplayName.Contains(term));
        }

        var total = await query.CountAsync(cancellationToken);
        query = string.Equals(sort, "oldest", StringComparison.OrdinalIgnoreCase)
            ? query.OrderBy(item => item.SubmittedUtc)
            : query.OrderByDescending(item => item.SubmittedUtc);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var responseDelivery = await LoadLatestResponseDeliveryAsync(items.Select(item => item.Id), cancellationToken);
        var activationDelivery = await LoadLatestActivationDeliveryAsync(
            items.Select(item => item.ChurchPersonApplication.LinkedMemberId ?? item.ApplicantMemberId),
            cancellationToken);
        return AppResult<MembershipApplicationPageDto>.Success(new MembershipApplicationPageDto(
            items.Select(item => ToApplicationDto(
                item,
                responseDelivery.TryGetValue(item.Id, out var responseStatus) ? responseStatus : null,
                ResolveActivationDelivery(item, activationDelivery))).ToArray(), page, pageSize, total));
    }

    public Task<AppResult<MembershipApplicationDto>> DecideGroupApplicationAsync(Guid actorMemberId, Guid groupId, Guid applicationId, DecideMembershipApplicationRequest request, CancellationToken cancellationToken)
        => serializableExecutor.ExecuteAsync(token => DecideAndIssueGroupApplicationAsync(actorMemberId, groupId, applicationId, request, token), cancellationToken);

    private async Task<AppResult<MembershipApplicationDto>> DecideAndIssueGroupApplicationAsync(
        Guid actorMemberId,
        Guid groupId,
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
    {
        var result = await serializableExecutor.ExecuteAsync(
            token => DecideGroupApplicationCoreAsync(actorMemberId, groupId, applicationId, request, token),
            cancellationToken);
        if (!result.IsSuccess || request.Decision != ApplicationDecisionKind.Approved)
        {
            return result;
        }

        var application = await LoadApplicationAsync(applicationId, cancellationToken);
        var memberId = application?.ChurchPersonApplication.LinkedMemberId ?? application?.ApplicantMemberId;
        if (application is null || memberId is null)
        {
            return result;
        }

        var member = await dbContext.Members.SingleAsync(item => item.Id == memberId.Value, cancellationToken);
        var hasPasskey = await dbContext.MemberPasskeyCredentials.AnyAsync(
            credential => credential.MemberId == member.Id && credential.RevokedUtc == null,
            cancellationToken);
        if (hasPasskey || member.IsRegistered || !await IsOrdinaryMemberAsync(member.Id, cancellationToken))
        {
            return result;
        }

        var churchId = await dbContext.Groups.AsNoTracking()
            .Where(group => group.IsChurch)
            .Select(group => group.Id)
            .SingleAsync(cancellationToken);
        var activation = await IssueActivationAsync(
            actorMemberId,
            member,
            ActivationPurpose.FirstActivation,
            [
                new ActivationGrantRequest(churchId, MembershipRole.Member),
                new ActivationGrantRequest(groupId, MembershipRole.Member)
            ],
            cancellationToken, sourceApplicationId: application.Id);

        return activation.IsSuccess
            ? AppResult<MembershipApplicationDto>.Success(ToApplicationDto(
                application,
                activationDeliveryStatus: activation.Value!.DeliveryStatus,
                manualActivationMessage: application.BrowserTokenHash is null ? activation.Value.ManualActivationMessage : null))
            : result;
    }

    private async Task<AppResult<MembershipApplicationDto>> DecideGroupApplicationCoreAsync(
        Guid actorMemberId,
        Guid groupId,
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorization.IsLeaderOrCoLeaderAsync(groupId, actorMemberId, cancellationToken))
        {
            return AppResult<MembershipApplicationDto>.Forbidden("application_decision_forbidden");
        }

        var application = await LoadApplicationAsync(applicationId, cancellationToken);
        if (application is null || application.GroupId != groupId)
        {
            return AppResult<MembershipApplicationDto>.NotFound("application_not_found");
        }
        if (request.LinkedMemberId == actorMemberId || application.ApplicantMemberId == actorMemberId || application.ChurchPersonApplication.LinkedMemberId == actorMemberId)
        {
            return AppResult<MembershipApplicationDto>.Forbidden("self_approval_forbidden");
        }
        if (!MatchesRowVersion(application.RowVersion, request.RowVersion))
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_changed");
        }
        if (application.Status is MembershipApplicationStatus.Approved or MembershipApplicationStatus.Rejected)
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_terminal");
        }

        var from = application.Status;
        MessageDeliveryStatus? responseDeliveryStatus = null;
        switch (request.Decision)
        {
            case ApplicationDecisionKind.Approved:
                var person = application.ChurchPersonApplication;
                if (!person.IsIdentityVerified && !request.IdentityVerified && !request.ContactVerified)
                {
                    return AppResult<MembershipApplicationDto>.Conflict("identity_verification_required");
                }
                if (!person.IsIdentityVerified)
                {
                    person.IsIdentityVerified = true;
                    person.IdentityVerifiedByMemberId = actorMemberId;
                    person.IdentityVerifiedUtc = DateTime.UtcNow;
                    AddAudit(actorMemberId, "identity.person_application.identity_verified", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId);
                }
                if (request.ContactVerified && person.PhoneE164 is not null && !person.IsContactVerified)
                {
                    person.IsContactVerified = true;
                    AddAudit(actorMemberId, "identity.person_application.contact_verified", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId, groupId);
                }
                var wasLinked = person.LinkedMemberId is not null;
                if (!await ResolveApplicantMemberAsync(person, request.LinkedMemberId, cancellationToken))
                {
                    return AppResult<MembershipApplicationDto>.Conflict("existing_contact_link_required");
                }
                if (!wasLinked && person.LinkedMemberId is not null)
                {
                    AddHistory(application, actorMemberId, ApplicationDecisionKind.LinkedToMember, application.Status, application.Status, null);
                    AddAudit(actorMemberId, "identity.person_application.linked", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId, groupId);
                }
                var churchId = await dbContext.Groups.AsNoTracking()
                    .Where(group => group.IsChurch)
                    .Select(group => group.Id)
                    .SingleAsync(cancellationToken);
                person.Status = MembershipApplicationStatus.Approved;
                await EnsureApprovedMembershipAsync(churchId, person.LinkedMemberId!.Value, MembershipRole.Member, cancellationToken);
                application.Status = await MaterializeMembershipAsync(application, cancellationToken)
                    ? MembershipApplicationStatus.Approved
                    : MembershipApplicationStatus.ApprovedWaitingForChurch;
                break;
            case ApplicationDecisionKind.NeedsInfo:
                if (string.IsNullOrWhiteSpace(request.Note))
                {
                    return AppResult<MembershipApplicationDto>.Validation("decision_note_required");
                }
                application.Status = MembershipApplicationStatus.NeedsInfo;
                responseDeliveryStatus = await CreateApplicationResponseTokenAsync(application, cancellationToken);
                break;
            case ApplicationDecisionKind.Rejected:
                application.Status = MembershipApplicationStatus.Rejected;
                break;
            default:
                return AppResult<MembershipApplicationDto>.Validation("decision_invalid");
        }

        application.UpdatedUtc = DateTime.UtcNow;
        AddHistory(application, actorMemberId, request.Decision, from, application.Status, request.Note);
        AddAudit(actorMemberId, $"identity.membership_application.{ToCamel(request.Decision)}", nameof(GroupMembershipApplication), application.Id, application.ApplicantMemberId, groupId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(application, responseDeliveryStatus));
    }

    public async Task<AppResult<MembershipApplicationDto>> DecidePersonApplicationAsync(
        Guid actorMemberId,
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => DecidePersonApplicationCoreAsync(actorMemberId, applicationId, request, token),
            cancellationToken);

    private async Task<AppResult<MembershipApplicationDto>> DecidePersonApplicationCoreAsync(
        Guid actorMemberId,
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
    {
        var church = await dbContext.Groups.AsNoTracking().SingleOrDefaultAsync(group => group.IsChurch, cancellationToken);
        if (church is null || !await CanManageChurchAsync(actorMemberId, church.Id, cancellationToken))
        {
            return AppResult<MembershipApplicationDto>.Forbidden("person_application_decision_forbidden");
        }

        var application = await LoadApplicationAsync(applicationId, cancellationToken);
        if (application is null)
        {
            return AppResult<MembershipApplicationDto>.NotFound("application_not_found");
        }
        var person = application.ChurchPersonApplication;
        if (request.LinkedMemberId == actorMemberId || person.ApplicantMemberId == actorMemberId || person.LinkedMemberId == actorMemberId)
        {
            return AppResult<MembershipApplicationDto>.Forbidden("self_approval_forbidden");
        }
        if (!MatchesRowVersion(application.RowVersion, request.RowVersion))
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_changed");
        }
        if (person.Status is MembershipApplicationStatus.Approved or MembershipApplicationStatus.Rejected)
        {
            return AppResult<MembershipApplicationDto>.Conflict("application_terminal");
        }

        var groupFrom = application.Status;
        MessageDeliveryStatus? responseDeliveryStatus = null;
        switch (request.Decision)
        {
            case ApplicationDecisionKind.Approved:
                if (!person.IsIdentityVerified && !request.IdentityVerified && !request.ContactVerified)
                {
                    return AppResult<MembershipApplicationDto>.Conflict("identity_verification_required");
                }
                if (!person.IsIdentityVerified)
                {
                    person.IsIdentityVerified = true;
                    person.IdentityVerifiedByMemberId = actorMemberId;
                    person.IdentityVerifiedUtc = DateTime.UtcNow;
                    AddAudit(actorMemberId, "identity.person_application.identity_verified", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId);
                }
                if (request.ContactVerified && person.PhoneE164 is not null && !person.IsContactVerified)
                {
                    person.IsContactVerified = true;
                    AddAudit(actorMemberId, "identity.person_application.contact_verified", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId);
                }
                var wasLinked = person.LinkedMemberId is not null;
                var linkedResult = await ResolveApplicantMemberAsync(person, request.LinkedMemberId, cancellationToken);
                if (!linkedResult)
                {
                    return AppResult<MembershipApplicationDto>.Conflict("existing_contact_link_required");
                }
                if (!wasLinked && person.LinkedMemberId is not null)
                {
                    AddHistory(application, actorMemberId, ApplicationDecisionKind.LinkedToMember, application.Status, application.Status, null);
                    AddAudit(actorMemberId, "identity.person_application.linked", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId);
                }
                person.Status = MembershipApplicationStatus.Approved;
                await EnsureApprovedMembershipAsync(church.Id, person.LinkedMemberId!.Value, MembershipRole.Member, cancellationToken);
                if (application.Status == MembershipApplicationStatus.ApprovedWaitingForChurch)
                {
                    application.Status = await MaterializeMembershipAsync(application, cancellationToken)
                        ? MembershipApplicationStatus.Approved
                        : MembershipApplicationStatus.ApprovedWaitingForChurch;
                }
                break;
            case ApplicationDecisionKind.NeedsInfo:
                if (string.IsNullOrWhiteSpace(request.Note))
                {
                    return AppResult<MembershipApplicationDto>.Validation("decision_note_required");
                }
                person.Status = MembershipApplicationStatus.NeedsInfo;
                application.Status = MembershipApplicationStatus.NeedsInfo;
                responseDeliveryStatus = await CreateApplicationResponseTokenAsync(application, cancellationToken);
                break;
            case ApplicationDecisionKind.Rejected:
                person.Status = MembershipApplicationStatus.Rejected;
                application.Status = MembershipApplicationStatus.Rejected;
                break;
            default:
                return AppResult<MembershipApplicationDto>.Validation("decision_invalid");
        }

        person.UpdatedUtc = DateTime.UtcNow;
        application.UpdatedUtc = DateTime.UtcNow;
        AddHistory(application, actorMemberId, request.Decision, groupFrom, application.Status, request.Note);
        AddAudit(actorMemberId, $"identity.person_application.{ToCamel(request.Decision)}", nameof(ChurchPersonApplication), person.Id, person.LinkedMemberId);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<MembershipApplicationDto>.Success(ToApplicationDto(application, responseDeliveryStatus));
    }

    public async Task<AppResult<MembershipApplicationPageDto>> ListPersonApplicationsAsync(
        Guid actorMemberId,
        string? status,
        string? search,
        string? sort,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var churchId = await dbContext.Groups.AsNoTracking()
            .Where(group => group.IsChurch)
            .Select(group => group.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (churchId == Guid.Empty || !await CanManageChurchAsync(actorMemberId, churchId, cancellationToken))
        {
            return AppResult<MembershipApplicationPageDto>.Forbidden("person_application_list_forbidden");
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 50);
        var query = dbContext.GroupMembershipApplications.AsNoTracking()
            .Include(item => item.Group)
            .Include(item => item.ChurchPersonApplication)
            .Include(item => item.History)
            .AsQueryable();
        if (Enum.TryParse<MembershipApplicationStatus>(status, true, out var parsedStatus))
        {
            query = query.Where(item => item.ChurchPersonApplication.Status == parsedStatus);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();
            query = query.Where(item => item.ChurchPersonApplication.DisplayName.Contains(term));
        }
        var total = await query.CountAsync(cancellationToken);
        query = string.Equals(sort, "oldest", StringComparison.OrdinalIgnoreCase)
            ? query.OrderBy(item => item.SubmittedUtc)
            : query.OrderByDescending(item => item.SubmittedUtc);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        var responseDelivery = await LoadLatestResponseDeliveryAsync(items.Select(item => item.Id), cancellationToken);
        var activationDelivery = await LoadLatestActivationDeliveryAsync(
            items.Select(item => item.ChurchPersonApplication.LinkedMemberId ?? item.ApplicantMemberId),
            cancellationToken);
        return AppResult<MembershipApplicationPageDto>.Success(new MembershipApplicationPageDto(
            items.Select(item => ToApplicationDto(
                item,
                responseDelivery.TryGetValue(item.Id, out var responseStatus) ? responseStatus : null,
                ResolveActivationDelivery(item, activationDelivery))).ToArray(), page, pageSize, total));
    }

    public async Task<AppResult<IReadOnlyList<MembershipApplicationDto>>> ListPersonalApplicationsAsync(
        Guid memberId,
        CancellationToken cancellationToken)
    {
        var items = await dbContext.GroupMembershipApplications.AsNoTracking()
            .Include(item => item.Group)
            .Include(item => item.ChurchPersonApplication)
            .Include(item => item.History)
            .Where(item => item.ApplicantMemberId == memberId || item.ChurchPersonApplication.LinkedMemberId == memberId)
            .OrderByDescending(item => item.UpdatedUtc)
            .Take(100)
            .ToListAsync(cancellationToken);
        var responseDelivery = await LoadLatestResponseDeliveryAsync(items.Select(item => item.Id), cancellationToken);
        var activationDelivery = await LoadLatestActivationDeliveryAsync(
            items.Select(item => item.ChurchPersonApplication.LinkedMemberId ?? item.ApplicantMemberId),
            cancellationToken);
        return AppResult<IReadOnlyList<MembershipApplicationDto>>.Success(
            items.Select(item => ToApplicationDto(
                item,
                responseDelivery.TryGetValue(item.Id, out var responseStatus) ? responseStatus : null,
                ResolveActivationDelivery(item, activationDelivery))).ToArray());
    }

    public IReadOnlyList<AlphaAccountDto> ListAlphaAccounts()
        => configuration.AlphaLoginEnabled
            ? configuration.AlphaAccounts.Select(account => new AlphaAccountDto(account.AccountId, account.Label)).ToArray()
            : [];

    public async Task<AppResult<IdentitySession>> AlphaLoginAsync(
        string accountId,
        string? passkeyBootstrapCode,
        CancellationToken cancellationToken)
    {
        if (!configuration.AlphaLoginEnabled)
        {
            return AppResult<IdentitySession>.NotFound("alpha_login_disabled");
        }

        var configured = configuration.AlphaAccounts.SingleOrDefault(account =>
            string.Equals(account.AccountId, accountId.Trim(), StringComparison.Ordinal));
        if (configured is null)
        {
            AddAudit(null, "identity.alpha.denied", "AlphaAccount", null);
            await dbContext.SaveChangesAsync(cancellationToken);
            return AppResult<IdentitySession>.Forbidden("alpha_account_invalid");
        }

        var member = await LoadMemberForTokenAsync(configured.MemberId, cancellationToken);
        if (member?.IsRegistered != true)
        {
            AddAudit(null, "identity.alpha.denied", "AlphaAccount", null);
            await dbContext.SaveChangesAsync(cancellationToken);
            return AppResult<IdentitySession>.Forbidden("alpha_account_invalid");
        }

        var wantsPasskeyBootstrap = !string.IsNullOrWhiteSpace(passkeyBootstrapCode);
        if (wantsPasskeyBootstrap)
        {
            var suppliedHash = SHA256.HashData(Encoding.UTF8.GetBytes(passkeyBootstrapCode!.Trim()));
            var bootstrapAllowed = configured.PasskeyBootstrapCodeHash is { Length: > 0 } expectedHash &&
                                   CryptographicOperations.FixedTimeEquals(suppliedHash, expectedHash) &&
                                   !await dbContext.MemberPasskeyCredentials.AnyAsync(
                                       credential => credential.MemberId == member.Id,
                                       cancellationToken);
            if (!bootstrapAllowed)
            {
                AddAudit(null, "identity.alpha.bootstrap_denied", "AlphaAccount", null, member.Id);
                await dbContext.SaveChangesAsync(cancellationToken);
                return AppResult<IdentitySession>.Forbidden("alpha_passkey_bootstrap_invalid");
            }
        }

        var authenticationMethod = wantsPasskeyBootstrap ? "alpha_bootstrap" : "alpha";
        var returnPath = wantsPasskeyBootstrap ? "/profile" : "/enter";
        var token = jwtTokenService.CreateToken(member, authenticationMethod, "alpha", TimeSpan.FromHours(12));
        AddAudit(
            member.Id,
            wantsPasskeyBootstrap ? "identity.alpha.bootstrap_authenticated" : "identity.alpha.signed_in",
            "AlphaAccount",
            null,
            member.Id);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<IdentitySession>.Success(new IdentitySession(
            token.Token, token.ExpiresUtc, false, authenticationMethod, "alpha", returnPath));
    }

    private async Task<AppResult<IdentitySession>> CompleteActivationAsync(
        OnboardingFlow flow,
        string authenticationMethod,
        string sessionKind,
        TimeSpan lifetime,
        Guid? pendingCredentialId,
        CancellationToken cancellationToken)
        => await serializableExecutor.ExecuteAsync(
            token => CompleteActivationCoreAsync(
                flow,
                authenticationMethod,
                sessionKind,
                lifetime,
                pendingCredentialId,
                token),
            cancellationToken);

    private async Task<AppResult<IdentitySession>> CompleteActivationCoreAsync(
        OnboardingFlow flow,
        string authenticationMethod,
        string sessionKind,
        TimeSpan lifetime,
        Guid? pendingCredentialId,
        CancellationToken cancellationToken)
    {
        if (flow.ActivationInvitationId is not Guid invitationId)
        {
            return AppResult<IdentitySession>.NotFound("activation_flow_invalid");
        }

        var invitation = await dbContext.MemberActivationInvitations
            .Include(item => item.Member)
                .ThenInclude(member => member.PlatformRoles)
                    .ThenInclude(role => role.Role)
            .Include(item => item.Grants)
            .SingleOrDefaultAsync(item => item.Id == invitationId, cancellationToken);
        if (invitation is null || invitation.Status != ActivationStatus.Active || invitation.ExpiresUtc <= DateTime.UtcNow)
        {
            return AppResult<IdentitySession>.Conflict("activation_not_active");
        }
        if (pendingCredentialId is Guid credentialId)
        {
            var pendingCredential = dbContext.MemberPasskeyCredentials.Local.SingleOrDefault(
                credential => credential.Id == credentialId && credential.MemberId == invitation.MemberId);
            var alreadyPersisted = await dbContext.MemberPasskeyCredentials.AsNoTracking().AnyAsync(
                credential => credential.Id == credentialId,
                cancellationToken);
            if (pendingCredential is null || alreadyPersisted)
            {
                return AppResult<IdentitySession>.Conflict("passkey_required");
            }
        }

        if (invitation.Purpose == ActivationPurpose.PasskeyRecovery)
        {
            var allowed = invitation.RecoveryGroupId is Guid groupId
                ? await CanIssuePersonalPasskeyAsync(invitation.IssuedByMemberId, groupId, invitation.MemberId, cancellationToken)
                : invitation.IssuedByMemberId != invitation.MemberId && await groupAuthorization.IsAdminAsync(invitation.IssuedByMemberId, cancellationToken);
            if (!allowed)
            {
                AddAudit(invitation.IssuedByMemberId, "identity.recovery.denied", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
                return AppResult<IdentitySession>.Forbidden("passkey_recovery_forbidden");
            }
        }
        if (invitation.SourceApplicationId is Guid sourceId)
        {
            var application = await LoadApplicationAsync(sourceId, cancellationToken);
            if (application is null || application.BrowserTokenConsumedUtc is not null || application.BrowserTokenExpiresUtc <= DateTime.UtcNow ||
                !await CanActivateApplicationAsync(application, cancellationToken))
                return AppResult<IdentitySession>.Conflict("application_activation_unavailable");
            application.BrowserTokenConsumedUtc = DateTime.UtcNow;
        }
        var now = DateTime.UtcNow;
        if (invitation.Purpose == ActivationPurpose.PasskeyRecovery)
        {
            var oldCredentials = await dbContext.MemberPasskeyCredentials.Where(x => x.MemberId == invitation.MemberId && x.Id != pendingCredentialId && x.RevokedUtc == null).ToListAsync(cancellationToken);
            foreach (var credential in oldCredentials) credential.RevokedUtc = now;
            var ceremonies = await dbContext.PasskeyCeremonies.Where(x => x.MemberId == invitation.MemberId && x.ConsumedUtc == null).ToListAsync(cancellationToken);
            foreach (var ceremony in ceremonies) ceremony.ConsumedUtc = now;
            var invitations = await dbContext.MemberActivationInvitations.Where(x => x.MemberId == invitation.MemberId && x.Id != invitation.Id && x.Status == ActivationStatus.Active).ToListAsync(cancellationToken);
            foreach (var other in invitations) { other.Status = ActivationStatus.Revoked; other.RevokedUtc = now; }
            AddAudit(invitation.IssuedByMemberId, "identity.recovery.completed", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId, invitation.RecoveryGroupId);
        }
        invitation.Member.IsRegistered = true;
        // Passkey possession does not verify a telephone number.
        invitation.Member.WebAuthnUserHandle ??= System.Security.Cryptography.RandomNumberGenerator.GetBytes(32);
        invitation.Member.UpdatedUtc = now;
        foreach (var grant in invitation.Grants.Where(grant => grant.Status == StagedGrantStatus.Pending))
        {
            if (grant.Role == MembershipRole.Leader && await dbContext.GroupMemberships.AnyAsync(
                    membership => membership.GroupId == grant.GroupId &&
                                  membership.MemberId != invitation.MemberId &&
                                  membership.Status == MembershipStatus.Approved &&
                                  membership.Role == MembershipRole.Leader,
                    cancellationToken))
            {
                grant.Status = StagedGrantStatus.Conflict;
                grant.ConflictCode = "leader_already_exists";
                grant.UpdatedUtc = now;
                AddAudit(null, "identity.activation.grant_conflict", nameof(ActivationGroupGrant), grant.Id, invitation.MemberId, grant.GroupId);
                dbContext.NotificationMessages.Add(new NotificationMessage
                {
                    Id = Guid.NewGuid(),
                    RecipientMemberId = invitation.IssuedByMemberId,
                    CreatedByMemberId = invitation.IssuedByMemberId,
                    GroupId = grant.GroupId,
                    OccurredUtc = now,
                    ActionType = "identity.activation.grant_conflict",
                    ActionDataJson = JsonSerializer.Serialize(new
                    {
                        title = new { en = "Activation role needs urgent review", zh = "激活角色需要紧急处理" },
                        body = new { en = "Account activation completed, but the staged leader role conflicted with the current leader.", zh = "账号激活已完成，但暂存的小组长角色与现任小组长冲突。" },
                        actionUrl = $"/groups/{grant.GroupId}/manage?section=members",
                        sourceType = "activationGroupGrant",
                        sourceId = grant.Id
                    }),
                    CreatedUtc = now,
                    UpdatedUtc = now
                });
                continue;
            }

            await EnsureApprovedMembershipAsync(grant.GroupId, invitation.MemberId, grant.Role, cancellationToken);
            grant.Status = StagedGrantStatus.Applied;
            grant.UpdatedUtc = now;
        }

        invitation.Status = ActivationStatus.Used;
        invitation.UsedUtc = now;
        flow.ConsumedUtc = now;
        AddAudit(invitation.MemberId, "identity.activation.completed", nameof(MemberActivationInvitation), invitation.Id, invitation.MemberId);
        await dbContext.SaveChangesAsync(cancellationToken);

        var token = jwtTokenService.CreateToken(invitation.Member, authenticationMethod, sessionKind, lifetime);
        return AppResult<IdentitySession>.Success(new IdentitySession(
            token.Token,
            token.ExpiresUtc,
            sessionKind == "standard",
            authenticationMethod,
            sessionKind,
            flow.ReturnPath ?? "/enter"));
    }

    private async Task<bool> ResolveApplicantMemberAsync(
        ChurchPersonApplication person,
        Guid? requestedMemberId,
        CancellationToken cancellationToken)
    {
        if (person.LinkedMemberId is not null)
        {
            return true;
        }

        if (requestedMemberId is Guid memberId)
        {
            var member = await dbContext.Members.SingleOrDefaultAsync(item => item.Id == memberId, cancellationToken);
            if (member is null || (person.PhoneE164 is not null && !string.Equals(member.PhoneE164, person.PhoneE164, StringComparison.Ordinal)))
            {
                return false;
            }
            person.LinkedMemberId = member.Id;
            person.MatchState = ApplicantMatchState.Linked;
            return true;
        }

        if (person.MatchState is ApplicantMatchState.Possible or ApplicantMatchState.Ambiguous)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        var created = new Member
        {
            Id = Guid.NewGuid(),
            DisplayName = person.DisplayName,
            PhoneE164 = person.PhoneE164,
            IsRegistered = false,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.Members.Add(created);
        person.LinkedMemberId = created.Id;
        person.MatchState = ApplicantMatchState.Linked;
        return true;
    }

    private async Task<bool> MaterializeMembershipAsync(GroupMembershipApplication application, CancellationToken cancellationToken)
    {
        var memberId = application.ChurchPersonApplication.LinkedMemberId ?? application.ApplicantMemberId;
        if (memberId is null)
        {
            return false;
        }

        await EnsureApprovedMembershipAsync(application.GroupId, memberId.Value, MembershipRole.Member, cancellationToken);
        AddAudit(null, "identity.membership_application.membership_applied", nameof(GroupMembership), null, memberId, application.GroupId);
        return true;
    }

    private async Task EnsureApprovedMembershipAsync(
        Guid groupId,
        Guid memberId,
        MembershipRole role,
        CancellationToken cancellationToken)
    {
        var membership = await dbContext.GroupMemberships
            .Where(item => item.GroupId == groupId && item.MemberId == memberId)
            .OrderByDescending(item => item.UpdatedUtc)
            .FirstOrDefaultAsync(cancellationToken);
        var now = DateTime.UtcNow;
        if (membership is null)
        {
            dbContext.GroupMemberships.Add(new GroupMembership
            {
                Id = Guid.NewGuid(),
                GroupId = groupId,
                MemberId = memberId,
                Status = MembershipStatus.Approved,
                Role = role,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }
        else
        {
            membership.Status = MembershipStatus.Approved;
            membership.Role = (MembershipRole)Math.Max((int)membership.Role, (int)role);
            membership.UpdatedUtc = now;
        }
    }

    private async Task<MessageDeliveryStatus?> CreateApplicationResponseTokenAsync(
        GroupMembershipApplication application,
        CancellationToken cancellationToken)
    {
        if (application.ApplicantMemberId is not null || application.BrowserTokenHash is not null || application.ChurchPersonApplication.PhoneE164 is null)
        {
            return null;
        }

        var now = DateTime.UtcNow;
        var previous = await dbContext.ApplicationResponseTokens
            .Where(item => item.GroupMembershipApplicationId == application.Id && item.ConsumedUtc == null && item.RevokedUtc == null)
            .ToListAsync(cancellationToken);
        foreach (var token in previous)
        {
            token.RevokedUtc = now;
        }

        var selector = tokenService.CreateSecret(16);
        var secret = tokenService.CreateSecret();
        var responseToken = new ApplicationResponseToken
        {
            Id = Guid.NewGuid(),
            GroupMembershipApplicationId = application.Id,
            Selector = selector,
            SecretHash = tokenService.HashToken(secret),
            DeliveryStatus = MessageDeliveryStatus.Pending,
            CreatedUtc = now,
            ExpiresUtc = now.AddHours(72)
        };
        dbContext.ApplicationResponseTokens.Add(responseToken);
        var url = $"{configuration.FrontendBaseUrl}/application/{selector}#{secret}";
        var delivery = await messageSender.SendApplicationResponseAsync(
            application.ChurchPersonApplication.PhoneE164,
            url,
            application.ChurchPersonApplication.PreferredLanguage,
            cancellationToken);
        responseToken.DeliveryStatus = delivery.Sent
            ? MessageDeliveryStatus.Sent
            : messageSender.IsAvailable ? MessageDeliveryStatus.Failed : MessageDeliveryStatus.Unavailable;
        AddAudit(null, $"identity.application_response.delivery_{ToCamel(responseToken.DeliveryStatus)}", nameof(ApplicationResponseToken), responseToken.Id, application.ApplicantMemberId, application.GroupId);
        return responseToken.DeliveryStatus;
    }

    private async Task<IReadOnlyDictionary<Guid, MessageDeliveryStatus>> LoadLatestResponseDeliveryAsync(
        IEnumerable<Guid> applicationIds,
        CancellationToken cancellationToken)
    {
        var ids = applicationIds.Distinct().ToArray();
        if (ids.Length == 0)
        {
            return new Dictionary<Guid, MessageDeliveryStatus>();
        }

        var tokens = await dbContext.ApplicationResponseTokens.AsNoTracking()
            .Where(item => ids.Contains(item.GroupMembershipApplicationId))
            .OrderByDescending(item => item.CreatedUtc)
            .Select(item => new { item.GroupMembershipApplicationId, item.DeliveryStatus })
            .ToListAsync(cancellationToken);
        return tokens
            .GroupBy(item => item.GroupMembershipApplicationId)
            .ToDictionary(group => group.Key, group => group.First().DeliveryStatus);
    }

    private async Task<IReadOnlyDictionary<Guid, MessageDeliveryStatus>> LoadLatestActivationDeliveryAsync(
        IEnumerable<Guid?> memberIds,
        CancellationToken cancellationToken)
    {
        var ids = memberIds.Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        if (ids.Length == 0)
        {
            return new Dictionary<Guid, MessageDeliveryStatus>();
        }

        var invitations = await dbContext.MemberActivationInvitations.AsNoTracking()
            .Where(item => ids.Contains(item.MemberId))
            .OrderByDescending(item => item.CreatedUtc)
            .Select(item => new { item.MemberId, item.DeliveryStatus })
            .ToListAsync(cancellationToken);
        return invitations
            .GroupBy(item => item.MemberId)
            .ToDictionary(group => group.Key, group => group.First().DeliveryStatus);
    }

    private static MessageDeliveryStatus? ResolveActivationDelivery(
        GroupMembershipApplication application,
        IReadOnlyDictionary<Guid, MessageDeliveryStatus> deliveryByMember)
    {
        var memberId = application.ChurchPersonApplication.LinkedMemberId ?? application.ApplicantMemberId;
        return memberId is Guid id && deliveryByMember.TryGetValue(id, out var delivery)
            ? delivery
            : null;
    }

    private async Task<GroupMembershipApplication?> LoadApplicationAsync(Guid applicationId, CancellationToken cancellationToken)
        => await dbContext.GroupMembershipApplications
            .Include(item => item.Group)
            .Include(item => item.ChurchPersonApplication)
            .Include(item => item.History)
            .SingleOrDefaultAsync(item => item.Id == applicationId, cancellationToken);

    private async Task<Member?> LoadMemberForTokenAsync(Guid memberId, CancellationToken cancellationToken)
        => await dbContext.Members
            .Include(member => member.PlatformRoles)
                .ThenInclude(role => role.Role)
            .SingleOrDefaultAsync(member => member.Id == memberId, cancellationToken);

    private async Task<bool> CanManageChurchAsync(Guid actorMemberId, Guid churchId, CancellationToken cancellationToken)
        => await groupAuthorization.IsAdminAsync(actorMemberId, cancellationToken) ||
           await groupAuthorization.IsLeaderOrCoLeaderAsync(churchId, actorMemberId, cancellationToken);

    private (OnboardingFlow Flow, string Token) CreateFlowEntity(
        OnboardingIntent intent,
        bool isPublicDevice,
        string? returnPath)
    {
        var token = tokenService.CreateSecret();
        var now = DateTime.UtcNow;
        return (new OnboardingFlow
        {
            Id = Guid.NewGuid(),
            TokenHash = tokenService.HashToken(token),
            Intent = intent,
            ReturnPath = IdentityPathPolicy.NormalizeReturnPath(returnPath),
            IsPublicDevice = isPublicDevice,
            CreatedUtc = now,
            ExpiresUtc = now.AddMinutes(30)
        }, token);
    }

    private async Task<OnboardingFlow?> FindActiveFlowAsync(string token, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }
        var hash = tokenService.HashToken(token);
        return await dbContext.OnboardingFlows.SingleOrDefaultAsync(
            flow => flow.TokenHash == hash && flow.ConsumedUtc == null && flow.ExpiresUtc > DateTime.UtcNow,
            cancellationToken);
    }

    private async Task<OnboardingContextDto> ToContextAsync(OnboardingFlow flow, CancellationToken cancellationToken)
    {
        if (flow.ActivationInvitationId is Guid activationId)
        {
            var target = await dbContext.MemberActivationInvitations.Where(x => x.Id == activationId).Select(x => new { x.Member.DisplayName, x.MemberId }).SingleOrDefaultAsync(cancellationToken);
            return ToContext(flow) with { DisplayName = target?.DisplayName, ActivationMemberId = target?.MemberId };
        }

        if (flow.GroupJoinInviteId is Guid inviteId)
        {
            var invite = await dbContext.GroupJoinInvites.AsNoTracking().Include(item => item.Group)
                .SingleOrDefaultAsync(item => item.Id == inviteId, cancellationToken);
            if (invite is not null)
            {
                var names = ReadLocalized(invite.Group.NameJson);
                return new OnboardingContextDto(
                    "groupJoin", flow.IsPublicDevice, flow.ReturnPath ?? string.Empty,
                    GroupJoinInviteId: invite.Id, GroupNameEn: names.En, GroupNameZh: names.Zh,
                    State: invite.Status == GroupJoinInviteStatus.Active && invite.ExpiresUtc > DateTime.UtcNow ? "active" : ToCamel(invite.Status));
            }
        }
        if (flow.ApplicationResponseTokenId is Guid responseTokenId)
        {
            var token = await dbContext.ApplicationResponseTokens.AsNoTracking()
                .Include(item => item.GroupMembershipApplication)
                    .ThenInclude(item => item.Group)
                .SingleOrDefaultAsync(item => item.Id == responseTokenId, cancellationToken);
            if (token is not null)
            {
                var names = ReadLocalized(token.GroupMembershipApplication.Group.NameJson);
                return new OnboardingContextDto(
                    "applicationResponse", false, string.Empty,
                    GroupApplicationId: token.GroupMembershipApplicationId,
                    GroupNameEn: names.En, GroupNameZh: names.Zh,
                    State: token.ConsumedUtc is null && token.RevokedUtc is null && token.ExpiresUtc > DateTime.UtcNow ? "needsInfo" : "expired");
            }
        }
        return ToContext(flow);
    }

    private static OnboardingContextDto ToContext(OnboardingFlow flow)
        => new(ToCamel(flow.Intent), flow.IsPublicDevice, flow.ReturnPath ?? string.Empty,
            flow.ActivationInvitationId, flow.GroupJoinInviteId, State: "active");

    private GroupJoinInvite CreateGroupInvite(Guid groupId, Guid actorMemberId)
    {
        var now = DateTime.UtcNow;
        return new GroupJoinInvite
        {
            Id = Guid.NewGuid(),
            GroupId = groupId,
            CreatedByMemberId = actorMemberId,
            Selector = tokenService.CreateSecret(16),
            Version = 1,
            Status = GroupJoinInviteStatus.Active,
            CreatedUtc = now,
            UpdatedUtc = now,
            ExpiresUtc = now.AddDays(90)
        };
    }

    private GroupJoinInviteDto ToInviteDto(GroupJoinInvite invite, bool includeUrl)
    {
        var effectiveStatus = invite.ExpiresUtc <= DateTime.UtcNow &&
                              invite.Status is GroupJoinInviteStatus.Active or GroupJoinInviteStatus.Paused
            ? GroupJoinInviteStatus.Expired
            : invite.Status;
        var url = includeUrl && effectiveStatus is GroupJoinInviteStatus.Active or GroupJoinInviteStatus.Paused
            ? $"{configuration.FrontendBaseUrl}/join/{invite.Selector}#{tokenService.SignGroupInvite(invite.Selector, invite.Version)}"
            : null;
        return new GroupJoinInviteDto(
            invite.Id, invite.GroupId, ToCamel(effectiveStatus), invite.ExpiresUtc,
            invite.LastUsedUtc, invite.SubmissionCount, url);
    }

    private static ActivationInvitationDto ToActivationDto(
        MemberActivationInvitation invitation,
        Member member,
        ManualActivationMessageDto? manualActivationMessage)
        => new(
            invitation.Id,
            member.Id,
            member.DisplayName ?? string.Empty,
            MaskPhone(member.PhoneE164),
            invitation.Purpose,
            invitation.ExpiresUtc <= DateTime.UtcNow &&
            invitation.Status is ActivationStatus.Active or ActivationStatus.PendingDelivery
                ? ActivationStatus.Expired
                : invitation.Status,
            invitation.DeliveryStatus,
            invitation.ExpiresUtc,
            manualActivationMessage,
            invitation.Grants.Select(grant => new ActivationGrantDto(grant.GroupId, grant.Role, grant.Status, grant.ConflictCode)).ToArray());

    private static MembershipApplicationDto ToApplicationDto(
        GroupMembershipApplication application,
        MessageDeliveryStatus? responseDeliveryStatus = null,
        MessageDeliveryStatus? activationDeliveryStatus = null,
        ManualActivationMessageDto? manualActivationMessage = null)
    {
        var person = application.ChurchPersonApplication;
        var names = ReadLocalized(application.Group.NameJson);
        return new MembershipApplicationDto(
            application.Id,
            person.Id,
            application.GroupId,
            names.En,
            names.Zh,
            person.DisplayName,
            MaskPhone(person.PhoneE164),
            person.ReplyPreference,
            person.PreferredLanguage,
            person.Declaration,
            person.IsContactVerified,
            ToCamel(person.MatchState),
            ToCamel(person.Status),
            ToCamel(application.Status),
            application.Source,
            responseDeliveryStatus is null ? null : ToCamel(responseDeliveryStatus.Value),
            activationDeliveryStatus is null ? null : ToCamel(activationDeliveryStatus.Value),
            manualActivationMessage,
            application.SubmittedUtc,
            Convert.ToBase64String(application.RowVersion ?? []),
            application.History.OrderBy(item => item.CreatedUtc).Select(item => new ApplicationHistoryDto(
                item.Id,
                ToCamel(item.Kind),
                ToCamel(item.FromStatus),
                ToCamel(item.ToStatus),
                item.Note,
                item.ActorMemberId,
                item.CreatedUtc)).ToArray(), person.IsIdentityVerified);
    }

    private static string BuildManualActivationMessage(string activationUrl)
        => $"ALIFE 帐号激活 / Account activation\n" +
           $"请在手机打开以下链接并建立 Passkey / Open this link on your phone to create a Passkey:\n" +
           activationUrl;

    private void AddHistory(
        GroupMembershipApplication application,
        Guid? actorMemberId,
        ApplicationDecisionKind kind,
        MembershipApplicationStatus from,
        MembershipApplicationStatus to,
        string? note)
    {
        var history = new ApplicationHistory
        {
            Id = Guid.NewGuid(),
            GroupMembershipApplicationId = application.Id,
            ActorMemberId = actorMemberId,
            Kind = kind,
            FromStatus = from,
            ToStatus = to,
            Note = string.IsNullOrWhiteSpace(note) ? null : note.Trim(),
            CreatedUtc = DateTime.UtcNow
        };
        application.History.Add(history);
        dbContext.ApplicationHistory.Add(history);
    }

    private void AddAudit(
        Guid? actorMemberId,
        string action,
        string entityType,
        Guid? entityId,
        Guid? targetMemberId = null,
        Guid? groupId = null)
        => dbContext.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = actorMemberId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            TargetMemberId = targetMemberId,
            GroupId = groupId,
            OccurredUtc = DateTime.UtcNow
        });

    private static bool MatchesRowVersion(byte[] current, string? supplied)
    {
        if (string.IsNullOrWhiteSpace(supplied)) return false;
        try
        {
            var parsed = Convert.FromBase64String(supplied);
            return current.Length == 0 || System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(current, parsed);
        }
        catch
        {
            return false;
        }
    }

    private static string? NormalizePhone(string? value)
    {
        var raw = value?.Trim();
        if (string.IsNullOrWhiteSpace(raw)) return null;
        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length is < 8 or > 15) return null;
        return "+" + digits;
    }

    private static string NormalizeReplyPreference(string value)
        => value.Trim().ToLowerInvariant() switch
        {
            "sms" => "sms",
            "phone" => "phone",
            "line" => "line",
            _ => "sms"
        };

    private static string NormalizeLanguage(string value)
        => value.Trim().ToLowerInvariant() switch
        {
            "zh" => "zh",
            "en" => "en",
            _ => "bilingual"
        };

    private static string MaskPhone(string? value)
    {
        var normalized = value ?? string.Empty;
        if (normalized.Length == 0) return string.Empty;
        if (normalized.Length <= 4) return "••••";
        return $"•••• {normalized[^4..]}";
    }

    private static (string En, string Zh) ReadLocalized(string? json)
    {
        try
        {
            var values = JsonSerializer.Deserialize<Dictionary<string, string>>(json ?? "{}") ?? [];
            values.TryGetValue("en", out var en);
            values.TryGetValue("zh", out var zh);
            return (en ?? zh ?? "Group", zh ?? en ?? "小组");
        }
        catch
        {
            return ("Group", "小组");
        }
    }

    private static string ToCamel<T>(T value) where T : struct, Enum
        => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());
}
