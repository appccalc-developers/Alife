using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.CreateEventEnrollment;

public sealed class CreateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<CreateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(
        CreateEventEnrollmentCommand request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Event not found.");
        }

        var canEnroll = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canEnroll)
        {
            return AppResult<EventEnrollmentDto>.Forbidden("You must be an approved member to enroll.");
        }

        var existingEnrollment = await dbContext.EventEnrollments
            .AsNoTracking()
            .AnyAsync(x => x.EventId == request.EventId && x.MemberId == request.CurrentMemberId, cancellationToken);

        if (existingEnrollment)
        {
            return AppResult<EventEnrollmentDto>.Conflict("Enrollment already exists for this event and member.");
        }

        if (request.RequestedId.HasValue)
        {
            var idAlreadyExists = await dbContext.EventEnrollments
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.RequestedId.Value, cancellationToken);

            if (idAlreadyExists)
            {
                return AppResult<EventEnrollmentDto>.Conflict("Enrollment id already exists.");
            }
        }

        var now = DateTime.UtcNow;
        var enrollment = new EventEnrollment
        {
            Id = request.RequestedId ?? Guid.NewGuid(),
            GroupId = groupEvent.GroupId,
            EventId = request.EventId,
            MemberId = request.CurrentMemberId,
            EnrollmentJson = request.EnrollmentJson,
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.EventEnrollments.Add(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(request.EventId, cancellationToken);

        return AppResult<EventEnrollmentDto>.Success(ToDto(enrollment));
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
