using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Commands.EnrollGroupEvent;

public sealed class EnrollGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService? eventCacheInvalidationService = null)
    : IRequestHandler<EnrollGroupEventCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(EnrollGroupEventCommand request, CancellationToken cancellationToken)
    {
        var result = await new EventEnrollmentCapacityService(dbContext, groupAuthorizationService, eventCacheInvalidationService)
            .MutateAsync(request.EventId, request.CurrentMemberId, "create", request.EnrollmentJson, null, false, cancellationToken, request.GroupId);
        return result;
    }
}