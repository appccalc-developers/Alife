using System.Text.Json;
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

public sealed record ListEventArchetypesQuery(Guid CurrentMemberId, Guid? GroupId = null)
    : IRequest<AppResult<IReadOnlyList<EventArchetypeDto>>>;

public sealed class ListEventArchetypesQueryHandler(IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<ListEventArchetypesQuery, AppResult<IReadOnlyList<EventArchetypeDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventArchetypeDto>>> Handle(
        ListEventArchetypesQuery request,
        CancellationToken cancellationToken)
        => AppResult<IReadOnlyList<EventArchetypeDto>>.Success(
            activityTemplateCatalog is null
                ? EventCompositionDefinitions.Archetypes
                : await activityTemplateCatalog.ListActiveArchetypesAsync(cancellationToken));
}

public sealed record ComposeEventPlanCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    EventPlanComposeRequest Composition)
    : IRequest<AppResult<EventPlanProposalDto>>;

public sealed class ComposeEventPlanCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCompositionEngine compositionEngine,
    IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<ComposeEventPlanCommand, AppResult<EventPlanProposalDto>>
{
    public async Task<AppResult<EventPlanProposalDto>> Handle(
        ComposeEventPlanCommand request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventPlanProposalDto>.Forbidden(
                "Only owning-group leaders and co-leaders can compose event plans.");
        }

        var normalized = request.Composition with { BasePlanVersion = null };
        var activityTypesByCode = activityTemplateCatalog is null
            ? EventCompositionDefinitions.ActivityTypesByCode
            : await activityTemplateCatalog.ActiveDefinitionsByCodeAsync(cancellationToken);
        var workflowRecommendation = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, request.GroupId, normalized, cancellationToken, activityTypesByCode);
        return compositionEngine.Compose(
            normalized,
            new EventCompositionContext(
                "\"plan-new\"",
                HasAccountableOwner: true,
                WorkflowRecommendation: workflowRecommendation,
                ActivityTypesByCode: activityTypesByCode));
    }
}

public sealed record GetEventPlanQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventPlanSnapshotDto>>;

public sealed class GetEventPlanQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetEventPlanQuery, AppResult<EventPlanSnapshotDto>>
{
    public async Task<AppResult<EventPlanSnapshotDto>> Handle(
        GetEventPlanQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventPlanSnapshotDto>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.CanViewEventTeamAsync(
                dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventPlanSnapshotDto>.Forbidden(
                "Event-team membership is required to view the full event plan.");
        }

        var snapshot = await dbContext.EventPlanSnapshots.AsNoTracking()
            .Where(x => x.EventId == request.EventId && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        if (snapshot is null)
        {
            return AppResult<EventPlanSnapshotDto>.NotFound("Event plan not found.");
        }

        try
        {
            return AppResult<EventPlanSnapshotDto>.Success(EventCompositionPersistence.ToSnapshotDto(snapshot));
        }
        catch (JsonException)
        {
            return AppResult<EventPlanSnapshotDto>.Conflict("The active event plan snapshot is invalid.");
        }
    }
}

public sealed record RecomposeEventPlanCommand(
    Guid EventId,
    Guid CurrentMemberId,
    EventPlanComposeRequest Composition,
    string? IfMatch)
    : IRequest<AppResult<EventPlanProposalDto>>;

public sealed class RecomposeEventPlanCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCompositionEngine compositionEngine,
    IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<RecomposeEventPlanCommand, AppResult<EventPlanProposalDto>>
{
    public async Task<AppResult<EventPlanProposalDto>> Handle(
        RecomposeEventPlanCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .Include(x => x.RamAssessment)
            .Include(x => x.WorkflowRun)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventPlanProposalDto>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.CanManageEventAsync(
                dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventPlanProposalDto>.Forbidden(
                "The accountable owner or owning-group leaders can recompose the event plan.");
        }
        var activeSnapshot = await dbContext.EventPlanSnapshots.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        var currentETag = activeSnapshot?.ETag ?? EventCompositionPersistence.CreateEmptyPlanETag(groupEvent);
        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !string.Equals(request.IfMatch.Trim(), currentETag, StringComparison.Ordinal))
        {
            return AppResult<EventPlanProposalDto>.PreconditionFailed(
                "The event plan changed. Refresh before recomposing.");
        }
        if (request.Composition.BasePlanVersion.HasValue &&
            request.Composition.BasePlanVersion != groupEvent.ActivePlanVersion)
        {
            return AppResult<EventPlanProposalDto>.PreconditionFailed(
                "The event plan changed. Refresh before recomposing.");
        }

        EventPlanSnapshotDto? basePlan = null;
        if (activeSnapshot is not null)
        {
            try
            {
                basePlan = EventCompositionPersistence.ToSnapshotDto(activeSnapshot);
            }
            catch (JsonException)
            {
                return AppResult<EventPlanProposalDto>.Conflict("The active event plan snapshot is invalid.");
            }
        }

        var protectedModules = await EventCompositionPersistence.GetProtectedModuleCodesAsync(
            dbContext, groupEvent, cancellationToken);
        var composition = request.Composition with { BasePlanVersion = groupEvent.ActivePlanVersion };
        var activityTypesByCode = activityTemplateCatalog is null
            ? EventCompositionDefinitions.ActivityTypesByCode
            : await activityTemplateCatalog.ActiveDefinitionsByCodeAsync(cancellationToken);
        var workflowRecommendation = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, groupEvent.GroupId, composition, cancellationToken, activityTypesByCode);
        return compositionEngine.Compose(composition, new EventCompositionContext(
            currentETag,
            basePlan?.Plan.ModuleDecisions,
            protectedModules,
            EventCompositionPersistence.GetSatisfiedReadinessRules(groupEvent),
            groupEvent.AccountableOwnerMemberId != Guid.Empty,
            groupEvent.GovernanceMode,
            groupEvent.SponsorshipStatus,
            WorkflowRecommendation: workflowRecommendation,
            ActivityTypesByCode: activityTypesByCode));
    }
}

