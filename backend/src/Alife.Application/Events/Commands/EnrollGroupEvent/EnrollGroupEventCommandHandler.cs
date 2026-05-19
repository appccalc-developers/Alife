using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.EnrollGroupEvent;

public sealed class EnrollGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<EnrollGroupEventCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(EnrollGroupEventCommand request, CancellationToken cancellationToken)
    {
        var canEnroll = await groupAuthorizationService.IsApprovedMemberAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canEnroll)
        {
            return AppResult<EventEnrollmentDto>.Forbidden("Only approved group members can enroll in events.");
        }

        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == request.EventId && x.GroupId == request.GroupId,
                cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Event not found.");
        }

        var now = DateTime.UtcNow;
        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(
                x => x.GroupId == request.GroupId &&
                     x.EventId == request.EventId &&
                     x.MemberId == request.CurrentMemberId,
                cancellationToken);

        if (enrollment is null)
        {
            enrollment = new EventEnrollment
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                EventId = request.EventId,
                MemberId = request.CurrentMemberId,
                EnrollmentJson = request.EnrollmentJson,
                CreatedUtc = now,
                UpdatedUtc = now,
            };
            dbContext.EventEnrollments.Add(enrollment);
        }
        else
        {
            enrollment.EnrollmentJson = request.EnrollmentJson;
            enrollment.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);

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
