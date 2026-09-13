using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;

namespace Alife.Application.Events.Commands.DeleteEventEnrollment;

public sealed class DeleteEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService? eventCacheInvalidationService = null)
    : IRequestHandler<DeleteEventEnrollmentCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(DeleteEventEnrollmentCommand request, CancellationToken cancellationToken)
    {
        var result = await new EventEnrollmentCapacityService(dbContext, groupAuthorizationService, eventCacheInvalidationService)
            .MutateAsync(request.EventId, request.CurrentMemberId, "cancel", null, request.EnrollmentId, false, cancellationToken);
        return result.Status switch {
            AppResultStatus.Success => AppResult<bool>.Success(true),
            AppResultStatus.NotFound => AppResult<bool>.NotFound(result.Message!),
            AppResultStatus.Forbidden => AppResult<bool>.Forbidden(result.Message!),
            AppResultStatus.PreconditionFailed => AppResult<bool>.PreconditionFailed(result.Message!),
            _ => AppResult<bool>.Conflict(result.Message!)
        };
    }
}