public sealed record AcceptEventPlanCommand(
    Guid EventId,
    Guid CurrentMemberId,
    AcceptEventPlanRequest Request,
    string? IfMatch,
    string? IdempotencyKey)
    : IRequest<AppResult<EventPlanSnapshotDto>>;

public sealed class AcceptEventPlanCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCompositionEngine compositionEngine,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<AcceptEventPlanCommand, AppResult<EventPlanSnapshotDto>>
{
    public async Task<AppResult<EventPlanSnapshotDto>> Handle(
        AcceptEventPlanCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .Include(x => x.WorkflowRun)
                .ThenInclude(x => x!.Steps)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventPlanSnapshotDto>.NotFound("Event not found.");
        }
        if (!await EventCompositionPersistence.CanManageEventAsync(
                dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventPlanSnapshotDto>.Forbidden(
                "The accountable owner or owning-group leaders can accept event plans.");
        }
        if (request.Request.Composition is null)
        {
            return AppResult<EventPlanSnapshotDto>.Validation(
                "composition is required so the server can recompute the proposal before acceptance.");
        }
        var idempotencyKey = request.IdempotencyKey?.Trim();
        if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 200)
        {
            return AppResult<EventPlanSnapshotDto>.Validation(
                "A valid Idempotency-Key header is required.");
        }

