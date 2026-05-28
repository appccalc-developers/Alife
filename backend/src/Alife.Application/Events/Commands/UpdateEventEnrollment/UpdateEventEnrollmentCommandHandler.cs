using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.UpdateEventEnrollment;

public sealed class UpdateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<UpdateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(
        UpdateEventEnrollmentCommand request,
        CancellationToken cancellationToken)
    {
        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(x => x.Id == request.EnrollmentId && x.EventId == request.EventId, cancellationToken);

        if (enrollment is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Enrollment not found.");
        }

        if (!await CanMutateAsync(enrollment, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventEnrollmentDto>.Forbidden("You do not have permission to update this enrollment.");
        }

        enrollment.EnrollmentJson = request.EnrollmentJson;
        enrollment.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(request.EventId, cancellationToken);

        return AppResult<EventEnrollmentDto>.Success(ToDto(enrollment));
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

    private static EventEnrollmentDto ToDto(EventEnrollment enrollment) =>
        new(
            enrollment.Id,
            enrollment.GroupId,
            enrollment.EventId,
            enrollment.MemberId,
            enrollment.EnrollmentJson,
            enrollment.CreatedUtc,
            enrollment.UpdatedUtc);
}
