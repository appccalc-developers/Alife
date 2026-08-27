using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Composition;

public sealed record ListEventRoleAssignmentsQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<EventRoleAssignmentDto>>>;

public sealed class ListEventRoleAssignmentsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventRoleAssignmentsQuery, AppResult<IReadOnlyList<EventRoleAssignmentDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventRoleAssignmentDto>>> Handle(
        ListEventRoleAssignmentsQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<IReadOnlyList<EventRoleAssignmentDto>>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.CanViewEventTeamAsync(
                dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<IReadOnlyList<EventRoleAssignmentDto>>.Forbidden(
                "Event-team membership is required to view role assignments.");
        }
        var assignments = await dbContext.EventRoleAssignments.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .OrderBy(x => x.RoleRequirementKey)
            .ThenBy(x => x.CreatedUtc)
            .ToListAsync(cancellationToken);
        return AppResult<IReadOnlyList<EventRoleAssignmentDto>>.Success(
            assignments.Select(EventCompositionPersistence.ToDto).ToArray());
    }
}

public sealed record CreateEventRoleAssignmentCommand(
    Guid EventId,
    Guid CurrentMemberId,
    CreateEventRoleAssignmentRequest Request,
    string? IdempotencyKey)
    : IRequest<AppResult<EventRoleAssignmentDto>>;

