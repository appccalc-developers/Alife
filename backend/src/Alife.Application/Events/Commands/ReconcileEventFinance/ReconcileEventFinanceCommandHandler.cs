using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.ReconcileEventFinance;

public sealed class ReconcileEventFinanceCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<ReconcileEventFinanceCommand, AppResult<EventFinanceReconciliationDto>>
{
    public async Task<AppResult<EventFinanceReconciliationDto>> Handle(ReconcileEventFinanceCommand request, CancellationToken cancellationToken)
    {
        if (request.NotesEn.Length > 2000 || request.NotesZh.Length > 2000)
            return AppResult<EventFinanceReconciliationDto>.Validation("Reconciliation notes cannot exceed 2,000 characters per language.");
        var groupEvent = await db.GroupEvents.Include(x => x.FinanceReconciliation).Include(x => x.ClosureReport)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventFinanceReconciliationDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventFinanceReconciliationDto>.Forbidden("Only event leaders can reconcile event finances.");
        if (!EventFinancePolicy.IsEnabled(groupEvent))
            return AppResult<EventFinanceReconciliationDto>.Conflict("Add finance to this event plan before reconciling actual finances.");
        if (request.LeaderConfirmed && groupEvent.EndDate > DateTime.UtcNow)
            return AppResult<EventFinanceReconciliationDto>.Validation("Actual finances can be confirmed only after the event has ended.");
        if (request.LeaderConfirmed && (string.IsNullOrWhiteSpace(request.NotesEn) || string.IsNullOrWhiteSpace(request.NotesZh)))
            return AppResult<EventFinanceReconciliationDto>.Validation("Add reconciliation notes in both languages before confirming.");

        var now = DateTime.UtcNow;
        var reconciliation = groupEvent.FinanceReconciliation ?? new EventFinanceReconciliation { EventId = groupEvent.Id };
        if (groupEvent.FinanceReconciliation is null) db.EventFinanceReconciliations.Add(reconciliation);
        reconciliation.NotesEn = request.NotesEn.Trim();
        reconciliation.NotesZh = request.NotesZh.Trim();
        reconciliation.LeaderConfirmed = request.LeaderConfirmed;
        reconciliation.ConfirmedByMemberId = request.LeaderConfirmed ? request.CurrentMemberId : null;
        reconciliation.ConfirmedUtc = request.LeaderConfirmed ? now : null;
        reconciliation.UpdatedUtc = now;
        if (groupEvent.ClosureReport is not null)
        {
            groupEvent.ClosureReport.LeaderConfirmed = false;
            groupEvent.ClosureReport.ConfirmedByMemberId = null;
            groupEvent.ClosureReport.ConfirmedUtc = null;
            groupEvent.ClosureReport.UpdatedUtc = now;
        }
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, Action = request.LeaderConfirmed ? "event.finance.reconciled" : "event.finance.reconciliation.saved",
            EntityType = nameof(EventFinanceReconciliation), EntityId = groupEvent.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            AfterJson = JsonSerializer.Serialize(new { reconciliation.LeaderConfirmed }), OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventFinanceReconciliationDto>.Success(new EventFinanceReconciliationDto(
            new WorkflowTextDto(reconciliation.NotesEn, reconciliation.NotesZh), reconciliation.LeaderConfirmed,
            reconciliation.ConfirmedByMemberId, request.LeaderConfirmed ? (await db.Members.AsNoTracking().Where(x => x.Id == request.CurrentMemberId).Select(x => x.DisplayName).FirstOrDefaultAsync(cancellationToken)) : null,
            reconciliation.ConfirmedUtc, reconciliation.UpdatedUtc));
    }
}
