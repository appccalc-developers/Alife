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

namespace Alife.Application.Events.Commands.UpdateEventOccurrences;

public sealed class UpdateEventOccurrencesCommandHandler(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization,
    IEventCacheInvalidationService cacheInvalidation)
    : IRequestHandler<UpdateEventOccurrencesCommand, AppResult<IReadOnlyList<EventPlanOccurrenceDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventPlanOccurrenceDto>>> Handle(
        UpdateEventOccurrencesCommand request,
        CancellationToken cancellationToken)
    {
        if (request.Occurrences.Count is < 1 or > 60)
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("An event must contain between 1 and 60 sessions.");
        if (request.Occurrences.Where(x => x.Id.HasValue).GroupBy(x => x.Id).Any(x => x.Count() > 1))
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("A session cannot appear more than once.");

        var groupEvent = await db.GroupEvents
            .Include(x => x.RamAssessment)
            .Include(x => x.ClosureReport)
            .Include(x => x.VenueBookings)
            .Include(x => x.Plan).ThenInclude(x => x!.Occurrences)
            .Include(x => x.Plan).ThenInclude(x => x!.Revisions)
            .Include(x => x.Plan).ThenInclude(x => x!.Modules)
            .Include(x => x.Plan).ThenInclude(x => x!.ReadinessGates).ThenInclude(x => x.ModuleInstance)
            .Include(x => x.Plan).ThenInclude(x => x!.Decisions)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null)
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Forbidden("Only event leaders can manage the event schedule.");

        foreach (var input in request.Occurrences)
        {
            if (string.IsNullOrWhiteSpace(input.NameEn) && string.IsNullOrWhiteSpace(input.NameZh))
                return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("Each session needs an English or Chinese name.");
            if (input.NameEn.Trim().Length > 200 || input.NameZh.Trim().Length > 200)
                return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("Session names cannot exceed 200 characters.");
            if (input.EndUtc <= input.StartUtc)
                return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("Each session must end after it starts.");
            if (input.StartUtc.ToUniversalTime() < groupEvent.StartDate || input.EndUtc.ToUniversalTime() > groupEvent.EndDate)
                return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("Every session must stay within the event's overall start and end dates.");
            if (string.IsNullOrWhiteSpace(input.TimeZoneId) || input.TimeZoneId.Trim().Length > 100)
                return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("Each session needs a valid time-zone name.");
        }

        var now = DateTime.UtcNow;
        if (groupEvent.Plan is null)
        {
            groupEvent.Plan = EventCompositionFactory.CreateInitial(
                groupEvent, request.CurrentMemberId, groupEvent.RamAssessment?.RamDataJson, now);
            db.EventPlans.Add(groupEvent.Plan);
        }

        var plan = groupEvent.Plan;
        var existingById = plan.Occurrences.ToDictionary(x => x.Id);
        var requestedIds = request.Occurrences.Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        if (requestedIds.Any(x => !existingById.ContainsKey(x)))
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Validation("A session does not belong to this event.");

        var removed = plan.Occurrences.Where(x => !requestedIds.Contains(x.Id)).ToArray();
        var protectedIds = groupEvent.VenueBookings
            .Where(x => x.EventOccurrenceId.HasValue)
            .Select(x => x.EventOccurrenceId!.Value)
            .ToHashSet();
        if (removed.Any(x => protectedIds.Contains(x.Id)))
            return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Conflict("A session with a venue request cannot be removed. Keep the session for history or resolve its venue request first.");

        var knownRevisionIds = plan.Revisions.Select(x => x.Id).ToHashSet();
        var knownDecisionIds = plan.Decisions.Select(x => x.Id).ToHashSet();
        foreach (var occurrence in removed)
        {
            plan.Occurrences.Remove(occurrence);
            db.EventOccurrences.Remove(occurrence);
        }

        for (var index = 0; index < request.Occurrences.Count; index++)
        {
            var input = request.Occurrences[index];
            EventOccurrence occurrence;
            if (input.Id is Guid id)
            {
                occurrence = existingById[id];
                var linkedBookingExists = protectedIds.Contains(id);
                if (linkedBookingExists &&
                    (occurrence.StartUtc != input.StartUtc.ToUniversalTime() || occurrence.EndUtc != input.EndUtc.ToUniversalTime()))
                    return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Conflict("A session time cannot change while a venue request is linked to it.");
            }
            else
            {
                occurrence = new EventOccurrence
                {
                    Id = Guid.NewGuid(),
                    EventPlanId = plan.Id,
                    OccurrenceKey = $"session-{Guid.NewGuid():N}"[..20],
                    EventPlan = plan
                };
                plan.Occurrences.Add(occurrence);
                db.EventOccurrences.Add(occurrence);
            }

            occurrence.NameEn = Fallback(input.NameEn, input.NameZh);
            occurrence.NameZh = Fallback(input.NameZh, input.NameEn);
            occurrence.StartUtc = input.StartUtc.ToUniversalTime();
            occurrence.EndUtc = input.EndUtc.ToUniversalTime();
            occurrence.TimeZoneId = input.TimeZoneId.Trim();
            occurrence.SortOrder = index + 1;
        }

        InvalidateScheduleDependentConfirmations(groupEvent, request.CurrentMemberId, now);
        EventCompositionFactory.RecordPlanChange(
            plan, groupEvent.EventDataJson, request.CurrentMemberId, "Event sessions updated", now);
        db.EventPlanRevisions.AddRange(plan.Revisions.Where(x => !knownRevisionIds.Contains(x.Id)));
        db.EventDecisionRecords.AddRange(plan.Decisions.Where(x => !knownDecisionIds.Contains(x.Id)));
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, GroupId = groupEvent.GroupId,
            EventId = groupEvent.Id, Action = "event.occurrences.updated", EntityType = nameof(EventPlan),
            EntityId = plan.Id, MetadataJson = JsonSerializer.Serialize(new { count = request.Occurrences.Count, planRevision = plan.CurrentRevision }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        await cacheInvalidation.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);

        return AppResult<IReadOnlyList<EventPlanOccurrenceDto>>.Success(plan.Occurrences
            .OrderBy(x => x.SortOrder)
            .Select(ToDto)
            .ToArray());
    }

    private static void InvalidateScheduleDependentConfirmations(GroupEvent groupEvent, Guid actorMemberId, DateTime now)
    {
        if (groupEvent.RamAssessment is not null)
        {
            var previousStatus = groupEvent.RamAssessment.Status;
            groupEvent.RamAssessment.RamDataJson = EventRamDecisionPolicy.ResetLeaderConfirmation(groupEvent.RamAssessment.RamDataJson);
            groupEvent.RamAssessment.Status = EventRamStatus.Draft;
            groupEvent.RamAssessment.SubmittedByMemberId = null;
            groupEvent.RamAssessment.SubmittedUtc = null;
            groupEvent.RamAssessment.ApprovedByMemberId = null;
            groupEvent.RamAssessment.ApprovedUtc = null;
            groupEvent.RamAssessment.UpdatedUtc = now;
            if (previousStatus is EventRamStatus.AwaitingReview or EventRamStatus.Approved)
                EventRamDecisionPolicy.InvalidateApproval(groupEvent.Plan, actorMemberId, "Event sessions changed; the RAM must be reviewed again.", now);
        }

        if (groupEvent.ClosureReport?.LeaderConfirmed == true)
        {
            groupEvent.ClosureReport.LeaderConfirmed = false;
            groupEvent.ClosureReport.ConfirmedByMemberId = null;
            groupEvent.ClosureReport.ConfirmedUtc = null;
            groupEvent.ClosureReport.UpdatedUtc = now;
        }
    }

    private static EventPlanOccurrenceDto ToDto(EventOccurrence occurrence) => new(
        occurrence.Id, occurrence.OccurrenceKey, new WorkflowTextDto(occurrence.NameEn, occurrence.NameZh),
        occurrence.StartUtc, occurrence.EndUtc, occurrence.TimeZoneId, occurrence.SortOrder);

    private static string Fallback(string primary, string secondary) =>
        string.IsNullOrWhiteSpace(primary) ? secondary.Trim() : primary.Trim();
}