public sealed class CreateEventRoleAssignmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<CreateEventRoleAssignmentCommand, AppResult<EventRoleAssignmentDto>>
{
    public async Task<AppResult<EventRoleAssignmentDto>> Handle(
        CreateEventRoleAssignmentCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventRoleAssignmentDto>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.CanManageEventAsync(
                dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventRoleAssignmentDto>.Forbidden(
                "The accountable owner or owning-group leaders can assign event roles.");
        }
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200)
        {
            return AppResult<EventRoleAssignmentDto>.Validation("A valid Idempotency-Key header is required.");
        }
        var requestHash = EventCompositionEngine.Hash(request.Request);
        var retry = await dbContext.EventIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Operation == "event.role.assign" &&
                x.ScopeId == groupEvent.Id && x.Key == key, cancellationToken);
        if (retry is not null)
        {
            if (!string.Equals(retry.RequestHash, requestHash, StringComparison.Ordinal))
            {
                return AppResult<EventRoleAssignmentDto>.Conflict(
                    "The Idempotency-Key was already used with a different request.");
            }
            var existing = await dbContext.EventRoleAssignments.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == retry.ResultEntityId, cancellationToken);
            return existing is null
                ? AppResult<EventRoleAssignmentDto>.Conflict("The idempotent result is no longer available.")
                : AppResult<EventRoleAssignmentDto>.Success(EventCompositionPersistence.ToDto(existing));
        }

        if (!await groupAuthorizationService.IsApprovedMemberAsync(
                groupEvent.GroupId, request.Request.MemberId, cancellationToken))
        {
            return AppResult<EventRoleAssignmentDto>.Validation(
                "The assigned member must be an approved member of the owning group.");
        }
        var snapshotEntity = await dbContext.EventPlanSnapshots.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        if (snapshotEntity is null)
        {
            return AppResult<EventRoleAssignmentDto>.Conflict("Accept an event plan before assigning roles.");
        }
        EventPlanSnapshotDto snapshot;
        try
        {
            snapshot = EventCompositionPersistence.ToSnapshotDto(snapshotEntity);
        }
        catch (System.Text.Json.JsonException)
        {
            return AppResult<EventRoleAssignmentDto>.Conflict("The active event plan snapshot is invalid.");
        }
        var requirement = snapshot.Plan.RoleRequirements.FirstOrDefault(x =>
            string.Equals(x.RequirementKey, request.Request.RoleRequirementKey, StringComparison.Ordinal));
        if (requirement is null)
        {
            return AppResult<EventRoleAssignmentDto>.Validation(
                "roleRequirementKey is not active in the accepted plan.");
        }
        if (requirement.Eligibility.Contains("eventTeamMember", StringComparer.Ordinal) &&
            groupEvent.AccountableOwnerMemberId != request.Request.MemberId &&
            !await dbContext.EventTeamMembers.AsNoTracking().AnyAsync(x => x.EventId == groupEvent.Id &&
                x.MemberId == request.Request.MemberId && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null, cancellationToken))
        {
            return AppResult<EventRoleAssignmentDto>.Validation(
                "This role requires an accepted event-team member.");
        }
        if (!await ScopeBelongsToEventAsync(
                dbContext, groupEvent.Id, request.Request.ScopeType, request.Request.ScopeId, cancellationToken))
        {
            return AppResult<EventRoleAssignmentDto>.Validation(
                "The role scope does not belong to this event.");
        }

        var activeAssignments = await dbContext.EventRoleAssignments
            .Where(x => x.EventId == groupEvent.Id && x.EndedUtc == null)
            .ToListAsync(cancellationToken);
        var requirementAssignments = activeAssignments.Count(x =>
            string.Equals(x.RoleRequirementKey, requirement.RequirementKey, StringComparison.Ordinal));
        var isOwnerReplacement = requirement.RoleCode == "event.accountableOwner" &&
            activeAssignments.Any(x => x.RoleRequirementKey == requirement.RequirementKey &&
                x.MemberId != request.Request.MemberId && x.Status == EventRoleAssignmentStatus.Accepted);
        if (requirement.Maximum.HasValue && requirementAssignments >= requirement.Maximum.Value && !isOwnerReplacement)
        {
            return AppResult<EventRoleAssignmentDto>.Conflict(
                "The role requirement already has its maximum active assignments.");
        }
        var separatedKeys = snapshot.Plan.RoleRequirements
            .Where(x => requirement.SeparationFrom.Contains(x.RoleCode, StringComparer.Ordinal))
            .Select(x => x.RequirementKey)
            .ToHashSet(StringComparer.Ordinal);
        if (activeAssignments.Any(x => x.MemberId == request.Request.MemberId &&
            separatedKeys.Contains(x.RoleRequirementKey)))
        {
            return AppResult<EventRoleAssignmentDto>.Conflict(
                "The member already holds a role that must remain separate.");
        }

        var now = DateTime.UtcNow;
        var assignment = new EventRoleAssignment
        {
            Id = Guid.NewGuid(),
            EventId = groupEvent.Id,
            RoleRequirementKey = requirement.RequirementKey,
            MemberId = request.Request.MemberId,
            ScopeType = request.Request.ScopeType.Trim().ToLowerInvariant(),
            ScopeId = request.Request.ScopeId,
            AssignedByMemberId = request.CurrentMemberId,
            Status = EventRoleAssignmentStatus.Invited,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.EventRoleAssignments.Add(assignment);
        dbContext.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            Operation = "event.role.assign",
            ScopeId = groupEvent.Id,
            Key = key,
            RequestHash = requestHash,
            ResultEntityId = assignment.Id,
            CreatedUtc = now,
            ExpiresUtc = now.AddDays(7)
        });
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventRoleAssignmentDto>.Success(EventCompositionPersistence.ToDto(assignment));
    }

    private static Task<bool> ScopeBelongsToEventAsync(
        IAlifeDbContext dbContext,
        Guid eventId,
        string scopeType,
        Guid? scopeId,
        CancellationToken cancellationToken)
    {
        var normalized = scopeType.Trim().ToLowerInvariant();
        if (normalized == "event")
        {
            return Task.FromResult(!scopeId.HasValue || scopeId == eventId);
        }
        if (!scopeId.HasValue)
        {
            return Task.FromResult(false);
        }
        return normalized switch
        {
            "occurrence" => dbContext.EventOccurrences.AsNoTracking()
                .AnyAsync(x => x.Id == scopeId && x.EventId == eventId, cancellationToken),
            "session" => dbContext.EventSessions.AsNoTracking()
                .AnyAsync(x => x.Id == scopeId && x.Occurrence.EventId == eventId, cancellationToken),
            "zone" => dbContext.EventZones.AsNoTracking()
                .AnyAsync(x => x.Id == scopeId && x.Occurrence.EventId == eventId, cancellationToken),
            _ => Task.FromResult(false)
        };
    }
}

public sealed record EndEventRoleAssignmentCommand(
    Guid EventId,
    Guid AssignmentId,
    Guid CurrentMemberId)
    : IRequest<AppResult<bool>>;