        var requestHash = EventCompositionEngine.Hash(new
        {
            request.EventId,
            request.Request,
            ifMatch = request.IfMatch?.Trim()
        });
        var existingRetry = await dbContext.EventIdempotencyRecords.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Operation == "event.plan.accept" &&
                x.ScopeId == groupEvent.Id && x.Key == idempotencyKey, cancellationToken);
        if (existingRetry is not null)
        {
            if (!string.Equals(existingRetry.RequestHash, requestHash, StringComparison.Ordinal))
            {
                return AppResult<EventPlanSnapshotDto>.Conflict(
                    "The Idempotency-Key was already used with a different request.");
            }
            var retrySnapshot = await dbContext.EventPlanSnapshots.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == existingRetry.ResultEntityId, cancellationToken);
            return retrySnapshot is null
                ? AppResult<EventPlanSnapshotDto>.Conflict("The idempotent result is no longer available.")
                : AppResult<EventPlanSnapshotDto>.Success(EventCompositionPersistence.ToSnapshotDto(retrySnapshot));
        }

        var activeSnapshot = await dbContext.EventPlanSnapshots
            .Where(x => x.EventId == groupEvent.Id && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        var currentETag = activeSnapshot?.ETag ?? EventCompositionPersistence.CreateEmptyPlanETag(groupEvent);
        if (string.IsNullOrWhiteSpace(request.IfMatch) ||
            !string.Equals(request.IfMatch.Trim(), currentETag, StringComparison.Ordinal))
        {
            return AppResult<EventPlanSnapshotDto>.PreconditionFailed(
                "The event plan changed. Refresh and review the latest proposal.");
        }
        if (request.Request.Composition.BasePlanVersion.HasValue &&
            request.Request.Composition.BasePlanVersion != groupEvent.ActivePlanVersion)
        {
            return AppResult<EventPlanSnapshotDto>.PreconditionFailed(
                "The proposal basePlanVersion is stale.");
        }

        EventPlanSnapshotDto? basePlan = null;
        if (activeSnapshot is not null)
        {
            try
            {
                basePlan = EventCompositionPersistence.ToSnapshotDto(activeSnapshot);
            }
            catch (JsonException)
            {
                return AppResult<EventPlanSnapshotDto>.Conflict("The active event plan snapshot is invalid.");
            }
        }

        var protectedModules = await EventCompositionPersistence.GetProtectedModuleCodesAsync(
            dbContext, groupEvent, cancellationToken);
        var composition = request.Request.Composition with { BasePlanVersion = groupEvent.ActivePlanVersion };
        var activityTypesByCode = activityTemplateCatalog is null
            ? EventCompositionDefinitions.ActivityTypesByCode
            : await activityTemplateCatalog.ActiveDefinitionsByCodeAsync(cancellationToken);
        var workflowRecommendation = await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
            dbContext, groupEvent.GroupId, composition, cancellationToken, activityTypesByCode);
        var proposalResult = compositionEngine.Compose(composition, new EventCompositionContext(
            currentETag,
            basePlan?.Plan.ModuleDecisions,
            protectedModules,
            EventCompositionPersistence.GetSatisfiedReadinessRules(groupEvent),
            groupEvent.AccountableOwnerMemberId != Guid.Empty,
            groupEvent.GovernanceMode,
            groupEvent.SponsorshipStatus,
            WorkflowRecommendation: workflowRecommendation,
            ActivityTypesByCode: activityTypesByCode));
        if (!proposalResult.IsSuccess)
        {
            return CopyFailure<EventPlanProposalDto, EventPlanSnapshotDto>(proposalResult);
        }
        var proposal = proposalResult.Value!;
        if (string.IsNullOrWhiteSpace(request.Request.ProposalHash) ||
            !string.Equals(proposal.ProposalHash, request.Request.ProposalHash, StringComparison.Ordinal) ||
            !string.Equals(proposal.ProposalHash, request.Request.ProposalHash.Trim(), StringComparison.Ordinal))
        {
            return AppResult<EventPlanSnapshotDto>.PreconditionFailed(
                "The proposal is stale or was changed after composition.");
        }
        if (proposal.Diff.BlockingRetirements.Count > 0)
        {
            return AppResult<EventPlanSnapshotDto>.Conflict(
                $"Modules with operational data require explicit retirement: {string.Join(", ", proposal.Diff.BlockingRetirements)}.");
        }

        var now = DateTime.UtcNow;
        var factVersion = (await dbContext.EventFactSets
            .Where(x => x.EventId == groupEvent.Id)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0) + 1;
        var planVersion = (await dbContext.EventPlanSnapshots
            .Where(x => x.EventId == groupEvent.Id)
            .MaxAsync(x => (int?)x.Version, cancellationToken) ?? 0) + 1;
        var factSet = new EventFactSet
        {
            Id = Guid.NewGuid(),
            EventId = groupEvent.Id,
            Version = factVersion,
            SchemaVersion = proposal.SchemaVersion,
            FactsJson = JsonSerializer.Serialize(proposal.Facts.Items, EventCompositionEngine.CreateJsonOptions()),
            SourceHash = proposal.Facts.SourceHash,
            CreatedByMemberId = request.CurrentMemberId,
            CreatedUtc = now
        };
        var acceptedProposal = proposal with { Facts = proposal.Facts with { Version = factVersion } };
        var etag = EventCompositionPersistence.CreatePlanETag(planVersion, proposal.ProposalHash);
        var snapshot = new EventPlanSnapshot
        {
            Id = Guid.NewGuid(),
            EventId = groupEvent.Id,
            SourceFactSetId = factSet.Id,
            Version = planVersion,
            SchemaVersion = proposal.SchemaVersion,
            ProposalHash = proposal.ProposalHash,
            ETag = etag,
            ArchetypeCode = proposal.ArchetypeCode,
            ArchetypeVersion = proposal.ArchetypeVersion,
            ActivityTypeCode = proposal.ActivityTypeCode,
            ActivityTypeVersion = proposal.ActivityTypeVersion,
            SnapshotJson = EventCompositionPersistence.SerializePlan(
                acceptedProposal, request.Request.HumanDecisions ?? []),
            AcceptedByMemberId = request.CurrentMemberId,
            AcceptedUtc = now,
            IsActive = true,
            CreatedUtc = now
        };
        if (activeSnapshot is not null)
        {
            activeSnapshot.IsActive = false;
        }
        dbContext.EventFactSets.Add(factSet);
        dbContext.EventPlanSnapshots.Add(snapshot);
        dbContext.EventIdempotencyRecords.Add(new EventIdempotencyRecord
        {
            Id = Guid.NewGuid(),
            Operation = "event.plan.accept",
            ScopeId = groupEvent.Id,
            Key = idempotencyKey,
            RequestHash = requestHash,
            ResultEntityId = snapshot.Id,
            CreatedUtc = now,
            ExpiresUtc = now.AddDays(7)
        });

        groupEvent.ActivePlanVersion = planVersion;
        groupEvent.PlanConcurrencyToken = Guid.NewGuid();
        groupEvent.UpdatedUtc = now;
        EventCompositionPersistence.SyncWorkflowContributions(groupEvent.WorkflowRun, acceptedProposal, now);

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AppResult<EventPlanSnapshotDto>.PreconditionFailed(
                "The event plan changed while it was being accepted.");
        }

        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventPlanSnapshotDto>.Success(new EventPlanSnapshotDto(
            groupEvent.Id,
            planVersion,
            request.CurrentMemberId,
            now,
            etag,
            false,
            acceptedProposal,
            request.Request.HumanDecisions ?? []));
    }

    private static AppResult<TTarget> CopyFailure<TSource, TTarget>(AppResult<TSource> source)
        => source.Status switch
        {
            AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message ?? "Not found."),
            AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message ?? "Forbidden."),
            AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message ?? "Conflict."),
            AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(source.Message ?? "Precondition failed."),
            _ => AppResult<TTarget>.Validation(source.Message ?? "Validation failed.")
        };
}

