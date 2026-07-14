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

        groupEvent.TitleEn = request.TitleEn;
        groupEvent.TitleZh = request.TitleZh;
        groupEvent.StartDate = request.StartDate;
        groupEvent.EndDate = request.EndDate;
        groupEvent.EventDataJson = request.EventDataJson;
        groupEvent.UpdatedUtc = DateTime.UtcNow;
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
            contactProfileIds));
    }
}