public sealed class EndEventRoleAssignmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<EndEventRoleAssignmentCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(
        EndEventRoleAssignmentCommand request,
        CancellationToken cancellationToken)
    {
        var assignment = await dbContext.EventRoleAssignments
            .Include(x => x.Event)
            .FirstOrDefaultAsync(x => x.Id == request.AssignmentId && x.EventId == request.EventId, cancellationToken);
        if (assignment is null)
        {
            return AppResult<bool>.NotFound("Role assignment not found.");
        }
        if (!await EventCompositionPersistence.CanManageEventAsync(
                dbContext, groupAuthorizationService, assignment.Event, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<bool>.Forbidden(
                "The accountable owner or owning-group leaders can end event roles.");
        }
        if (assignment.EndedUtc.HasValue)
        {
            return AppResult<bool>.Success(true);
        }
        if (assignment.RoleRequirementKey.EndsWith(":event.accountableOwner", StringComparison.Ordinal) &&
            assignment.MemberId == assignment.Event.AccountableOwnerMemberId)
        {
            return AppResult<bool>.Conflict(
                "Assign a new accountable owner before ending the current assignment.");
        }
        assignment.EndedUtc = DateTime.UtcNow;
        assignment.Status = EventRoleAssignmentStatus.Ended;
        assignment.UpdatedUtc = assignment.EndedUtc.Value;
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<bool>.Conflict("The role assignment changed while it was being ended; reload and try again.");
        }
        return AppResult<bool>.Success(true);
    }
}

public sealed record RespondToEventRoleAssignmentCommand(
    Guid EventId, Guid AssignmentId, Guid CurrentMemberId, bool Accept)
    : IRequest<AppResult<EventRoleAssignmentDto>>;

public sealed class RespondToEventRoleAssignmentCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<RespondToEventRoleAssignmentCommand, AppResult<EventRoleAssignmentDto>>
{
    public async Task<AppResult<EventRoleAssignmentDto>> Handle(
        RespondToEventRoleAssignmentCommand request,
        CancellationToken cancellationToken)
    {
        var assignment = await dbContext.EventRoleAssignments
            .Include(x => x.Event)
            .FirstOrDefaultAsync(x => x.Id == request.AssignmentId && x.EventId == request.EventId, cancellationToken);
        if (assignment is null)
        {
            return AppResult<EventRoleAssignmentDto>.NotFound("Role assignment not found.");
        }
        if (assignment.MemberId != request.CurrentMemberId)
        {
            return AppResult<EventRoleAssignmentDto>.Forbidden("Only the invited member can respond to this role.");
        }
        if (assignment.Status != EventRoleAssignmentStatus.Invited || assignment.EndedUtc.HasValue)
        {
            return AppResult<EventRoleAssignmentDto>.Conflict("This role invitation is no longer pending.");
        }

        var now = DateTime.UtcNow;
        assignment.Status = request.Accept
            ? EventRoleAssignmentStatus.Accepted
            : EventRoleAssignmentStatus.Declined;
        assignment.AcceptedUtc = request.Accept ? now : null;
        assignment.DeclinedUtc = request.Accept ? null : now;
        assignment.EndedUtc = request.Accept ? null : now;
        assignment.UpdatedUtc = now;
        if (request.Accept && assignment.RoleRequirementKey.EndsWith(":event.accountableOwner", StringComparison.Ordinal))
        {
            var previousOwners = await dbContext.EventRoleAssignments.Where(x => x.EventId == assignment.EventId &&
                x.Id != assignment.Id && x.RoleRequirementKey == assignment.RoleRequirementKey && x.EndedUtc == null).ToListAsync(cancellationToken);
            foreach (var previous in previousOwners)
            {
                previous.Status = EventRoleAssignmentStatus.Ended;
                previous.EndedUtc = now;
                previous.UpdatedUtc = now;
            }
            assignment.Event.AccountableOwnerMemberId = assignment.MemberId;
            assignment.Event.PlanConcurrencyToken = Guid.NewGuid();
            assignment.Event.UpdatedUtc = now;
        }
        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<EventRoleAssignmentDto>.Conflict("This role invitation was already answered or changed; reload before trying again.");
        }
        return AppResult<EventRoleAssignmentDto>.Success(EventCompositionPersistence.ToDto(assignment));
    }
}

public sealed record SubmitEventSponsorshipCommand(
    Guid EventId,
    Guid CurrentMemberId,
    SponsorshipSubmissionRequest Request,
    string? IdempotencyKey)
    : IRequest<AppResult<EventSponsorshipDto>>;

