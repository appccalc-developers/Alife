using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
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

        var canViewAllEnrollments = await new EventEnrollmentCapacityService(dbContext, groupAuthorizationService)
            .CanManageAsync(groupEvent, request.CurrentMemberId, cancellationToken);
        var rows = await dbContext.EventEnrollments.AsNoTracking().Where(x => x.EventId == request.EventId).ToListAsync(cancellationToken);
        var enrollments = rows.Where(x => canViewAllEnrollments || x.MemberId == request.CurrentMemberId)
            .OrderBy(x => x.QueuedUtc ?? x.CreatedUtc).ThenBy(x => x.Id)
            .Select(x => EventEnrollmentCapacityService.ToDto(x, rows)).ToArray();
        return AppResult<IReadOnlyList<EventEnrollmentDto>>.Success(enrollments);
    }
}
