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
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<CreateGroupEventCommand, AppResult<GroupEventSummaryDto>>
{
    private const string EventCreatedActionType = "event.created";
    private static readonly JsonSerializerOptions NotificationJsonOptions = new(JsonSerializerDefaults.Web);

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

        var contactProfileIds = (request.ContactProfileIds ?? []).Distinct().ToArray();
        var validContactCount = await dbContext.ContactProfiles.AsNoTracking().CountAsync(
            x => x.OwnerGroupId == request.GroupId && contactProfileIds.Contains(x.Id), cancellationToken);
        if (validContactCount != contactProfileIds.Length)
        {
            return AppResult<GroupEventSummaryDto>.Validation("Every event contact must belong to the event group.");
        }

        var now = DateTime.UtcNow;
        var groupEvent = new GroupEvent
        {
            Id = Guid.NewGuid(),
            GroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            TitleEn = request.TitleEn,
            TitleZh = request.TitleZh,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            EventDataJson = request.EventDataJson,
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));
        var recipientMemberIds = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(x => x.GroupId == request.GroupId && x.Status == MembershipStatus.Approved)
            .Select(x => x.MemberId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var actionDataJson = JsonSerializer.Serialize(
            new
            {
                eventId = groupEvent.Id,
                groupId = groupEvent.GroupId,
                title = new
                {
                    en = groupEvent.TitleEn,
                    zh = groupEvent.TitleZh
                },
                startDate = groupEvent.StartDate,
                endDate = groupEvent.EndDate
            },
            NotificationJsonOptions);

        dbContext.NotificationMessages.AddRange(recipientMemberIds.Select(memberId => new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = memberId,
            CreatedByMemberId = request.CurrentMemberId,
            GroupId = request.GroupId,
            EventId = groupEvent.Id,
            OccurredUtc = now,
            ActionType = EventCreatedActionType,
            ActionDataJson = actionDataJson,
            CreatedUtc = now,
            UpdatedUtc = now
        }));

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(ToDto(groupEvent, contactProfileIds));
    }

    private static GroupEventSummaryDto ToDto(GroupEvent e, IReadOnlyList<Guid> contactProfileIds) =>
        new(e.Id, e.GroupId, e.CreatedByMemberId, e.TitleEn, e.TitleZh,
            e.StartDate, e.EndDate, e.EventDataJson, e.CreatedUtc, e.UpdatedUtc, contactProfileIds);
}
