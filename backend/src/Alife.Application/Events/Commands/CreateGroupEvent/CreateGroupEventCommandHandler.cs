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
    IEventCacheInvalidationService eventCacheInvalidationService)
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

        string eventDataJson;
        try { eventDataJson = EventFinancePolicy.ForceUnconfirmed(request.EventDataJson); }
        catch (System.Text.Json.JsonException)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        if (!EventVisibilityPolicy.TryReadVisibility(eventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
        }

        var coreValidationError = EventCorePolicy.ValidationError(
            request.TitleEn, request.TitleZh, request.StartDate, request.EndDate, eventDataJson);
        if (coreValidationError is not null)
        {
            return AppResult<GroupEventSummaryDto>.Validation(coreValidationError);
        }

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == request.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
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
            TitleEn = request.TitleEn,
            TitleZh = request.TitleZh,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            EventDataJson = eventDataJson,
            CreatedUtc = now,
            UpdatedUtc = now,
            RamAssessment = ramAssessment
        };
        ramAssessment.EventId = groupEvent.Id;
        groupEvent.Plan = EventCompositionFactory.CreateInitial(
            groupEvent,
            request.CurrentMemberId,
            request.RamDataJson,
            now,
            request.AiAssistanceReviewed
                ? "AI-assisted event draft confirmed by leader"
                : "Initial composition");

        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventRamAssessments.Add(ramAssessment);
        if (request.AiAssistanceReviewed)
        {
            dbContext.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(),
                ActorMemberId = request.CurrentMemberId,
                GroupId = request.GroupId,
                EventId = groupEvent.Id,
                Action = "event.ai-draft.confirmed",
                EntityType = nameof(GroupEvent),
                EntityId = groupEvent.Id,
                MetadataJson = "{\"humanReviewed\":true,\"promptStored\":false,\"outputStored\":false}",
                OccurredUtc = now
            });
        }
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));
        // One SaveChanges call keeps event creation, RAM initialization and the
        // composed event plan atomic for relational database providers. The legacy
        // workflow template field is intentionally ignored for older API clients.
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(ToDto(groupEvent, contactProfileIds, ramAssessment.Status, visibility));
    }

    private static GroupEventSummaryDto ToDto(GroupEvent e, IReadOnlyList<Guid> contactProfileIds, EventRamStatus ramStatus, string visibility) =>
        new(e.Id, e.GroupId, e.CreatedByMemberId, e.TitleEn, e.TitleZh,
            e.StartDate, e.EndDate, e.EventDataJson, e.CreatedUtc, e.UpdatedUtc, contactProfileIds, ramStatus, visibility,
            EventCompositionFactory.RequiresRam(e.EventDataJson, e.RamAssessment?.RamDataJson), e.EventSeriesId, e.SeriesOccurrenceDate,
            EventCompositionFactory.SelectedOptionalModules(e));
}