public sealed class SubmitEventSponsorshipCommandHandler(
    IAlifeDbContext dbContext,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<SubmitEventSponsorshipCommand, AppResult<EventSponsorshipDto>>
{
    public async Task<AppResult<EventSponsorshipDto>> Handle(
        SubmitEventSponsorshipCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.ApprovalDecisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventSponsorshipDto>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.HasDirectGroupLeadershipAsync(
                dbContext, groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventSponsorshipDto>.Forbidden(
                "Only owning-group leaders and co-leaders can submit sponsorship.");
        }
        if (string.IsNullOrWhiteSpace(request.Request.Reason))
        {
            return AppResult<EventSponsorshipDto>.Validation("A sponsorship reason is required.");
        }
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200)
        {
            return AppResult<EventSponsorshipDto>.Validation("A valid Idempotency-Key header is required.");
        }
        var retryResult = await TryGetSponsorshipRetryAsync(
            dbContext, groupEvent, "event.sponsorship.submit", key,
            EventCompositionEngine.Hash(request.Request), cancellationToken);
        if (retryResult is not null)
        {
            return retryResult;
        }
        if (groupEvent.SponsorshipStatus == EventSponsorshipStatus.Pending)
        {
            return AppResult<EventSponsorshipDto>.Conflict("Sponsorship is already pending.");
        }
        if (groupEvent.SponsorshipStatus == EventSponsorshipStatus.Approved)
        {
            return AppResult<EventSponsorshipDto>.Conflict("Sponsorship is already approved.");
        }

        var now = DateTime.UtcNow;
        groupEvent.GovernanceMode = EventGovernanceMode.ChurchSponsored;
        groupEvent.SponsorshipStatus = EventSponsorshipStatus.Pending;
        groupEvent.PlanConcurrencyToken = Guid.NewGuid();
        groupEvent.UpdatedUtc = now;
        var decision = AddDecision(groupEvent, request.CurrentMemberId, EventApprovalDecisionType.Submitted,
            request.Request.Reason.Trim(), now);
        dbContext.EventApprovalDecisions.Add(decision);
        AddIdempotency(dbContext, "event.sponsorship.submit", groupEvent.Id, key,
            EventCompositionEngine.Hash(request.Request), decision.Id, now);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventSponsorshipDto>.Success(ToSponsorshipDto(groupEvent, decision));
    }

    internal static EventApprovalDecision AddDecision(
        GroupEvent groupEvent,
        Guid actorMemberId,
        EventApprovalDecisionType type,
        string reason,
        DateTime now)
    {
        var decision = new EventApprovalDecision
        {
            Id = Guid.NewGuid(),
            EventId = groupEvent.Id,
            SubjectType = "event.sponsorship",
            SubjectVersion = groupEvent.ApprovalDecisions.Count + 1,
            Decision = type,
            ActorMemberId = actorMemberId,
            Reason = reason,
            DecidedUtc = now
        };
        groupEvent.ApprovalDecisions.Add(decision);
        return decision;
    }

    internal static void AddIdempotency(
        IAlifeDbContext dbContext,
        string operation,
        Guid scopeId,
        string key,
        string requestHash,
        Guid resultId,
        DateTime now)
        => dbContext.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            Operation = operation,
            ScopeId = scopeId,
            Key = key,
            RequestHash = requestHash,
            ResultEntityId = resultId,
            CreatedUtc = now,
            ExpiresUtc = now.AddDays(7)
        });

    internal static async Task<AppResult<EventSponsorshipDto>?> TryGetSponsorshipRetryAsync(
        IAlifeDbContext dbContext,
        GroupEvent groupEvent,
        string operation,
        string key,
        string requestHash,
        CancellationToken cancellationToken)
    {
        var retry = await dbContext.EventIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Operation == operation && x.ScopeId == groupEvent.Id && x.Key == key,
                cancellationToken);
        if (retry is null)
        {
            return null;
        }
        if (!string.Equals(retry.RequestHash, requestHash, StringComparison.Ordinal))
        {
            return AppResult<EventSponsorshipDto>.Conflict(
                "The Idempotency-Key was already used with a different request.");
        }
        var decision = await dbContext.EventApprovalDecisions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == retry.ResultEntityId, cancellationToken);
        return decision is null
            ? AppResult<EventSponsorshipDto>.Conflict("The idempotent result is no longer available.")
            : AppResult<EventSponsorshipDto>.Success(ToSponsorshipDto(groupEvent, decision));
    }

    internal static EventSponsorshipDto ToSponsorshipDto(
        GroupEvent groupEvent,
        EventApprovalDecision? decision)
    {
        var status = decision?.Decision switch
        {
            EventApprovalDecisionType.Submitted => EventSponsorshipStatus.Pending,
            EventApprovalDecisionType.Approved => EventSponsorshipStatus.Approved,
            EventApprovalDecisionType.Rejected => EventSponsorshipStatus.Rejected,
            EventApprovalDecisionType.Revoked => EventSponsorshipStatus.Revoked,
            _ => groupEvent.SponsorshipStatus
        };
        var etagTicks = decision?.DecidedUtc.Ticks ?? groupEvent.UpdatedUtc.Ticks;
        return new EventSponsorshipDto(
            groupEvent.Id,
            groupEvent.GovernanceMode,
            status,
            decision?.ActorMemberId,
            decision?.Reason,
            decision?.DecidedUtc,
            $"\"sponsorship-{(int)status}-{etagTicks:x}\"");
    }

    internal static string CreateSponsorshipETag(GroupEvent groupEvent)
        => $"\"sponsorship-{(int)groupEvent.SponsorshipStatus}-{groupEvent.UpdatedUtc.Ticks:x}\"";
}