public sealed record GetEventWorkspaceQuery(Guid EventId, Guid CurrentMemberId)
    : IRequest<AppResult<EventWorkspaceDto>>;

public sealed class GetEventWorkspaceQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<GetEventWorkspaceQuery, AppResult<EventWorkspaceDto>>
{
    public async Task<AppResult<EventWorkspaceDto>> Handle(
        GetEventWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents.AsNoTracking()
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventWorkspaceDto>.NotFound("Event not found.");
        }

        var canManage = await EventCompositionPersistence.CanManageEventAsync(
            dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken);
        var isEventTeam = canManage || await EventCompositionPersistence.CanViewEventTeamAsync(
            dbContext, groupAuthorizationService, groupEvent, request.CurrentMemberId, cancellationToken);
        var isGroupMember = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId, request.CurrentMemberId, cancellationToken);
        var churchRootId = await EventCompositionPersistence.FindChurchRootIdAsync(
            dbContext, groupEvent.GroupId, cancellationToken);
        var isChurchMember = churchRootId.HasValue && churchRootId.Value != groupEvent.GroupId &&
            await groupAuthorizationService.IsApprovedMemberAsync(
                churchRootId.Value, request.CurrentMemberId, cancellationToken);
        var canAuditRam = await AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext, request.CurrentMemberId, AdminPermissionCatalog.AuditEvents, cancellationToken);
        var isRosterParticipant = await dbContext.EventRosterAssignments.AsNoTracking().AnyAsync(x =>
            x.MemberId == request.CurrentMemberId && x.EndedUtc == null &&
            x.ServiceSlot.Occurrence.EventId == groupEvent.Id, cancellationToken);
        if (!isEventTeam && !isGroupMember && !isChurchMember && !canAuditRam)
        {
            return AppResult<EventWorkspaceDto>.Forbidden(
                "Approved group membership or an event-team role is required.");
        }

        var activeSnapshot = await dbContext.EventPlanSnapshots.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id && x.IsActive)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);
        if (activeSnapshot is null)
        {
            var blocker = new LocalizedTextDto(
                "Compose and accept an event plan.",
                "組合並接受活動方案。");
            return AppResult<EventWorkspaceDto>.Success(new EventWorkspaceDto(
                groupEvent.Id,
                groupEvent.GroupId,
                new LocalizedTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
                null,
                EventCompositionPersistence.CreateEmptyPlanETag(groupEvent),
                new ReadinessDto(EventReadinessStatus.NotReady, [blocker], [], DateTime.UtcNow),
                [new EventWorkspaceItemDto(
                    "workspace.overview", null, "tab", "overview", null,
                    new LocalizedTextDto("Overview", "總覽"), 10,
                    EventReadinessStatus.NotReady, [blocker],
                    canManage ? ["plan.recompose", "plan.accept"] : [])],
                [blocker],
                canManage,
                groupEvent.SponsorshipStatus));
        }

        EventPlanSnapshotDto snapshot;
        try
        {
            snapshot = EventCompositionPersistence.ToSnapshotDto(activeSnapshot);
        }
        catch (JsonException)
        {
            return AppResult<EventWorkspaceDto>.Conflict("The active event plan snapshot is invalid.");
        }

        var currentPlan = EventCompositionPersistence.RefreshReadiness(snapshot.Plan, groupEvent, DateTime.UtcNow);
        currentPlan = await EventCompositionPersistence.ApplyOperationalReadinessAsync(
            dbContext, currentPlan, groupEvent, DateTime.UtcNow, cancellationToken);
        var items = currentPlan.Navigation
            .Where(item => CanSeeItem(item, isEventTeam, isGroupMember || isChurchMember, canAuditRam, isRosterParticipant))
            .Select(item => item with
            {
                Blockers = isEventTeam || canManage || canAuditRam ? item.Blockers : [],
                AllowedActions = BuildAllowedActions(item, canManage, isEventTeam, canAuditRam)
            })
            .ToArray();
        var nextSteps = currentPlan.Readiness.Blockers.Take(3).ToArray();
        if (nextSteps.Length == 0)
        {
            nextSteps =
            [
                new LocalizedTextDto(
                    "Review the next required workflow step.",
                    "檢查下一個必需的流程步驟。")
            ];
        }

        return AppResult<EventWorkspaceDto>.Success(new EventWorkspaceDto(
            groupEvent.Id,
            groupEvent.GroupId,
            new LocalizedTextDto(groupEvent.TitleEn, groupEvent.TitleZh),
            snapshot.PlanVersion,
            snapshot.ETag,
            currentPlan.Readiness,
            items,
            nextSteps,
            canManage,
            groupEvent.SponsorshipStatus));
    }

    private static bool CanSeeItem(
        EventWorkspaceItemDto item,
        bool isEventTeam,
        bool isGroupMember,
        bool canAuditRam,
        bool isRosterParticipant)
    {
        if (item.ModuleCode is null)
        {
            return true;
        }
        if (!EventCompositionDefinitions.ModulesByCode.TryGetValue(item.ModuleCode, out var module))
        {
            return false;
        }
        if (isEventTeam)
        {
            return true;
        }
        if (canAuditRam && item.ModuleCode == "SAFETY.RAM")
        {
            return true;
        }
        if (isRosterParticipant && item.ModuleCode == "SERVICE.ROSTER")
        {
            return true;
        }
        if (!isGroupMember)
        {
            return false;
        }
        return module.DataClasses.Contains("public", StringComparer.Ordinal) ||
               module.DataClasses.Contains("churchOrGroupVisible", StringComparer.Ordinal);
    }

    private static IReadOnlyList<string> BuildAllowedActions(
        EventWorkspaceItemDto item,
        bool canManage,
        bool isEventTeam,
        bool canAuditRam)
    {
        if (item.ModuleCode == "SAFETY.RAM" && canAuditRam)
        {
            return canManage ? ["ram.view", "ram.edit", "ram.approve"] : ["ram.view", "ram.approve"];
        }
        if (item.ModuleCode is null)
        {
            return canManage ? ["plan.recompose", "plan.accept", "event.role.assign"] : ["plan.view"];
        }
        if (!EventCompositionDefinitions.ModulesByCode.TryGetValue(item.ModuleCode, out var module))
        {
            return [];
        }
        var integration = module.IntegrationKey;
        return canManage ? [$"{integration}.view", $"{integration}.manage"]
            : isEventTeam ? [$"{integration}.view"] : [];
    }
}
