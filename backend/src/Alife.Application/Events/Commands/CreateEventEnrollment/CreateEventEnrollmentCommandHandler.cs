using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventEnrollment;

public sealed class CreateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService? eventCacheInvalidationService = null)
    : IRequestHandler<CreateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(CreateEventEnrollmentCommand request, CancellationToken cancellationToken)
    {
        var result = await new EventEnrollmentCapacityService(dbContext, groupAuthorizationService, eventCacheInvalidationService)
            .MutateAsync(request.EventId, request.CurrentMemberId, "create", request.EnrollmentJson, request.RequestedId, request.AcceptWaitlist, cancellationToken);
        return result;
    }
}