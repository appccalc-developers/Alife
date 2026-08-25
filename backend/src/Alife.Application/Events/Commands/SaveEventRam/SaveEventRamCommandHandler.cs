using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventRam;

public sealed class SaveEventRamCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<SaveEventRamCommand, AppResult<EventRamAssessmentDto>>
{
    public async Task<AppResult<EventRamAssessmentDto>> Handle(SaveEventRamCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .Include(x => x.RamAssessment)
            .Include(x => x.Plan).ThenInclude(x => x!.Revisions)
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .Include(x => x.Plan).ThenInclude(x => x!.ReadinessGates).ThenInclude(x => x.ModuleInstance)
            .Include(x => x.Plan).ThenInclude(x => x!.Decisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
        {
            return AppResult<EventRamAssessmentDto>.NotFound("Event not found.");
        }

        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventRamAssessmentDto>.Forbidden("Only group leaders and co-leaders can edit RAM drafts.");
        }

        if (!EventRamPolicy.IsValidJson(request.RamDataJson))
        {
            return AppResult<EventRamAssessmentDto>.Validation("RAM data must be a JSON object.");
        }

        var now = DateTime.UtcNow;
        var ram = groupEvent.RamAssessment;
        if (ram is null)
        {
            ram = new EventRamAssessment { EventId = groupEvent.Id, CreatedUtc = now };
            groupEvent.RamAssessment = ram;
            dbContext.EventRamAssessments.Add(ram);
        }

        var previousStatus = ram.Status;
        ram.RamDataJson = request.RamDataJson;
        ram.Status = EventRamStatus.Draft;
        ram.SubmittedByMemberId = null;
        ram.SubmittedUtc = null;
        ram.ApprovedByMemberId = null;
        ram.ApprovedUtc = null;
        ram.UpdatedUtc = now;
        groupEvent.UpdatedUtc = now;

        if (previousStatus is EventRamStatus.AwaitingReview or EventRamStatus.Approved)
        {
            EventRamDecisionPolicy.InvalidateApproval(
                groupEvent.Plan,
                request.CurrentMemberId,
                "RAM content changed after submission; a new review is required.",
                now);
            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorMemberId = request.CurrentMemberId,
                Action = "event.ram.review-invalidated",
                EntityType = nameof(EventRamAssessment),
                EntityId = groupEvent.Id,
                GroupId = groupEvent.GroupId,
                EventId = groupEvent.Id,
                MetadataJson = System.Text.Json.JsonSerializer.Serialize(new { previousStatus = previousStatus.ToString() }),
                OccurredUtc = now
            });
        }

        var knownDecisionIds = groupEvent.Plan?.Decisions.Select(x => x.Id).ToHashSet() ?? [];
        if (groupEvent.Plan is null)
        {
            groupEvent.Plan = EventCompositionFactory.CreateInitial(
                groupEvent, request.CurrentMemberId, request.RamDataJson, now);
            dbContext.EventPlans.Add(groupEvent.Plan);
        }
        else
        {
            var knownRevisionIds = groupEvent.Plan.Revisions.Select(x => x.Id).ToHashSet();
            var knownOccurrenceIds = groupEvent.Plan.Occurrences.Select(x => x.Id).ToHashSet();
            var knownModuleIds = groupEvent.Plan.Modules.Select(x => x.Id).ToHashSet();
            var knownGateIds = groupEvent.Plan.ReadinessGates.Select(x => x.Id).ToHashSet();
            EventCompositionFactory.Revise(
                groupEvent.Plan, groupEvent, request.CurrentMemberId, request.RamDataJson, now);
            dbContext.EventPlanRevisions.AddRange(groupEvent.Plan.Revisions.Where(x => !knownRevisionIds.Contains(x.Id)));
            dbContext.EventOccurrences.AddRange(groupEvent.Plan.Occurrences.Where(x => !knownOccurrenceIds.Contains(x.Id)));
            dbContext.EventModuleInstances.AddRange(groupEvent.Plan.Modules.Where(x => !knownModuleIds.Contains(x.Id)));
            dbContext.EventReadinessGates.AddRange(groupEvent.Plan.ReadinessGates.Where(x => !knownGateIds.Contains(x.Id)));
        }
        dbContext.EventDecisionRecords.AddRange(groupEvent.Plan.Decisions.Where(x => !knownDecisionIds.Contains(x.Id)));

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram, groupEvent.GroupId));
    }
}
