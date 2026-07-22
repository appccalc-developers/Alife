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
        var ramAssessment = new EventRamAssessment
        {
            EventId = groupEvent.Id,
            RamDataJson = request.RamDataJson ?? "{}",
            Status = EventRamStatus.Draft,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.EventRamAssessments.Add(ramAssessment);
        dbContext.EventContactProfiles.AddRange(contactProfileIds.Select(contactProfileId => new EventContactProfile
        {
            EventId = groupEvent.Id,
            ContactProfileId = contactProfileId
        }));
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(request.GroupId, cancellationToken);

        return AppResult<GroupEventSummaryDto>.Success(ToDto(groupEvent, contactProfileIds, ramAssessment.Status));
    }

    private static GroupEventSummaryDto ToDto(GroupEvent e, IReadOnlyList<Guid> contactProfileIds, EventRamStatus ramStatus) =>
        new(e.Id, e.GroupId, e.CreatedByMemberId, e.TitleEn, e.TitleZh,
            e.StartDate, e.EndDate, e.EventDataJson, e.CreatedUtc, e.UpdatedUtc, contactProfileIds, ramStatus);
}
