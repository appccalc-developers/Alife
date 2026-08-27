using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.CreateGroupEvent;

public sealed class CreateGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService,
    IEventCompositionEngine? compositionEngine = null,
    IEventActivityTemplateCatalog? activityTemplateCatalog = null)
    : IRequestHandler<CreateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(CreateGroupEventCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupEventSummaryDto>.Forbidden("Only group leaders and co-leaders can create events.");
        }

        if (request.RamDataJson is not null && !EventRamPolicy.IsValidJson(request.RamDataJson))
        {
            return AppResult<GroupEventSummaryDto>.Validation("RAM data must be a JSON object.");
        }

        if (!EventVisibilityPolicy.TryReadVisibility(request.EventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        var accountableOwnerMemberId = request.AccountableOwnerMemberId ?? request.CurrentMemberId;
        if (accountableOwnerMemberId != request.CurrentMemberId)
        {
            var ownerIsApprovedMember = await dbContext.GroupMemberships.AsNoTracking().AnyAsync(
                x => x.GroupId == request.GroupId &&
                    x.MemberId == accountableOwnerMemberId &&
                    x.Status == MembershipStatus.Approved,
                cancellationToken);
            if (!ownerIsApprovedMember)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "The accountable owner must be an approved member of the owning group.");
            }
        }

        if (request.ParentEventId.HasValue)
        {
            var parent = await dbContext.GroupEvents.AsNoTracking()
                .Where(x => x.Id == request.ParentEventId.Value)
                .Select(x => new { x.GroupId, x.ParentEventId })
                .FirstOrDefaultAsync(cancellationToken);
            if (parent is null || parent.GroupId != request.GroupId)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "A child event must belong to the same owning group as its parent.");
            }
            if (parent.ParentEventId.HasValue)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "Child events are limited to one level.");
            }
        }

        var idempotencyKey = request.IdempotencyKey?.Trim();
        string? createRequestHash = null;
        if (request.Composition is not null)
        {
            if (request.GovernanceMode == EventGovernanceMode.ChurchSponsored)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "Create the event first, then use the audited sponsorship submit/decision workflow.");
            }
            if (compositionEngine is null)
            {
                return AppResult<GroupEventSummaryDto>.Conflict(
                    "Event composition is unavailable.");
            }
            if (string.Equals(request.Composition.SchemaVersion, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(request.WorkflowTemplateCode))
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "schemaVersion 1.1.0 does not accept workflowTemplateCode; use the activity type workflow decision.");
            }
            if (string.IsNullOrWhiteSpace(idempotencyKey) || idempotencyKey.Length > 200)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "A valid Idempotency-Key header is required when creating from a proposal.");
            }

            createRequestHash = EventCompositionEngine.Hash(new
            {
                request.GroupId,
                request.CurrentMemberId,
                request.TitleEn,
                request.TitleZh,
                request.StartDate,
                request.EndDate,
                request.EventDataJson,
                request.ContactProfileIds,
                request.RamDataJson,
                request.WorkflowTemplateCode,
                request.Composition,
                request.CompositionProposalHash,
                accountableOwnerMemberId,
                governanceMode = request.GovernanceMode ?? EventGovernanceMode.MemberLed,
                request.ParentEventId,
                request.SeriesSetup
            });
            var existingRetry = await dbContext.EventIdempotencyRecords.AsNoTracking()
                .FirstOrDefaultAsync(x => x.Operation == "event.create.plan" &&
                    x.ScopeId == request.GroupId && x.Key == idempotencyKey,
                    cancellationToken);
            if (existingRetry is not null)
            {
                if (!string.Equals(existingRetry.RequestHash, createRequestHash, StringComparison.Ordinal))
                {
                    return AppResult<GroupEventSummaryDto>.Conflict(
                        "The Idempotency-Key was already used with a different request.");
                }

                var existingEvent = await dbContext.GroupEvents.AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == existingRetry.ResultEntityId, cancellationToken);
                if (existingEvent is null)
                {
                    return AppResult<GroupEventSummaryDto>.Conflict(
                        "The idempotent result is no longer available.");
                }
                var existingContactIds = await dbContext.EventContactProfiles.AsNoTracking()
                    .Where(x => x.EventId == existingEvent.Id)
                    .Select(x => x.ContactProfileId)
                    .ToListAsync(cancellationToken);
                var existingRamStatus = await dbContext.EventRamAssessments.AsNoTracking()
                    .Where(x => x.EventId == existingEvent.Id)
                    .Select(x => (EventRamStatus?)x.Status)
                    .FirstOrDefaultAsync(cancellationToken) ?? EventRamStatus.Draft;
                EventVisibilityPolicy.TryReadVisibility(existingEvent.EventDataJson, out var existingVisibility);
                return AppResult<GroupEventSummaryDto>.Success(ToDto(
                    existingEvent, existingContactIds, existingRamStatus, existingVisibility));
            }
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == request.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        var activityTypesByCode = activityTemplateCatalog is null
            ? EventCompositionDefinitions.ActivityTypesByCode
            : await activityTemplateCatalog.ActiveDefinitionsByCodeAsync(cancellationToken);
        var workflowRecommendation = request.Composition is null
            ? null
            : await EventCompositionPersistence.ResolveWorkflowRecommendationAsync(
                dbContext, request.GroupId, request.Composition, cancellationToken, activityTypesByCode);
        EventWorkflowTemplate? workflowTemplate = null;
        IReadOnlyList<EventWorkflowStageDefinitionDto>? workflowStages = null;
        if (string.Equals(request.Composition?.SchemaVersion, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal))
        {
            if (workflowRecommendation?.Status == "selected" && workflowRecommendation.ResolvedVersion.HasValue)
            {
                workflowTemplate = await dbContext.EventWorkflowTemplates
                    .Where(x => x.IsActive && x.Code == workflowRecommendation.Code &&
                        x.Version == workflowRecommendation.ResolvedVersion.Value &&
                        (x.OwnerGroupId == null || x.OwnerGroupId == request.GroupId))
                    .OrderByDescending(x => x.OwnerGroupId == request.GroupId)
                    .FirstOrDefaultAsync(cancellationToken);
                if (workflowTemplate is null)
                {
                    return AppResult<GroupEventSummaryDto>.PreconditionFailed(
                        "The recommended workflow changed after proposal review. Compose the plan again.");
                }
            }
        }
        else if (!string.IsNullOrWhiteSpace(request.WorkflowTemplateCode))
        {
            var templateCode = request.WorkflowTemplateCode.Trim().ToLowerInvariant();
            workflowTemplate = await dbContext.EventWorkflowTemplates
                .Where(x => x.IsActive && x.Code == templateCode &&
                    (x.OwnerGroupId == null || x.OwnerGroupId == request.GroupId))
                .OrderByDescending(x => x.Version)
                .FirstOrDefaultAsync(cancellationToken);
            if (workflowTemplate is null)
            {
                return AppResult<GroupEventSummaryDto>.NotFound("Workflow template not found.");
            }

        }

        if (workflowTemplate is not null)
        {
            try
            {
                workflowStages = EventWorkflowDefinition.Parse(workflowTemplate.DefinitionJson);
            }
            catch (JsonException)
            {
                return AppResult<GroupEventSummaryDto>.Validation("The selected workflow template is invalid.");
            }
        }

        var now = DateTime.UtcNow;
        var ramAssessment = new EventRamAssessment
        {
            EventId = Guid.Empty,
            RamDataJson = request.RamDataJson ?? "{}",
            Status = EventRamStatus.Draft,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(),
            GroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            AccountableOwnerMemberId = accountableOwnerMemberId,
            ParentEventId = request.ParentEventId,
            GovernanceMode = request.GovernanceMode ?? EventGovernanceMode.MemberLed,
            TitleEn = request.TitleEn,
            TitleZh = request.TitleZh,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            EventDataJson = request.EventDataJson,
            CreatedUtc = now,
            UpdatedUtc = now,
            RamAssessment = ramAssessment
        };
        ramAssessment.EventId = groupEvent.Id;

        EventPlanProposalDto? acceptedProposal = null;
        EventFactSet? factSet = null;
        EventPlanSnapshot? planSnapshot = null;
        if (request.Composition is not null)
        {
            var composition = request.Composition with { BasePlanVersion = null };
            var proposalResult = compositionEngine!.Compose(composition, new EventCompositionContext(
                "\"plan-new\"",
                HasAccountableOwner: true,
                CheckedUtc: now,
                WorkflowRecommendation: workflowRecommendation,
                ActivityTypesByCode: activityTypesByCode));
            if (!proposalResult.IsSuccess)
            {
                return CopyFailure<EventPlanProposalDto, GroupEventSummaryDto>(proposalResult);
            }
            if (string.IsNullOrWhiteSpace(request.CompositionProposalHash) ||
                !string.Equals(
                    proposalResult.Value!.ProposalHash,
                    request.CompositionProposalHash.Trim(),
                    StringComparison.Ordinal))
            {
                return AppResult<GroupEventSummaryDto>.PreconditionFailed(
                    "The composition proposal is stale or was changed before event creation.");
            }

            acceptedProposal = proposalResult.Value with
            {
                Facts = proposalResult.Value.Facts with { Version = 1 }
            };
            factSet = new EventFactSet
            {
                Id = Guid.NewGuid(),
                EventId = groupEvent.Id,
                Version = 1,
                SchemaVersion = acceptedProposal.SchemaVersion,
                FactsJson = JsonSerializer.Serialize(
                    acceptedProposal.Facts.Items,
                    EventCompositionEngine.CreateJsonOptions()),
                SourceHash = acceptedProposal.Facts.SourceHash,
                CreatedByMemberId = request.CurrentMemberId,
                CreatedUtc = now
            };
            var planETag = EventCompositionPersistence.CreatePlanETag(1, acceptedProposal.ProposalHash);
            planSnapshot = new EventPlanSnapshot
            {
                Id = Guid.NewGuid(),
                EventId = groupEvent.Id,
                SourceFactSetId = factSet.Id,
                Version = 1,
                SchemaVersion = acceptedProposal.SchemaVersion,
                ProposalHash = acceptedProposal.ProposalHash,
                ETag = planETag,
                ArchetypeCode = acceptedProposal.ArchetypeCode,
                ArchetypeVersion = acceptedProposal.ArchetypeVersion,
                ActivityTypeCode = acceptedProposal.ActivityTypeCode,
                ActivityTypeVersion = acceptedProposal.ActivityTypeVersion,
                SnapshotJson = EventCompositionPersistence.SerializePlan(acceptedProposal, []),
                AcceptedByMemberId = request.CurrentMemberId,
                AcceptedUtc = now,
                IsActive = true,
                CreatedUtc = now
            };
            groupEvent.ActivePlanVersion = 1;
        }

        EventSeries? eventSeries = null;
        IReadOnlyList<EventOccurrence> occurrences;
        var isCurrentRecurring = acceptedProposal is not null &&
            string.Equals(acceptedProposal.SchemaVersion, EventCompositionDefinitions.SchemaVersion, StringComparison.Ordinal) &&
            string.Equals(acceptedProposal.ArchetypeCode, "recurring-gathering", StringComparison.Ordinal);
        if (isCurrentRecurring)
        {
            if (request.SeriesSetup is null)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "seriesSetup is required for recurring-gathering creation.");
            }
            if (string.IsNullOrWhiteSpace(request.SeriesSetup.Name.En) ||
                string.IsNullOrWhiteSpace(request.SeriesSetup.Name.Zh))
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "Both English and Chinese series names are required.");
            }
            if (!EventSeriesMaterializer.TryValidate(
                    request.SeriesSetup.RecurrenceRule,
                    request.SeriesSetup.TimeZone,
                    request.SeriesSetup.FirstStartLocal,
                    request.SeriesSetup.DurationMinutes,
                    request.SeriesSetup.RollingOccurrenceWeeks,
                    out var intervalWeeks,
                    out var timeZone,
                    out var seriesError))
            {
                return AppResult<GroupEventSummaryDto>.Validation(seriesError!);
            }

            eventSeries = new EventSeries
            {
                Id = Guid.NewGuid(),
                OwningGroupId = request.GroupId,
                CreatedByMemberId = request.CurrentMemberId,
                NameEn = request.SeriesSetup.Name.En.Trim(),
                NameZh = request.SeriesSetup.Name.Zh.Trim(),
                RecurrenceRule = request.SeriesSetup.RecurrenceRule.Trim().ToUpperInvariant(),
                TimeZone = request.SeriesSetup.TimeZone.Trim(),
                ExceptionDatesJson = JsonSerializer.Serialize(request.SeriesSetup.ExceptionDates ?? []),
                RollingOccurrenceWeeks = request.SeriesSetup.RollingOccurrenceWeeks,
                CreatedUtc = now,
                UpdatedUtc = now
            };
            groupEvent.EventSeriesId = eventSeries.Id;
            occurrences = EventSeriesMaterializer.Materialize(
                groupEvent.Id,
                request.SeriesSetup.FirstStartLocal,
                request.SeriesSetup.DurationMinutes,
                intervalWeeks,
                request.SeriesSetup.RollingOccurrenceWeeks,
                timeZone!,
                (request.SeriesSetup.ExceptionDates ?? []).ToHashSet(),
                new HashSet<DateTime>(),
                now);
            if (occurrences.Count == 0)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "seriesSetup did not produce an occurrence inside the rolling window.");
            }

            // The series setup is the authority for recurring wall-clock time.
            // Keep the compatibility GroupEvent dates aligned with the first
            // materialized occurrence even when the browser and selected IANA
            // time zones differ.
            var firstOccurrence = occurrences.OrderBy(x => x.StartUtc).First();
            groupEvent.StartDate = firstOccurrence.StartUtc;
            groupEvent.EndDate = firstOccurrence.EndUtc;
        }
        else
        {
            if (request.SeriesSetup is not null && acceptedProposal is not null)
            {
                return AppResult<GroupEventSummaryDto>.Validation(
                    "seriesSetup is only valid for recurring-gathering creation.");
            }
            occurrences =
            [
                new EventOccurrence
                {
                    Id = Guid.NewGuid(),
                    EventId = groupEvent.Id,
                    StartUtc = request.StartDate.ToUniversalTime(),
                    EndUtc = request.EndDate.ToUniversalTime(),
                    LocalDate = DateOnly.FromDateTime(request.StartDate),
                    Status = EventOccurrenceStatus.Scheduled,
                    CreatedUtc = now,
                    UpdatedUtc = now
                }
            ];
        }

        IReadOnlyList<EventServiceSlot> presetServiceSlots = [];
        var rosterEnabled = acceptedProposal?.ModuleDecisions.Any(x =>
            x.ModuleCode == "SERVICE.ROSTER" && x.Status != EventModuleDecisionStatus.Inactive) == true;
        if (rosterEnabled &&
            !string.IsNullOrWhiteSpace(acceptedProposal!.ActivityTypeCode) &&
            activityTypesByCode.TryGetValue(
                acceptedProposal.ActivityTypeCode, out var acceptedActivityType))
        {
            // These are editable planning defaults, not policy conclusions or
            // member assignments. Each occurrence owns its own operational slots.
            presetServiceSlots = occurrences.SelectMany(occurrence =>
                acceptedActivityType.PresetServiceSlots.Select(preset => new EventServiceSlot
                {
                    Id = Guid.NewGuid(),
                    OccurrenceId = occurrence.Id,
                    RoleCode = preset.RoleCode,
                    StartUtc = occurrence.StartUtc,
                    EndUtc = occurrence.EndUtc,
                    RequiredCount = preset.RequiredCount,
                    EligibilityCode = preset.EligibilityCode,
                    CreatedUtc = now,
                    UpdatedUtc = now
                })).ToArray();
        }

        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventRamAssessments.Add(ramAssessment);
        if (eventSeries is not null)
        {
            dbContext.EventSeries.Add(eventSeries);
        }
        dbContext.EventOccurrences.AddRange(occurrences);
        dbContext.EventServiceSlots.AddRange(presetServiceSlots);
        if (factSet is not null && planSnapshot is not null)
        {
            dbContext.EventFactSets.Add(factSet);
            dbContext.EventPlanSnapshots.Add(planSnapshot);
            dbContext.EventIdempotencyRecords.Add(new EventIdempotencyRecord
            {
                Id = Guid.NewGuid(),
                Operation = "event.create.plan",
                ScopeId = request.GroupId,
                Key = idempotencyKey!,
                RequestHash = createRequestHash!,
                ResultEntityId = groupEvent.Id,
                CreatedUtc = now,
                ExpiresUtc = now.AddDays(7)
            });
        }
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));
        if (workflowTemplate is not null && workflowStages is not null)
        {
            var workflowRun = EventWorkflowRunFactory.Create(
                groupEvent,
                workflowTemplate,
                workflowStages,
                request.CurrentMemberId,
                now);
            groupEvent.WorkflowRun = workflowRun;
            if (acceptedProposal is not null)
            {
                EventCompositionPersistence.SyncWorkflowContributions(workflowRun, acceptedProposal, now);
            }
            dbContext.EventWorkflowRuns.Add(workflowRun);
        }

        // One SaveChanges call keeps event creation, RAM initialization and the
        // selected workflow snapshot atomic for relational database providers.
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(ToDto(groupEvent, contactProfileIds, ramAssessment.Status, visibility));
    }

    private static GroupEventSummaryDto ToDto(GroupEvent e, IReadOnlyList<Guid> contactProfileIds, EventRamStatus ramStatus, string visibility) =>
        new(e.Id, e.GroupId, e.CreatedByMemberId, e.TitleEn, e.TitleZh,
            e.StartDate, e.EndDate, e.EventDataJson, e.CreatedUtc, e.UpdatedUtc, contactProfileIds, ramStatus, visibility,
            e.AccountableOwnerMemberId, e.GovernanceMode, e.SponsorshipStatus, e.ActivePlanVersion);

    private static AppResult<TTarget> CopyFailure<TSource, TTarget>(AppResult<TSource> source)
        => source.Status switch
        {
            AppResultStatus.NotFound => AppResult<TTarget>.NotFound(source.Message ?? "Not found."),
            AppResultStatus.Forbidden => AppResult<TTarget>.Forbidden(source.Message ?? "Forbidden."),
            AppResultStatus.Conflict => AppResult<TTarget>.Conflict(source.Message ?? "Conflict."),
            AppResultStatus.PreconditionFailed => AppResult<TTarget>.PreconditionFailed(
                source.Message ?? "Precondition failed."),
            _ => AppResult<TTarget>.Validation(source.Message ?? "Validation failed.")
        };
}
