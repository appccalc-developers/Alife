using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventEnrollment;

public sealed class UpdateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService? eventCacheInvalidationService = null)
    : IRequestHandler<UpdateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(UpdateEventEnrollmentCommand request, CancellationToken cancellationToken)
    {
        var result = await new EventEnrollmentCapacityService(dbContext, groupAuthorizationService, eventCacheInvalidationService)
            .MutateAsync(request.EventId, request.CurrentMemberId, "update", request.EnrollmentJson, request.EnrollmentId, false, cancellationToken);
        return result;
    }
}