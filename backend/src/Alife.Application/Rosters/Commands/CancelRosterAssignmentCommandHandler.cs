using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Rosters.Commands;

public sealed class CancelRosterAssignmentCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<CancelRosterAssignmentCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(CancelRosterAssignmentCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await RosterPolicy.GetManagedEventAsync(db, authorization, request.EventId, request.CurrentMemberId, cancellationToken);
        if (groupEvent is null) return AppResult<bool>.Forbidden("Event not found or roster permission denied.");
        var assignment = await db.EventRosterAssignments.Include(x => x.Shift)
            .FirstOrDefaultAsync(x => x.Id == request.AssignmentId && x.Shift.EventId == groupEvent.Id, cancellationToken);
        if (assignment is null) return AppResult<bool>.NotFound("Roster assignment not found.");
        assignment.Status = EventRosterAssignmentStatus.Cancelled;
        assignment.UpdatedUtc = DateTime.UtcNow;
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, TargetMemberId = assignment.MemberId,
            Action = "roster.assignment.cancelled", EntityType = "eventRosterAssignment", EntityId = assignment.Id,
            OccurredUtc = assignment.UpdatedUtc
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }
}
