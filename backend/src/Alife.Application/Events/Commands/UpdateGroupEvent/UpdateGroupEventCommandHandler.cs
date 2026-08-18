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

        if (!EventVisibilityPolicy.TryReadVisibility(request.EventDataJson, out var visibility))
        {
            return AppResult<GroupEventSummaryDto>.Validation("Event data must be a JSON object with a supported visibility.");
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
                    CreatedUtc = now
                };
                dbContext.EventRamAssessments.Add(groupEvent.RamAssessment);
            }

            groupEvent.RamAssessment.RamDataJson = request.RamDataJson;
        }

        if (groupEvent.RamAssessment is not null)
        {
            groupEvent.RamAssessment.Status = Alife.Domain.Enums.EventRamStatus.Draft;
            groupEvent.RamAssessment.SubmittedByMemberId = null;
            groupEvent.RamAssessment.SubmittedUtc = null;
            groupEvent.RamAssessment.ApprovedByMemberId = null;
            groupEvent.RamAssessment.ApprovedUtc = null;
            groupEvent.RamAssessment.UpdatedUtc = now;
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
            visibility));
    }
}
