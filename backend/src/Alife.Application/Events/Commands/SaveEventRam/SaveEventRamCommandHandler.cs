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
            dbContext.EventRamAssessments.Add(ram);
        }

        ram.RamDataJson = request.RamDataJson;
        ram.Status = EventRamStatus.Draft;
        ram.SubmittedByMemberId = null;
        ram.SubmittedUtc = null;
        ram.ApprovedByMemberId = null;
        ram.ApprovedUtc = null;
        ram.UpdatedUtc = now;
        groupEvent.UpdatedUtc = now;

        await EventWorkflowIntegration.SyncRamAsync(
            dbContext, groupEvent.Id, EventRamStatus.Draft, ram.RamDataJson,
            request.CurrentMemberId, now, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram, groupEvent.GroupId));
    }
}
