using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Commands.SaveEventFinanceEntry;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.DeleteEventFinanceEntry;

public sealed class DeleteEventFinanceEntryCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<DeleteEventFinanceEntryCommand, AppResult<bool>>
{
    public async Task<AppResult<bool>> Handle(DeleteEventFinanceEntryCommand request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.Include(x => x.FinanceReconciliation).Include(x => x.ClosureReport)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<bool>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<bool>.Forbidden("Only event leaders can remove actual finance entries.");
        if (!EventFinancePolicy.IsEnabled(groupEvent))
            return AppResult<bool>.Conflict("Add finance to this event plan before changing actual finances.");
        var entry = await db.EventFinanceEntries.FirstOrDefaultAsync(x => x.Id == request.EntryId && x.EventId == groupEvent.Id, cancellationToken);
        if (entry is null) return AppResult<bool>.NotFound("Finance entry not found.");
        var now = DateTime.UtcNow;
        db.EventFinanceEntries.Remove(entry);
        SaveEventFinanceEntryCommandHandler.InvalidateConfirmations(groupEvent, now);
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, Action = "event.finance.actual.deleted",
            EntityType = nameof(EventFinanceEntry), EntityId = entry.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            BeforeJson = JsonSerializer.Serialize(new { entry.Type, entry.Category, entry.Amount, entry.OccurredUtc }), OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<bool>.Success(true);
    }
}
