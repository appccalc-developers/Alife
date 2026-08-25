using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateGroupEvent;

public sealed class UpdateGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<UpdateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    public async Task<AppResult<GroupEventSummaryDto>> Handle(UpdateGroupEventCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(e => e.RamAssessment)
            .Include(e => e.ClosureReport)
            .Include(e => e.Plan).ThenInclude(x => x!.Revisions)
            .Include(e => e.Plan).ThenInclude(x => x!.Occurrences)
            .Include(e => e.Plan).ThenInclude(x => x!.Modules)
            .Include(e => e.Plan).ThenInclude(x => x!.ReadinessGates).ThenInclude(x => x.ModuleInstance)
            .Include(e => e.Plan).ThenInclude(x => x!.Decisions)
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<GroupEventSummaryDto>.NotFound("Event not found.");
        }

        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupEventSummaryDto>.Forbidden("Only group leaders and co-leaders can update events.");
        }

        string nextEventDataJson;
        try
        {
            nextEventDataJson = request.PreserveFinanceConfirmation
                ? request.EventDataJson
                : EventFinancePolicy.ProtectConfirmation(groupEvent.EventDataJson, request.EventDataJson);
        }
        catch (System.Text.Json.JsonException)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        if (!EventVisibilityPolicy.TryReadVisibility(nextEventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        var coreValidationError = EventCorePolicy.ValidationError(
            request.TitleEn, request.TitleZh, request.StartDate, request.EndDate, nextEventDataJson);
        if (coreValidationError is not null)
        {
            return AppResult<GroupEventSummaryDto>.Validation(coreValidationError);
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == groupEvent.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        var existingContacts = await dbContext.EventContactProfiles
            .Where(x => x.EventId == groupEvent.Id)
            .ToListAsync(cancellationToken);
        dbContext.EventContactProfiles.RemoveRange(existingContacts);
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new Alife.Domain.Entities.EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));

        var knownDecisionIds = groupEvent.Plan?.Decisions.Select(x => x.Id).ToHashSet() ?? new HashSet<Guid>();
        var effectiveRamDataJson = request.RamDataJson ?? groupEvent.RamAssessment?.RamDataJson;

        var ramReviewAffected = groupEvent.RamAssessment is not null && EventRamImpactPolicy.HasMaterialChange(
            groupEvent,
            request.TitleEn,
            request.TitleZh,
            request.StartDate,
            request.EndDate,
            nextEventDataJson,
            request.RamDataJson);
        var closureConfirmationAffected = groupEvent.ClosureReport?.LeaderConfirmed == true
            && EventClosurePolicy.ScheduleChanged(groupEvent, request.StartDate, request.EndDate);

        groupEvent.TitleEn = request.TitleEn;
        groupEvent.TitleZh = request.TitleZh;
        groupEvent.StartDate = request.StartDate;
        groupEvent.EndDate = request.EndDate;
        groupEvent.EventDataJson = nextEventDataJson;
        var now = DateTime.UtcNow;
        groupEvent.UpdatedUtc = now;

        if (request.RamDataJson is not null)
        {
            if (!EventRamPolicy.IsValidJson(request.RamDataJson))
            {
                return AppResult<GroupEventSummaryDto>.Validation("RAM data must be a JSON object.");
            }

            if (groupEvent.RamAssessment is null)
            {
                groupEvent.RamAssessment = new Alife.Domain.Entities.EventRamAssessment
                {
                    EventId = groupEvent.Id,
                    CreatedUtc = now,
                    UpdatedUtc = now
                };
                dbContext.EventRamAssessments.Add(groupEvent.RamAssessment);
            }

            groupEvent.RamAssessment.RamDataJson = request.RamDataJson;
        }

        if (groupEvent.RamAssessment is not null && ramReviewAffected)
        {
            var previousRamStatus = groupEvent.RamAssessment.Status;
            groupEvent.RamAssessment.Status = Alife.Domain.Enums.EventRamStatus.Draft;
            groupEvent.RamAssessment.SubmittedByMemberId = null;
            groupEvent.RamAssessment.SubmittedUtc = null;
            groupEvent.RamAssessment.ApprovedByMemberId = null;
            groupEvent.RamAssessment.ApprovedUtc = null;
            groupEvent.RamAssessment.UpdatedUtc = now;
            if (previousRamStatus is Alife.Domain.Enums.EventRamStatus.AwaitingReview or Alife.Domain.Enums.EventRamStatus.Approved)
            {
                EventRamDecisionPolicy.InvalidateApproval(
                    groupEvent.Plan,
                    request.CurrentMemberId,
                    "Event details changed; the RAM must be reviewed again.",
                    now);
                dbContext.AuditLogs.Add(new Alife.Domain.Entities.AuditLog
                {
                    Id = Guid.NewGuid(),
                    ActorMemberId = request.CurrentMemberId,
                    Action = "event.ram.review-invalidated",
                    EntityType = nameof(Alife.Domain.Entities.EventRamAssessment),
                    EntityId = groupEvent.Id,
                    GroupId = groupEvent.GroupId,
                    EventId = groupEvent.Id,
                    MetadataJson = System.Text.Json.JsonSerializer.Serialize(new { previousStatus = previousRamStatus.ToString(), source = "event-update" }),
                    OccurredUtc = now
                });
            }
        }
        if (groupEvent.ClosureReport is not null && closureConfirmationAffected)
        {
            groupEvent.ClosureReport.LeaderConfirmed = false;
            groupEvent.ClosureReport.ConfirmedByMemberId = null;
            groupEvent.ClosureReport.ConfirmedUtc = null;
            groupEvent.ClosureReport.UpdatedUtc = now;
            dbContext.AuditLogs.Add(new Alife.Domain.Entities.AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
                Action = "event.closure.confirmation-invalidated", EntityType = "eventClosureReport", EntityId = groupEvent.Id,
                MetadataJson = "{\"reason\":\"event-schedule-changed\"}", OccurredUtc = now
            });
        }
        if (groupEvent.Plan is null)
        {
            groupEvent.Plan = EventCompositionFactory.CreateInitial(
                groupEvent,
                request.CurrentMemberId,
                effectiveRamDataJson,
                now,
                request.AiAssistanceReviewed
                    ? "AI-assisted event draft confirmed by leader"
                    : "Initial composition");
            dbContext.EventPlans.Add(groupEvent.Plan);
        }
        else
        {
            var knownRevisionIds = groupEvent.Plan.Revisions.Select(x => x.Id).ToHashSet();
            var knownOccurrenceIds = groupEvent.Plan.Occurrences.Select(x => x.Id).ToHashSet();
            var knownModuleIds = groupEvent.Plan.Modules.Select(x => x.Id).ToHashSet();
            var knownGateIds = groupEvent.Plan.ReadinessGates.Select(x => x.Id).ToHashSet();
            EventCompositionFactory.Revise(
                groupEvent.Plan,
                groupEvent,
                request.CurrentMemberId,
                effectiveRamDataJson,
                now,
                request.AiAssistanceReviewed
                    ? "AI-assisted event draft confirmed by leader"
                    : "Event facts updated");
            dbContext.EventPlanRevisions.AddRange(groupEvent.Plan.Revisions.Where(x => !knownRevisionIds.Contains(x.Id)));
            dbContext.EventOccurrences.AddRange(groupEvent.Plan.Occurrences.Where(x => !knownOccurrenceIds.Contains(x.Id)));
            dbContext.EventModuleInstances.AddRange(groupEvent.Plan.Modules.Where(x => !knownModuleIds.Contains(x.Id)));
            dbContext.EventReadinessGates.AddRange(groupEvent.Plan.ReadinessGates.Where(x => !knownGateIds.Contains(x.Id)));
        }
        if (groupEvent.Plan is not null)
        {
            dbContext.EventDecisionRecords.AddRange(groupEvent.Plan.Decisions.Where(x => !knownDecisionIds.Contains(x.Id)));
        }
        if (request.AiAssistanceReviewed)
        {
            dbContext.AuditLogs.Add(new Alife.Domain.Entities.AuditLog
            {
                Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId,
                GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
                Action = "event.ai-draft.confirmed", EntityType = nameof(Alife.Domain.Entities.GroupEvent), EntityId = groupEvent.Id,
                MetadataJson = "{\"humanReviewed\":true,\"promptStored\":false,\"outputStored\":false}", OccurredUtc = now
            });
        }
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(groupEvent.Id, cancellationToken);
        await eventCacheInvalidationService.RemoveEventReviewsAsync(groupEvent.Id, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(new GroupEventSummaryDto(
            groupEvent.Id,
            groupEvent.GroupId,
            groupEvent.CreatedByMemberId,
            groupEvent.TitleEn,
            groupEvent.TitleZh,
            groupEvent.StartDate,
            groupEvent.EndDate,
            groupEvent.EventDataJson,
            groupEvent.CreatedUtc,
            groupEvent.UpdatedUtc,
            contactProfileIds,
            groupEvent.RamAssessment?.Status ?? Alife.Domain.Enums.EventRamStatus.Draft,
            visibility,
            EventCompositionFactory.RequiresRam(groupEvent.EventDataJson, groupEvent.RamAssessment?.RamDataJson),
            groupEvent.EventSeriesId,
            groupEvent.SeriesOccurrenceDate,
            EventCompositionFactory.SelectedOptionalModules(groupEvent)));
    }
}