public sealed record DecideEventSponsorshipCommand(
    Guid EventId,
    Guid CurrentMemberId,
    SponsorshipDecisionRequest Request,
    EventApprovalDecisionType Decision,
    string? IfMatch,
    string? IdempotencyKey)
    : IRequest<AppResult<EventSponsorshipDto>>;

public sealed class DecideEventSponsorshipCommandHandler(
    IAlifeDbContext dbContext,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<DecideEventSponsorshipCommand, AppResult<EventSponsorshipDto>>
{
    public async Task<AppResult<EventSponsorshipDto>> Handle(
        DecideEventSponsorshipCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Decision is not EventApprovalDecisionType.Approved and not EventApprovalDecisionType.Rejected)
        {
            return AppResult<EventSponsorshipDto>.Validation("Only approve or reject decisions are supported.");
        }
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.ApprovalDecisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventSponsorshipDto>.NotFound("Event not found.");
        }
        var rootId = await EventCompositionPersistence.FindChurchRootIdAsync(
            dbContext, groupEvent.GroupId, cancellationToken);
        var hasPermission = await AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext, request.CurrentMemberId, AdminPermissionCatalog.SponsorEvents, cancellationToken);
        var isRootLeader = rootId.HasValue && await EventCompositionPersistence.HasDirectGroupLeadershipAsync(
            dbContext, rootId.Value, request.CurrentMemberId, cancellationToken);
        if (!hasPermission && !isRootLeader)
        {
            return AppResult<EventSponsorshipDto>.Forbidden(
                "Root-church leadership or admin.events.sponsor is required.");
        }
        if (string.IsNullOrWhiteSpace(request.Request.Reason))
        {
            return AppResult<EventSponsorshipDto>.Validation("A decision reason is required.");
        }
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200)
        {
            return AppResult<EventSponsorshipDto>.Validation("A valid Idempotency-Key header is required.");
        }
        var operation = request.Decision == EventApprovalDecisionType.Approved
            ? "event.sponsorship.approve"
            : "event.sponsorship.reject";
        var requestHash = EventCompositionEngine.Hash(request.Request);
        var retryResult = await SubmitEventSponsorshipCommandHandler.TryGetSponsorshipRetryAsync(
            dbContext, groupEvent, operation, key, requestHash, cancellationToken);
        if (retryResult is not null)
        {
            return retryResult;
        }
        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !string.Equals(request.IfMatch.Trim(),
                SubmitEventSponsorshipCommandHandler.CreateSponsorshipETag(groupEvent),
                StringComparison.Ordinal))
        {
            return AppResult<EventSponsorshipDto>.PreconditionFailed(
                "The sponsorship request changed. Refresh before deciding it.");
        }
        if (groupEvent.SponsorshipStatus != EventSponsorshipStatus.Pending)
        {
            return AppResult<EventSponsorshipDto>.Conflict(
                "Only a pending sponsorship request can be decided.");
        }

        var now = DateTime.UtcNow;
        groupEvent.SponsorshipStatus = request.Decision == EventApprovalDecisionType.Approved
            ? EventSponsorshipStatus.Approved
            : EventSponsorshipStatus.Rejected;
        groupEvent.PlanConcurrencyToken = Guid.NewGuid();
        groupEvent.UpdatedUtc = now;
        var decision = SubmitEventSponsorshipCommandHandler.AddDecision(
            groupEvent, request.CurrentMemberId, request.Decision, request.Request.Reason.Trim(), now);
        dbContext.EventApprovalDecisions.Add(decision);
        SubmitEventSponsorshipCommandHandler.AddIdempotency(
            dbContext, operation, groupEvent.Id, key, requestHash, decision.Id, now);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventSponsorshipDto>.Success(
            SubmitEventSponsorshipCommandHandler.ToSponsorshipDto(groupEvent, decision));
    }
}
