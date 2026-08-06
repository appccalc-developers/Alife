using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.ListEventEnrollments;

public sealed class ListEventEnrollmentsQueryHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<ListEventEnrollmentsQuery, AppResult<IReadOnlyList<EventEnrollmentDto>>>
{
    public async Task<AppResult<IReadOnlyList<EventEnrollmentDto>>> Handle(
        ListEventEnrollmentsQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<IReadOnlyList<EventEnrollmentDto>>.NotFound("Event not found.");
        }

        var isApprovedMember = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!isApprovedMember)
        {
            return AppResult<IReadOnlyList<EventEnrollmentDto>>.Forbidden("You must be an approved member to view enrollments.");
        }

        var canViewAllEnrollments = groupEvent.CreatedByMemberId == request.CurrentMemberId ||
            await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                groupEvent.GroupId,
                request.CurrentMemberId,
                cancellationToken);

        var enrollmentQuery = dbContext.EventEnrollments
            .AsNoTracking()
            .Where(x => x.EventId == request.EventId);

        if (!canViewAllEnrollments)
        {
            enrollmentQuery = enrollmentQuery.Where(x => x.MemberId == request.CurrentMemberId);
        }

        var enrollments = await enrollmentQuery
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new EventEnrollmentDto(
                x.Id,
                x.GroupId,
                x.EventId,
                x.MemberId,
                x.EnrollmentJson,
                x.CreatedUtc,
                x.UpdatedUtc))
            .ToListAsync(cancellationToken);

        return AppResult<IReadOnlyList<EventEnrollmentDto>>.Success(enrollments);
    }
}
