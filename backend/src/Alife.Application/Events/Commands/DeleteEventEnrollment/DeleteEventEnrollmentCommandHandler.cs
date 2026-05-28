using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.DeleteEventEnrollment;

public sealed class DeleteEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<DeleteEventEnrollmentCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(
        DeleteEventEnrollmentCommand request,
        CancellationToken cancellationToken)
    {
        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(x => x.Id == request.EnrollmentId && x.EventId == request.EventId, cancellationToken);

        if (enrollment is null)
        {
            return AppResult<bool>.NotFound("Enrollment not found.");
        }

        if (!await CanMutateAsync(enrollment, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<bool>.Forbidden("You do not have permission to delete this enrollment.");
        }

        dbContext.EventEnrollments.Remove(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(request.EventId, cancellationToken);

        return AppResult<bool>.Success(true);
    }

    private async Task<bool> CanMutateAsync(EventEnrollment enrollment, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (enrollment.MemberId == currentMemberId)
        {
            return true;
        }

        return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            enrollment.GroupId,
            currentMemberId,
            cancellationToken);
    }
}
