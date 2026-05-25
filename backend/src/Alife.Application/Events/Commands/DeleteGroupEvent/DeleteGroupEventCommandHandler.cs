using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.DeleteGroupEvent;

public sealed class DeleteGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<DeleteGroupEventCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(DeleteGroupEventCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .FirstOrDefaultAsync(e => e.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<bool>.NotFound("Event not found.");
        }

        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<bool>.Forbidden("Only group leaders and co-leaders can delete events.");
        }

        groupEvent.IsDeleted = true;
        groupEvent.UpdatedUtc = DateTime.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveGroupEventsAsync(groupEvent.GroupId, cancellationToken);

        return AppResult<bool>.Success(true);
    }
}
